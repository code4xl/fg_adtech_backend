// src/rtb/jobs/every-5-minutes/budget-cleanup.job.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RedisService } from 'src/redis/redis.service';
import { REDIS_KEYS, RTB_CACHE_TTL } from 'src/rtb/constants/cache-keys';

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
   * Clean up a single reservation if it has expired
   */
  private async cleanupSingleReservation(reservationKey: string): Promise<{
    cleaned: boolean;
    creditedAmount?: number;
  }> {
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

      const reservationData = JSON.parse(metadata as string);

      // Check if this reservation was already confirmed
      if (reservationData.confirmed) {
        // Already confirmed, just cleanup metadata
        await this.redis.del(metadataKey);
        return { cleaned: true, creditedAmount: 0 };
      }

      // Reservation expired without confirmation - credit back the budget
      await this.creditBackExpiredReservation(reservationData);

      // Clean up metadata
      await this.redis.del(metadataKey);

      this.logger.debug('Credited back expired reservation', {
        reservationId,
        campaignId: reservationData.campaignId,
        amount: reservationData.costPerImpression,
      });

      return {
        cleaned: true,
        creditedAmount: reservationData.costPerImpression,
      };
    } catch (error) {
      this.logger.warn('Failed to cleanup single reservation', {
        reservationKey,
        error: error.message,
      });
      return { cleaned: false };
    }
  }

  /**
   * Credit back budget for expired reservation
   */
  private async creditBackExpiredReservation(
    reservationData: any,
  ): Promise<void> {
    try {
      const { campaignId, costPerImpression } = reservationData;
      const today = new Date().toISOString().split('T')[0];

      // Credit back to daily spend counter (reduce spend)
      const currentSpend = await this.redis.get(
        REDIS_KEYS.DAILY_BUDGET_SPEND(campaignId, today),
      );

      if (currentSpend) {
        const newSpend = Math.max(
          0,
          parseFloat(currentSpend as string) - costPerImpression,
        );
        await this.redis.set(
          REDIS_KEYS.DAILY_BUDGET_SPEND(campaignId, today),
          newSpend.toString(),
        );
      }

      // Update campaign status if it was exhausted
      const campaignStatus = await this.redis.get(
        REDIS_KEYS.CAMPAIGN_STATUS(campaignId),
      );
      if (campaignStatus === 'BUDGET_EXHAUSTED') {
        // Check if we now have budget available
        const dailyLimit = await this.redis.get(
          REDIS_KEYS.DAILY_BUDGET_LIMIT(campaignId),
        );
        if (dailyLimit && newSpend < parseFloat(dailyLimit as string)) {
          await this.redis.set(
            REDIS_KEYS.CAMPAIGN_STATUS(campaignId),
            'ACTIVE',
          );

          this.logger.log('Campaign reactivated after budget credit', {
            campaignId,
            newSpend,
            dailyLimit: parseFloat(dailyLimit as string),
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to credit back expired reservation', {
        error: error.message,
        reservationData,
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
  }> {
    try {
      const [pendingReservations, lastRun, todayCount] = await Promise.all([
        this.redis.keys('budget:reservation:*').then((keys) => keys.length),
        this.redis.get('cleanup:reservations:last-run'),
        this.redis.get(
          `cleanup:reservations:count:${new Date().toISOString().split('T')[0]}`,
        ),
      ]);

      return {
        pendingReservations,
        lastCleanupRun: lastRun as string,
        totalCleanedToday: parseInt(todayCount as string) || 0,
      };
    } catch (error) {
      this.logger.error('Failed to get cleanup metrics', {
        error: error.message,
      });
      return {
        pendingReservations: 0,
        totalCleanedToday: 0,
      };
    }
  }

  /**
   * Manual trigger for cleanup (useful for testing)
   */
  async triggerManualCleanup(): Promise<{
    success: boolean;
    cleaned: number;
    credited: number;
    processingTime: number;
  }> {
    const startTime = Date.now();

    try {
      await this.cleanupExpiredReservations();

      return {
        success: true,
        cleaned: 0, // Would need to track this in the actual implementation
        credited: 0, // Would need to track this in the actual implementation
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        cleaned: 0,
        credited: 0,
        processingTime: Date.now() - startTime,
      };
    }
  }
}
