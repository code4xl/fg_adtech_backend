import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuctionStatusDto } from '../dto';
import { BidRequestWithAuction } from '../types/bid-request.types';
import { REDIS_KEYS, RTB_CACHE_TTL } from '../constants/cache-keys';
import { RedisService } from 'src/redis/redis.service';
import { CampaignEligibilityService } from './campaign-eligibility.service';
import { CampaignWithTargeting } from '../types/campaign.types';
import { BidEvaluationService } from './bid-evaluation.service';
import { CreativeWithTemplate } from '../types/creative.types';
import { CreatedBidResponse } from '../types/bid-response.types';
import { AuctionBidResult } from '../types/auction-result.types';
import { v4 as uuidv4 } from 'uuid';
import { BudgetValidationService } from 'src/tracking/services/budget-validation.service';
import { AdMarkupService } from './ad-markup.service';
import { CreativeSelectionService } from './creative-selection.service';
import { BudgetManagerService } from './budget-manager.service';

@Injectable()
export class AuctionService {
  private readonly logger = new Logger(AuctionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly campaignEligibility: CampaignEligibilityService,
    private readonly bidEvaluationService: BidEvaluationService,
    private readonly creativeSelectionService: CreativeSelectionService,
    private readonly budgetValidationService: BudgetValidationService,
    private readonly adMarkupService: AdMarkupService,
    private readonly budgetManagerService: BudgetManagerService,
  ) {}

  async getAuctionStatus(requestId: string): Promise<AuctionStatusDto | null> {
    try {
      // Get bid request with auction log
      const bidRequest = await this.prisma.bidRequest.findFirst({
        where: {
          id: requestId,
        },
        include: {
          auctionLog: true,
          bidResponses: {
            include: {
              campaign: {
                select: {
                  name: true,
                  advertiser: {
                    select: { name: true },
                  },
                },
              },
              creative: {
                select: { name: true },
              },
            },
          },
        },
      });

      if (!bidRequest) {
        return null;
      }
      this.logger.debug('Retrieved bid request for auction status', {
        requestId,
        bidRequest,
      });
      // Determine current stage and status
      let stage: string;
      let status: string;

      if (!bidRequest.auctionLog) {
        this.logger.debug('Auction log not found, checking eligibility', {
          requestId,
        });
        stage = 'eligibility_check';
        status = 'processing';
      } else {
        this.logger.debug('Auction log found, determining stage', {
          requestId,
          auctionLog: bidRequest.auctionLog,
        });
        stage = 'auction_complete';
        status = bidRequest.auctionLog.status.toLowerCase();
      }

      // Build metrics
      const metrics = {
        processingStarted: bidRequest.requestTimestamp.toISOString(),
        eligibleCampaigns: bidRequest.bidResponses.length,
        totalBids: bidRequest.auctionLog?.totalBids || 0,
        auctionDuration: bidRequest.auctionLog?.auctionDuration
          ? `${bidRequest.auctionLog.auctionDuration}ms`
          : 'unknown',
        cacheHitRate: '85%', // TODO: Implement actual cache hit tracking
      };

      // Find winner information
      let winner = undefined;
      if (status === 'completed') {
        const winningBid = bidRequest.bidResponses.find(
          (bid) => bid.status === 'WON',
        );
        if (winningBid) {
          winner = {
            campaignId: winningBid.campaignId,
            advertiserName: winningBid.campaign.advertiser.name,
            bidPrice: Number(winningBid.bidPrice),
            finalPrice: Number(winningBid.finalPrice || winningBid.bidPrice),
            creativeId: winningBid.creativeId,
          };
        }
      }

      return {
        requestId,
        status,
        stage,
        metrics,
        winner,
      };
    } catch (error) {
      this.logger.error('Failed to get auction status', {
        error: error.message,
        requestId,
      });
      throw error;
    }
  }

  async findEligibleCampaigns(
    bidRequest: BidRequestWithAuction,
  ): Promise<CampaignWithTargeting[]> {
    const cacheKey = REDIS_KEYS.ELIGIBLE_CAMPAIGNS(
      bidRequest.inventoryId,
      bidRequest.userContext.deviceType,
    );

    try {
      // 1. Check Redis cache first
      const cached = await this.redis.get<string>(cacheKey);
      if (cached) {
        this.logger.debug('Campaign eligibility cache hit', {
          inventoryId: bidRequest.inventoryId,
        });
        return JSON.parse(cached);
      }

      this.logger.debug('Campaign eligibility cache miss, querying database', {
        inventoryId: bidRequest.inventoryId,
      });

      // 2. Get eligible campaigns from database with targeting rules
      const eligibleCampaigns =
        await this.campaignEligibility.getEligibleCampaigns(
          bidRequest.inventoryId,
          bidRequest.userContext,
          bidRequest.adSlotContext,
        );

      // 3. Cache results for 5 minutes
      await this.redis.set(
        cacheKey,
        JSON.stringify(eligibleCampaigns),
        RTB_CACHE_TTL.CAMPAIGN_ELIGIBILITY,
      );

      return eligibleCampaigns;
    } catch (error) {
      this.logger.error('Failed to find eligible campaigns', {
        error: error.message,
        inventoryId: bidRequest.inventoryId,
      });
      return [];
    }
  }

  async generateBidResponses(
    bidRequest: BidRequestWithAuction,
    eligibleCampaigns: CampaignWithTargeting[],
    auctionId: string,
  ): Promise<CreatedBidResponse[]> {
    const bidPromises = eligibleCampaigns.map(async (campaign) => {
      try {
        // 1. Calculate actual bid price first
        const actualBidPrice =
          await this.bidEvaluationService.calculateBidPrice(
            campaign,
            bidRequest,
          );

        // 2.  PRECISE budget validation with actual calculated bid
        const costPerImpression = actualBidPrice / 1000; // Convert CPM to per-impression
        const hasBudget =
          await this.budgetValidationService.validateCampaignBudget(
            campaign.id,
            costPerImpression,
          );

        if (!hasBudget) {
          this.logger.debug(
            'Campaign excluded: insufficient budget for actual bid',
            {
              campaignId: campaign.id,
              actualBidPriceCPM: actualBidPrice,
              costPerImpression: costPerImpression,
            },
          );
          return null;
        }

        this.logger.debug('Campaign passed precise budget validation', {
          campaignId: campaign.id,
          actualBidPriceCPM: actualBidPrice,
          costPerImpression: costPerImpression,
        });

        // 3. Apply floor price check
        if (bidRequest.floorPrice && actualBidPrice < bidRequest.floorPrice) {
          this.logger.debug('Bid below floor price', {
            campaignId: campaign.id,
            actualBidPrice,
            floorPrice: bidRequest.floorPrice,
          });
          return null;
        }

        // 4. Select appropriate creative
        const creative = await this.creativeSelectionService.selectCreative(
          campaign,
          bidRequest.adSlotContext,
        );
        if (!creative) {
          this.logger.debug('No matching creative found', {
            campaignId: campaign.id,
          });
          return null;
        }

        // 5. Create bid response
        return await this.createBidResponse(
          bidRequest,
          campaign,
          creative,
          actualBidPrice,
          auctionId,
        );
      } catch (error) {
        this.logger.warn('Failed to generate bid for campaign', {
          campaignId: campaign.id,
          error: error,
        });
        return null;
      }
    });

    const bidResults = await Promise.all(bidPromises);
    return bidResults.filter((bid) => bid !== null);
  }

  private async createBidResponse(
    bidRequest: BidRequestWithAuction,
    campaign: CampaignWithTargeting,
    creative: CreativeWithTemplate,
    bidPrice: number,
    auctionId: string,
  ): Promise<any> {
    let bidResponseId = uuidv4();

    // Generate comprehensive tracking URLs
    const trackingUrls = this.adMarkupService.generateTrackingUrls(
      auctionId,
      bidResponseId,
    );

    // Generate comprehensive ad markup
    const adMarkup = this.adMarkupService.generateAdMarkup(
      creative,
      trackingUrls,
      {
        width: bidRequest.adSlotContext.width,
        height: bidRequest.adSlotContext.height,
        format: bidRequest.adSlotContext.format,
      },
    );

    // this.logger.debug('Creating bid response', {
    //   id: bidResponseId,
    // });

    // Ask mit about this, store the admarkup, impression and click urls in the bid response for the winner only.
    // Not for all the bids. (This is to avoid storing unnecessary data for lost bids)
    return await this.prisma.bidResponse.create({
      data: {
        id: bidResponseId,
        bidRequestId: bidRequest.id,
        campaignId: campaign.id,
        creativeId: creative.id,
        advertiserId: campaign.advertiserId,
        bidPrice,
        currency: 'INR',
        status: 'PENDING',
        adMarkup,
        impressionUrls: trackingUrls.impression,
        clickUrls: trackingUrls.click,
        landingUrl: creative.landingUrl,
      },
    });
  }

  async runAuction(
    bidResponses: CreatedBidResponse[],
    bidRequest: BidRequestWithAuction,
  ): Promise<AuctionBidResult> {
    // Sort bids by price (descending)
    const sortedBids = bidResponses.sort(
      (a, b) => Number(b.bidPrice) - Number(a.bidPrice),
    );

    const winningBid = sortedBids[0];
    const auctionType = bidRequest.auctionType || 'SECOND_PRICE';

    let finalPrice: number;

    if (auctionType === 'FIRST_PRICE') {
      // Winner pays their bid
      finalPrice = Number(winningBid.bidPrice);
    } else {
      // Second-price auction: winner pays second highest + $0.01
      if (sortedBids.length > 1) {
        finalPrice = Number(sortedBids[1].bidPrice) + 0.01;
      } else {
        // Only one bid, use floor price or minimum
        finalPrice = bidRequest.floorPrice
          ? Math.max(Number(bidRequest.floorPrice), 0.01)
          : 0.01;
      }
    }

    this.logger.debug('Auction completed', {
      auctionType,
      winningBid: Number(winningBid.bidPrice),
      finalPrice,
      totalBids: bidResponses.length,
    });

    winningBid.finalPrice = finalPrice;
    winningBid.status = 'WON';
    await this.budgetManagerService.reserveBudgetOnWin(
      winningBid,
      bidRequest.publisherId,
      bidRequest.inventoryId,
      bidRequest.websiteId,
      bidRequest.auctionId,
      finalPrice,
    );
    // sync winning bid response to redis
    const winningBidCache = {
      bidResponseId: winningBid.id,
      creativeId: winningBid.creativeId,
      campaignId: winningBid.campaignId,
      advertiserId: winningBid.advertiserId,
      inventoryId: bidRequest.inventoryId,
      publisherId: bidRequest.publisherId,
      websiteId: bidRequest.websiteId,
      templateId: bidRequest.adSlotContext.adSlotTemplateId,
      bidPrice: parseFloat(winningBid.bidPrice.toString()),
      finalPrice: parseFloat(finalPrice.toString()),
      landingUrl: winningBid.landingUrl,
    };
    this.redis.set(
      REDIS_KEYS.BID_RESPONSE(winningBid.id),
      JSON.stringify(winningBidCache),
      3600, // Set TTL for 1 hour
    );
    // Update all other bids to LOST
    await this.updateBidResponseStatuses(
      bidResponses,
      winningBid.id,
      finalPrice,
    );

    this.logger.debug('Bid Request Timestamp', {
      requestTimestamp: bidRequest.requestTimestamp,
      responseTimestamp: Date.now(),
      requestTimestampType: typeof bidRequest.requestTimestamp,
      converted: new Date(bidRequest.requestTimestamp).getTime(),
    });

    winningBid.responseLatency =
      Date.now() - new Date(bidRequest.requestTimestamp).getTime();

    winningBid.processedAt = new Date();

    if (winningBid) {
      this.logger.debug('Auction win recorded successfully', {
        campaignId: winningBid.campaignId,
      });
    }

    return {
      winner: {
        id: winningBid.id,
        campaignId: winningBid.campaignId,
        creativeId: winningBid.creativeId,
        advertiserId: winningBid.advertiserId,
        bidPrice: Number(winningBid.bidPrice),
        finalPrice: Number(finalPrice),
        status: 'WON',
        responseLatency: winningBid.responseLatency,
        processedAt: winningBid.processedAt?.getTime(),
        currency: winningBid.currency,
        adMarkup: winningBid.adMarkup,
        impressionUrls: winningBid.impressionUrls,
        clickUrls: winningBid.clickUrls,
        landingUrl: winningBid.landingUrl,
      },
      winnerId: winningBid.id,
      finalPrice,
      auctionType,
      auctionId: bidRequest.auctionId,
      auctionStatus: 'COMPLETED',
      totalBids: bidResponses.length,
      validBids: bidResponses.length,
      processingTime: winningBid.responseLatency,
      originalBidRequest: bidRequest,
      processedAt: winningBid.processedAt?.toISOString(),
      floorPrice: bidRequest.floorPrice,
    };
  }

  private async updateBidResponseStatuses(
    bidResponses: CreatedBidResponse[],
    winnerId: string,
    finalPrice: number,
  ): Promise<void> {
    try {
      // Update winner
      await this.prisma.bidResponse.update({
        where: { id: winnerId },
        data: {
          finalPrice,
          cpi: finalPrice / 1000, // Assuming finalPrice is in CPM, convert to CPI
          status: 'WON',
          processedAt: new Date(),
        },
      });

      // Update losers
      const loserIds = bidResponses
        .filter((bid) => bid.id !== winnerId)
        .map((bid) => bid.id);

      if (loserIds.length > 0) {
        await this.prisma.bidResponse.updateMany({
          where: { id: { in: loserIds } },
          data: {
            status: 'LOST',
            processedAt: new Date(),
          },
        });
      }
    } catch (error) {
      this.logger.error('Failed to update bid response statuses', {
        error: error.message,
        winnerId,
      });
    }
  }
}
