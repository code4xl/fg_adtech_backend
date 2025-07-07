import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BudgetSyncService } from '../../services/budget-sync.service';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class BudgetSyncToPostgresJob {
  private readonly logger = new Logger(BudgetSyncToPostgresJob.name);

  constructor(
    private readonly budgetSyncService: BudgetSyncService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Sync daily budget spends every 15 minutes
   * Frequent sync ensures PostgreSQL data stays fresh
   */
  @Cron('*/15 * * * *', {
    name: 'syncDailyBudgetSpends',
    timeZone: 'Asia/Kolkata',
  })
  async handleDailyBudgetSync() {
    const startTime = Date.now();

    try {
      this.logger.debug('🔄 Starting scheduled daily budget sync');

      // Sync daily budget spends from Redis to PostgreSQL
      const result = await this.budgetSyncService.syncDailyBudgetSpends();

      const processingTime = Date.now() - startTime;

      if (result.success) {
        this.logger.debug('✅ Scheduled daily budget sync completed', {
          campaignsSynced: result.campaignsSynced,
          totalSpendSynced: result.totalSpendSynced,
          processingTimeMs: processingTime,
        });
      } else {
        this.logger.error('❌ Scheduled daily budget sync had errors', {
          campaignsSynced: result.campaignsSynced,
          totalSpendSynced: result.totalSpendSynced,
          errorCount: result.errors.length,
          errors: result.errors.slice(0, 5), // Log first 5 errors
          processingTimeMs: processingTime,
        });
      }

      // Update last sync timestamp
      await this.redis.set(
        'budget:sync:last-run',
        new Date().toISOString(),
        86400, // 24 hours TTL
      );

      // Update sync metrics
      await this.updateSyncMetrics(result, processingTime);
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('❌ Scheduled daily budget sync failed completely', {
        error: error.message,
        stack: error.stack,
        processingTimeMs: processingTime,
      });

      // Record failure
      await this.recordSyncFailure(error.message);
    }
  }

  /**
   * Sync total campaign budgets every hour
   * Less frequent since total budgets change more slowly
   */
  @Cron('0 * * * *', {
    name: 'syncTotalCampaignBudgets',
    timeZone: 'Asia/Kolkata',
  })
  async handleTotalBudgetSync() {
    try {
      this.logger.debug('🔄 Starting scheduled total budget sync');

      const result = await this.budgetSyncService.syncTotalCampaignBudgets();

      if (result.success) {
        this.logger.debug('✅ Scheduled total budget sync completed', {
          campaignsSynced: result.campaignsSynced,
        });
      } else {
        this.logger.error('❌ Scheduled total budget sync had errors', {
          campaignsSynced: result.campaignsSynced,
          errorCount: result.errors.length,
          errors: result.errors.slice(0, 3), // Log first 3 errors
        });
      }
    } catch (error) {
      this.logger.error('❌ Scheduled total budget sync failed', {
        error: error.message,
      });
    }
  }

  /**
   * Update sync metrics for monitoring
   */
  private async updateSyncMetrics(
    result: any,
    processingTime: number,
  ): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const hour = new Date().getHours();

      const pipeline = this.redis.pipeline();

      // Hourly metrics
      pipeline.incrby(`budget:sync:campaigns:${hour}`, result.campaignsSynced);
      pipeline.expire(`budget:sync:campaigns:${hour}`, 86400); // 24 hours

      pipeline.incrbyfloat(
        `budget:sync:amount:${hour}`,
        result.totalSpendSynced,
      );
      pipeline.expire(`budget:sync:amount:${hour}`, 86400);

      pipeline.setex(
        `budget:sync:processing-time:${hour}`,
        86400,
        processingTime.toString(),
      );

      // Daily totals
      pipeline.incrby(
        `budget:sync:campaigns:daily:${today}`,
        result.campaignsSynced,
      );
      pipeline.expire(`budget:sync:campaigns:daily:${today}`, 86400 * 7); // 7 days

      pipeline.incrbyfloat(
        `budget:sync:amount:daily:${today}`,
        result.totalSpendSynced,
      );
      pipeline.expire(`budget:sync:amount:daily:${today}`, 86400 * 7);

      // Success/failure tracking
      if (result.success) {
        pipeline.incr(`budget:sync:success:${today}`);
        pipeline.expire(`budget:sync:success:${today}`, 86400 * 7);
      } else {
        pipeline.incr(`budget:sync:errors:${today}`);
        pipeline.expire(`budget:sync:errors:${today}`, 86400 * 7);
      }

      await pipeline.exec();
    } catch (error) {
      this.logger.warn('Failed to update sync metrics', {
        error: error.message,
      });
    }
  }

  /**
   * Record sync failure for alerting
   */
  private async recordSyncFailure(errorMessage: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];

      const pipeline = this.redis.pipeline();

      pipeline.incr(`budget:sync:failures:${today}`);
      pipeline.expire(`budget:sync:failures:${today}`, 86400 * 7);

      pipeline.lpush(
        'budget:sync:recent-errors',
        JSON.stringify({
          error: errorMessage,
          timestamp: new Date().toISOString(),
        }),
      );
      pipeline.ltrim('budget:sync:recent-errors', 0, 49); // Keep last 50 errors
      pipeline.expire('budget:sync:recent-errors', 86400 * 7);

      await pipeline.exec();
    } catch (error) {
      this.logger.warn('Failed to record sync failure', {
        error: error.message,
      });
    }
  }

  /**
   * Manual trigger for emergency sync
   */
  async triggerEmergencySync(): Promise<{
    success: boolean;
    dailySyncResult?: any;
    totalSyncResult?: any;
    error?: string;
  }> {
    try {
      this.logger.debug('🚨 Emergency budget sync triggered');

      const [dailySyncResult, totalSyncResult] = await Promise.all([
        this.budgetSyncService.syncDailyBudgetSpends(),
        this.budgetSyncService.syncTotalCampaignBudgets(),
      ]);

      return {
        success: dailySyncResult.success && totalSyncResult.success,
        dailySyncResult,
        totalSyncResult,
      };
    } catch (error) {
      this.logger.error('❌ Emergency budget sync failed', {
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get sync job health status
   */
  async getSyncJobHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    details: any;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [
        lastSyncTime,
        todaySuccesses,
        todayErrors,
        todayFailures,
        recentErrors,
        syncStatus,
      ] = await Promise.all([
        this.redis.get('budget:sync:last-run'),
        this.redis.get(`budget:sync:success:${today}`),
        this.redis.get(`budget:sync:errors:${today}`),
        this.redis.get(`budget:sync:failures:${today}`),
        this.redis.lrange('budget:sync:recent-errors', 0, 4),
        this.budgetSyncService.getBudgetSyncStatus(),
      ]);

      const lastSync = lastSyncTime ? new Date(lastSyncTime as string) : null;
      const timeSinceLastSync = lastSync
        ? Date.now() - lastSync.getTime()
        : Infinity;

      const successCount = parseInt((todaySuccesses as string) || '0');
      const errorCount = parseInt((todayErrors as string) || '0');
      const failureCount = parseInt((todayFailures as string) || '0');

      // Determine health status
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';

      if (timeSinceLastSync > 30 * 60 * 1000) {
        // > 30 minutes
        status = 'critical';
      } else if (failureCount > 0 || errorCount > successCount) {
        status = 'warning';
      } else if (syncStatus.syncLag.length > 0) {
        status = 'warning';
      }

      return {
        status,
        details: {
          lastSyncTime: lastSyncTime as string,
          timeSinceLastSyncMinutes: Math.round(timeSinceLastSync / 60000),
          todayStats: {
            successes: successCount,
            errors: errorCount,
            failures: failureCount,
          },
          syncStatus,
          recentErrors: recentErrors.map((error) => {
            try {
              return JSON.parse(error);
            } catch {
              return { error, timestamp: 'unknown' };
            }
          }),
        },
      };
    } catch (error) {
      return {
        status: 'critical',
        details: {
          error: error.message,
        },
      };
    }
  }
}
