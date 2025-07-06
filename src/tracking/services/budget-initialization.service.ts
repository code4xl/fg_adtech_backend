import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { REDIS_KEYS } from 'src/rtb/constants/cache-keys';

@Injectable()
export class BudgetInitializationService {
  private readonly logger = new Logger(BudgetInitializationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Initialize campaign budget when campaign is created
   * Creates both CampaignBudget and CampaignDailyBudget records
   */
  async initializeCampaignBudget(
    campaignId: string,
    totalBudget: number,
    dailyBudget: number,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    try {
      this.logger.log('Initializing campaign budget', {
        campaignId,
        totalBudget,
        dailyBudget,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });

      // 1. Create or update main campaign budget record
      await this.prisma.campaignBudget.upsert({
        where: { campaignId },
        create: {
          campaignId,
          totalBudget,
          dailyBudget,
          isExhausted: false,
          lastUpdated: new Date(),
        },
        update: {
          totalBudget,
          dailyBudget,
          isExhausted: false,
          lastUpdated: new Date(),
        },
      });

      // 2. Create daily budget records for campaign duration
      await this.createDailyBudgetRecords(
        campaignId,
        dailyBudget,
        startDate,
        endDate,
      );

      // 3. Clear any existing budget cache
      await this.clearBudgetCache(campaignId);

      this.logger.log('✅ Campaign budget initialized successfully', {
        campaignId,
        totalBudget,
        dailyBudget,
      });
    } catch (error) {
      this.logger.error('❌ Failed to initialize campaign budget', {
        error: error.message,
        campaignId,
        totalBudget,
        dailyBudget,
      });
      throw error;
    }
  }

  /**
   * Create daily budget records for each day of the campaign
   */
  private async createDailyBudgetRecords(
    campaignId: string,
    dailyBudget: number,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    const dailyRecords = [];
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    // Generate daily budget records for each day of the campaign
    while (currentDate <= endDate) {
      dailyRecords.push({
        campaignId,
        date: new Date(currentDate),
        spentToday: 0,
        remainingToday: dailyBudget,
        isExhausted: false,
        lastUpdated: new Date(),
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Batch create all daily budget records
    if (dailyRecords.length > 0) {
      await this.prisma.campaignDailyBudget.createMany({
        data: dailyRecords,
        skipDuplicates: true, // Skip if record already exists
      });

      this.logger.debug('Created daily budget records', {
        campaignId,
        recordsCreated: dailyRecords.length,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });
    }
  }

  /**
   * Validate if campaign has sufficient budget for a bid
   * Used by RTB system before allowing campaign to participate in auction
   */
  async validateCampaignBudget(
    campaignId: string,
    estimatedCost: number,
  ): Promise<boolean> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get today's budget status
      const dailyBudget = await this.prisma.campaignDailyBudget.findUnique({
        where: {
          campaignId_date: {
            campaignId,
            date: today,
          },
        },
        select: {
          remainingToday: true,
          isExhausted: true,
        },
      });

      if (!dailyBudget) {
        this.logger.warn('No daily budget record found', {
          campaignId,
          date: today.toISOString().split('T')[0],
        });
        return false;
      }

      if (dailyBudget.isExhausted) {
        this.logger.debug('Campaign daily budget is exhausted', {
          campaignId,
        });
        return false;
      }

      // Convert CPM to per-impression cost if needed
      const costPerImpression =
        estimatedCost > 1 ? estimatedCost / 1000 : estimatedCost;
      const remainingBudget = Number(dailyBudget.remainingToday);

      const hasValidBudget = remainingBudget >= costPerImpression;

      this.logger.debug('Budget validation result', {
        campaignId,
        estimatedCost,
        costPerImpression,
        remainingBudget,
        hasValidBudget,
      });

      return hasValidBudget;
    } catch (error) {
      this.logger.error('Budget validation failed', {
        error: error.message,
        campaignId,
        estimatedCost,
      });
      return false;
    }
  }

  /**
   * Get current daily budget status for a campaign
   */
  async getDailyBudgetStatus(campaignId: string): Promise<{
    spentToday: number;
    remainingToday: number;
    dailyBudget: number;
    isExhausted: boolean;
    spendPercentage: number;
  } | null> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const dailyBudget = await this.prisma.campaignDailyBudget.findUnique({
        where: {
          campaignId_date: {
            campaignId,
            date: today,
          },
        },
        select: {
          spentToday: true,
          remainingToday: true,
          isExhausted: true,
        },
      });

      if (!dailyBudget) {
        return null;
      }

      const spentToday = Number(dailyBudget.spentToday);
      const remainingToday = Number(dailyBudget.remainingToday);
      const totalDailyBudget = spentToday + remainingToday;
      const spendPercentage =
        totalDailyBudget > 0 ? (spentToday / totalDailyBudget) * 100 : 0;

      return {
        spentToday,
        remainingToday,
        dailyBudget: totalDailyBudget,
        isExhausted: dailyBudget.isExhausted,
        spendPercentage: Math.round(spendPercentage * 100) / 100,
      };
    } catch (error) {
      this.logger.error('Failed to get daily budget status', {
        error: error.message,
        campaignId,
      });
      return null;
    }
  }

  /**
   * Get campaign's total budget information
   */
  async getCampaignBudgetInfo(campaignId: string): Promise<{
    totalBudget: number;
    dailyBudget: number;
    isExhausted: boolean;
  } | null> {
    try {
      const campaignBudget = await this.prisma.campaignBudget.findUnique({
        where: { campaignId },
        select: {
          totalBudget: true,
          dailyBudget: true,
          isExhausted: true,
        },
      });

      if (!campaignBudget) {
        return null;
      }

      return {
        totalBudget: Number(campaignBudget.totalBudget),
        dailyBudget: Number(campaignBudget.dailyBudget),
        isExhausted: campaignBudget.isExhausted,
      };
    } catch (error) {
      this.logger.error('Failed to get campaign budget info', {
        error: error.message,
        campaignId,
      });
      return null;
    }
  }

  /**
   * Reset daily budgets for new day (cron job)
   * Called daily at midnight to reset daily spend counters
   */
  async resetDailyBudgets(): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      this.logger.log('Starting daily budget reset', {
        date: today.toISOString().split('T')[0],
      });

      // Get all campaigns with daily budgets for today
      const dailyBudgets = await this.prisma.campaignDailyBudget.findMany({
        where: {
          date: today,
        },
        include: {
          campaign: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

      let resetCount = 0;
      let pausedCount = 0;

      for (const budget of dailyBudgets) {
        try {
          // Get campaign budget info
          const campaignBudget = await this.prisma.campaignBudget.findUnique({
            where: { campaignId: budget.campaignId },
            select: { dailyBudget: true },
          });

          if (!campaignBudget) continue;

          // Reset daily spend counters
          await this.prisma.campaignDailyBudget.update({
            where: {
              campaignId_date: {
                campaignId: budget.campaignId,
                date: today,
              },
            },
            data: {
              spentToday: 0,
              remainingToday: campaignBudget.dailyBudget,
              isExhausted: false,
              lastUpdated: new Date(),
            },
          });

          // Reactivate campaign if it was paused due to budget exhaustion
          if (budget.campaign.status === 'BUDGET_EXHAUSTED') {
            await this.prisma.campaign.update({
              where: { id: budget.campaignId },
              data: {
                status: 'ACTIVE',
                updatedAt: new Date(),
              },
            });
            pausedCount++;
          }

          resetCount++;
        } catch (error) {
          this.logger.error('Failed to reset budget for campaign', {
            error: error.message,
            campaignId: budget.campaignId,
          });
        }
      }

      // Clear all budget caches
      await this.clearAllBudgetCaches();

      this.logger.log('✅ Daily budget reset completed', {
        date: today.toISOString().split('T')[0],
        campaignsReset: resetCount,
        campaignsReactivated: pausedCount,
      });
    } catch (error) {
      this.logger.error('❌ Daily budget reset failed', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update campaign budget amounts (when advertiser adds more budget)
   */
  async updateCampaignBudget(
    campaignId: string,
    newTotalBudget: number,
    newDailyBudget: number,
  ): Promise<void> {
    try {
      this.logger.log('Updating campaign budget', {
        campaignId,
        newTotalBudget,
        newDailyBudget,
      });

      // Update main budget record
      await this.prisma.campaignBudget.update({
        where: { campaignId },
        data: {
          totalBudget: newTotalBudget,
          dailyBudget: newDailyBudget,
          isExhausted: false, // Reset exhaustion flag
          lastUpdated: new Date(),
        },
      });

      // Update future daily budget records (don't affect today's spent amount)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      await this.prisma.campaignDailyBudget.updateMany({
        where: {
          campaignId,
          date: {
            gte: tomorrow, // Only update future dates
          },
        },
        data: {
          remainingToday: newDailyBudget,
          isExhausted: false,
          lastUpdated: new Date(),
        },
      });

      // Clear budget cache
      await this.clearBudgetCache(campaignId);

      this.logger.log('✅ Campaign budget updated successfully', {
        campaignId,
        newTotalBudget,
        newDailyBudget,
      });
    } catch (error) {
      this.logger.error('❌ Failed to update campaign budget', {
        error: error.message,
        campaignId,
      });
      throw error;
    }
  }

  /**
   * Create daily budget record for a specific date (if missing)
   */
  async ensureDailyBudgetExists(campaignId: string, date: Date): Promise<void> {
    try {
      date.setHours(0, 0, 0, 0);

      const existing = await this.prisma.campaignDailyBudget.findUnique({
        where: {
          campaignId_date: {
            campaignId,
            date,
          },
        },
      });

      if (existing) {
        return; // Already exists
      }

      // Get campaign's daily budget amount
      const campaignBudget = await this.prisma.campaignBudget.findUnique({
        where: { campaignId },
        select: { dailyBudget: true },
      });

      if (!campaignBudget) {
        throw new Error(
          `Campaign budget not found for campaign: ${campaignId}`,
        );
      }

      // Create missing daily budget record
      await this.prisma.campaignDailyBudget.create({
        data: {
          campaignId,
          date,
          spentToday: 0,
          remainingToday: campaignBudget.dailyBudget,
          isExhausted: false,
          lastUpdated: new Date(),
        },
      });

      this.logger.debug('Created missing daily budget record', {
        campaignId,
        date: date.toISOString().split('T')[0],
      });
    } catch (error) {
      this.logger.error('Failed to ensure daily budget exists', {
        error: error.message,
        campaignId,
        date,
      });
      throw error;
    }
  }

  /**
   * Clear budget cache for specific campaign
   */
  private async clearBudgetCache(campaignId: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const cacheKey = REDIS_KEYS.CAMPAIGN_BUDGET_INFO(campaignId, today);
      await this.redis.del(cacheKey);

      this.logger.debug('Cleared budget cache', { campaignId });
    } catch (error) {
      this.logger.warn('Failed to clear budget cache', {
        error: error.message,
        campaignId,
      });
    }
  }

  /**
   * Clear all budget caches (used during daily reset)
   */
  private async clearAllBudgetCaches(): Promise<void> {
    try {
      const pattern = 'campaign:budget:info:*';
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await Promise.all(keys.map((key) => this.redis.del(key)));
        this.logger.debug('Cleared all budget caches', {
          keysCleared: keys.length,
        });
      }
    } catch (error) {
      this.logger.warn('Failed to clear all budget caches', {
        error: error.message,
      });
    }
  }

  /**
   * Refresh campaign budget data from database and update cache
   * Used when budget data might be stale or after external budget updates
   */
  async refreshCampaignBudget(campaignId: string): Promise<{
    totalBudget: number;
    dailyBudget: number;
    spentToday: number;
    remainingToday: number;
    isExhausted: boolean;
    lastUpdated: Date;
  } | null> {
    try {
      this.logger.debug('Refreshing campaign budget data', { campaignId });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 1. Clear existing cache first
      await this.clearBudgetCache(campaignId);

      // 2. Fetch fresh data from database
      const [campaignBudget, dailyBudget] = await Promise.all([
        this.prisma.campaignBudget.findUnique({
          where: { campaignId },
          select: {
            totalBudget: true,
            dailyBudget: true,
            isExhausted: true,
            lastUpdated: true,
          },
        }),
        this.prisma.campaignDailyBudget.findUnique({
          where: {
            campaignId_date: {
              campaignId,
              date: today,
            },
          },
          select: {
            spentToday: true,
            remainingToday: true,
            isExhausted: true,
            lastUpdated: true,
          },
        }),
      ]);

      if (!campaignBudget) {
        this.logger.warn('Campaign budget not found during refresh', {
          campaignId,
        });
        return null;
      }

      // 3. Ensure daily budget exists for today
      if (!dailyBudget) {
        this.logger.warn('Daily budget missing, creating for today', {
          campaignId,
          date: today.toISOString().split('T')[0],
        });

        await this.ensureDailyBudgetExists(campaignId, today);

        // Fetch the newly created daily budget
        const newDailyBudget = await this.prisma.campaignDailyBudget.findUnique(
          {
            where: {
              campaignId_date: {
                campaignId,
                date: today,
              },
            },
            select: {
              spentToday: true,
              remainingToday: true,
              isExhausted: true,
              lastUpdated: true,
            },
          },
        );

        const refreshedData = {
          totalBudget: Number(campaignBudget.totalBudget),
          dailyBudget: Number(campaignBudget.dailyBudget),
          spentToday: newDailyBudget ? Number(newDailyBudget.spentToday) : 0,
          remainingToday: newDailyBudget
            ? Number(newDailyBudget.remainingToday)
            : Number(campaignBudget.dailyBudget),
          isExhausted:
            campaignBudget.isExhausted ||
            (newDailyBudget?.isExhausted ?? false),
          lastUpdated:
            newDailyBudget?.lastUpdated || campaignBudget.lastUpdated,
        };

        this.logger.log(
          '✅ Campaign budget refreshed (with daily budget creation)',
          {
            campaignId,
            refreshedData,
          },
        );

        return refreshedData;
      }

      // 4. Return refreshed budget data
      const refreshedData = {
        totalBudget: Number(campaignBudget.totalBudget),
        dailyBudget: Number(campaignBudget.dailyBudget),
        spentToday: Number(dailyBudget.spentToday),
        remainingToday: Number(dailyBudget.remainingToday),
        isExhausted: campaignBudget.isExhausted || dailyBudget.isExhausted,
        lastUpdated:
          dailyBudget.lastUpdated > campaignBudget.lastUpdated
            ? dailyBudget.lastUpdated
            : campaignBudget.lastUpdated,
      };

      // 5. Update cache with fresh data
      const cacheKey = REDIS_KEYS.CAMPAIGN_BUDGET_INFO(
        campaignId,
        today.toISOString().split('T')[0],
      );
      await this.redis.set(cacheKey, JSON.stringify(refreshedData), 3600); // Cache for 1 hour

      this.logger.log('✅ Campaign budget refreshed successfully', {
        campaignId,
        refreshedData,
      });

      return refreshedData;
    } catch (error) {
      this.logger.error('❌ Failed to refresh campaign budget', {
        error: error.message,
        campaignId,
      });
      throw error;
    }
  }

  /**
   * Bulk refresh multiple campaign budgets
   * Useful for dashboard or reporting that needs fresh data for multiple campaigns
   */
  async refreshMultipleCampaignBudgets(
    campaignIds: string[],
  ): Promise<Map<string, any>> {
    try {
      this.logger.debug('Bulk refreshing campaign budgets', {
        campaignCount: campaignIds.length,
      });

      const refreshResults = new Map();

      // Process in batches to avoid overwhelming the database
      const batchSize = 10;
      for (let i = 0; i < campaignIds.length; i += batchSize) {
        const batch = campaignIds.slice(i, i + batchSize);

        const batchPromises = batch.map(async (campaignId) => {
          try {
            const refreshed = await this.refreshCampaignBudget(campaignId);
            return { campaignId, data: refreshed, success: true };
          } catch (error) {
            this.logger.warn('Failed to refresh budget for campaign', {
              campaignId,
              error: error.message,
            });
            return {
              campaignId,
              data: null,
              success: false,
              error: error.message,
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);

        batchResults.forEach(({ campaignId, data, success, error }) => {
          refreshResults.set(campaignId, { data, success, error });
        });
      }

      this.logger.log('✅ Bulk budget refresh completed', {
        totalCampaigns: campaignIds.length,
        successCount: Array.from(refreshResults.values()).filter(
          (r) => r.success,
        ).length,
        failureCount: Array.from(refreshResults.values()).filter(
          (r) => !r.success,
        ).length,
      });

      return refreshResults;
    } catch (error) {
      this.logger.error('❌ Bulk budget refresh failed', {
        error: error.message,
        campaignIds,
      });
      throw error;
    }
  }

  /**
   * Get budget summary for multiple campaigns (dashboard view)
   */
  async getCampaignsBudgetSummary(campaignIds: string[]): Promise<
    Array<{
      campaignId: string;
      totalBudget: number;
      dailyBudget: number;
      spentToday: number;
      remainingToday: number;
      isExhausted: boolean;
    }>
  > {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const budgetSummaries = await Promise.all(
        campaignIds.map(async (campaignId) => {
          const [campaignBudget, dailyBudget] = await Promise.all([
            this.prisma.campaignBudget.findUnique({
              where: { campaignId },
              select: {
                totalBudget: true,
                dailyBudget: true,
                isExhausted: true,
              },
            }),
            this.prisma.campaignDailyBudget.findUnique({
              where: {
                campaignId_date: {
                  campaignId,
                  date: today,
                },
              },
              select: {
                spentToday: true,
                remainingToday: true,
                isExhausted: true,
              },
            }),
          ]);

          return {
            campaignId,
            totalBudget: campaignBudget
              ? Number(campaignBudget.totalBudget)
              : 0,
            dailyBudget: campaignBudget
              ? Number(campaignBudget.dailyBudget)
              : 0,
            spentToday: dailyBudget ? Number(dailyBudget.spentToday) : 0,
            remainingToday: dailyBudget
              ? Number(dailyBudget.remainingToday)
              : 0,
            isExhausted:
              (campaignBudget?.isExhausted || dailyBudget?.isExhausted) ??
              false,
          };
        }),
      );

      return budgetSummaries;
    } catch (error) {
      this.logger.error('Failed to get campaigns budget summary', {
        error: error.message,
        campaignIds,
      });
      return [];
    }
  }
}
