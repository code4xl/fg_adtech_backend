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

      // Get all reservation keys that might have expired
      const reservationKeys = await this.redis.keys('budget:reservation:*');

      if (reservationKeys.length === 0) {
        this.logger.debug('No reservations found to cleanup');
        return;
      }

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
      }

      const processingTime = Date.now() - startTime;

      // 🔧 FIX: Update cleanup metrics
      await this.updateCleanupMetrics({
        totalReservationsChecked: reservationKeys.length,
        totalCleaned,
        totalCreditedAmount: totalCredited,
        processingTimeMs: processingTime,
      });

      this.logger.log('✅ Reservation cleanup completed', {
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
   * 🔧 FIX: Clean up a single reservation if it has expired
   */
  private async cleanupSingleReservation(
    reservationKey: string,
  ): Promise<CleanupResult> {
    try {
      // Check if reservation still exists (TTL expired = key doesn't exist)
      const reservationExists = await this.redis.exists(reservationKey);

      if (reservationExists) {
        // Reservation still active, no cleanup needed
        return { cleaned: false };
      }

      // Extract reservation ID from key
      const reservationId = reservationKey.replace('budget:reservation:', '');

      // Get reservation metadata if it exists
      const metadataKey = REDIS_KEYS.REVENUE_METADATA(reservationId);
      const metadata = await this.redis.get(metadataKey);

      if (!metadata) {
        // No metadata found, reservation was already processed or invalid
        return { cleaned: false };
      }

      let reservationData;
      try {
        reservationData = JSON.parse(metadata as string);
      } catch (parseError) {
        this.logger.warn('Failed to parse reservation metadata', {
          reservationId,
          error: parseError.message,
        });
        // Clean up invalid metadata
        await this.redis.del(metadataKey);
        return { cleaned: true, creditedAmount: 0 };
      }

      // Check if this reservation was already confirmed
      if (reservationData.confirmed) {
        // Already confirmed, just cleanup metadata
        await this.redis.del(metadataKey);
        return { cleaned: true, creditedAmount: 0 };
      }

      // Reservation expired without confirmation - credit back the budget
      const creditedAmount =
        await this.creditBackExpiredReservation(reservationData);

      // Clean up metadata
      await this.redis.del(metadataKey);

      this.logger.debug('Credited back expired reservation', {
        reservationId,
        campaignId: reservationData.campaignId,
        amount: creditedAmount,
      });

      return {
        cleaned: true,
        creditedAmount,
      };
    } catch (error) {
      this.logger.warn('Failed to cleanup single reservation', {
        reservationKey,
        error: error.message,
      });
      return {
        cleaned: false,
        error: error.message,
      };
    }
  }

  /**
   * 🔧 FIX: Credit back budget for expired reservation
   */
  private async creditBackExpiredReservation(
    reservationData: any,
  ): Promise<number> {
    try {
      const { campaignId, costPerImpression } = reservationData;
      const today = new Date().toISOString().split('T')[0];

      if (!campaignId || !costPerImpression) {
        this.logger.warn('Invalid reservation data for credit back', {
          reservationData,
        });
        return 0;
      }

      // Credit back to daily spend counter (reduce spend)
      const currentSpendKey = REDIS_KEYS.DAILY_BUDGET_SPEND(campaignId, today);
      const currentSpend = await this.redis.get(currentSpendKey);

      if (currentSpend) {
        const currentSpendFloat = parseFloat(currentSpend as string);
        const newSpend = Math.max(0, currentSpendFloat - costPerImpression);

        await this.redis.set(currentSpendKey, newSpend.toString());

        // Update campaign status if it was exhausted
        await this.checkAndUpdateCampaignStatus(campaignId, newSpend);

        this.logger.debug('Budget credited back successfully', {
          campaignId,
          previousSpend: currentSpendFloat,
          creditAmount: costPerImpression,
          newSpend,
        });

        return costPerImpression;
      } else {
        this.logger.warn('No current spend found for campaign', {
          campaignId,
          today,
        });
        return 0;
      }
    } catch (error) {
      this.logger.error('Failed to credit back expired reservation', {
        error: error.message,
        reservationData,
      });
      return 0;
    }
  }

  /**
   * 🔧 FIX: Check and update campaign status after budget credit
   */
  private async checkAndUpdateCampaignStatus(
    campaignId: string,
    newSpend: number,
  ): Promise<void> {
    try {
      const campaignStatus = await this.redis.get(
        REDIS_KEYS.CAMPAIGN_STATUS(campaignId),
      );

      if (campaignStatus === 'BUDGET_EXHAUSTED') {
        // Check if we now have budget available
        const dailyLimit = await this.redis.get(
          REDIS_KEYS.DAILY_BUDGET_LIMIT(campaignId),
        );

        if (dailyLimit) {
          const limit = parseFloat(dailyLimit as string);

          if (newSpend < limit) {
            await this.redis.set(
              REDIS_KEYS.CAMPAIGN_STATUS(campaignId),
              'ACTIVE',
            );

            this.logger.log('Campaign reactivated after budget credit', {
              campaignId,
              newSpend,
              dailyLimit: limit,
            });
          }
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
   * 🔧 FIX: Update cleanup metrics for monitoring
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

      pipeline.incrbyfloat(
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
        totalCleanedToday: parseInt(todayCount as string) || 0,
        totalCreditedToday: parseFloat(todayCredited as string) || 0,
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
      this.logger.log('🔄 Manual cleanup triggered');

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
   * 🆕 NEW: Force cleanup specific reservation (for debugging)
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
        this.logger.log('✅ Force cleanup completed', {
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
   * 🆕 NEW: Get detailed reservation status (for debugging)
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
