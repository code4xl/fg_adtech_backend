import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { REDIS_KEYS } from 'src/rtb/constants/cache-keys';
import { BudgetRedisSyncService } from './budget-redis-sync.service';

@Injectable()
export class BudgetValidationService {
  private readonly logger = new Logger(BudgetValidationService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly budgetRedisSyncService: BudgetRedisSyncService,
  ) {}

  // Validate campaign budget for a single bid - DONE
  async validateCampaignBudget(
    campaignId: string,
    costPerImpression: number,
  ): Promise<boolean> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const redisClient = this.redis.getClient();

      // Try Redis first for fast lookup
      const [dailyLimit, dailySpend, status] = await Promise.all([
        redisClient.get(REDIS_KEYS.DAILY_BUDGET_LIMIT(campaignId)),
        redisClient.get(REDIS_KEYS.DAILY_BUDGET_SPEND(campaignId, today)),
        redisClient.get(REDIS_KEYS.CAMPAIGN_STATUS(campaignId)),
      ]);
      // this.logger.debug(
      //   `Campaign ${campaignId} budget check (campaign budget validation checking)`,
      //   {
      //     dailyLimit,
      //     dailySpend,
      //     status,
      //     costPerImpression,
      //   },
      // );
      // If Redis data missing, sync from database
      if (!dailyLimit || !status) {
        this.logger.debug(
          `Redis cache miss for campaign ${campaignId}, syncing from database`,
        );

        await this.budgetRedisSyncService.syncCampaignBudgetToRedis(campaignId);

        // Retry Redis read after sync
        const [newDailyLimit, newDailySpend, newStatus] = await Promise.all([
          redisClient.get(REDIS_KEYS.DAILY_BUDGET_LIMIT(campaignId)),
          redisClient.get(REDIS_KEYS.DAILY_BUDGET_SPEND(campaignId, today)),
          redisClient.get(REDIS_KEYS.CAMPAIGN_STATUS(campaignId)),
        ]);

        if (!newDailyLimit || newStatus !== 'ACTIVE') {
          this.logger.debug(
            `Campaign ${campaignId} not active or no budget data after sync`,
          );
          return false;
        }

        // Use synced data
        const limit = parseFloat(newDailyLimit);
        const currentSpend = parseFloat(newDailySpend || '0');
        const remainingBudget = limit - currentSpend;

        const canAfford = remainingBudget >= costPerImpression;

        this.logger.debug('Budget validation (after sync)', {
          campaignId,
          limit,
          currentSpend,
          remainingBudget,
          costPerImpression,
          canAfford,
        });

        return canAfford;
      }

      // Process Redis data
      if (status !== 'ACTIVE') {
        this.logger.debug(`Campaign ${campaignId} not active: ${status}`);
        return false;
      }

      const limit = parseFloat(dailyLimit);
      const currentSpend = parseFloat(dailySpend || '0');
      const remainingBudget = limit - currentSpend;

      const canAfford = remainingBudget >= costPerImpression;

      // this.logger.debug('Budget validation (cache hit)', {
      //   campaignId,
      //   limit,
      //   currentSpend,
      //   remainingBudget,
      //   costPerImpression,
      //   canAfford,
      // });

      return canAfford;
    } catch (error) {
      this.logger.error(
        `Budget validation failed for campaign ${campaignId}:`,
        error,
      );
      return false; // Fail safe
    }
  }
  // Batch validation for multiple campaigns (for auction efficiency)
  async validateBatchCampaignBudgets(
    campaignBids: Array<{ campaignId: string; bidAmount: number }>,
  ): Promise<string[]> {
    if (campaignBids.length === 0) return [];

    const validCampaignIds: string[] = [];

    try {
      const today = new Date().toISOString().split('T')[0];

      // Use raw Redis client for batch operations
      const redisClient = this.redis.getClient();
      const pipeline = redisClient.pipeline();

      campaignBids.forEach(({ campaignId }) => {
        pipeline.get(REDIS_KEYS.DAILY_BUDGET_LIMIT(campaignId));
        pipeline.get(REDIS_KEYS.DAILY_BUDGET_SPEND(campaignId, today));
        pipeline.get(REDIS_KEYS.CAMPAIGN_STATUS(campaignId));
      });

      const results = await pipeline.exec();

      // Process results
      for (let i = 0; i < campaignBids.length; i++) {
        const { campaignId, bidAmount } = campaignBids[i];
        const baseIndex = i * 3;

        const dailyLimit = results[baseIndex]?.[1] as string;
        const dailySpend = results[baseIndex + 1]?.[1] as string;
        const status = results[baseIndex + 2]?.[1] as string;

        if (status === 'ACTIVE' && dailyLimit) {
          const limit = parseFloat(dailyLimit);
          const currentSpend = parseFloat(dailySpend || '0');
          const remainingBudget = limit - currentSpend;

          if (remainingBudget >= bidAmount) {
            validCampaignIds.push(campaignId);
          }
        }
      }
    } catch (error) {
      this.logger.error('Batch budget validation failed:', error);
    }

    return validCampaignIds;
  }

  /**
   * Health check for budget validation service
   * Checks Redis connectivity and budget data availability
   */
  async checkHealth(): Promise<{
    status: string;
    budgetsLoaded?: number;
    error?: string;
  }> {
    try {
      // Test Redis connection
      const redisClient = this.redis.getClient();
      const start = Date.now();

      // Ping Redis to check connectivity
      await redisClient.ping();
      const latency = Date.now() - start;

      // Count how many campaigns have budget data loaded
      const budgetKeys = await redisClient.keys(
        REDIS_KEYS.DAILY_BUDGET_LIMIT('*').replace('*', '*'),
      );

      // Get sample campaign statuses to ensure data integrity
      const sampleKeys = budgetKeys.slice(0, 5); // Check first 5 campaigns
      const sampleStatuses = await Promise.all(
        sampleKeys.map((key) => {
          const campaignId = key.split(':').pop(); // Extract campaign ID from key
          return redisClient.get(REDIS_KEYS.CAMPAIGN_STATUS(campaignId));
        }),
      );

      const activeCampaigns = sampleStatuses.filter(
        (status) => status === 'ACTIVE',
      ).length;

      return {
        status: 'healthy',
        budgetsLoaded: budgetKeys.length,
      };
    } catch (error) {
      this.logger.error('Budget validation health check failed:', error);
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  /**
   * Get detailed budget health metrics
   * Useful for monitoring and debugging
   */
  async getBudgetHealthMetrics(): Promise<any> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const redisClient = this.redis.getClient();

      // Get all campaign budget keys
      const budgetLimitKeys = await redisClient.keys(
        REDIS_KEYS.DAILY_BUDGET_LIMIT('*').replace('*', '*'),
      );

      const metrics = {
        totalCampaignsWithBudgets: budgetLimitKeys.length,
        activeCampaigns: 0,
        pausedCampaigns: 0,
        campaignsWithSpending: 0,
        totalDailySpending: 0,
        campaignsNearBudgetLimit: 0, // >90% spent
        campaignsOverBudget: 0,
      };

      // Sample first 20 campaigns for detailed analysis
      const sampleCampaigns = budgetLimitKeys.slice(0, 20);

      for (const budgetKey of sampleCampaigns) {
        // Extract campaign ID from key pattern: budget:limit:{campaignId}
        const campaignId = budgetKey.split(':').pop();

        const [status, budgetLimit, dailySpend] = await Promise.all([
          redisClient.get(REDIS_KEYS.CAMPAIGN_STATUS(campaignId)),
          redisClient.get(REDIS_KEYS.DAILY_BUDGET_LIMIT(campaignId)),
          redisClient.get(REDIS_KEYS.DAILY_BUDGET_SPEND(campaignId, today)),
        ]);

        // Count campaign statuses
        if (status === 'ACTIVE') {
          metrics.activeCampaigns++;
        } else {
          metrics.pausedCampaigns++;
        }

        // Analyze spending
        if (dailySpend && parseFloat(dailySpend) > 0) {
          metrics.campaignsWithSpending++;
          metrics.totalDailySpending += parseFloat(dailySpend);

          // Check budget utilization
          if (budgetLimit) {
            const limit = parseFloat(budgetLimit);
            const spend = parseFloat(dailySpend);
            const utilization = spend / limit;

            if (spend > limit) {
              metrics.campaignsOverBudget++;
            } else if (utilization > 0.9) {
              metrics.campaignsNearBudgetLimit++;
            }
          }
        }
      }

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        metrics,
        sampleSize: sampleCampaigns.length,
        note:
          sampleCampaigns.length < budgetLimitKeys.length
            ? `Analyzed ${sampleCampaigns.length} of ${budgetLimitKeys.length} campaigns`
            : 'Analyzed all campaigns',
      };
    } catch (error) {
      this.logger.error('Failed to get budget health metrics:', error);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Quick health check for high-frequency monitoring
   * Minimal operations for performance
   */
  async quickHealthCheck(): Promise<{ status: string; latency?: number }> {
    try {
      const start = Date.now();
      const redisClient = this.redis.getClient();

      // Just ping Redis and check one budget key
      await redisClient.ping();

      const latency = Date.now() - start;

      return {
        status: 'healthy',
        latency,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
      };
    }
  }
}
