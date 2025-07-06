// src/rtb/jobs/every-5-minutes/budget-cleanup.job.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BudgetManagerService } from 'src/rtb/services/budget-manager.service';
import { RedisService } from 'src/redis/redis.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class BudgetCleanupJob {
  private readonly logger = new Logger(BudgetCleanupJob.name);
  private isRunning = false;

  constructor(
    private readonly budgetManager: BudgetManagerService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Clean up expired budget reservations every 5 minutes
   * This prevents memory leaks and ensures accurate budget tracking
   */
  @Cron('*/5 * * * *', {
    name: 'cleanupExpiredBudgetReservations',
    timeZone: 'Asia/Kolkata',
  })
  async handleCleanupExpiredReservations(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('Cleanup already running, skipping this execution');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.logger.debug('🧹 Starting expired budget reservations cleanup');

      // 1. Clean up expired reservations using budget manager
      const cleanupResult =
        await this.budgetManager.cleanupExpiredReservations();

      // 2. Update cleanup metrics
      await this.updateCleanupMetrics(cleanupResult, startTime);

      // 3. Log results
      const processingTime = Date.now() - startTime;

      if (cleanupResult.cleanedCount > 0) {
        this.logger.log('✅ Budget reservations cleanup completed', {
          cleanedCount: cleanupResult.cleanedCount,
          reversedAmount: cleanupResult.reversedAmount,
          processingTimeMs: processingTime,
        });
      } else {
        this.logger.debug('No expired reservations to clean up');
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('❌ Budget cleanup job failed', {
        error: error.message,
        stack: error.stack,
        processingTimeMs: processingTime,
      });

      // Record failure metrics
      await this.recordCleanupFailure(error.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Emergency cleanup - can be triggered manually for critical situations
   */
  async triggerEmergencyCleanup(): Promise<{
    success: boolean;
    cleanedCount: number;
    reversedAmount: number;
    processingTime: number;
  }> {
    const startTime = Date.now();

    this.logger.log('🚨 Emergency budget cleanup triggered');

    try {
      const result = await this.budgetManager.cleanupExpiredReservations();
      const processingTime = Date.now() - startTime;

      this.logger.log('✅ Emergency cleanup completed', {
        cleanedCount: result.cleanedCount,
        reversedAmount: result.reversedAmount,
        processingTimeMs: processingTime,
      });

      return {
        success: true,
        cleanedCount: result.cleanedCount,
        reversedAmount: result.reversedAmount,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('❌ Emergency cleanup failed', {
        error: error.message,
        processingTimeMs: processingTime,
      });

      return {
        success: false,
        cleanedCount: 0,
        reversedAmount: 0,
        processingTime,
      };
    }
  }

  /**
   * Update cleanup metrics in Redis
   */
  private async updateCleanupMetrics(
    cleanupResult: { cleanedCount: number; reversedAmount: number },
    startTime: number,
  ): Promise<void> {
    try {
      const processingTime = Date.now() - startTime;
      const today = new Date().toISOString().split('T')[0];
      const hour = new Date().getHours();

      const pipeline = this.redis.pipeline();

      // Daily metrics
      pipeline.incr(`cleanup:budget:success:${today}`);
      pipeline.incrby(
        `cleanup:budget:cleaned:${today}`,
        cleanupResult.cleanedCount,
      );
      pipeline.incrbyfloat(
        `cleanup:budget:reversed:${today}`,
        cleanupResult.reversedAmount,
      );
      pipeline.incrby(`cleanup:budget:time:${today}`, processingTime);

      // Hourly metrics
      pipeline.incr(`cleanup:budget:hourly:${today}:${hour}`);
      pipeline.incrby(
        `cleanup:budget:cleaned:hourly:${today}:${hour}`,
        cleanupResult.cleanedCount,
      );

      // Set expiration (keep for 7 days)
      pipeline.expire(`cleanup:budget:success:${today}`, 86400 * 7);
      pipeline.expire(`cleanup:budget:cleaned:${today}`, 86400 * 7);
      pipeline.expire(`cleanup:budget:reversed:${today}`, 86400 * 7);
      pipeline.expire(`cleanup:budget:time:${today}`, 86400 * 7);
      pipeline.expire(`cleanup:budget:hourly:${today}:${hour}`, 86400 * 7);
      pipeline.expire(
        `cleanup:budget:cleaned:hourly:${today}:${hour}`,
        86400 * 7,
      );

      // Last run timestamp
      pipeline.set(
        'cleanup:budget:last-run',
        new Date().toISOString(),
        'EX',
        86400 * 7,
      );

      await pipeline.exec();
    } catch (error) {
      this.logger.warn('Failed to update cleanup metrics', {
        error: error.message,
      });
    }
  }

  /**
   * Record cleanup failure metrics
   */
  private async recordCleanupFailure(errorMessage: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const pipeline = this.redis.pipeline();

      // Increment failure count
      pipeline.incr(`cleanup:budget:failure:${today}`);
      pipeline.expire(`cleanup:budget:failure:${today}`, 86400 * 7);

      // Store recent error
      pipeline.lpush(
        'cleanup:budget:recent-errors',
        JSON.stringify({
          error: errorMessage,
          timestamp: new Date().toISOString(),
        }),
      );
      pipeline.ltrim('cleanup:budget:recent-errors', 0, 99); // Keep last 100 errors
      pipeline.expire('cleanup:budget:recent-errors', 86400 * 7);

      await pipeline.exec();
    } catch (error) {
      this.logger.warn('Failed to record cleanup failure metrics', {
        error: error.message,
      });
    }
  }

  /**
   * Get cleanup job status and metrics
   */
  async getCleanupStatus(): Promise<{
    isRunning: boolean;
    lastRun?: string;
    todaySuccessCount: number;
    todayFailureCount: number;
    todayCleanedCount: number;
    todayReversedAmount: number;
    averageProcessingTime: number;
    recentErrors: Array<{ error: string; timestamp: string }>;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [
        lastRun,
        successCount,
        failureCount,
        cleanedCount,
        reversedAmount,
        totalTime,
        recentErrorsRaw,
      ] = await Promise.all([
        this.redis.get('cleanup:budget:last-run'),
        this.redis.get(`cleanup:budget:success:${today}`),
        this.redis.get(`cleanup:budget:failure:${today}`),
        this.redis.get(`cleanup:budget:cleaned:${today}`),
        this.redis.get(`cleanup:budget:reversed:${today}`),
        this.redis.get(`cleanup:budget:time:${today}`),
        this.redis.lrange('cleanup:budget:recent-errors', 0, 4), // Last 5 errors
      ]);

      const todaySuccessCount = parseInt(successCount as string) || 0;
      const todayFailureCount = parseInt(failureCount as string) || 0;
      const todayCleanedCount = parseInt(cleanedCount as string) || 0;
      const todayReversedAmount = parseFloat(reversedAmount as string) || 0;
      const totalProcessingTime = parseInt(totalTime as string) || 0;

      const averageProcessingTime =
        todaySuccessCount > 0 ? totalProcessingTime / todaySuccessCount : 0;

      const recentErrors = recentErrorsRaw.map((errorStr) => {
        try {
          return JSON.parse(errorStr);
        } catch {
          return { error: errorStr, timestamp: 'unknown' };
        }
      });

      return {
        isRunning: this.isRunning,
        lastRun: lastRun as string,
        todaySuccessCount,
        todayFailureCount,
        todayCleanedCount,
        todayReversedAmount: Math.round(todayReversedAmount * 100) / 100,
        averageProcessingTime: Math.round(averageProcessingTime),
        recentErrors,
      };
    } catch (error) {
      this.logger.error('Failed to get cleanup status', {
        error: error.message,
      });

      return {
        isRunning: this.isRunning,
        todaySuccessCount: 0,
        todayFailureCount: 0,
        todayCleanedCount: 0,
        todayReversedAmount: 0,
        averageProcessingTime: 0,
        recentErrors: [],
      };
    }
  }
}
