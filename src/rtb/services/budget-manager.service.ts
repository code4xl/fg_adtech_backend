import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { CLICK_AND_IMPRESSION_KEYS } from '../constants/cache-keys';
import { CampaignEligibilityService } from './campaign-eligibility.service';
import { CreatedBidResponse } from '../types/bid-response.types';

@Injectable()
export class BudgetManagerService {
  private readonly logger = new Logger(BudgetManagerService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly campaignEligibility: CampaignEligibilityService,
  ) {}
  async deductBudgetOnWin(
    winningBid: CreatedBidResponse,
    publisherId: string,
    finalPrice: number,
  ) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const costPerImpression = finalPrice / 1000;

      this.logger.debug('Recording auction win with cost deduction', {
        campaignId: winningBid.campaignId,
        finalPriceInput: finalPrice,
        costPerImpression: costPerImpression,
        date: today.toISOString().split('T')[0],
      });

      const updatedBudget = await this.prisma.campaignDailyBudget.update({
        where: {
          campaignId_date: {
            campaignId: winningBid.campaignId,
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
        CLICK_AND_IMPRESSION_KEYS.DAILY_BUDGET_SPEND(
          winningBid.campaignId,
          todayStr,
        ),
        Number(updatedBudget.spentToday).toString(),
      );

      // Update campaign status if exhausted
      const remainingBudget = Number(updatedBudget.remainingToday);
      if (remainingBudget < 0.001) {
        // Less than Rs.1 CPM equivalent
        await this.redis.set(
          CLICK_AND_IMPRESSION_KEYS.CAMPAIGN_STATUS(winningBid.campaignId),
          'BUDGET_EXHAUSTED',
        );
      }

      await this.recordBudgetTransaction(
        winningBid.campaignId,
        costPerImpression,
        'IMPRESSION_COST',
      );

      await this.recordImpressionRevenue(
        winningBid.creativeId,
        winningBid.advertiserId,
        publisherId,
        winningBid.campaignId,
        costPerImpression,
      );

      await this.campaignEligibility.invalidateBudgetCache(
        winningBid.campaignId,
      );

      this.logger.log('Auction win recorded successfully', {
        campaignId: winningBid.campaignId,
        costDeducted: costPerImpression,
        newSpentToday: Number(updatedBudget.spentToday),
        newRemainingToday: Number(updatedBudget.remainingToday),
        isNowExhausted: remainingBudget < 0.001,
      });
    } catch (error) {
      this.logger.error('Failed to record auction win', {
        error: error.message,
        campaignId: winningBid.campaignId,
        finalPrice,
      });
      throw error;
    }
  }

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
  private getDateString(date?: Date): string {
    const d = date || new Date();
    return d.toISOString().split('T')[0];
  }
  private async recordImpressionRevenue(
    creativeId: string,
    advertiserId: string,
    publisherId: string,
    campaignId: string,
    costPerImpression: number,
  ): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();
      const today = this.getDateString();
      // 3. Update budget spending (critical for budget control)
      pipeline.incrbyfloat(
        CLICK_AND_IMPRESSION_KEYS.DAILY_BUDGET_SPEND(campaignId, today),
        costPerImpression,
      );

      // 4. Update revenue splitting
      const publisherRevenueDetails: string = await this.redis.get(
        CLICK_AND_IMPRESSION_KEYS.PUBLISHER_REVENUE_TIERS(publisherId),
      );
      const publisherRevenueTier = publisherRevenueDetails
        ? JSON.parse(publisherRevenueDetails)
        : { tier: 'STANDARD', paymentThreshold: 100.0 }; // Default values
      this.logger.debug(
        `Publisher revenue tier: ${publisherRevenueTier.tier}, threshold: ${publisherRevenueTier}`,
      );

      const systemRevenue =
        costPerImpression * commissionMap[publisherRevenueTier.tier];
      const publisherRevenue = costPerImpression - systemRevenue;
      pipeline.incrbyfloat(
        CLICK_AND_IMPRESSION_KEYS.PUBLISHER_REVENUE(publisherId, today),
        publisherRevenue,
      );
      pipeline.incrbyfloat(
        CLICK_AND_IMPRESSION_KEYS.SYSTEM_REVENUE(today),
        systemRevenue,
      );
      pipeline.incrbyfloat(
        CLICK_AND_IMPRESSION_KEYS.CREATIVE_SPENDING(creativeId, today),
        costPerImpression,
      );
      pipeline.incrbyfloat(
        CLICK_AND_IMPRESSION_KEYS.CAMPAIGN_SPENDING(campaignId, today),
        costPerImpression,
      );
      pipeline.incrbyfloat(
        CLICK_AND_IMPRESSION_KEYS.ADVERTISER_SPENDING(advertiserId, today),
        costPerImpression,
      );
    } catch (error) {
      this.logger.error('Failed to record impression revenue', {
        error: error.message,
        campaignId,
        costPerImpression,
      });
    }
  }
}
