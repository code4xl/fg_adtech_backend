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
   * Initialize daily budgets for all active campaigns
   * This should run daily at the start of each day
   */
  async initializeDailyBudgets(): Promise<{
    success: boolean;
    campaignsProcessed: number;
    campaignsCreated: number;
    campaignsUpdated: number;
    errors: string[];
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of day

    const errors: string[] = [];
    let campaignsProcessed = 0;
    let campaignsCreated = 0;
    let campaignsUpdated = 0;

    this.logger.debug('🚀 Starting daily budget initialization', {
      date: today.toISOString().split('T')[0],
    });

    try {
      // 1. Get all active campaigns with their budget settings
      const activeCampaigns = await this.prisma.campaign.findMany({
        where: {
          status: 'ACTIVE',
          startDate: { lte: today },
          endDate: { gte: today },
        },
        include: {
          campaignBudget: true,
        },
      });

      this.logger.debug(`Found ${activeCampaigns.length} active campaigns`);

      // 2. Process each campaign
      for (const campaign of activeCampaigns) {
        try {
          await this.initializeCampaignDailyBudget(campaign, today);
          campaignsProcessed++;

          // Determine if this was a create or update operation
          const existingDailyBudget =
            await this.prisma.campaignDailyBudget.findUnique({
              where: {
                campaignId_date: {
                  campaignId: campaign.id,
                  date: today,
                },
              },
            });

          if (existingDailyBudget && existingDailyBudget.lastUpdated < today) {
            campaignsCreated++;
          } else {
            campaignsUpdated++;
          }
        } catch (campaignError) {
          const errorMsg = `Failed to initialize budget for campaign ${campaign.id}: ${campaignError.message}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      const result = {
        success: errors.length === 0,
        campaignsProcessed,
        campaignsCreated,
        campaignsUpdated,
        errors,
      };

      this.logger.debug(' Daily budget initialization completed', result);
      return result;
    } catch (error) {
      const errorMsg = `Daily budget initialization failed: ${error.message}`;
      this.logger.error(errorMsg);

      return {
        success: false,
        campaignsProcessed,
        campaignsCreated,
        campaignsUpdated,
        errors: [errorMsg, ...errors],
      };
    }
  }

  /**
   * Initialize daily budget for a specific campaign
   */
  private async initializeCampaignDailyBudget(
    campaign: any,
    date: Date,
  ): Promise<void> {
    // Get the daily budget amount from campaign budget settings
    const dailyBudgetAmount = campaign.campaignBudget?.dailyBudget || 0;

    if (dailyBudgetAmount <= 0) {
      this.logger.warn(`Campaign ${campaign.id} has no daily budget set`);
      return;
    }

    // Check if daily budget record already exists for today
    const existingDailyBudget =
      await this.prisma.campaignDailyBudget.findUnique({
        where: {
          campaignId_date: {
            campaignId: campaign.id,
            date: date,
          },
        },
      });

    if (existingDailyBudget) {
      // Record exists - check if it needs reset
      const isNewDay =
        existingDailyBudget.lastUpdated.toDateString() !== date.toDateString();

      if (isNewDay) {
        // Reset for new day
        await this.prisma.campaignDailyBudget.update({
          where: {
            campaignId_date: {
              campaignId: campaign.id,
              date: date,
            },
          },
          data: {
            spentToday: 0,
            remainingToday: dailyBudgetAmount,
            isExhausted: false,
            lastUpdated: new Date(),
          },
        });

        this.logger.debug(`Reset daily budget for campaign ${campaign.id}`, {
          dailyBudget: dailyBudgetAmount,
        });
      }
    } else {
      // Create new daily budget record
      await this.prisma.campaignDailyBudget.create({
        data: {
          campaignId: campaign.id,
          date: date,
          spentToday: 0,
          remainingToday: dailyBudgetAmount,
          isExhausted: false,
          lastUpdated: new Date(),
        },
      });

      this.logger.debug(`Created daily budget for campaign ${campaign.id}`, {
        dailyBudget: dailyBudgetAmount,
      });
    }
  }

  /**
   * Initialize budget for a single campaign (useful for new campaigns)
   */
  async initializeSingleCampaignBudget(campaignId: string): Promise<boolean> {
    try {
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { campaignBudget: true },
      });

      if (!campaign) {
        this.logger.warn(`Campaign ${campaignId} not found`);
        return false;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await this.initializeCampaignDailyBudget(campaign, today);

      this.logger.debug(` Single campaign budget initialized: ${campaignId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to initialize single campaign budget: ${error.message}`,
        {
          campaignId,
        },
      );
      return false;
    }
  }

  /**
   * Clean up old daily budget records (optional - for housekeeping)
   */
  async cleanupOldDailyBudgets(daysToKeep: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await this.prisma.campaignDailyBudget.deleteMany({
        where: {
          date: {
            lt: cutoffDate,
          },
        },
      });

      this.logger.debug(
        `🧹 Cleaned up ${result.count} old daily budget records`,
      );
      return result.count;
    } catch (error) {
      this.logger.error(
        `Failed to cleanup old daily budgets: ${error.message}`,
      );
      return 0;
    }
  }
}
