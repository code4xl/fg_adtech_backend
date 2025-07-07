import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { REDIS_KEYS } from '../constants/cache-keys';

@Injectable()
export class BudgetSyncService {
  private readonly logger = new Logger(BudgetSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Sync daily budget spends from Redis to PostgreSQL
   * This should run frequently (every 10-15 minutes) to keep data fresh
   */
  async syncDailyBudgetSpends(): Promise<{
    success: boolean;
    campaignsSynced: number;
    totalSpendSynced: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    const today = new Date().toISOString().split('T')[0];
    let campaignsSynced = 0;
    let totalSpendSynced = 0;
    const errors: string[] = [];

    this.logger.debug('🔄 Starting daily budget spend sync', {
      date: today,
    });

    try {
      // 1. Get all campaign daily spend keys from Redis
      const spendKeys = await this.redis.keys(
        `campaign:budget:daily:*:${today}`,
      );

      if (spendKeys.length === 0) {
        this.logger.debug('No daily spend data found in Redis');
        return {
          success: true,
          campaignsSynced: 0,
          totalSpendSynced: 0,
          errors: [],
        };
      }

      this.logger.debug(`Found ${spendKeys.length} campaigns with spend data`);

      // 2. Process campaigns in batches
      const batchSize = 20;
      for (let i = 0; i < spendKeys.length; i += batchSize) {
        const batch = spendKeys.slice(i, i + batchSize);

        for (const spendKey of batch) {
          try {
            // Extract campaign ID from key pattern: campaign:budget:daily:{campaignId}:{date}
            const keyParts = spendKey.split(':');
            if (keyParts.length !== 5) {
              this.logger.warn('Invalid spend key format', { spendKey });
              continue;
            }

            const campaignId = keyParts[3];
            const dateFromKey = keyParts[4];

            // Verify date matches (safety check)
            if (dateFromKey !== today) {
              continue;
            }

            // Get current spend from Redis
            const currentSpendStr: string = await this.redis.get(spendKey);
            if (!currentSpendStr) {
              continue;
            }

            const currentSpend = parseFloat(currentSpendStr);
            if (isNaN(currentSpend) || currentSpend < 0) {
              this.logger.warn('Invalid spend value', {
                campaignId,
                currentSpend,
              });
              continue;
            }

            // Sync to PostgreSQL
            await this.syncCampaignDailyBudget(campaignId, today, currentSpend);

            campaignsSynced++;
            totalSpendSynced += currentSpend;
          } catch (error) {
            const errorMsg = `Failed to sync campaign from key ${spendKey}: ${error.message}`;
            this.logger.error(errorMsg);
            errors.push(errorMsg);
          }
        }

        // Small delay between batches
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const processingTime = Date.now() - startTime;

      this.logger.debug('✅ Daily budget spend sync completed', {
        campaignsSynced,
        totalSpendSynced,
        errors: errors.length,
        processingTimeMs: processingTime,
      });

      return {
        success: errors.length === 0,
        campaignsSynced,
        totalSpendSynced,
        errors,
      };
    } catch (error) {
      this.logger.error('❌ Daily budget spend sync failed', {
        error: error.message,
        campaignsSynced,
        totalSpendSynced,
      });

      return {
        success: false,
        campaignsSynced,
        totalSpendSynced,
        errors: [error.message, ...errors],
      };
    }
  }

  /**
   * Sync individual campaign daily budget
   */
  private async syncCampaignDailyBudget(
    campaignId: string,
    date: string,
    currentSpend: number,
  ): Promise<void> {
    try {
      // Get daily budget limit (should exist if campaign is active)
      const dailyLimitStr: string = await this.redis.get(
        REDIS_KEYS.DAILY_BUDGET_LIMIT(campaignId),
      );

      if (!dailyLimitStr) {
        this.logger.warn('No daily budget limit found', { campaignId });
        return;
      }

      const dailyLimit = parseFloat(dailyLimitStr);
      const remainingBudget = Math.max(0, dailyLimit - currentSpend);
      const isExhausted = currentSpend >= dailyLimit;

      // Update PostgreSQL with current Redis data
      await this.prisma.campaignDailyBudget.upsert({
        where: {
          campaignId_date: {
            campaignId,
            date: new Date(date),
          },
        },
        create: {
          campaignId,
          date: new Date(date),
          spentToday: currentSpend,
          remainingToday: remainingBudget,
          isExhausted,
          lastUpdated: new Date(),
        },
        update: {
          spentToday: currentSpend,
          remainingToday: remainingBudget,
          isExhausted,
          lastUpdated: new Date(),
        },
      });

      // Also update campaign status in database if exhausted
      if (isExhausted) {
        await this.prisma.campaignDailyBudget.updateMany({
          where: {
            id: campaignId,
          },
          data: {
            isExhausted: true,
            lastUpdated: new Date(),
          },
        });
      }

      this.logger.debug('✅ Campaign daily budget synced', {
        campaignId,
        date,
        spentToday: currentSpend,
        remainingToday: remainingBudget,
        isExhausted,
      });
    } catch (error) {
      this.logger.error('❌ Failed to sync campaign daily budget', {
        error: error.message,
        campaignId,
        date,
        currentSpend,
      });
      throw error;
    }
  }

  /**
   * Sync total campaign budget consumption (for overall budget tracking)
   */
  async syncTotalCampaignBudgets(): Promise<{
    success: boolean;
    campaignsSynced: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    let campaignsSynced = 0;
    const errors: string[] = [];

    this.logger.debug('🔄 Starting total campaign budget sync');

    try {
      // Get all active campaigns that have budget tracking
      const campaigns = await this.prisma.campaign.findMany({
        where: {
          status: {
            in: ['ACTIVE', 'BUDGET_EXHAUSTED'],
          },
          campaignBudget: {
            isNot: null,
          },
        },
        include: {
          campaignBudget: true,
          dailyBudgets: {
            orderBy: { date: 'desc' },
          },
        },
      });

      for (const campaign of campaigns) {
        try {
          // Calculate total spent from daily budgets
          const totalSpent = campaign.dailyBudgets.reduce(
            (sum, daily) => sum + parseFloat(daily.spentToday.toString()),
            0,
          );

          const totalBudget = parseFloat(
            campaign.campaignBudget.totalBudget.toString(),
          );
          const remainingBudget = Math.max(0, totalBudget - totalSpent);
          const isExhausted = totalSpent >= totalBudget;

          // Update campaign budget with current totals
          await this.prisma.campaignBudget.update({
            where: { campaignId: campaign.id },
            data: {
              isExhausted,
              lastUpdated: new Date(),
            },
          });

          // Update campaign status if total budget exhausted
          if (isExhausted && campaign.status !== 'BUDGET_EXHAUSTED') {
            await this.prisma.campaign.update({
              where: { id: campaign.id },
              data: {
                status: 'BUDGET_EXHAUSTED',
                updatedAt: new Date(),
              },
            });

            // Also update Redis
            await this.redis.set(
              REDIS_KEYS.CAMPAIGN_STATUS(campaign.id),
              'BUDGET_EXHAUSTED',
            );
          }

          campaignsSynced++;

          this.logger.debug('✅ Campaign total budget synced', {
            campaignId: campaign.id,
            totalSpent,
            totalBudget,
            remainingBudget,
            isExhausted,
          });
        } catch (error) {
          const errorMsg = `Failed to sync total budget for campaign ${campaign.id}: ${error.message}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      const processingTime = Date.now() - startTime;

      this.logger.debug('✅ Total campaign budget sync completed', {
        campaignsSynced,
        errors: errors.length,
        processingTimeMs: processingTime,
      });

      return {
        success: errors.length === 0,
        campaignsSynced,
        errors,
      };
    } catch (error) {
      this.logger.error('❌ Total campaign budget sync failed', {
        error: error.message,
      });

      return {
        success: false,
        campaignsSynced,
        errors: [error.message, ...errors],
      };
    }
  }

  /**
   * Emergency sync for specific campaign (manual trigger)
   */
  async emergencySync(campaignId: string): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get current spend from Redis
      const currentSpendStr: string = await this.redis.get(
        REDIS_KEYS.DAILY_BUDGET_SPEND(campaignId, today),
      );

      if (!currentSpendStr) {
        return {
          success: false,
          error: 'No spend data found in Redis',
        };
      }

      const currentSpend = parseFloat(currentSpendStr);

      // Sync to PostgreSQL
      await this.syncCampaignDailyBudget(campaignId, today, currentSpend);

      // Also sync total budget
      await this.syncTotalCampaignBudgets();

      return {
        success: true,
        data: {
          campaignId,
          date: today,
          syncedSpend: currentSpend,
        },
      };
    } catch (error) {
      this.logger.error('❌ Emergency sync failed', {
        error: error.message,
        campaignId,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get budget sync status for monitoring
   */
  async getBudgetSyncStatus(): Promise<{
    redisCampaigns: number;
    postgresCampaigns: number;
    lastSyncTime?: string;
    syncLag: string[];
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Count campaigns in Redis with spend data
      const redisSpendKeys = await this.redis.keys(
        `campaign:budget:daily:*:${today}`,
      );
      const redisCampaigns = redisSpendKeys.length;

      // Count campaigns in PostgreSQL with today's data
      const postgresCount = await this.prisma.campaignDailyBudget.count({
        where: {
          date: new Date(today),
        },
      });

      // Check for campaigns with significant lag
      const syncLag: string[] = [];

      for (const key of redisSpendKeys.slice(0, 10)) {
        // Check first 10
        const campaignId = key.split(':')[3];

        const [redisSpend, postgresRecord] = await Promise.all([
          this.redis.get(key),
          this.prisma.campaignDailyBudget.findUnique({
            where: {
              campaignId_date: {
                campaignId,
                date: new Date(today),
              },
            },
          }),
        ]);

        if (redisSpend && postgresRecord) {
          const redisAmount = parseFloat(redisSpend as string);
          const postgresAmount = parseFloat(
            postgresRecord.spentToday.toString(),
          );

          // Check if lag > 5% or > Rs. 1
          const lagAmount = Math.abs(redisAmount - postgresAmount);
          const lagPercentage = lagAmount / Math.max(redisAmount, 0.01);

          if (lagAmount > 1 || lagPercentage > 0.05) {
            syncLag.push(
              `${campaignId}: Redis=${redisAmount}, PG=${postgresAmount}`,
            );
          }
        }
      }

      // Get last sync time from Redis
      const lastSyncTime = await this.redis.get('budget:sync:last-run');

      return {
        redisCampaigns,
        postgresCampaigns: postgresCount,
        lastSyncTime: lastSyncTime as string,
        syncLag,
      };
    } catch (error) {
      this.logger.error('Failed to get budget sync status', {
        error: error.message,
      });

      return {
        redisCampaigns: 0,
        postgresCampaigns: 0,
        syncLag: [],
      };
    }
  }
}
