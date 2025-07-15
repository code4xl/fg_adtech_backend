// src/rtb/services/budget-manager.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { REDIS_KEYS, RTB_CACHE_TTL } from '../constants/cache-keys';

@Injectable()
export class BudgetManagerService {
  private readonly logger = new Logger(BudgetManagerService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) { }

  /**
   * 🎯 FIXED: Reserve budget when auction is won
   * This creates a temporary reservation that expires if not confirmed
   */
  async reserveBudgetOnWin(
    winningBid: any,
    publisherId: string,
    inventoryId: string,
    websiteId: string,
    auctionId: string,
    finalPriceCPM: number,
  ): Promise<string> {
    const today = new Date().toISOString().split('T')[0];

    // 🔧 SIMPLIFIED: Use only bidResponseId for reservation tracking
    const reservationId = winningBid.id; // Just the bidResponseId

    // 🔧 FIX: Convert CPM to per-impression cost consistently
    const costPerImpression = finalPriceCPM / 1000;

    try {
      this.logger.debug("In Budget Reservation Won");

      // 1. Create reservation metadata
      const reservationData = {
        reservationId,
        campaignId: winningBid.campaignId,
        advertiserId: winningBid.advertiserId,
        publisherId,
        inventoryId,
        websiteId,
        creativeId: winningBid.creativeId,
        bidResponseId: winningBid.id,
        auctionId,
        finalPriceCPM,
        costPerImpression,
        reservedAt: new Date().toISOString(),
        confirmed: false,
      };

      // 2. Store reservation with TTL (5 minutes)
      await this.redis.set(
        REDIS_KEYS.BUDGET_RESERVATION(reservationId),
        JSON.stringify(reservationData),
        RTB_CACHE_TTL.BUDGET_RESERVATION, // 300 seconds = 5 minutes
      );

      // 3. Store metadata separately for cleanup job
      await this.redis.set(
        REDIS_KEYS.REVENUE_METADATA(reservationId),
        JSON.stringify(reservationData),
        RTB_CACHE_TTL.REVENUE_METADATA, // 600 seconds = 10 minutes (longer than reservation)
      );

      // 4. Immediately deduct from available budget (optimistic locking)
      await this.deductBudgetForReservation(
        winningBid.campaignId,
        costPerImpression,
        today,
      );

      // 5. Track reservation for monitoring
      await this.trackReservation(reservationId, winningBid.campaignId, today);

      this.logger.debug(' Budget reserved successfully', {
        reservationId,
        campaignId: winningBid.campaignId,
        costPerImpression,
        finalPriceCPM,
      });

      return reservationId;
    } catch (error) {
      this.logger.error('❌ Failed to reserve budget', {
        error: error.message,
        campaignId: winningBid.campaignId,
        costPerImpression,
      });
      throw error;
    }
  }

  /**
   * 🎯 FIXED: Confirm budget when impression is tracked
   * This converts the reservation into actual spend
   */
  async confirmReservedBudget(
    reservationId: string,
    campaignId: string,
    publisherId: string,
    inventoryId: string,
    websiteId: string,
    advertiserId: string,
    creativeId: string,
    costPerImpression: number,
  ): Promise<boolean> {
    try {
      // 1. Check if reservation exists
      const reservation = await this.redis.get(
        REDIS_KEYS.BUDGET_RESERVATION(reservationId),
      );

      if (!reservation) {
        this.logger.warn('⚠️ Reservation not found or expired', {
          reservationId,
          campaignId,
        });

        // Fallback: Deduct budget directly if reservation expired
        const today = new Date().toISOString().split('T')[0];
        await this.deductBudgetForReservation(
          campaignId,
          costPerImpression,
          today,
        );
        this.logger.debug(
          ' Budget deducted without reservation and proceeding to revenue sharing',
          {
            reservationId,
            campaignId,
            costPerImpression,
          },
        );
        await this.processRevenueSharing(
          campaignId,
          publisherId,
          inventoryId,
          websiteId,
          advertiserId,
          creativeId,
          costPerImpression,
        );
        return true;
      }

      const reservationData = JSON.parse(reservation as string);

      // 2. Validate reservation data
      if (reservationData.campaignId !== campaignId) {
        this.logger.error('❌ Campaign ID mismatch in reservation', {
          reservationId,
          expectedCampaignId: campaignId,
          actualCampaignId: reservationData.campaignId,
        });
        return false;
      }

      // 3. Mark reservation as confirmed
      reservationData.confirmed = true;
      reservationData.confirmedAt = new Date().toISOString();

      // 4. Update metadata
      await this.redis.set(
        REDIS_KEYS.REVENUE_METADATA(reservationId),
        JSON.stringify(reservationData),
        RTB_CACHE_TTL.REVENUE_METADATA,
      );

      // 5. Process revenue sharing (publisher, advertiser, system)
      await this.processRevenueSharing(
        campaignId,
        publisherId,
        inventoryId,
        websiteId,
        advertiserId,
        creativeId,
        costPerImpression,
      );

      // 6. Clean up reservation (it's now confirmed)
      await this.redis.del(REDIS_KEYS.BUDGET_RESERVATION(reservationId));

      this.logger.debug(' Budget confirmed successfully', {
        reservationId,
        campaignId,
        costPerImpression,
      });

      return true;
    } catch (error) {
      this.logger.error('❌ Failed to confirm budget', {
        error: error.message,
        reservationId,
        campaignId,
      });
      return false;
    }
  }

  /**
   * Deduct budget from campaign's daily allocation
   */
  private async deductBudgetForReservation(
    campaignId: string,
    costPerImpression: number,
    today: string,
  ): Promise<void> {
    const pipeline = this.redis.pipeline();

    // Increment daily spend
    pipeline.incrbyfloat(
      REDIS_KEYS.DAILY_BUDGET_SPEND(campaignId, today),
      costPerImpression,
    );

    // Check if budget is exhausted
    const [, dailyLimit] = await Promise.all([
      pipeline.exec(),
      this.redis.get(REDIS_KEYS.DAILY_BUDGET_LIMIT(campaignId)),
    ]);

    if (dailyLimit) {
      const currentSpend = await this.redis.get(
        REDIS_KEYS.DAILY_BUDGET_SPEND(campaignId, today),
      );
      const limit = parseFloat(dailyLimit as string);
      const spend = parseFloat((currentSpend as string) || '0');

      if (spend >= limit) {
        await this.redis.set(
          REDIS_KEYS.CAMPAIGN_STATUS(campaignId),
          'BUDGET_EXHAUSTED',
        );

        this.logger.warn('Campaign budget exhausted', {
          campaignId,
          spend,
          limit,
        });
      }
    }
  }

  /**
   * Process revenue sharing between publisher, advertiser, and system
   */
  private async processRevenueSharing(
    campaignId: string,
    publisherId: string,
    inventoryId: string,
    websiteId: string,
    advertiserId: string,
    creativeId: string,
    costPerImpression: number,
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    try {
      // Get publisher commission rate
      const commissionRate = await this.getPublisherCommissionRate(publisherId);

      const grossRevenue = costPerImpression;
      const publisherShare = grossRevenue * commissionRate;
      const systemEarning = grossRevenue - publisherShare;
      this.logger.debug('Processing revenue sharing', {
        campaignId,
        publisherId,
        grossRevenue,
        costPerImpression,
        publisherShare,
        systemEarning,
        commissionRate,
      });
      // 1. Publisher Revenue
      const publisherRevenueData = {
        publisherId,
        campaignId,
        inventoryId,
        websiteId,
        grossRevenue,
        commissionRate,
        netRevenue: publisherShare,
        eventType: 'IMPRESSION',
        createdAt: new Date().toISOString(),
      };

      await this.redis.lpush(
        REDIS_KEYS.PUBLISHER_REVENUE_PENDING,
        JSON.stringify(publisherRevenueData),
      );

      // 2. Advertiser Spending
      const advertiserSpendingData = {
        advertiserId,
        campaignId,
        creativeId,
        amount: costPerImpression,
        eventType: 'IMPRESSION',
        createdAt: new Date().toISOString(),
      };

      await this.redis.lpush(
        REDIS_KEYS.ADVERTISER_SPENDING_PENDING,
        JSON.stringify(advertiserSpendingData),
      );

      // 3. System Revenue
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

      await this.redis.lpush(
        REDIS_KEYS.SYSTEM_REVENUE_PENDING,
        JSON.stringify(systemRevenueData),
      );

      // 4. Budget Transaction Record
      const budgetTransactionData = {
        campaignId,
        type: 'IMPRESSION_COST',
        amount: costPerImpression,
        description: `Impression cost for creative ${creativeId}`,
        publisherId,
        inventoryId,
        createdAt: new Date().toISOString(),
      };

      await this.redis.lpush(
        REDIS_KEYS.BUDGET_TRANSACTION_PENDING,
        JSON.stringify(budgetTransactionData),
      );

      // 5. Update daily aggregations
      await this.updateDailyAggregations(
        publisherId,
        advertiserId,
        campaignId,
        grossRevenue,
        publisherShare,
        systemEarning,
        today,
      );

      this.logger.debug(' Revenue sharing processed', {
        campaignId,
        publisherId,
        grossRevenue,
        publisherShare,
        systemEarning,
      });
    } catch (error) {
      this.logger.error('❌ Failed to process revenue sharing', {
        error: error.message,
        campaignId,
        publisherId,
      });
      throw error;
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
      const cached = await this.redis.get(
        REDIS_KEYS.PUBLISHER_REVENUE_TIERS(publisherId),
      );
      if (cached) {
        return parseFloat(cached as string);
      }

      // Fallback to database
      const publisher = await this.prisma.publisher.findUnique({
        where: { id: publisherId },
        include: { tier: true },
      });

      const commissionRate = publisher?.tier?.commissionRate
        ? parseFloat(publisher.tier.commissionRate.toString())
        : 0.4; // Default 40%

      // Cache for 30 days
      await this.redis.set(
        REDIS_KEYS.PUBLISHER_REVENUE_TIERS(publisherId),
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
      return 0.4; // Default 40%
    }
  }

  /**
   * Update daily aggregations in Redis
   */
  // private async updateDailyAggregations(
  //   publisherId: string,
  //   advertiserId: string,
  //   campaignId: string,
  //   grossRevenue: number,
  //   publisherShare: number,
  //   systemEarning: number,
  //   today: string,
  // ): Promise<void> {
  //   const pipeline = this.redis.pipeline();

  //   // Publisher daily aggregation
  //   const publisherDailyKey = REDIS_KEYS.PUBLISHER_REVENUE_DAILY(
  //     publisherId,
  //     today,
  //   );
  //   pipeline.hincrby(publisherDailyKey, 'totalImpressions', 1);
  //   pipeline.hincrbyfloat(publisherDailyKey, 'grossRevenue', grossRevenue);
  //   pipeline.hincrbyfloat(publisherDailyKey, 'netRevenue', publisherShare);
  //   pipeline.hincrbyfloat(
  //     publisherDailyKey,
  //     'commissionPaid',
  //     grossRevenue - publisherShare,
  //   );
  //   pipeline.expire(publisherDailyKey, 86400 * 32); // 32 days

  //   // Advertiser daily aggregation
  //   const advertiserDailyKey = REDIS_KEYS.ADVERTISER_SPENDING_DAILY(
  //     advertiserId,
  //     campaignId,
  //     today,
  //   );
  //   pipeline.hincrby(advertiserDailyKey, 'totalImpressions', 1);
  //   pipeline.hincrbyfloat(advertiserDailyKey, 'totalSpend', grossRevenue);
  //   pipeline.expire(advertiserDailyKey, 86400 * 32); // 32 days

  //   // System daily aggregation
  //   const systemDailyKey = REDIS_KEYS.SYSTEM_REVENUE_DAILY(today);
  //   pipeline.hincrby(systemDailyKey, 'totalImpressions', 1);
  //   pipeline.hincrbyfloat(systemDailyKey, 'totalGrossRevenue', grossRevenue);
  //   pipeline.hincrbyfloat(
  //     systemDailyKey,
  //     'totalCommissionEarned',
  //     systemEarning,
  //   );
  //   pipeline.hincrbyfloat(
  //     systemDailyKey,
  //     'totalPublisherPayout',
  //     publisherShare,
  //   );
  //   pipeline.expire(systemDailyKey, 86400 * 32); // 32 days

  //   await pipeline.exec();
  // }

  private async updateDailyAggregations(
    publisherId: string,
    advertiserId: string,
    campaignId: string,
    grossRevenue: number,
    publisherShare: number,
    systemEarning: number,
    today: string,
  ): Promise<void> {
    // 🔧 CRITICAL: Use Redis transactions with proper locking
    const lockKey = `lock:daily:aggregation:${today}`;
    const lockTimeout = 5000; // 5 seconds

    try {
      // 🔧 FIX: Acquire distributed lock to prevent race conditions
      const lockAcquired = await this.redis.getClient().set(
        lockKey,
        'locked',
        'PX',
        lockTimeout,
        'NX'
      );

      if (!lockAcquired) {
        // Wait and retry if lock not acquired
        await new Promise(resolve => setTimeout(resolve, 100));
        return this.updateDailyAggregations(
          publisherId, advertiserId, campaignId,
          grossRevenue, publisherShare, systemEarning, today
        );
      }

      // 🔧 ATOMIC: Single pipeline with proper initialization
      const pipeline = this.redis.pipeline();

      // ===== PUBLISHER DAILY AGGREGATION =====
      const publisherDailyKey = REDIS_KEYS.PUBLISHER_REVENUE_DAILY(publisherId, today);

      // Initialize all fields if they don't exist
      pipeline.hsetnx(publisherDailyKey, 'totalImpressions', '0');
      pipeline.hsetnx(publisherDailyKey, 'totalClicks', '0');
      pipeline.hsetnx(publisherDailyKey, 'grossRevenue', '0');
      pipeline.hsetnx(publisherDailyKey, 'netRevenue', '0');
      pipeline.hsetnx(publisherDailyKey, 'commissionPaid', '0');

      // Now increment atomically
      pipeline.hincrby(publisherDailyKey, 'totalImpressions', 1);
      pipeline.hincrbyfloat(publisherDailyKey, 'grossRevenue', grossRevenue);
      pipeline.hincrbyfloat(publisherDailyKey, 'netRevenue', publisherShare);
      pipeline.hincrbyfloat(publisherDailyKey, 'commissionPaid', grossRevenue - publisherShare);
      pipeline.expire(publisherDailyKey, 86400 * 32);

      // ===== ADVERTISER DAILY AGGREGATION =====
      const advertiserDailyKey = REDIS_KEYS.ADVERTISER_SPENDING_DAILY(advertiserId, campaignId, today);

      pipeline.hsetnx(advertiserDailyKey, 'totalImpressions', '0');
      pipeline.hsetnx(advertiserDailyKey, 'totalClicks', '0');
      pipeline.hsetnx(advertiserDailyKey, 'totalSpend', '0');

      pipeline.hincrby(advertiserDailyKey, 'totalImpressions', 1);
      pipeline.hincrbyfloat(advertiserDailyKey, 'totalSpend', grossRevenue);
      pipeline.expire(advertiserDailyKey, 86400 * 32);

      // ===== SYSTEM DAILY AGGREGATION =====
      const systemDailyKey = REDIS_KEYS.SYSTEM_REVENUE_DAILY(today);

      pipeline.hsetnx(systemDailyKey, 'totalImpressions', '0');
      pipeline.hsetnx(systemDailyKey, 'totalClicks', '0');
      pipeline.hsetnx(systemDailyKey, 'totalGrossRevenue', '0');
      pipeline.hsetnx(systemDailyKey, 'totalCommissionEarned', '0');
      pipeline.hsetnx(systemDailyKey, 'totalPublisherPayout', '0');

      pipeline.hincrby(systemDailyKey, 'totalImpressions', 1);
      pipeline.hincrbyfloat(systemDailyKey, 'totalGrossRevenue', grossRevenue);
      pipeline.hincrbyfloat(systemDailyKey, 'totalCommissionEarned', systemEarning);
      pipeline.hincrbyfloat(systemDailyKey, 'totalPublisherPayout', publisherShare);
      pipeline.expire(systemDailyKey, 86400 * 32);

      // 🔧 CRITICAL: Execute with proper error handling
      const results = await pipeline.exec();

      if (!results) {
        throw new Error('Pipeline execution returned null');
      }

      // 🔧 VALIDATE: Check for any failed operations
      const failedOps = results.filter(([err]) => err !== null);
      if (failedOps.length > 0) {
        this.logger.error('❌ Daily aggregation pipeline failed', {
          publisherId,
          advertiserId,
          campaignId,
          totalOps: results.length,
          failedOps: failedOps.length,
          errors: failedOps.map(([err]) => err?.message),
        });
        throw new Error(`${failedOps.length} pipeline operations failed`);
      }

      // 🔧 SUCCESS LOGGING
      this.logger.debug('✅ Daily aggregations updated atomically', {
        publisherId,
        advertiserId,
        campaignId,
        grossRevenue,
        publisherShare,
        systemEarning,
        totalOperations: results.length,
      });

    } catch (error) {
      this.logger.error('❌ CRITICAL: Daily aggregation failed', {
        error: error.message,
        publisherId,
        advertiserId,
        campaignId,
        stack: error.stack,
      });
      throw error;
    } finally {
      // 🔧 ALWAYS: Release the lock
      try {
        await this.redis.del(lockKey);
      } catch (lockError) {
        this.logger.warn('Failed to release aggregation lock', {
          lockKey,
          error: lockError.message,
        });
      }
    }
  }

  /**
   * Track reservation for monitoring
   */
  private async trackReservation(
    reservationId: string,
    campaignId: string,
    today: string,
  ): Promise<void> {
    const trackingKey = REDIS_KEYS.RESERVATION_TRACKING(today, campaignId);
    await this.redis.sadd(trackingKey, reservationId);
    await this.redis.expire(trackingKey, RTB_CACHE_TTL.RESERVATION_TRACKING);
  }

  /**
   * Sync publisher revenue tiers from database to Redis
   */
  async syncPublisherRevenueTiers(): Promise<void> {
    try {
      const publishers = await this.prisma.publisher.findMany({
        include: { tier: true },
        where: { status: 'ACTIVE' },
      });

      const pipeline = this.redis.pipeline();

      for (const publisher of publishers) {
        const commissionRate = publisher.tier?.commissionRate
          ? parseFloat(publisher.tier.commissionRate.toString())
          : 0.4;

        pipeline.setex(
          REDIS_KEYS.PUBLISHER_REVENUE_TIERS(publisher.id),
          RTB_CACHE_TTL.PUBLISHER_REVENUE_TIERS,
          commissionRate.toString(),
        );
      }

      await pipeline.exec();

      this.logger.debug(`${publishers.length} Publisher revenue tiers synced`);
    } catch (error) {
      this.logger.error('❌ Failed to sync publisher revenue tiers', {
        error: error.message,
      });
    }
  }
}
