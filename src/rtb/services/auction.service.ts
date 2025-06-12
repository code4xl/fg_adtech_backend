import { Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuctionStatusDto } from '../dto';
import { BidRequestWithAuction } from '../types/bid-request.types';
import { CAMPAIGN_KEYS, RTB_CACHE_TTL, RTB_KEYS } from '../constants/cache-keys';
import { RedisService } from 'src/redis/redis.service';
import { CampaignEligibilityService } from './campaign-eligibility.service';
import { CampaignWithTargeting } from '../types/campaign.types';
import { BidEvaluationService } from './bid-evaluation.service';
import { CreativeWithTemplate } from '../types/creative.types';
import { ConfigService } from '@nestjs/config';
import { CreatedBidResponse } from '../types/bid-response.types';
import { AuctionBidResult } from '../types/auction-result.types';

export class AuctionService {
  private readonly logger = new Logger(AuctionService.name);
  private readonly trackingBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly campaignEligibility: CampaignEligibilityService,
    private readonly bidEvaluationService: BidEvaluationService,
    private readonly config: ConfigService,
  ) {
    this.trackingBaseUrl =
      this.config.get<string>('template.url') ||
      'https://track.oceanadtech.com';
  }

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


  async findEligibleCampaigns(bidRequest: BidRequestWithAuction): Promise<CampaignWithTargeting[]> {
    const cacheKey = CAMPAIGN_KEYS.ELIGIBLE_CAMPAIGNS(
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
      await this.redis.set(cacheKey, JSON.stringify(eligibleCampaigns), RTB_CACHE_TTL.CAMPAIGN_ELIGIBILITY);

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
        // 1. Check budget availability
        const hasBudget =
          await this.campaignEligibility.checkBudgetAvailability(campaign.id);
        if (!hasBudget) {
          this.logger.debug('Campaign excluded due to budget exhaustion', {
            campaignId: campaign.id,
          });
          return null;
        }

        // 2. Calculate bid price
        const bidPrice = await this.bidEvaluationService.calculateBidPrice(
          campaign,
          bidRequest,
        );

        // 3. Apply floor price check
        if (bidRequest.floorPrice && bidPrice < bidRequest.floorPrice) {
          this.logger.debug('Bid below floor price', {
            campaignId: campaign.id,
            bidPrice,
            floorPrice: bidRequest.floorPrice,
          });
          return null;
        }

        // 4. Select appropriate creative
        const creative = await this.selectCreative(
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
          bidPrice,
          auctionId,
        );
      } catch (error) {
        this.logger.warn('Failed to generate bid for campaign', {
          campaignId: campaign.id,
          error: error.message,
        });
        return null;
      }
    });

    const bidResults = await Promise.all(bidPromises);
    return bidResults.filter((bid) => bid !== null);
  }

  private async selectCreative(
    campaign: CampaignWithTargeting,
    adSlotContext: any,
  ): Promise<CreativeWithTemplate> {
    try {
      // Find creative that matches ad slot requirements
      const creative = await this.prisma.creative.findFirst({
        where: {
          campaignId: campaign.id,
          status: 'APPROVED',
          adSlotTemplate: {
            width: adSlotContext.width,
            height: adSlotContext.height,
            format: adSlotContext.format,
          },
        },
        include: {
          adSlotTemplate: true,
        },
      });

      return creative;
    } catch (error) {
      this.logger.error('Failed to select creative', {
        campaignId: campaign.id,
        error: error.message,
      });
      return null;
    }
  }

  private async createBidResponse(
    bidRequest: BidRequestWithAuction,
    campaign: CampaignWithTargeting,
    creative: CreativeWithTemplate,
    bidPrice: number,
    auctionId: string,
  ): Promise<any> {
    // Generate comprehensive tracking URLs
    const trackingUrls = this.generateTrackingUrls(auctionId);

    // Generate comprehensive ad markup
    const adMarkup = this.generateAdMarkup(creative, trackingUrls, {
      width: bidRequest.adSlotContext.width,
      height: bidRequest.adSlotContext.height,
      format: bidRequest.adSlotContext.format,
    });

    this.logger.debug('Creating bid response', {
      id: bidRequest.id,
    });

    // Ask mit about this, store the admarkup, impression and click urls in the bid response for the winner only.
    // Not for all the bids. (This is to avoid storing unnecessary data for lost bids)
    return await this.prisma.bidResponse.create({
      data: {
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

  generateTrackingUrls(
    auctionId: string,
    bidResponseId?: string,
  ): {
    impression: string[];
    click: string[];
  } {
    const baseUrl = this.trackingBaseUrl;

    if (bidResponseId) {
      // Detailed tracking with bidResponseId and timestamp
      return {
        impression: [
          `${baseUrl}/track/impression/${bidResponseId}?auction=${auctionId}&t=${Date.now()}`,
        ],
        click: [
          `${baseUrl}/track/click/${bidResponseId}?auction=${auctionId}&t=${Date.now()}`,
        ],
      };
    } else {
      // Simple tracking for backward compatibility
      return {
        impression: [`${baseUrl}/track/impression/${auctionId}`],
        click: [`${baseUrl}/track/click/${auctionId}`],
      };
    }
  }

  generateAdMarkup(
    creative: any,
    trackingUrls: { impression: string[]; click: string[] },
    context: {
      width: number;
      height: number;
      format?: string;
    },
  ): string {
    const { width, height, format } = context;
    const impressionUrl = trackingUrls.impression[0];
    const clickUrl = trackingUrls.click[0];

    // Determine format from creative or context
    const creativeFormat =
      format || creative.adSlotTemplate?.format || 'BANNER';

    // Generate markup based on creative type
    switch (creativeFormat) {
      case 'BANNER':
        return this.generateBannerMarkup(
          creative,
          width,
          height,
          impressionUrl,
          clickUrl,
        );

      case 'NATIVE':
        return this.generateNativeMarkup(creative, impressionUrl, clickUrl);

      case 'VIDEO':
        return this.generateVideoMarkup(
          creative,
          width,
          height,
          impressionUrl,
          clickUrl,
        );

      default:
        return this.generateDefaultMarkup(
          creative,
          width,
          height,
          impressionUrl,
          clickUrl,
        );
    }
  }

  private generateBannerMarkup(
    creative: any,
    width: number,
    height: number,
    impressionUrl: string,
    clickUrl: string,
  ): string {
    return `
        <div class="ocean-ad-container" style="width: ${width}px; height: ${height}px; position: relative; overflow: hidden;">
            <a href="${clickUrl}&url=${encodeURIComponent(creative.landingUrl)}" target="_blank" style="display: block; width: 100%; height: 100%;">
                <img src="${creative.fileUrl}" 
                     alt="${creative.name}"
                     style="width: 100%; height: 100%; object-fit: cover;" />
            </a>
            <img src="${impressionUrl}" style="position: absolute; width: 1px; height: 1px; opacity: 0;" alt="" />
        </div>
        `.trim();
  }

  private generateNativeMarkup(
    creative: any,
    impressionUrl: string,
    clickUrl: string,
  ): string {
    return `
        <div class="ocean-native-ad">
            <div class="ocean-native-content">
                <h3 class="ocean-native-title">${creative.title || creative.name}</h3>
                <p class="ocean-native-description">${creative.description || ''}</p>
                <a href="${clickUrl}&url=${encodeURIComponent(creative.landingUrl)}" target="_blank" class="ocean-native-cta">
                    Learn More
                </a>
            </div>
            <img src="${impressionUrl}" style="display: none;" alt="" />
        </div>
        `.trim();
  }

  private generateVideoMarkup(
    creative: any,
    width: number,
    height: number,
    impressionUrl: string,
    clickUrl: string,
  ): string {
    return `
        <div class="ocean-video-ad" style="width: ${width}px; height: ${height}px; position: relative;">
            <video width="${width}" height="${height}" controls autoplay muted>
                <source src="${creative.fileUrl}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
            <div class="ocean-video-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;">
                <a href="${clickUrl}&url=${encodeURIComponent(creative.landingUrl)}" target="_blank" 
                   style="position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; padding: 5px 10px; text-decoration: none; pointer-events: auto;">
                    Learn More
                </a>
            </div>
            <img src="${impressionUrl}" style="display: none;" alt="" />
        </div>
        `.trim();
  }

  private generateDefaultMarkup(
    creative: any,
    width: number,
    height: number,
    impressionUrl: string,
    clickUrl: string,
  ): string {
    return `
        <div class="ocean-ad" style="width: ${width}px; height: ${height}px;">
            <a href="${clickUrl}&url=${encodeURIComponent(creative.landingUrl)}" target="_blank">
                <img src="${creative.fileUrl}" 
                     alt="${creative.name}"
                     style="width: 100%; height: 100%;" />
            </a>
            <img src="${impressionUrl}" style="display: none;" alt="" />
        </div>
        `.trim();
  }

  async getFormattedDate() {
    const now = new Date();

    const pad = (num) => String(num).padStart(2, '0');

    const day = pad(now.getDate());
    const month = pad(now.getMonth() + 1); // Months are 0-indexed
    const year = now.getFullYear();
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    const seconds = pad(now.getSeconds());

    return `${day}/${month}/${year}_${hours}:${minutes}:${seconds}`;
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

    const date = await this.getFormattedDate();

    this.redis.setWinner(
      RTB_KEYS.WINNER_BID_REQUEST(winningBid.campaignId, date),
      JSON.stringify({
        winningBidId: winningBid.id,
        campaignId: winningBid.campaignId,
        creativeId: winningBid.creativeId,
        bidPrice: winningBid.bidPrice,
        winningPrice: finalPrice,
        auctionType,
        bidStatus: 'WON',
        totalBids: bidResponses.length,
        validBids: bidResponses.length,
        auctionId: bidRequest.auctionId,
      }),
      60 * 60 * 24,
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
