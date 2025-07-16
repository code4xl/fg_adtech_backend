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
  ) { }
  ) { }

  /**
   * Sync daily budget spends from Redis to PostgreSQL
   * This should run frequently (every 10-15 minutes) to keep data fresh
   * 🔧 FIXED: Updated to use new Redis key patterns
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
      // 🔧 FIXED: Updated Redis key pattern to match your new format
      const spendKeys = await this.redis.keys(
        `campaign:budget:daily:spend:*:${today}`,
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
            // 🔧 FIXED: Extract campaign ID from new key pattern: campaign:budget:daily:spend:{campaignId}:{date}
            const keyParts = spendKey.split(':');
            if (keyParts.length !== 6) {
              this.logger.warn('Invalid spend key format', { spendKey });
              continue;
            }

            const campaignId = keyParts[4]; // Position 4 in the new pattern
            const dateFromKey = keyParts[5]; // Position 5 in the new pattern

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

      this.logger.debug(' Campaign daily budget synced', {
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
   * 🔧 FIXED: Updated to use new Redis key patterns
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
      // 🔧 FIXED: Updated Redis key pattern to match your new format
      const totalSpendKeys = await this.redis.keys('campaign:budget:total:spend:*');

      if (totalSpendKeys.length === 0) {
        this.logger.debug('No total budget spend data found in Redis');
        return {
          success: true,
          campaignsSynced: 0,
          errors: [],
        };
      }

      this.logger.debug(`Found ${totalSpendKeys.length} campaigns with total spend data`);

      // 2. Process campaigns in batches
      const batchSize = 20;
      for (let i = 0; i < totalSpendKeys.length; i += batchSize) {
        const batch = totalSpendKeys.slice(i, i + batchSize);

        for (const spendKey of batch) {
          try {
            // 🔧 FIXED: Extract campaign ID from new key pattern: campaign:budget:total:spend:{campaignId}
            const keyParts = spendKey.split(':');
            if (keyParts.length !== 5) {
              this.logger.warn('Invalid total spend key format', { spendKey });
              continue;
            }

            const campaignId = keyParts[4]; // Position 4 in the new pattern

            // 🚀 EFFICIENT: Get current total spend from Redis (no DB query needed!)
            const [totalSpendStr, totalLimitStr] = await Promise.all([
              this.redis.get(spendKey), // TOTAL_BUDGET_SPEND
              this.redis.get(REDIS_KEYS.TOTAL_BUDGET_LIMIT(campaignId)), // TOTAL_BUDGET_LIMIT
            ]);

            if (!totalSpendStr || !totalLimitStr) {
              continue;
            }

            const totalSpent = parseFloat(totalSpendStr as string);
            const totalBudget = parseFloat(totalLimitStr as string);

            if (isNaN(totalSpent) || isNaN(totalBudget) || totalSpent < 0) {
              this.logger.warn('Invalid total budget values', {
                campaignId,
                totalSpent,
                totalBudget,
              });
              continue;
            }

            const remainingBudget = Math.max(0, totalBudget - totalSpent);
            const isExhausted = totalSpent >= totalBudget;

            // 🚀 EFFICIENT: Update PostgreSQL with Redis data (no reduce() needed!)
            await this.prisma.campaignBudget.update({
              where: { campaignId },
              data: {
                spentAmount: totalSpent, // 🆕 UPDATE: Set spent amount from Redis
                isExhausted,
                lastUpdated: new Date(),
              },
            });
            // 🚀 EFFICIENT: Update PostgreSQL with Redis data (no reduce() needed!)
            await this.prisma.campaignBudget.update({
              where: { campaignId },
              data: {
                spentAmount: totalSpent, // 🆕 UPDATE: Set spent amount from Redis
                isExhausted,
                lastUpdated: new Date(),
              },
            });

            // Update campaign status if total budget exhausted
            if (isExhausted) {
              await this.prisma.campaign.update({
                where: { id: campaignId },
                data: {
                  status: 'BUDGET_EXHAUSTED',
                  updatedAt: new Date(),
                },
              });
            // Update campaign status if total budget exhausted
            if (isExhausted) {
              await this.prisma.campaign.update({
                where: { id: campaignId },
                data: {
                  status: 'BUDGET_EXHAUSTED',
                  updatedAt: new Date(),
                },
              });

              // Also update Redis status
              await this.redis.set(
                REDIS_KEYS.CAMPAIGN_STATUS(campaignId),
                'BUDGET_EXHAUSTED',
              );
            }
              // Also update Redis status
              await this.redis.set(
                REDIS_KEYS.CAMPAIGN_STATUS(campaignId),
                'BUDGET_EXHAUSTED',
              );
            }

            campaignsSynced++;
            campaignsSynced++;

            this.logger.debug('✅ Campaign total budget synced', {
              campaignId,
              totalSpent,
              totalBudget,
              remainingBudget,
              isExhausted,
            });
          } catch (error) {
            const errorMsg = `Failed to sync total budget for campaign from key ${spendKey}: ${error.message}`;
            this.logger.error(errorMsg);
            errors.push(errorMsg);
          }
        }

        // Small delay between batches
        await new Promise((resolve) => setTimeout(resolve, 100));
            this.logger.debug('✅ Campaign total budget synced', {
              campaignId,
              totalSpent,
              totalBudget,
              remainingBudget,
              isExhausted,
            });
          } catch (error) {
            const errorMsg = `Failed to sync total budget for campaign from key ${spendKey}: ${error.message}`;
            this.logger.error(errorMsg);
            errors.push(errorMsg);
          }
        }

        // Small delay between batches
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const processingTime = Date.now() - startTime;

      this.logger.debug('✅ Total campaign budget sync completed', {
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
   * 🔧 FIXED: Updated to use new Redis key patterns
   */
  async getBudgetSyncStatus(): Promise<{
    redisCampaigns: number;
    postgresCampaigns: number;
    lastSyncTime?: string;
    syncLag: string[];
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];

      // 🔧 FIXED: Updated Redis key pattern to match your new format
      const redisSpendKeys = await this.redis.keys(
        `campaign:budget:daily:spend:*:${today}`,
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
        // 🔧 FIXED: Extract campaign ID from new key pattern
        const campaignId = key.split(':')[4]; // Position 4 in new pattern

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
  

  

  /**
   * Compare campaign budget data between Redis and PostgreSQL
   * 🚀 UPDATED: Include total budget comparison
   * 🚀 UPDATED: Include total budget comparison
   */
  async compareCampaignBudgetData(campaignId: string): Promise<{
    campaignId: string;
    redis: any;
    postgres: any;
    differences: string[];
    recommendation: string;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get Redis data (both daily and total)
      const [redisSpend, redisLimit, status, totalSpend, totalLimit] = await Promise.all([
      // Get Redis data (both daily and total)
      const [redisSpend, redisLimit, status, totalSpend, totalLimit] = await Promise.all([
        this.redis.get(REDIS_KEYS.DAILY_BUDGET_SPEND(campaignId, today)),
        this.redis.get(REDIS_KEYS.DAILY_BUDGET_LIMIT(campaignId)),
        this.redis.get(REDIS_KEYS.CAMPAIGN_STATUS(campaignId)),
        this.redis.get(REDIS_KEYS.TOTAL_BUDGET_SPEND(campaignId)), // 🆕 ADD: Total spend
        this.redis.get(REDIS_KEYS.TOTAL_BUDGET_LIMIT(campaignId)), // 🆕 ADD: Total limit
        this.redis.get(REDIS_KEYS.TOTAL_BUDGET_SPEND(campaignId)), // 🆕 ADD: Total spend
        this.redis.get(REDIS_KEYS.TOTAL_BUDGET_LIMIT(campaignId)), // 🆕 ADD: Total limit
      ]);


      const campaignStatus = status
        ? JSON.parse(status as string).status
        : null;


      // Get PostgreSQL data
      const [campaignData, dailyBudgetData] = await Promise.all([
        this.prisma.campaign.findUnique({
          where: { id: campaignId },
          include: { campaignBudget: true },
        }),
        this.prisma.campaignDailyBudget.findUnique({
          where: {
            campaignId_date: {
              campaignId,
              date: new Date(today),
            },
          },
        }),
      ]);

      const redisData = {
        dailySpend: redisSpend ? parseFloat(redisSpend as string) : 0,
        dailyLimit: redisLimit ? parseFloat(redisLimit as string) : 0,
        totalSpend: totalSpend ? parseFloat(totalSpend as string) : 0, // 🆕 ADD
        totalLimit: totalLimit ? parseFloat(totalLimit as string) : 0, // 🆕 ADD
        totalSpend: totalSpend ? parseFloat(totalSpend as string) : 0, // 🆕 ADD
        totalLimit: totalLimit ? parseFloat(totalLimit as string) : 0, // 🆕 ADD
        status: campaignStatus || 'UNKNOWN',
        source: 'Redis',
      };

      const postgresData = {
        dailySpend: dailyBudgetData
          ? parseFloat(dailyBudgetData.spentToday.toString())
          : 0,
        dailyLimit: campaignData?.campaignBudget
          ? parseFloat(campaignData.campaignBudget.dailyBudget.toString())
          : 0,
        totalSpend: campaignData?.campaignBudget // 🆕 ADD
          ? parseFloat(campaignData.campaignBudget.spentAmount.toString())
          : 0,
        totalLimit: campaignData?.campaignBudget // 🆕 ADD
          ? parseFloat(campaignData.campaignBudget.totalBudget.toString())
          : 0,
        totalSpend: campaignData?.campaignBudget // 🆕 ADD
          ? parseFloat(campaignData.campaignBudget.spentAmount.toString())
          : 0,
        totalLimit: campaignData?.campaignBudget // 🆕 ADD
          ? parseFloat(campaignData.campaignBudget.totalBudget.toString())
          : 0,
        status: campaignData?.status || 'UNKNOWN',
        isExhausted: dailyBudgetData?.isExhausted || false,
        lastUpdated: dailyBudgetData?.lastUpdated?.toISOString(),
        source: 'PostgreSQL',
      };

      // Identify differences
      const differences: string[] = [];
      let recommendation = 'Data is synchronized';

      // Daily budget comparisons
      const dailySpendDiff = Math.abs(
      // Daily budget comparisons
      const dailySpendDiff = Math.abs(
        redisData.dailySpend - postgresData.dailySpend,
      );
      if (dailySpendDiff > 0.01) {
      if (dailySpendDiff > 0.01) {
        differences.push(
          `Daily spend differs: Redis=${redisData.dailySpend}, PG=${postgresData.dailySpend} (diff: ${dailySpendDiff})`,
          `Daily spend differs: Redis=${redisData.dailySpend}, PG=${postgresData.dailySpend} (diff: ${dailySpendDiff})`,
        );
      }

      const dailyLimitDiff = Math.abs(
      const dailyLimitDiff = Math.abs(
        redisData.dailyLimit - postgresData.dailyLimit,
      );
      if (dailyLimitDiff > 0.01) {
        differences.push(
          `Daily limit differs: Redis=${redisData.dailyLimit}, PG=${postgresData.dailyLimit} (diff: ${dailyLimitDiff})`,
        );
      }

      // 🆕 ADD: Total budget comparisons
      const totalSpendDiff = Math.abs(
        redisData.totalSpend - postgresData.totalSpend,
      );
      if (totalSpendDiff > 0.01) {
        differences.push(
          `Total spend differs: Redis=${redisData.totalSpend}, PG=${postgresData.totalSpend} (diff: ${totalSpendDiff})`,
        );
      }

      const totalLimitDiff = Math.abs(
        redisData.totalLimit - postgresData.totalLimit,
      );
      if (totalLimitDiff > 0.01) {
      if (dailyLimitDiff > 0.01) {
        differences.push(
          `Daily limit differs: Redis=${redisData.dailyLimit}, PG=${postgresData.dailyLimit} (diff: ${dailyLimitDiff})`,
        );
      }

      // 🆕 ADD: Total budget comparisons
      const totalSpendDiff = Math.abs(
        redisData.totalSpend - postgresData.totalSpend,
      );
      if (totalSpendDiff > 0.01) {
        differences.push(
          `Total spend differs: Redis=${redisData.totalSpend}, PG=${postgresData.totalSpend} (diff: ${totalSpendDiff})`,
        );
      }

      const totalLimitDiff = Math.abs(
        redisData.totalLimit - postgresData.totalLimit,
      );
      if (totalLimitDiff > 0.01) {
        differences.push(
          `Total limit differs: Redis=${redisData.totalLimit}, PG=${postgresData.totalLimit} (diff: ${totalLimitDiff})`,
          `Total limit differs: Redis=${redisData.totalLimit}, PG=${postgresData.totalLimit} (diff: ${totalLimitDiff})`,
        );
      }

      if (redisData.status !== postgresData.status) {
        differences.push(
          `Status differs: Redis=${redisData.status}, PG=${postgresData.status}`,
        );
      }

      // Provide recommendations
      if (differences.length > 0) {
        if (dailySpendDiff > 1 || dailyLimitDiff > 1 || totalSpendDiff > 1 || totalLimitDiff > 1) {
        if (dailySpendDiff > 1 || dailyLimitDiff > 1 || totalSpendDiff > 1 || totalLimitDiff > 1) {
          recommendation =
            'URGENT: Significant differences detected. Run emergency sync immediately.';
        } else if (differences.length > 1) {
          recommendation =
            'Multiple differences detected. Consider running manual sync.';
        } else {
          recommendation =
            'Minor differences detected. Monitor or run sync if needed.';
        }
      }

      return {
        campaignId,
        redis: redisData,
        postgres: postgresData,
        differences,
        recommendation,
      };
    } catch (error) {
      this.logger.error('❌ Failed to compare campaign budget data', {
        error: error.message,
        campaignId,
      });

      return {
        campaignId,
        redis: { error: 'Failed to fetch Redis data' },
        postgres: { error: 'Failed to fetch PostgreSQL data' },
        differences: ['Comparison failed due to error'],
        recommendation: 'Fix the underlying error and retry comparison',
      };
    }
  }
}
