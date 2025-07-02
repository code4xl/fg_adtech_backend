// import { Injectable, Logger } from '@nestjs/common';
// import { PrismaService } from 'src/prisma/prisma.service';
// import { RedisService } from 'src/redis/redis.service';
// import { CampaignWithTargeting } from '../types/campaign.types';
// import { bidStrategyService } from './bid-strategy.service';
// import { BidAdjustmentService } from './bid-adjustment.service';

// @Injectable()
// export class BidEvaluationService {
//   private readonly logger = new Logger(BidEvaluationService.name);

//   constructor(
//     private readonly prisma: PrismaService,
//     private readonly redis: RedisService,
//     private readonly bidStrategyService: bidStrategyService,
//     private readonly bidAdjustmentService: BidAdjustmentService,
//   ) {}

//   async calculateBidPrice(
//     campaign: CampaignWithTargeting,
//     context: any,
//   ): Promise<number> {
//     this.logger.debug('Calculating bid price', {
//       campaignId: campaign.id,
//       bidStrategy: campaign.bidStrategy,
//       deviceType: context.userContext.deviceType,
//     });

//     try {
//       // 1. Get base bid amount from campaign
//       const baseBid = await this.getBaseBidAmount(campaign);

//       // Adjustments Critria

//       // 2. Apply bid strategy logic
//       const strategicBid = await this.applyBidStrategy(
//         campaign,
//         baseBid,
//         context,
//       );

//       // 3. Apply contextual adjustments
//       const adjustedBid = await this.applyBidAdjustments(
//         campaign,
//         strategicBid,
//         context,
//       );

//       // 4. Apply budget pacing constraints
//       const pacedBid = await this.applyBudgetPacing(campaign, adjustedBid);

//       // 5. Ensure bid meets minimum and maximum constraints
//       const finalBid = this.applyBidConstraints(
//         pacedBid,
//         context.floorPrice,
//         Number(campaign.bidAmount),
//       );

//       this.logger.debug('Bid calculation completed', {
//         campaignId: campaign.id,
//         baseBid,
//         strategicBid,
//         adjustedBid,
//         pacedBid,
//         finalBid,
//       });

//       return finalBid;
//     } catch (error) {
//       this.logger.error('Bid calculation failed', {
//         error: error.message,
//         campaignId: campaign.id,
//       });

//       // Fallback to minimum viable bid
//       return Math.max(context.floorPrice || 0.01, 0.01);
//     }
//   }

//   // async getPerformanceAdjustment(
//   //   campaignId: string,
//   //   context: any,
//   // ): Promise<number> {
//   //   try {
//   //     // Get recent performance metrics
//   //     const metrics = await this.getRecentPerformanceMetrics(
//   //       campaignId,
//   //       context,
//   //     );

//   //     if (!metrics) {
//   //       return 1.0; // No adjustment if no data
//   //     }

//   //     // Calculate performance score (0.5 to 2.0 multiplier)
//   //     const ctrScore = this.calculateCTRScore(metrics.ctr);
//   //     const conversionScore = this.calculateConversionScore(
//   //       metrics.conversionRate,
//   //     );
//   //     const qualityScore = this.calculateQualityScore(metrics);

//   //     // Weighted combination
//   //     const performanceScore =
//   //       ctrScore * 0.4 + conversionScore * 0.4 + qualityScore * 0.2;

//   //     // Cap adjustments to reasonable range
//   //     return Math.max(0.5, Math.min(2.0, performanceScore));
//   //   } catch (error) {
//   //     this.logger.error('Performance adjustment calculation failed', {
//   //       error: error.message,
//   //       campaignId,
//   //     });
//   //     return 1.0;
//   //   }
//   // }

//   private async getBaseBidAmount(
//     campaign: CampaignWithTargeting,
//   ): Promise<number> {
//     // Use campaign's bid amount or derive from budget
//     if (campaign.bidAmount && Number(campaign.bidAmount) > 0) {
//       return Number(campaign.bidAmount);
//     }

//     // Fallback: derive from daily budget (assume 1000 impressions per day)
//     const dailyBudget = await this.getDailyBudget(campaign.id);
//     if (dailyBudget > 0) {
//       return dailyBudget / 1000; // Simple estimation
//     }

//     // Ultimate fallback
//     return 1.0;
//   }

//   private async getDailyBudget(campaignId: string): Promise<number> {
//     try {
//       const today = new Date().toISOString();

//       const budgetTracker = await this.prisma.campaignBudgetTracker.findUnique({
//         where: {
//           campaignId_date: {
//             campaignId,
//             date: today,
//           },
//         },
//         select: {
//           dailyBudget: true,
//         },
//       });

//       return budgetTracker ? Number(budgetTracker.dailyBudget) : 0;
//     } catch (error) {
//       this.logger.warn('Failed to get daily budget', {
//         error: error.message,
//         campaignId,
//       });
//       return 0;
//     }
//   }

//   private async applyBidStrategy(
//     campaign: CampaignWithTargeting,
//     baseBid: number,
//     context: any,
//   ): Promise<number> {
//     switch (campaign.bidStrategy) {
//       case 'LOWEST_COST':
//         return this.bidStrategyService.calculateLowestCostBid(baseBid, context);

//       case 'COST_CAP':
//         return this.bidStrategyService.calculateCostCapBid(
//           campaign,
//           baseBid,
//           context,
//         );

//       case 'BID_CAP':
//         return this.bidStrategyService.calculateBidCapBid(campaign, baseBid);

//       case 'TARGET_COST':
//         return this.bidStrategyService.calculateTargetCostBid(
//           campaign,
//           baseBid,
//           context,
//         );

//       default:
//         return baseBid;
//     }
//   }

//   private async applyBidAdjustments(
//     campaign: CampaignWithTargeting,
//     baseBid: number,
//     context: any,
//   ): Promise<number> {
//     let adjustedBid = baseBid;

//     // Device type adjustment
//     const deviceMultiplier =
//       await this.bidAdjustmentService.getDeviceMultiplier(
//         campaign.id,
//         context.userContext.deviceType,
//       );
//     adjustedBid *= deviceMultiplier;

//     // Geographic adjustment
//     const geoMultiplier =
//       await this.bidAdjustmentService.getGeographicMultiplier(
//         campaign.id,
//         context.userContext.country,
//         context.userContext.region,
//       );
//     adjustedBid *= geoMultiplier;

//     // Time-of-day adjustment
//     const timeMultiplier = this.bidAdjustmentService.getTimeOfDayMultiplier(
//       new Date().getHours(),
//     );
//     adjustedBid *= timeMultiplier;

//     // Inventory quality adjustment
//     const qualityMultiplier =
//       await this.bidAdjustmentService.getInventoryQualityMultiplier(
//         context.inventoryId,
//       );
//     adjustedBid *= qualityMultiplier;

//     return adjustedBid;
//   }

//   private async applyBudgetPacing(
//     campaign: any,
//     bidAmount: number,
//   ): Promise<number> {
//     try {
//       // Get current spend pace
//       const spendPace = await this.getCurrentSpendPace(campaign.id);

//       if (spendPace > 1.2) {
//         // Spending too fast, reduce bids
//         return bidAmount * 0.8;
//       } else if (spendPace < 0.8) {
//         // Spending too slow, increase bids
//         return bidAmount * 1.2;
//       }

//       return bidAmount;
//     } catch (error) {
//       this.logger.warn('Budget pacing calculation failed', {
//         error: error.message,
//         campaignId: campaign.id,
//       });
//       return bidAmount;
//     }
//   }

//   private applyBidConstraints(
//     bidAmount: number,
//     floorPrice?: number,
//     maxBid?: number,
//   ): number {
//     let finalBid = bidAmount;

//     // Apply floor price
//     if (floorPrice && finalBid < floorPrice) {
//       finalBid = floorPrice;
//     }

//     // Apply maximum bid cap
//     if (maxBid && finalBid > maxBid) {
//       finalBid = Number(maxBid);
//     }

//     // Ensure minimum viable bid
//     finalBid = Math.max(finalBid, 0.01);

//     // Round to 2 decimal places
//     return Math.round(finalBid * 100) / 100;
//   }

//   private async getCurrentSpendPace(campaignId: string): Promise<number> {
//     try {
//       const today = new Date().toISOString();

//       const budgetTracker = await this.prisma.campaignDailyBudget.findUnique({
//         where: {
//           campaignId_date: {
//             campaignId,
//             date: today,
//           },
//         },
//       });

//       if (!budgetTracker) return 1.0;

//       const currentHour = new Date().getHours();
//       const expectedPace = currentHour / 24; // Expected pace through the day
//       const actualPace =
//         Number(budgetTracker.spentToday) / Number(budgetTracker.dailyBudget);

//       return actualPace / expectedPace;
//     } catch (error) {
//       this.logger.warn('Failed to calculate spend pace', {
//         error: error.message,
//         campaignId,
//       });
//       return 1.0;
//     }
//   }
// }

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { CampaignWithTargeting } from '../types/campaign.types';
import { bidStrategyService } from './bid-strategy.service';
import { BidAdjustmentService } from './bid-adjustment.service';

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
    context: any,
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
        Number(campaign.bidAmount),
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

  private async getBaseBidAmount(
    campaign: CampaignWithTargeting,
  ): Promise<number> {
    // REASON: Use campaign's bid amount (which is now CPM-based as per payment flow)
    // LOGIC: bidAmount represents cost per 1,000 impressions, not per impression
    if (campaign.bidAmount && Number(campaign.bidAmount) > 0) {
      // CRITICAL: Convert CPM to per-impression cost
      // If bidAmount = $2.50 CPM, then cost per impression = $2.50 / 1000 = $0.0025
      const cpmBid = Number(campaign.bidAmount);
      const costPerImpression = cpmBid / 1000;

      this.logger.debug('Base bid calculation', {
        campaignId: campaign.id,
        cpmBid: cpmBid,
        costPerImpression: costPerImpression,
      });

      return costPerImpression;
    }

    // REASON: Fallback calculation using new budget structure
    // LOGIC: If no bid amount, derive from daily budget assuming reasonable impression volume
    const dailyBudget = await this.getDailyBudget(campaign.id);
    if (dailyBudget > 0) {
      // Assume 10,000 impressions per day as baseline (adjustable)
      const estimatedDailyImpressions = 10000;
      const costPerImpression = dailyBudget / estimatedDailyImpressions;

      this.logger.debug('Fallback bid from daily budget', {
        campaignId: campaign.id,
        dailyBudget: dailyBudget,
        estimatedDailyImpressions: estimatedDailyImpressions,
        costPerImpression: costPerImpression,
      });

      return costPerImpression;
    }

    // Ultimate fallback - $1 CPM = $0.001 per impression
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
    context: any,
  ): Promise<number> {
    // REASON: No changes needed here - bid strategy logic remains the same
    // LOGIC: Strategy calculations work with per-impression costs regardless of source
    switch (campaign.bidStrategy) {
      case 'LOWEST_COST':
        return this.bidStrategyService.calculateLowestCostBid(baseBid, context);

      case 'COST_CAP':
        return this.bidStrategyService.calculateCostCapBid(
          campaign,
          baseBid,
          context,
        );

      case 'BID_CAP':
        return this.bidStrategyService.calculateBidCapBid(campaign, baseBid);

      case 'TARGET_COST':
        return this.bidStrategyService.calculateTargetCostBid(
          campaign,
          baseBid,
          context,
        );

      default:
        return baseBid;
    }
  }

  private async applyBidAdjustments(
    campaign: CampaignWithTargeting,
    baseBid: number,
    context: any,
  ): Promise<number> {
    // REASON: No changes needed here - adjustment logic remains the same
    // LOGIC: Multipliers work on any bid amount regardless of budget structure
    let adjustedBid = baseBid;

    // Device type adjustment
    const deviceMultiplier =
      await this.bidAdjustmentService.getDeviceMultiplier(
        campaign.id,
        context.userContext.deviceType,
      );
    adjustedBid *= deviceMultiplier;

    // Geographic adjustment
    const geoMultiplier =
      await this.bidAdjustmentService.getGeographicMultiplier(
        campaign.id,
        context.userContext.country,
        context.userContext.region,
      );
    adjustedBid *= geoMultiplier;

    // Time-of-day adjustment
    const timeMultiplier = this.bidAdjustmentService.getTimeOfDayMultiplier(
      new Date().getHours(),
    );
    adjustedBid *= timeMultiplier;

    // Inventory quality adjustment
    const qualityMultiplier =
      await this.bidAdjustmentService.getInventoryQualityMultiplier(
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
        return bidAmount * 0.8;
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

    // REASON: Apply maximum bid cap if specified
    // LOGIC: Respect campaign's maximum bid limit (converted from CPM if needed)
    if (maxBid && maxBid > 0) {
      // CRITICAL: Convert CPM max bid to per-impression if needed
      const maxBidPerImpression = maxBid > 1 ? maxBid / 1000 : maxBid;
      if (finalBid > maxBidPerImpression) {
        finalBid = maxBidPerImpression;
        this.logger.debug('Bid capped at maximum', {
          originalBid: bidAmount,
          maxBidCPM: maxBid,
          maxBidPerImpression: maxBidPerImpression,
          adjustedBid: finalBid,
        });
      }
    }

    // REASON: Ensure minimum viable bid
    // LOGIC: Never bid less than $0.0001 per impression ($0.10 CPM)
    finalBid = Math.max(finalBid, 0.0001);

    // REASON: Round to 6 decimal places for precision
    // LOGIC: Financial calculations require precision for small per-impression amounts
    return Math.round(finalBid * 1000000) / 1000000;
  }

  private async getCurrentSpendPace(campaignId: string): Promise<number> {
    try {
      // REASON: Use new CampaignDailyBudget table for spend pace calculation
      // LOGIC: Compare actual spend vs expected spend based on time of day
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
          spentToday: true,
          remainingToday: true,
        },
      });

      if (!dailyBudget) {
        this.logger.debug('No daily budget found, assuming normal pace', {
          campaignId,
          date: today.toISOString().split('T')[0],
        });
        return 1.0;
      }

      // REASON: Calculate total daily budget from spent + remaining
      // LOGIC: Total budget = what we've spent + what's left
      const totalDailyBudget =
        Number(dailyBudget.spentToday) + Number(dailyBudget.remainingToday);
      const actualSpent = Number(dailyBudget.spentToday);

      if (totalDailyBudget <= 0) {
        return 1.0;
      }

      // REASON: Calculate expected spend based on time progression through the day
      // LOGIC: If it's 12 PM (50% through day), we should have spent ~50% of budget
      const currentHour = new Date().getHours();
      const expectedPace = currentHour / 24; // Expected percentage of day complete
      const actualPace = actualSpent / totalDailyBudget; // Actual percentage of budget spent

      // REASON: Avoid division by zero
      // LOGIC: If expected pace is 0 (very early morning), assume normal pacing
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
        totalDailyBudget: totalDailyBudget,
        actualSpent: actualSpent,
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

  // REASON: Helper method to validate campaign has sufficient budget for bidding
  // LOGIC: Before calculating bids, ensure campaign can afford at least one impression
  async validateCampaignBudgetForBidding(
    campaignId: string,
    estimatedCostPerImpression: number,
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
        this.logger.debug('Campaign budget exhausted or not found', {
          campaignId,
          dailyBudget: dailyBudget,
        });
        return false;
      }

      const remainingBudget = Number(dailyBudget.remainingToday);
      const canAffordImpression = remainingBudget >= estimatedCostPerImpression;

      this.logger.debug('Budget validation for bidding', {
        campaignId,
        remainingBudget: remainingBudget,
        estimatedCost: estimatedCostPerImpression,
        canAfford: canAffordImpression,
      });

      return canAffordImpression;
    } catch (error) {
      this.logger.error('Budget validation failed', {
        error: error.message,
        campaignId,
      });
      return false;
    }
  }
}
