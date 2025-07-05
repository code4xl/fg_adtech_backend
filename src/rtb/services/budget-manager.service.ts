// src/rtb/services/budget-manager.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { REDIS_KEYS, RTB_CACHE_TTL } from '../constants/cache-keys';
import { CreatedBidResponse } from '../types/bid-response.types';

@Injectable()
export class BudgetManagerService {
  private readonly logger = new Logger(BudgetManagerService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async deductBudgetOnWin(
    winningBid: CreatedBidResponse,
    publisherId: string,
    inventoryId: string,
    websiteId: string,
    finalPrice: number,
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const costPerImpression = finalPrice / 1000; // Convert CPM to per-impression cost

    try {
      this.logger.debug('Processing budget deduction on win', {
        campaignId: winningBid.campaignId,
        finalPrice,
        costPerImpression,
        publisherId,
      });

      // ===== 1. DEDUCT CAMPAIGN BUDGET =====
      await this.deductCampaignBudget(
        winningBid.campaignId,
        publisherId,
        inventoryId,
        websiteId,
        costPerImpression,
        today,
      );

      // ===== 2. CACHE PUBLISHER REVENUE =====
      await this.cachePublisherRevenue(
        publisherId,
        winningBid.campaignId,
        inventoryId,
        websiteId,
        costPerImpression,
        today,
      );

      // ===== 3. CACHE ADVERTISER SPENDING =====
      await this.cacheAdvertiserSpending(
        winningBid.advertiserId,
        winningBid.campaignId,
        winningBid.creativeId,
        costPerImpression,
        today,
      );

      // ===== 4. CACHE SYSTEM REVENUE =====
      await this.cacheSystemRevenue(
        winningBid.campaignId,
        publisherId,
        winningBid.advertiserId,
        winningBid.creativeId,
        inventoryId,
        costPerImpression,
        today,
      );

      this.logger.debug('✅ Budget deduction and revenue caching completed', {
        campaignId: winningBid.campaignId,
        finalPrice,
        costPerImpression,
      });
    } catch (error) {
      this.logger.error('❌ Budget deduction failed', {
        error: error.message,
        campaignId: winningBid.campaignId,
        finalPrice,
      });
      throw error;
    }
  }

  /**
   * Deduct campaign budget in Redis (real-time)
   */
  private async deductCampaignBudget(
    campaignId: string,
    publisherId: string,
    inventoryId: string,
    websiteId: string,
    costPerImpression: number,
    today: string,
  ): Promise<void> {
    const pipeline = this.redis.pipeline();

    // Update daily spend
    const dailySpendKey = REDIS_KEYS.DAILY_BUDGET_SPEND(campaignId, today);
    pipeline.incrbyfloat(dailySpendKey, costPerImpression);

    // Update campaign spending cache for job processing -- ambiguous
    const campaignSpendKey = REDIS_KEYS.CAMPAIGN_SPENDING(campaignId, today);
    pipeline.incrbyfloat(campaignSpendKey, costPerImpression);

    // Cache budget transaction for PostgreSQL sync
    const transactionData = {
      campaignId,
      type: 'IMPRESSION_COST',
      amount: costPerImpression,
      description: 'RTB impression cost deduction',
      createdAt: new Date().toISOString(),
      publisherId,
      inventoryId,
      websiteId,
    };
    // -- ambiguous
    pipeline.lpush(
      REDIS_KEYS.BUDGET_TRANSACTION_PENDING,
      JSON.stringify(transactionData),
    );

    await pipeline.exec();

    this.logger.debug('Campaign budget deducted', {
      campaignId,
      costPerImpression,
      today,
    });
  }

  /**
   * Cache publisher revenue data for batch processing
   */
  private async cachePublisherRevenue(
    publisherId: string,
    campaignId: string,
    inventoryId: string,
    websiteId: string,
    grossRevenue: number,
    today: string,
  ): Promise<void> {
    try {
      // Get publisher commission rate
      const commissionRate = await this.getPublisherCommissionRate(publisherId);
      const netRevenue = grossRevenue * (1 - commissionRate);

      const pipeline = this.redis.pipeline();

      // Update publisher daily revenue accumulation
      const revenueKey = REDIS_KEYS.PUBLISHER_REVENUE(publisherId, today);
      pipeline.incrbyfloat(revenueKey, netRevenue);

      // Cache detailed revenue data for PostgreSQL sync
      const revenueData = {
        publisherId,
        campaignId,
        inventoryId,
        websiteId,
        grossRevenue: grossRevenue, // Convert back to per-impression
        commissionRate,
        netRevenue: netRevenue,
        eventType: 'IMPRESSION',
        createdAt: new Date().toISOString(),
      };

      pipeline.lpush(
        REDIS_KEYS.PUBLISHER_REVENUE_PENDING,
        JSON.stringify(revenueData),
      );

      // Update daily aggregation cache
      const dailyKey = REDIS_KEYS.PUBLISHER_REVENUE_DAILY(publisherId, today);
      pipeline.hincrby(dailyKey, 'totalImpressions', 1);
      pipeline.hincrbyfloat(dailyKey, 'grossRevenue', grossRevenue);
      pipeline.hincrbyfloat(dailyKey, 'netRevenue', netRevenue);
      pipeline.hincrbyfloat(
        dailyKey,
        'commissionPaid',
        grossRevenue * commissionRate,
      );
      pipeline.expire(dailyKey, RTB_CACHE_TTL.PUBLISHER_REVENUE_PIPELINE); // 7 days

      await pipeline.exec();

      this.logger.debug('Publisher revenue cached', {
        publisherId,
        grossRevenue: grossRevenue,
        netRevenue: netRevenue,
        commissionRate,
      });
    } catch (error) {
      this.logger.error('Failed to cache publisher revenue', {
        error: error.message,
        publisherId,
        campaignId,
      });
    }
  }

  /**
   * Cache advertiser spending data for batch processing
   */
  private async cacheAdvertiserSpending(
    advertiserId: string,
    campaignId: string,
    creativeId: string,
    amount: number,
    today: string,
  ): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();

      // Update advertiser daily spending accumulation
      const spendingKey = REDIS_KEYS.ADVERTISER_SPENDING(advertiserId, today);
      pipeline.incrbyfloat(spendingKey, amount);

      // Cache detailed spending data for PostgreSQL sync
      const spendingData = {
        advertiserId,
        campaignId,
        creativeId,
        amount,
        eventType: 'IMPRESSION',
        createdAt: new Date().toISOString(),
      };

      pipeline.lpush(
        REDIS_KEYS.ADVERTISER_SPENDING_PENDING,
        JSON.stringify(spendingData),
      );

      // Update daily aggregation cache
      const dailyKey = REDIS_KEYS.ADVERTISER_SPENDING_DAILY(
        advertiserId,
        campaignId,
        today,
      );
      pipeline.hincrby(dailyKey, 'totalImpressions', 1);
      pipeline.hincrbyfloat(dailyKey, 'totalSpend', amount);
      pipeline.expire(dailyKey, RTB_CACHE_TTL.ADVERTISER_SPENDING_PIPELINE); // 7 days

      await pipeline.exec();

      this.logger.debug('Advertiser spending cached', {
        advertiserId,
        campaignId,
        amount,
      });
    } catch (error) {
      this.logger.error('Failed to cache advertiser spending', {
        error: error.message,
        advertiserId,
        campaignId,
      });
    }
  }

  /**
   * Cache system revenue data for batch processing
   */
  private async cacheSystemRevenue(
    campaignId: string,
    publisherId: string,
    advertiserId: string,
    creativeId: string,
    inventoryId: string,
    grossRevenue: number,
    today: string,
  ): Promise<void> {
    try {
      const commissionRate = await this.getPublisherCommissionRate(publisherId);
      const systemEarning = grossRevenue * commissionRate;
      const publisherShare = grossRevenue * (1 - commissionRate);

      const pipeline = this.redis.pipeline();

      // Update system daily revenue accumulation
      const systemRevenueKey = REDIS_KEYS.SYSTEM_REVENUE(today);
      pipeline.incrbyfloat(systemRevenueKey, systemEarning);

      // Cache detailed system revenue data for PostgreSQL sync
      const systemRevenueData = {
        campaignId,
        publisherId,
        advertiserId,
        creativeId,
        inventoryId,
        grossRevenue,
        publisherShare,
        systemEarning,
        commissionRate,
        eventType: 'IMPRESSION',
        createdAt: new Date().toISOString(),
      };

      pipeline.lpush(
        REDIS_KEYS.SYSTEM_REVENUE_PENDING,
        JSON.stringify(systemRevenueData),
      );

      // Update daily system aggregation cache
      const systemDailyKey = REDIS_KEYS.SYSTEM_REVENUE_DAILY(today);
      pipeline.hincrby(systemDailyKey, 'totalImpressions', 1);
      pipeline.hincrbyfloat(systemDailyKey, 'totalGrossRevenue', grossRevenue);
      pipeline.hincrbyfloat(
        systemDailyKey,
        'totalCommissionEarned',
        systemEarning,
      );
      pipeline.hincrbyfloat(
        systemDailyKey,
        'totalPublisherPayout',
        publisherShare,
      );
      pipeline.expire(systemDailyKey, RTB_CACHE_TTL.SYSTEM_REVENUE_PIPELINE); // 30 days

      await pipeline.exec();

      this.logger.debug('System revenue cached', {
        campaignId,
        grossRevenue: grossRevenue,
        systemEarning,
        publisherShare,
      });
    } catch (error) {
      this.logger.error('Failed to cache system revenue', {
        error: error.message,
        campaignId,
      });
    }
  }

  /**
   * Get publisher commission rate from cache or database
   */
  private async getPublisherCommissionRate(
    publisherId: string,
  ): Promise<number> {
    try {
      // Check cache first
      const cacheKey = REDIS_KEYS.PUBLISHER_REVENUE_TIERS(publisherId);
      const cached = await this.redis.get<string>(cacheKey);

      if (cached) {
        return parseFloat(cached);
      }

      // Fallback to database
      const publisher = await this.prisma.publisher.findUnique({
        where: { id: publisherId },
        include: { tier: true },
      });

      const commissionRate = publisher?.tier?.commissionRate
        ? Number(publisher.tier.commissionRate)
        : 0.4; // Default 40% commission

      // Cache for 30 days
      await this.redis.set(
        cacheKey,
        commissionRate.toString(),
        RTB_CACHE_TTL.PUBLISHER_REVENUE_TIERS,
      );

      return commissionRate;
    } catch (error) {
      this.logger.warn(
        'Failed to get publisher commission rate, using default',
        {
          error: error.message,
          publisherId,
        },
      );
      return 0.4; // Default 40% commission
    }
  }

  /**
   * Sync publisher revenue tiers to Redis cache
   */
  async syncPublisherRevenueTiers(): Promise<void> {
    try {
      this.logger.log('Syncing publisher revenue tiers to Redis...');

      const publishers = await this.prisma.publisher.findMany({
        where: { status: 'ACTIVE' },
        include: { tier: true },
      });

      const pipeline = this.redis.pipeline();

      for (const publisher of publishers) {
        const commissionRate = publisher.tier?.commissionRate
          ? Number(publisher.tier.commissionRate)
          : 0.4;

        const cacheKey = REDIS_KEYS.PUBLISHER_REVENUE_TIERS(publisher.id);
        pipeline.setex(
          cacheKey,
          RTB_CACHE_TTL.PUBLISHER_REVENUE_TIERS,
          commissionRate.toString(),
        ); // 30 days TTL
      }

      await pipeline.exec();

      this.logger.log(
        `✅ Synced ${publishers.length} publisher revenue tiers to Redis`,
      );
    } catch (error) {
      this.logger.error('Failed to sync publisher revenue tiers', {
        error: error.message,
      });
    }
  }

  /**
   * Get pending transaction counts for monitoring
   */
  async getPendingTransactionCounts(): Promise<{
    budgetTransactions: number;
    publisherRevenue: number;
    advertiserSpending: number;
    systemRevenue: number;
  }> {
    try {
      const [
        budgetTransactions,
        publisherRevenue,
        advertiserSpending,
        systemRevenue,
      ] = await Promise.all([
        this.redis.llen(REDIS_KEYS.BUDGET_TRANSACTION_PENDING),
        this.redis.llen(REDIS_KEYS.PUBLISHER_REVENUE_PENDING),
        this.redis.llen(REDIS_KEYS.ADVERTISER_SPENDING_PENDING),
        this.redis.llen(REDIS_KEYS.SYSTEM_REVENUE_PENDING),
      ]);

      return {
        budgetTransactions,
        publisherRevenue,
        advertiserSpending,
        systemRevenue,
      };
    } catch (error) {
      this.logger.error('Failed to get pending transaction counts', {
        error: error.message,
      });
      return {
        budgetTransactions: 0,
        publisherRevenue: 0,
        advertiserSpending: 0,
        systemRevenue: 0,
      };
    }
  }
}
