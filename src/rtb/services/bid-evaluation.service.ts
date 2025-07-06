import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { CampaignWithTargeting } from '../types/campaign.types';
import { bidStrategyService } from './bid-strategy.service';
import { BidAdjustmentService } from './bid-adjustment.service';
import { REDIS_KEYS } from '../constants/cache-keys';
export interface AdRequest {
  id: string;
  externalRequestId: string;
  inventoryId: string;
  publisherId: string;
  websiteId: string;
  userContext: UserContext;
  adSlotContext: AdSlotContext;
  floorPrice: number;
  auctionType: 'FIRST_PRICE' | 'SECOND_PRICE' | 'THIRD_PRICE'; // assuming possible auction types
  timeout: number;
  requestTimestamp: string | Date; // ISO date string
  processedAt?: string | null;
  auctionId: string;
}

export interface UserContext {
  city: string;
  osType: string;
  region: string;
  userId: string;
  country: string;
  ipAddress: string;
  sessionId: string;
  userAgent: string;
  deviceType: 'MOBILE' | 'DESKTOP' | 'TABLET' | string;
  browserType: string;
  additionalData: AdditionalData;
}

export interface AdditionalData {
  ageGroup: string;
  interests: string[];
}

export interface AdSlotContext {
  width: number;
  format: string;
  height: number;
  pageUrl: string;
  position: string;
  referrerUrl: string;
  pageCategory: string;
  pageKeywords: string[];
}

@Injectable()
export class BidEvaluationService {
  private readonly logger = new Logger(BidEvaluationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly bidStrategyService: bidStrategyService,
    private readonly bidAdjustmentService: BidAdjustmentService,
  ) {}

  async calculateBidPrice(
    campaign: CampaignWithTargeting,
    context: AdRequest,
  ): Promise<number> {
    this.logger.debug('Calculating bid price', {
      campaignId: campaign.id,
      bidStrategy: campaign.bidStrategy,
      deviceType: context.userContext.deviceType,
    });

    try {
      // 1. Get base bid amount from campaign
      const baseBid = await this.getBaseBidAmount(campaign);

      // 2. Apply bid strategy logic
      const strategicBid = await this.applyBidStrategy(
        campaign,
        baseBid,
        context.floorPrice,
      );

      // 3. Apply contextual adjustments
      const adjustedBid =
        await this.bidAdjustmentService.calculateComprehensiveBidAdjustments(
          campaign.id,
          strategicBid,
          context.userContext,
        );

      // 4. Apply budget pacing constraints
      const pacedBid = await this.applyBudgetPacing(
        campaign,
        adjustedBid.finalBidCPM,
      );

      // 5. Ensure bid meets minimum and maximum constraints
      const finalBid = this.applyBidConstraints(pacedBid, context.floorPrice);

      this.logger.debug('Bid calculation completed', {
        campaignId: campaign.id,
        baseBid,
        strategicBid,
        adjustedBid,
        finalBid,
      });

      return finalBid;
    } catch (error) {
      this.logger.error('Bid calculation failed', {
        error: error.message,
        campaignId: campaign.id,
      });

      // Fallback to minimum viable bid
      return Math.max(context.floorPrice || 0.01, 0.01);
    }
  }

  private async getBaseBidAmount(
    campaign: CampaignWithTargeting,
  ): Promise<number> {
    if (campaign.bidAmount && Number(campaign.bidAmount) > 0) {
      const cpmBid = Number(campaign.bidAmount);
      const costPerImpression = cpmBid / 1000;

      this.logger.debug('Base bid calculation', {
        campaignId: campaign.id,
        cpmBid: cpmBid,
        costPerImpression: costPerImpression,
      });

      return costPerImpression;
    }

    // Ultimate fallback - Rs.1 CPM = $0.001 per impression
    return 0.001;
  }

  private async getDailyBudget(campaignId: string): Promise<number> {
    try {
      // REASON: Use new CampaignDailyBudget table instead of old CampaignBudgetTracker
      // LOGIC: New payment flow uses CampaignDailyBudget for daily spend tracking
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of day

      const dailyBudget = await this.prisma.campaignDailyBudget.findUnique({
        where: {
          campaignId_date: {
            campaignId,
            date: today,
          },
        },
        select: {
          remainingToday: true,
        },
      });

      // REASON: Return remaining budget instead of total daily budget
      // LOGIC: We want to bid based on remaining budget, not total allocated budget
      const remainingBudget = dailyBudget
        ? Number(dailyBudget.remainingToday)
        : 0;

      this.logger.debug('Daily budget retrieved', {
        campaignId,
        date: today.toISOString().split('T')[0],
        remainingBudget: remainingBudget,
      });

      return remainingBudget;
    } catch (error) {
      this.logger.warn('Failed to get daily budget', {
        error: error.message,
        campaignId,
      });
      return 0;
    }
  }

  private async applyBidStrategy(
    campaign: CampaignWithTargeting,
    baseBid: number,
    floorPrice: number,
  ): Promise<number> {
    const bidStrategy = campaign.bidStrategy || 'LOWEST_COST';

    // Create context object
    const context = {
      floorPrice: floorPrice,
      campaignId: campaign.id,
      // Add any other context you need
    };

    return this.bidStrategyService.calculateBidAmount(
      bidStrategy,
      baseBid,
      context,
    );
  }

  private async applyBudgetPacing(
    campaign: any,
    bidAmount: number,
  ): Promise<number> {
    try {
      // REASON: Updated to use new budget tracking system
      // LOGIC: Compare actual spend pace vs expected pace for the day
      const spendPace = await this.getCurrentSpendPace(campaign.id);

      if (spendPace > 1.2) {
        // REASON: Spending too fast, reduce bids to slow down spend
        // LOGIC: 20% over expected pace = reduce bids by 20%
        this.logger.debug('Reducing bid due to fast spending', {
          campaignId: campaign.id,
          spendPace: spendPace,
          reduction: 0.8,
        });
        return bidAmount * 0.9;
      } else if (spendPace < 0.8) {
        // REASON: Spending too slow, increase bids to catch up
        // LOGIC: 20% under expected pace = increase bids by 20%
        this.logger.debug('Increasing bid due to slow spending', {
          campaignId: campaign.id,
          spendPace: spendPace,
          increase: 1.2,
        });
        return bidAmount * 1.2;
      }

      return bidAmount;
    } catch (error) {
      this.logger.warn('Budget pacing calculation failed', {
        error: error.message,
        campaignId: campaign.id,
      });
      return bidAmount;
    }
  }

  private applyBidConstraints(
    bidAmount: number,
    floorPrice?: number,
    maxBid?: number,
  ): number {
    let finalBid = bidAmount;

    // REASON: Apply floor price constraint first
    // LOGIC: Ensure we never bid below the inventory's minimum price
    if (floorPrice && finalBid < floorPrice) {
      finalBid = floorPrice;
      this.logger.debug('Bid adjusted to meet floor price', {
        originalBid: bidAmount,
        floorPrice: floorPrice,
        adjustedBid: finalBid,
      });
    }
    return finalBid;
  }

  private async getCurrentSpendPace(campaignId: string): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // fetch daily budget and spend data from redis
      let dailyBudgetLimit = await this.redis.get(
        REDIS_KEYS.DAILY_BUDGET_LIMIT(campaignId),
      );
      const dailySpend = await this.redis.get(
        REDIS_KEYS.DAILY_BUDGET_SPEND(
          campaignId,
          today.toISOString().split('T')[0],
        ),
      );
      if (!dailyBudgetLimit) {
        this.logger.debug('No daily budget found, assuming normal pace', {
          campaignId,
          date: today.toISOString().split('T')[0],
        });
        return 1.0;
      }

      const spending = Number(dailySpend) || 0;
      const dailyBudget = Number(dailyBudgetLimit) || 0;

      // REASON: Calculate expected spend based on time progression through the day
      // LOGIC: If it's 12 PM (50% through day), we should have spent ~50% of budget
      const currentHour = new Date().getHours();
      const expectedPace = currentHour / 24; // Expected percentage of day complete
      const actualPace = spending / dailyBudget; // Actual percentage of budget spent

      if (expectedPace === 0) {
        return 1.0;
      }

      const spendPace = actualPace / expectedPace;

      this.logger.debug('Spend pace calculation', {
        campaignId,
        currentHour: currentHour,
        expectedPace: expectedPace,
        actualPace: actualPace,
        spendPace: spendPace,
        totalDailyBudget: dailyBudget,
        actualSpent: spending,
      });

      return spendPace;
    } catch (error) {
      this.logger.warn('Failed to calculate spend pace', {
        error: error.message,
        campaignId,
      });
      return 1.0;
    }
  }
}
