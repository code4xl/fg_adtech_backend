// src/rtb/services/bid-evaluation.service.ts
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
  floorPrice: number; // CPM value
  auctionType: 'FIRST_PRICE' | 'SECOND_PRICE' | 'THIRD_PRICE';
  timeout: number;
  requestTimestamp: string | Date;
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

  /**
   * 🎯 FIXED: All calculations now work in CPM and return CPM
   * Final conversion to CPI happens only when needed for budget validation
   */
  async calculateBidPrice(
    campaign: CampaignWithTargeting,
    context: AdRequest,
  ): Promise<number> {
    this.logger.debug('Calculating bid price (CPM)', {
      campaignId: campaign.id,
      bidStrategy: campaign.bidStrategy,
      deviceType: context.userContext.deviceType,
      floorPriceCPM: context.floorPrice,
    });

    try {
      // 1. Get base bid amount (CPM) from campaign
      const baseBidCPM = await this.getBaseBidCPMAmount(campaign);
      this.logger.debug('Base bid CPM amount retrieved', {
        campaignId: campaign.id,
        baseBidCPM,
      });

      // 2. Apply bid strategy logic (CPM in, CPM out)
      const strategicBidCPM = await this.applyBidStrategy(
        campaign,
        baseBidCPM,
        context.floorPrice, // floorPrice is CPM
      );
      this.logger.debug('Strategic bid CPM calculated', {
        campaignId: campaign.id,
        baseBidCPM,
        strategicBidCPM,
      });

      // 3. Apply contextual adjustments (CPM in, CPM out)
      const adjustedBid =
        await this.bidAdjustmentService.calculateComprehensiveBidAdjustments(
          campaign.id,
          strategicBidCPM, // Pass CPM
          context.userContext,
        );
      this.logger.debug('Adjusted bid CPM after contextual adjustments', {
        campaignId: campaign.id,
        strategicBidCPM,
        adjustedBidCPM: adjustedBid.finalBidCPM,
      });

      // 4. Apply budget pacing constraints (CPM in, CPM out)
      const pacedBidCPM = await this.applyBudgetPacing(
        campaign,
        adjustedBid.finalBidCPM,
      );
      this.logger.debug('Paced bid CPM after budget pacing', {
        campaignId: campaign.id,
        adjustedBidCPM: adjustedBid.finalBidCPM,
        pacedBidCPM,
      });

      // 5. Ensure bid meets minimum constraints (CPM level)
      // const finalBidCPM = this.applyBidConstraints(
      //   pacedBidCPM,
      //   context.floorPrice, // floorPrice is CPM
      // );

      this.logger.debug('Final bid CPM after constraints', {
        campaignId: campaign.id,
        pacedBidCPM,

        floorPriceCPM: context.floorPrice,
      });

      this.logger.debug(' Bid calculation completed (CPM)', {
        campaignId: campaign.id,
        baseBidCPM,
        strategicBidCPM,
        adjustedBidCPM: adjustedBid.finalBidCPM,
        pacedBidCPM,

        breakdown: adjustedBid.breakdown,
      });

      return pacedBidCPM; // Return CPM value
    } catch (error) {
      this.logger.error('Bid calculation failed', {
        error: error.message,
        campaignId: campaign.id,
      });

      // Fallback to minimum viable bid (CPM)
      return Math.max(context.floorPrice || 1.0, 1.0);
    }
  }

  /**
   * 🎯 FIXED: Always return CPM values
   */
  private async getBaseBidCPMAmount(
    campaign: CampaignWithTargeting,
  ): Promise<number> {
    if (campaign.bidAmount && Number(campaign.bidAmount) > 0) {
      const cpmBid = Number(campaign.bidAmount);

      this.logger.debug('Base bid CPM calculation', {
        campaignId: campaign.id,
        cpmBid: cpmBid,
        source: 'campaign.bidAmount',
      });

      return cpmBid; // Already CPM
    }

    // Ultimate fallback - Rs.1 CPM
    this.logger.debug('Using fallback base bid CPM', {
      campaignId: campaign.id,
      fallbackCPM: 1.0,
    });

    return 1.0;
  }

  /**
   * 🎯 FIXED: All strategy calculations work in CPM
   */
  private async applyBidStrategy(
    campaign: CampaignWithTargeting,
    baseBidCPM: number,
    floorPriceCPM: number,
  ): Promise<number> {
    const bidStrategy = campaign.bidStrategy;

    // Create context object with CPM values
    const context = {
      floorPriceCPM: floorPriceCPM,
      campaignId: campaign.id,
    };

    return this.bidStrategyService.calculateBidAmountCPM(
      bidStrategy,
      baseBidCPM,
      context,
    );
  }

  /**
   * 🎯 FIXED: Budget pacing works in CPM
   */
  private async applyBudgetPacing(
    campaign: any,
    bidAmountCPM: number,
  ): Promise<number> {
    try {
      const spendPace = await this.getCurrentSpendPace(campaign.id);

      if (spendPace > 1.2) {
        // Spending too fast, reduce bids by 10%
        const adjustedCPM = bidAmountCPM * 0.9;
        this.logger.debug('Reducing CPM bid due to fast spending', {
          campaignId: campaign.id,
          spendPace: spendPace,
          originalCPM: bidAmountCPM,
          adjustedCPM,
        });
        return adjustedCPM;
      } else if (spendPace < 0.8) {
        // Spending too slow, increase bids by 20%
        const adjustedCPM = bidAmountCPM * 1.2;
        this.logger.debug('Increasing CPM bid due to slow spending', {
          campaignId: campaign.id,
          spendPace: spendPace,
          originalCPM: bidAmountCPM,
          adjustedCPM,
        });
        return adjustedCPM;
      }

      return bidAmountCPM;
    } catch (error) {
      this.logger.warn('Budget pacing calculation failed', {
        error: error.message,
        campaignId: campaign.id,
      });
      return bidAmountCPM;
    }
  }

  /**
   * 🎯 FIXED: Constraints work in CPM
   */
  private applyBidConstraints(
    bidAmountCPM: number,
    floorPriceCPM?: number,
    maxBidCPM?: number,
  ): number {
    let finalBidCPM = bidAmountCPM;

    // Apply floor price constraint (CPM level)
    if (floorPriceCPM && finalBidCPM < floorPriceCPM) {
      finalBidCPM = floorPriceCPM;
      this.logger.debug('Bid CPM adjusted to meet floor price', {
        originalBidCPM: bidAmountCPM,
        floorPriceCPM: floorPriceCPM,
        adjustedBidCPM: finalBidCPM,
      });
    }

    // Apply max bid constraint if provided
    if (maxBidCPM && finalBidCPM > maxBidCPM) {
      finalBidCPM = maxBidCPM;
      this.logger.debug('Bid CPM capped at maximum', {
        originalBidCPM: bidAmountCPM,
        maxBidCPM: maxBidCPM,
        adjustedBidCPM: finalBidCPM,
      });
    }

    // Ensure minimum viable CPM (Rs. 0.10)
    finalBidCPM = Math.max(finalBidCPM, 0.1);

    return finalBidCPM;
  }

  /**
   * Helper: Convert CPM to CPI when needed for budget validation
   */
  public convertCPMToCPI(cpmValue: number): number {
    return cpmValue / 1000;
  }

  /**
   * Helper: Convert CPI to CPM when needed
   */
  public convertCPIToCPM(cpiValue: number): number {
    return cpiValue * 1000;
  }

  /**
   * Spend pace calculation remains the same
   */
  private async getCurrentSpendPace(campaignId: string): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Fetch daily budget and spend data from redis
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

      // Calculate expected spend based on time progression through the day
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
