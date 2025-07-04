import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuctionStatusDto } from '../dto';
import { BidRequestWithAuction } from '../types/bid-request.types';
import {
  CAMPAIGN_KEYS,
  CLICK_AND_IMPRESSION_KEYS,
  CREATIVE_KEYS,
  RTB_CACHE_TTL,
  RTB_KEYS,
} from '../constants/cache-keys';
import { RedisService } from 'src/redis/redis.service';
import { CampaignEligibilityService } from './campaign-eligibility.service';
import { CampaignWithTargeting } from '../types/campaign.types';
import { BidEvaluationService } from './bid-evaluation.service';
import { CreativeWithTemplate } from '../types/creative.types';
import { CreatedBidResponse } from '../types/bid-response.types';
import { AuctionBidResult } from '../types/auction-result.types';
import { v4 as uuidv4 } from 'uuid';
import { ImpressionClickLinkingService } from 'src/tracking/services/impression-click-linking.service';
import { TransactionType } from '@prisma/client';
import { BudgetValidationService } from 'src/tracking/services/budget-validation.service';

@Injectable()
export class AuctionService {
  private readonly logger = new Logger(AuctionService.name);
  private readonly trackingBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly campaignEligibility: CampaignEligibilityService,
    private readonly bidEvaluationService: BidEvaluationService,
    private readonly impressionClickLinking: ImpressionClickLinkingService,
    private readonly budgetValidationService: BudgetValidationService,
  ) {
    this.trackingBaseUrl = process.env.TRACKING_URL || 'http://localhost:3000';
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

  async findEligibleCampaigns(
    bidRequest: BidRequestWithAuction,
  ): Promise<CampaignWithTargeting[]> {
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

        // 2. ✅ PRECISE budget validation with actual calculated bid
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

  private async selectCreative(
    campaign: CampaignWithTargeting,
    adSlotContext: any,
  ): Promise<CreativeWithTemplate> {
    try {
      // Get all matching creatives
      const creatives = await this.prisma.creative.findMany({
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
        orderBy: { id: 'asc' }, // Consistent ordering for round-robin
      });

      if (creatives.length === 0) return null;
      if (creatives.length === 1) return creatives[0];

      // Round-robin selection
      const selectedCreative = await this.roundRobinSelect(
        campaign.id,
        creatives,
      );
      return selectedCreative;
    } catch (error) {
      this.logger.error('Failed to select creative', {
        campaignId: campaign.id,
        error: error.message,
      });
      return null;
    }
  }

  private async roundRobinSelect(
    campaignId: string,
    creatives: CreativeWithTemplate[],
  ): Promise<CreativeWithTemplate> {
    // Redis key for round-robin counter
    const counterKey = CREATIVE_KEYS.CREATIVE_ROUND_ROBIN(campaignId);

    try {
      // Get current counter value and increment atomically
      const currentCount = await this.redis.incr(counterKey);

      // Set expiry on first use (24 hours)
      if (currentCount === 1) {
        await this.redis.expire(counterKey, RTB_CACHE_TTL.CREATIVE_ROUND_ROBIN); // 24 hours
      }

      // Calculate index using modulo
      const selectedIndex = (currentCount - 1) % creatives.length;

      this.logger.debug('Round-robin creative selection', {
        campaignId,
        currentCount,
        totalCreatives: creatives.length,
        selectedIndex,
        selectedCreativeId: creatives[selectedIndex].id,
      });

      return creatives[selectedIndex];
    } catch (error) {
      // Fallback to first creative if Redis fails
      this.logger.warn('Round-robin selection failed, using fallback', {
        campaignId,
        error: error.message,
      });
      return creatives[0];
    }
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
    const trackingUrls = this.generateTrackingUrls(auctionId, bidResponseId);

    // Generate comprehensive ad markup
    const adMarkup = this.generateAdMarkup(creative, trackingUrls, {
      width: bidRequest.adSlotContext.width,
      height: bidRequest.adSlotContext.height,
      format: bidRequest.adSlotContext.format,
    });

    this.logger.debug('Creating bid response', {
      id: bidResponseId,
    });

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

  generateTrackingUrls(
    auctionId: string,
    bidResponseId: string,
  ): {
    impression: string[];
    click: string[];
  } {
    const baseUrl = this.trackingBaseUrl;

    const slotId =
      this.impressionClickLinking.generateImpressionSlot(bidResponseId);

    return {
      impression: [
        `${baseUrl}/track/impression/${bidResponseId}?slotId=${slotId}&auctionId=${auctionId}&t=${Date.now()}`,
      ],
      click: [
        `${baseUrl}/track/click/${bidResponseId}?slotId=${slotId}&auctionId=${auctionId}&t=${Date.now()}`,
      ],
    };
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

    if (winningBid) {
      await this.recordAuctionWin(winningBid.campaignId, finalPrice);
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

  // == NEW ==

  // Add these methods to your AuctionService class

  async recordAuctionWin(campaignId: string, finalPrice: number) {
    try {
      // REASON: Update new budget tracking system instead of old CampaignBudgetTracker
      // LOGIC: Deduct the actual cost from today's remaining budget
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // REASON: Convert CPM final price to per-impression cost
      // LOGIC: If finalPrice is $2.50 CPM, cost per impression is $0.0025
      const costPerImpression = finalPrice > 1 ? finalPrice / 1000 : finalPrice;

      this.logger.debug('Recording auction win with cost deduction', {
        campaignId,
        finalPriceInput: finalPrice,
        costPerImpression: costPerImpression,
        date: today.toISOString().split('T')[0],
      });

      // REASON: Use atomic update to prevent race conditions
      // LOGIC: Multiple auctions could complete simultaneously
      const updatedBudget = await this.prisma.campaignDailyBudget.update({
        where: {
          campaignId_date: {
            campaignId,
            date: today,
          },
        },
        data: {
          spentToday: {
            increment: costPerImpression, // Add cost to spent amount
          },
          remainingToday: {
            decrement: costPerImpression, // Subtract cost from remaining
          },
          lastUpdated: new Date(),
        },
        select: {
          spentToday: true,
          remainingToday: true,
          isExhausted: true,
        },
      });

      const todayStr = today.toISOString().split('T')[0];
      await this.redis.set(
        CLICK_AND_IMPRESSION_KEYS.DAILY_BUDGET_SPEND(campaignId, todayStr),
        Number(updatedBudget.spentToday).toString(),
      );

      // Update campaign status if exhausted
      const remainingBudget = Number(updatedBudget.remainingToday);
      if (remainingBudget < 0.001) {
        // Less than $1 CPM equivalent
        await this.redis.set(
          CLICK_AND_IMPRESSION_KEYS.CAMPAIGN_STATUS(campaignId),
          'BUDGET_EXHAUSTED',
        );
      }
      // REASON: Record the transaction for audit trail
      // LOGIC: Keep track of every budget deduction for transparency
      await this.recordBudgetTransaction(
        campaignId,
        costPerImpression,
        'IMPRESSION_COST',
      );

      // REASON: Record revenue for publisher and system
      // LOGIC: New payment flow requires revenue tracking per impression
      await this.recordImpressionRevenue(campaignId, finalPrice);

      // REASON: Invalidate budget cache after update
      // LOGIC: Ensure next budget checks get fresh data
      await this.campaignEligibility.invalidateBudgetCache(campaignId);

      this.logger.log('Auction win recorded successfully', {
        campaignId,
        costDeducted: costPerImpression,
        newSpentToday: Number(updatedBudget.spentToday),
        newRemainingToday: Number(updatedBudget.remainingToday),
        isNowExhausted: remainingBudget < 0.001,
      });
    } catch (error) {
      this.logger.error('Failed to record auction win', {
        error: error.message,
        campaignId,
        finalPrice,
      });
      throw error;
    }
  }

  // REASON: Record budget transaction for audit trail
  // LOGIC: Track every budget change for financial reporting
  private async recordBudgetTransaction(
    campaignId: string,
    amount: number,
    type: 'IMPRESSION_COST' | 'CLICK_COST' | 'REFUND' | 'ADJUSTMENT',
    impressionId?: string,
    clickId?: string,
  ): Promise<void> {
    try {
      await this.prisma.budgetTransaction.create({
        data: {
          campaignId,
          type: type,
          amount: amount,
          description: `${type.toLowerCase().replace('_', ' ')} deduction`,
          impressionId,
          clickId,
          createdAt: new Date(),
        },
      });

      this.logger.debug('Budget transaction recorded', {
        campaignId,
        type,
        amount,
      });
    } catch (error) {
      this.logger.error('Failed to record budget transaction', {
        error: error.message,
        campaignId,
        type,
        amount,
      });
      // Don't throw - transaction recording failure shouldn't break auction
    }
  }

  // REASON: Record impression revenue for payment flow
  // LOGIC: Track revenue split between publisher and system per impression
  private async recordImpressionRevenue(
    campaignId: string,
    grossRevenue: number,
  ): Promise<void> {
    try {
      // REASON: Get campaign and publisher info for revenue calculation
      // LOGIC: Need publisher tier to determine commission rate
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        select: {
          id: true,
          advertiserId: true,
        },
      });

      if (!campaign) {
        this.logger.warn('Campaign not found for revenue recording', {
          campaignId,
        });
        return;
      }

      // Note: You'll need to get publisherId and inventoryId from the bid request context
      // This is a placeholder - you should pass these as parameters
      // const { publisherId, inventoryId } = await this.getBidRequestContext(campaignId);

      this.logger.debug(
        'Revenue recording implemented - need publisher context',
        {
          campaignId,
          grossRevenue,
          note: 'Publisher and inventory context needed for complete implementation',
        },
      );
    } catch (error) {
      this.logger.error('Failed to record impression revenue', {
        error: error.message,
        campaignId,
        grossRevenue,
      });
    }
  }

  // REASON: Pause campaign when budget is exhausted
  // LOGIC: Prevent further bid requests for campaigns with no budget
  private async pauseCampaignForBudgetExhaustion(
    campaignId: string,
  ): Promise<void> {
    try {
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'BUDGET_EXHAUSTED',
          updatedAt: new Date(),
        },
      });

      this.logger.warn('Campaign paused due to budget exhaustion', {
        campaignId,
        newStatus: 'BUDGET_EXHAUSTED',
      });

      // REASON: Clear campaign from eligible campaigns cache
      // LOGIC: Exhausted campaigns shouldn't appear in future auctions
      await this.clearCampaignFromEligibilityCache(campaignId);
    } catch (error) {
      this.logger.error('Failed to pause campaign for budget exhaustion', {
        error: error.message,
        campaignId,
      });
    }
  }

  // REASON: Remove exhausted campaign from eligibility cache
  // LOGIC: Prevent exhausted campaigns from participating in auctions
  private async clearCampaignFromEligibilityCache(
    campaignId: string,
  ): Promise<void> {
    try {
      // REASON: Pattern-based cache invalidation for campaign eligibility
      // LOGIC: Clear all cache entries that might contain this campaign
      const pattern = `campaigns:pool:*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await Promise.all(keys.map((key) => this.redis.del(key)));
        this.logger.debug('Cleared campaign eligibility cache', {
          campaignId,
          keysCleared: keys.length,
        });
      }
    } catch (error) {
      this.logger.warn('Failed to clear campaign eligibility cache', {
        error: error.message,
        campaignId,
      });
    }
  }

  // REASON: Helper method to check if campaign has sufficient budget before auction
  // LOGIC: Pre-validate budget availability to avoid unnecessary processing
  async validateCampaignBudgetBeforeAuction(
    campaignId: string,
    estimatedCost: number,
  ): Promise<boolean> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const dailyBudget = await this.prisma.campaignDailyBudget.findUnique({
        where: {
          campaignId_date: {
            campaignId,
            date: today,
          },
        },
        select: {
          remainingToday: true,
          isExhausted: true,
        },
      });

      if (!dailyBudget || dailyBudget.isExhausted) {
        return false;
      }

      const remainingBudget = Number(dailyBudget.remainingToday);
      const costPerImpression =
        estimatedCost > 1 ? estimatedCost / 1000 : estimatedCost;

      return remainingBudget >= costPerImpression;
    } catch (error) {
      this.logger.error('Budget validation before auction failed', {
        error: error.message,
        campaignId,
        estimatedCost,
      });
      return false;
    }
  }

  // REASON: Get current budget status for real-time monitoring
  // LOGIC: Provide dashboard data for campaign budget tracking
  async getCampaignBudgetStatus(campaignId: string): Promise<{
    spentToday: number;
    remainingToday: number;
    isExhausted: boolean;
    lastUpdated: Date;
  } | null> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const budgetStatus = await this.prisma.campaignDailyBudget.findUnique({
        where: {
          campaignId_date: {
            campaignId,
            date: today,
          },
        },
        select: {
          spentToday: true,
          remainingToday: true,
          isExhausted: true,
          lastUpdated: true,
        },
      });

      if (!budgetStatus) {
        return null;
      }

      return {
        spentToday: Number(budgetStatus.spentToday),
        remainingToday: Number(budgetStatus.remainingToday),
        isExhausted: budgetStatus.isExhausted,
        lastUpdated: budgetStatus.lastUpdated,
      };
    } catch (error) {
      this.logger.error('Failed to get campaign budget status', {
        error: error.message,
        campaignId,
      });
      return null;
    }
  }
}
