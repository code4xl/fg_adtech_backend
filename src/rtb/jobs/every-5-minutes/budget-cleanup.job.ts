// src/rtb/jobs/every-5-minutes/budget-cleanup.job.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RedisService } from 'src/redis/redis.service';
import { REDIS_KEYS, RTB_CACHE_TTL } from 'src/rtb/constants/cache-keys';

interface CleanupResult {
  cleaned: boolean;
  creditedAmount?: number;
  error?: string;
}

interface CleanupMetrics {
  totalReservationsChecked: number;
  totalCleaned: number;
  totalCreditedAmount: number;
  processingTimeMs: number;
}

@Injectable()
export class BudgetCleanupJob {
  private readonly logger = new Logger(BudgetCleanupJob.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Clean up expired budget reservations every 5 minutes
   * This ensures that unredeemed reservations are properly credited back
   */
  @Cron('*/5 * * * *', {
    name: 'cleanupExpiredReservations',
    timeZone: 'Asia/Kolkata',
  })
  async cleanupExpiredReservations(): Promise<void> {
    const startTime = Date.now();
    let totalCleaned = 0;
    let totalCredited = 0;

    try {
      this.logger.debug('🧹 Starting expired reservation cleanup');

      // 🔧 FIX: Check metadata keys instead of reservation keys
      // Reservation keys auto-expire, but metadata keys have longer TTL
      const metadataKeys = await this.redis.keys('revenue:metadata:*');

      if (metadataKeys.length === 0) {
        this.logger.debug('No reservation metadata found to cleanup');
        return;
      }

      this.logger.debug(
        `Found ${metadataKeys.length} metadata entries to check`,
      );

      // Convert metadata keys to reservation keys for processing
      const reservationKeys = metadataKeys.map((key) => {
        const reservationId = key.replace('revenue:metadata:', '');
        return `budget:reservation:${reservationId}`;
      });

      // Process in batches to avoid overwhelming Redis
      const batchSize = 50;
      for (let i = 0; i < reservationKeys.length; i += batchSize) {
        const batch = reservationKeys.slice(i, i + batchSize);

        const cleanupResults = await Promise.all(
          batch.map((key) => this.cleanupSingleReservation(key)),
        );

        const batchCleaned = cleanupResults.filter(
          (result) => result.cleaned,
        ).length;

        const batchCredited = cleanupResults.reduce(
          (sum, result) => sum + (result.creditedAmount || 0),
          0,
        );

        totalCleaned += batchCleaned;
        totalCredited += batchCredited;

        this.logger.debug(`Processed batch ${Math.floor(i / batchSize) + 1}`, {
          batchSize: batch.length,
          batchCleaned,
          batchCredited,
          totalCleaned,
          totalCredited,
        });
      }

      const processingTime = Date.now() - startTime;

      // Update cleanup metrics
      await this.updateCleanupMetrics({
        totalReservationsChecked: metadataKeys.length, // Use metadata count
        totalCleaned,
        totalCreditedAmount: totalCredited,
        processingTimeMs: processingTime,
      });

      this.logger.debug('✅ Reservation cleanup completed', {
        totalMetadataChecked: metadataKeys.length,
        totalReservationsChecked: reservationKeys.length,
        totalCleaned,
        totalCreditedAmount: totalCredited,
        processingTimeMs: processingTime,
      });
    } catch (error) {
      this.logger.error('❌ Reservation cleanup failed', {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * 🔧 FIXED: Clean up single reservation with proper error handling
   */
  private async cleanupSingleReservation(
    reservationKey: string,
  ): Promise<CleanupResult> {
    const reservationId = reservationKey.replace('budget:reservation:', '');
    const metadataKey = REDIS_KEYS.REVENUE_METADATA(reservationId);
    const lockKey = `lock:cleanup:${reservationId}`;

    try {
      // 🔧 FIX: Proper Redis SET with NX and EX options
      const lockResult = await this.redis
        .getClient()
        .set(lockKey, '1', 'EX', 30, 'NX');
      if (!lockResult) {
        return {
          cleaned: false,
          error: 'Already being processed by another worker',
        };
      }

      // 🔧 FIX: Check TTL and handle both existing and expired reservations
      const ttl = await this.redis.ttl(reservationKey);

      // If reservation has significant time left, skip cleanup
      if (ttl > 30) {
        this.logger.debug('Reservation still has time left, skipping', {
          reservationId,
          ttlRemaining: ttl,
        });
        return { cleaned: false };
      }

      // Get metadata (this should exist even if reservation expired)
      const metadata = await this.redis.get(metadataKey);
      if (!metadata) {
        this.logger.debug('No metadata found for reservation', {
          reservationId,
          metadataKey,
        });
        return { cleaned: false, error: 'No metadata found' };
      }

      let reservationData;
      try {
        reservationData = JSON.parse(metadata as string);
      } catch (parseError) {
        this.logger.warn('Failed to parse reservation metadata', {
          reservationId,
          error: parseError.message,
        });
        await this.redis.del(metadataKey);
        return { cleaned: true, creditedAmount: 0 };
      }

      // Check if already processed to prevent double-processing
      if (reservationData.processed) {
        this.logger.debug(
          'Reservation already processed, cleaning up metadata',
          {
            reservationId,
          },
        );
        await this.redis.del(metadataKey);
        return { cleaned: true, creditedAmount: 0 };
      }

      // If reservation confirmed, just cleanup metadata
      if (reservationData.confirmed) {
        this.logger.debug('Reservation was confirmed, cleaning up metadata', {
          reservationId,
        });
        await this.redis.del(metadataKey);
        await this.redis.del(reservationKey); // Clean up reservation if it still exists
        return { cleaned: true, creditedAmount: 0 };
      }

      // 🔧 NEW: Handle the main case - reservation expired but not confirmed
      if (ttl === -2) {
        // Reservation key doesn't exist (expired) - this is the main case we want to handle
        this.logger.debug('Reservation expired, crediting back budget', {
          reservationId,
          campaignId: reservationData.campaignId,
          costPerImpression: reservationData.costPerImpression,
        });
      } else if (ttl === -1) {
        // Key exists but has no expiration (shouldn't happen in our system)
        this.logger.warn('Reservation key exists without TTL', {
          reservationId,
        });
      } else if (ttl <= 0) {
        // Key exists but expired
        this.logger.debug('Reservation key expired, crediting back budget', {
          reservationId,
          ttl,
        });
      }

      // Credit back budget atomically
      const creditedAmount = await this.atomicCreditBackBudget(reservationData);

      // Mark as processed to prevent double-processing
      reservationData.processed = true;
      reservationData.processedAt = new Date().toISOString();
      reservationData.creditedAmount = creditedAmount;

      // Update metadata with processed flag
      await this.redis.set(metadataKey, JSON.stringify(reservationData), 300); // Shorter TTL now

      // Clean up reservation key if it still exists
      await this.redis.del(reservationKey);

      this.logger.debug('✅ Credited back expired reservation', {
        reservationId,
        campaignId: reservationData.campaignId,
        amount: creditedAmount,
        finalPriceCPM: reservationData.finalPriceCPM,
      });

      return {
        cleaned: true,
        creditedAmount,
      };
    } catch (error) {
      this.logger.error('❌ Failed to cleanup single reservation', {
        reservationKey,
        reservationId,
        error: error.message,
      });
      return {
        cleaned: false,
        error: error.message,
      };
    } finally {
      // Always release the lock
      await this.redis.del(lockKey);
    }
  }

  /**
   * 🔧 FIXED: Atomic budget credit-back with proper Redis operations
   */
  private async atomicCreditBackBudget(reservationData: any): Promise<number> {
    try {
      const { campaignId, costPerImpression } = reservationData;
      const today = new Date().toISOString().split('T')[0];
      const currentSpendKey = REDIS_KEYS.DAILY_BUDGET_SPEND(campaignId, today);

      if (!campaignId || !costPerImpression) {
        this.logger.warn('Invalid reservation data for credit back', {
          reservationData,
        });
        return 0;
      }

      // 🔧 FIX: Use Redis client directly for incrbyfloat
      const newSpend = await this.redis
        .getClient()
        .incrbyfloat(currentSpendKey, -costPerImpression);

      // 🔧 FIX: Handle newSpend as number (incrbyfloat returns number as string)
      const newSpendFloat = parseFloat(newSpend);

      // Ensure spend doesn't go negative
      if (newSpendFloat < 0) {
        await this.redis.set(currentSpendKey, '0');
        this.logger.debug('Corrected negative spend to 0', {
          campaignId,
          negativeSpend: newSpendFloat,
        });
      }

      // Update campaign status if budget was exhausted
      await this.checkAndUpdateCampaignStatus(
        campaignId,
        Math.max(0, newSpendFloat),
      );

      this.logger.debug('✅ Budget credited back atomically', {
        campaignId,
        creditAmount: costPerImpression,
        newSpend: Math.max(0, newSpendFloat),
      });

      return costPerImpression;
    } catch (error) {
      this.logger.error('❌ Failed to credit back budget atomically', {
        error: error.message,
        reservationData,
      });
      return 0;
    }
  }

  /**
   * 🔧 IMPROVED: Better campaign status checking
   */
  private async checkAndUpdateCampaignStatus(
    campaignId: string,
    newSpend: number,
  ): Promise<void> {
    try {
      const [campaignStatus, dailyLimitStr] = await Promise.all([
        this.redis.get(REDIS_KEYS.CAMPAIGN_STATUS(campaignId)),
        this.redis.get(REDIS_KEYS.DAILY_BUDGET_LIMIT(campaignId)),
      ]);

      if (campaignStatus === 'BUDGET_EXHAUSTED' && dailyLimitStr) {
        const dailyLimit = parseFloat(dailyLimitStr as string);

        // Add buffer to prevent immediate re-exhaustion
        const reactivationThreshold = dailyLimit * 0.95; // 95% of budget

        if (newSpend < reactivationThreshold) {
          await this.redis.set(
            REDIS_KEYS.CAMPAIGN_STATUS(campaignId),
            'ACTIVE',
          );

          this.logger.debug('✅ Campaign reactivated after budget credit', {
            campaignId,
            newSpend,
            dailyLimit,
            reactivationThreshold,
          });
        }
      }
    } catch (error) {
      this.logger.warn('Failed to update campaign status after credit', {
        error: error.message,
        campaignId,
      });
    }
  }

  /**
   * 🔧 FIXED: Update cleanup metrics for monitoring
   */
  private async updateCleanupMetrics(metrics: CleanupMetrics): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const pipeline = this.redis.pipeline();

      // Store daily metrics
      pipeline.setex(
        `cleanup:reservations:last-run`,
        86400, // 24 hours
        new Date().toISOString(),
      );

      pipeline.incrby(
        `cleanup:reservations:count:${today}`,
        metrics.totalCleaned,
      );
      pipeline.expire(`cleanup:reservations:count:${today}`, 86400 * 7); // 7 days

      // 🔧 FIX: Use incrbyfloat through pipeline or Redis client
      const redisClient = this.redis.getClient();
      await redisClient.incrbyfloat(
        `cleanup:reservations:credited:${today}`,
        metrics.totalCreditedAmount,
      );
      pipeline.expire(`cleanup:reservations:credited:${today}`, 86400 * 7); // 7 days

      pipeline.setex(
        `cleanup:reservations:processing-time:${today}`,
        86400, // 24 hours
        metrics.processingTimeMs.toString(),
      );

      await pipeline.exec();
    } catch (error) {
      this.logger.warn('Failed to update cleanup metrics', {
        error: error.message,
      });
    }
  }

  /**
   * Get cleanup metrics for monitoring
   */
  async getCleanupMetrics(): Promise<{
    pendingReservations: number;
    lastCleanupRun?: string;
    totalCleanedToday: number;
    totalCreditedToday: number;
    lastProcessingTime?: number;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [
        reservationKeys,
        lastRun,
        todayCount,
        todayCredited,
        lastProcessingTime,
      ] = await Promise.all([
        this.redis.keys('budget:reservation:*'),
        this.redis.get('cleanup:reservations:last-run'),
        this.redis.get(`cleanup:reservations:count:${today}`),
        this.redis.get(`cleanup:reservations:credited:${today}`),
        this.redis.get(`cleanup:reservations:processing-time:${today}`),
      ]);

      return {
        pendingReservations: reservationKeys.length,
        lastCleanupRun: lastRun as string,
        totalCleanedToday: parseInt((todayCount as string) || '0') || 0,
        totalCreditedToday: parseFloat((todayCredited as string) || '0') || 0,
        lastProcessingTime: lastProcessingTime
          ? parseInt(lastProcessingTime as string)
          : undefined,
      };
    } catch (error) {
      this.logger.error('Failed to get cleanup metrics', {
        error: error.message,
      });
      return {
        pendingReservations: 0,
        totalCleanedToday: 0,
        totalCreditedToday: 0,
      };
    }
  }

  /**
   * Manual trigger for cleanup (useful for testing)
   */
  async triggerManualCleanup(): Promise<{
    success: boolean;
    metrics?: CleanupMetrics;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      this.logger.debug('🔄 Manual cleanup triggered');

      await this.cleanupExpiredReservations();

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        metrics: {
          totalReservationsChecked: 0, // Would need to track this
          totalCleaned: 0, // Would need to track this
          totalCreditedAmount: 0, // Would need to track this
          processingTimeMs: processingTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Force cleanup specific reservation (for debugging)
   */
  async forceCleanupReservation(reservationId: string): Promise<{
    success: boolean;
    credited?: number;
    error?: string;
  }> {
    try {
      const reservationKey = REDIS_KEYS.BUDGET_RESERVATION(reservationId);
      const result = await this.cleanupSingleReservation(reservationKey);

      if (result.cleaned) {
        this.logger.debug('✅ Force cleanup completed', {
          reservationId,
          credited: result.creditedAmount || 0,
        });

        return {
          success: true,
          credited: result.creditedAmount || 0,
        };
      } else {
        return {
          success: false,
          error: result.error || 'Reservation not found or already processed',
        };
      }
    } catch (error) {
      this.logger.error('❌ Force cleanup failed', {
        error: error.message,
        reservationId,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get detailed reservation status (for debugging)
   */
  async getReservationStatus(reservationId: string): Promise<{
    exists: boolean;
    metadata?: any;
    ttl?: number;
  }> {
    try {
      const [reservationExists, metadata, ttl] = await Promise.all([
        this.redis.exists(REDIS_KEYS.BUDGET_RESERVATION(reservationId)),
        this.redis.get(REDIS_KEYS.REVENUE_METADATA(reservationId)),
        this.redis.ttl(REDIS_KEYS.BUDGET_RESERVATION(reservationId)),
      ]);

      return {
        exists: reservationExists === 1,
        metadata: metadata ? JSON.parse(metadata as string) : null,
        ttl: ttl > 0 ? ttl : undefined,
      };
    } catch (error) {
      this.logger.error('Failed to get reservation status', {
        error: error.message,
        reservationId,
      });

      return {
        exists: false,
      };
    }
  }
}
