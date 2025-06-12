import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { RedisService } from "src/redis/redis.service";
import { CampaignWithTargeting } from "../types/campaign.types";
import { bidStrategyService } from "./bid-strategy.service";
import { BidAdjustmentService } from "./bid-adjustment.service";

@Injectable()
export class BidEvaluationService {
  private readonly logger = new Logger(BidEvaluationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly bidStrategyService: bidStrategyService,
    private readonly bidAdjustmentService: BidAdjustmentService,
  ) { }

  async calculateBidPrice(campaign: CampaignWithTargeting, context: any): Promise<number> {
    this.logger.debug('Calculating bid price', {
      campaignId: campaign.id,
      bidStrategy: campaign.bidStrategy,
      deviceType: context.userContext.deviceType,
    });

    try {
      // 1. Get base bid amount from campaign
      const baseBid = await this.getBaseBidAmount(campaign);

      // Adjustments Critria

      // 2. Apply bid strategy logic
      const strategicBid = await this.applyBidStrategy(
        campaign,
        baseBid,
        context,
      );

      // 3. Apply contextual adjustments
      const adjustedBid = await this.applyBidAdjustments(
        campaign,
        strategicBid,
        context,
      );

      // 4. Apply budget pacing constraints
      const pacedBid = await this.applyBudgetPacing(campaign, adjustedBid);

      // 5. Ensure bid meets minimum and maximum constraints
      const finalBid = this.applyBidConstraints(
        pacedBid,
        context.floorPrice,
        campaign.bidAmount.toNumber(),
      );

      this.logger.debug('Bid calculation completed', {
        campaignId: campaign.id,
        baseBid,
        strategicBid,
        adjustedBid,
        pacedBid,
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

  // async getPerformanceAdjustment(
  //   campaignId: string,
  //   context: any,
  // ): Promise<number> {
  //   try {
  //     // Get recent performance metrics
  //     const metrics = await this.getRecentPerformanceMetrics(
  //       campaignId,
  //       context,
  //     );

  //     if (!metrics) {
  //       return 1.0; // No adjustment if no data
  //     }

  //     // Calculate performance score (0.5 to 2.0 multiplier)
  //     const ctrScore = this.calculateCTRScore(metrics.ctr);
  //     const conversionScore = this.calculateConversionScore(
  //       metrics.conversionRate,
  //     );
  //     const qualityScore = this.calculateQualityScore(metrics);

  //     // Weighted combination
  //     const performanceScore =
  //       ctrScore * 0.4 + conversionScore * 0.4 + qualityScore * 0.2;

  //     // Cap adjustments to reasonable range
  //     return Math.max(0.5, Math.min(2.0, performanceScore));
  //   } catch (error) {
  //     this.logger.error('Performance adjustment calculation failed', {
  //       error: error.message,
  //       campaignId,
  //     });
  //     return 1.0;
  //   }
  // }

  private async getBaseBidAmount(campaign: CampaignWithTargeting): Promise<number> {
    // Use campaign's bid amount or derive from budget
    if (campaign.bidAmount && campaign.bidAmount.toNumber() > 0) {
      return Number(campaign.bidAmount);
    }

    // Fallback: derive from daily budget (assume 1000 impressions per day)
    const dailyBudget = await this.getDailyBudget(campaign.id);
    if (dailyBudget > 0) {
      return dailyBudget / 1000; // Simple estimation
    }

    // Ultimate fallback
    return 1.0;
  }

  private async getDailyBudget(campaignId: string): Promise<number> {
    try {
      const today = new Date().toISOString();

      const budgetTracker = await this.prisma.campaignBudgetTracker.findUnique({
        where: {
          campaignId_date: {
            campaignId,
            date: today,
          },
        },
        select: {
          dailyBudget: true,
        },
      });

      return budgetTracker ? Number(budgetTracker.dailyBudget) : 0;
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
    context: any,
  ): Promise<number> {
    switch (campaign.bidStrategy) {
      case 'LOWEST_COST':
        return this.bidStrategyService.calculateLowestCostBid(baseBid, context);

      case 'COST_CAP':
        return this.bidStrategyService.calculateCostCapBid(campaign, baseBid, context);

      case 'BID_CAP':
        return this.bidStrategyService.calculateBidCapBid(campaign, baseBid);

      case 'TARGET_COST':
        return this.bidStrategyService.calculateTargetCostBid(campaign, baseBid, context);

      default:
        return baseBid;
    }
  }

  private async applyBidAdjustments(
    campaign: CampaignWithTargeting,
    baseBid: number,
    context: any,
  ): Promise<number> {
    let adjustedBid = baseBid;

    // Device type adjustment
    const deviceMultiplier = await this.bidAdjustmentService.getDeviceMultiplier(
      campaign.id,
      context.userContext.deviceType,
    );
    adjustedBid *= deviceMultiplier;

    // Geographic adjustment
    const geoMultiplier = await this.bidAdjustmentService.getGeographicMultiplier(
      campaign.id,
      context.userContext.country,
      context.userContext.region,
    );
    adjustedBid *= geoMultiplier;

    // Time-of-day adjustment
    const timeMultiplier = this.bidAdjustmentService.getTimeOfDayMultiplier(new Date().getHours());
    adjustedBid *= timeMultiplier;

    // Inventory quality adjustment
    const qualityMultiplier = await this.bidAdjustmentService.getInventoryQualityMultiplier(
      context.inventoryId,
    );
    adjustedBid *= qualityMultiplier;

    return adjustedBid;
  }

  private async applyBudgetPacing(
    campaign: any,
    bidAmount: number,
  ): Promise<number> {
    try {
      // Get current spend pace
      const spendPace = await this.getCurrentSpendPace(campaign.id);

      if (spendPace > 1.2) {
        // Spending too fast, reduce bids
        return bidAmount * 0.8;
      } else if (spendPace < 0.8) {
        // Spending too slow, increase bids
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

    // Apply floor price
    if (floorPrice && finalBid < floorPrice) {
      finalBid = floorPrice;
    }

    // Apply maximum bid cap
    if (maxBid && finalBid > maxBid) {
      finalBid = Number(maxBid);
    }

    // Ensure minimum viable bid
    finalBid = Math.max(finalBid, 0.01);

    // Round to 2 decimal places
    return Math.round(finalBid * 100) / 100;
  }

  private async getCurrentSpendPace(campaignId: string): Promise<number> {
    try {
      const today = new Date().toISOString();

      const budgetTracker = await this.prisma.campaignBudgetTracker.findUnique({
        where: {
          campaignId_date: {
            campaignId,
            date: today,
          },
        },
      });

      if (!budgetTracker) return 1.0;

      const currentHour = new Date().getHours();
      const expectedPace = currentHour / 24; // Expected pace through the day
      const actualPace =
        Number(budgetTracker.spentToday) / Number(budgetTracker.dailyBudget);

      return actualPace / expectedPace;
    } catch (error) {
      this.logger.warn('Failed to calculate spend pace', {
        error: error.message,
        campaignId,
      });
      return 1.0;
    }
  }
}