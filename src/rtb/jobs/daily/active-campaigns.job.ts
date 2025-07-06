import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BudgetRedisSyncService } from 'src/tracking/services/budget-redis-sync.service';
import { BudgetInitializationService } from 'src/tracking/services/budget-initialization.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class ActiveCampaignsJob {
  private readonly logger = new Logger(ActiveCampaignsJob.name);

  constructor(
    private readonly budgetRedisSyncService: BudgetRedisSyncService,
    private readonly budgetInitializationService: BudgetInitializationService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Daily job to initialize budgets and sync active campaigns
   * Runs at 2 AM IST every day
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM, {
    name: 'initializeAndSyncDailyBudgets',
    timeZone: 'Asia/Kolkata',
  })
  async handle() {
    const startTime = Date.now();

    this.logger.log(
      '🚀 Starting daily campaign budget initialization and sync',
    );

    try {
      // STEP 1: Initialize daily budgets for all active campaigns
      // This creates/resets CampaignDailyBudget records for today
      const initResult =
        await this.budgetInitializationService.initializeDailyBudgets();

      if (!initResult.success) {
        this.logger.error('❌ Daily budget initialization had errors', {
          errors: initResult.errors,
          campaignsProcessed: initResult.campaignsProcessed,
        });
      } else {
        this.logger.log(
          '✅ Daily budget initialization completed successfully',
          {
            campaignsProcessed: initResult.campaignsProcessed,
            campaignsCreated: initResult.campaignsCreated,
            campaignsUpdated: initResult.campaignsUpdated,
          },
        );
      }

      // STEP 2: Sync all active campaigns to Redis
      // This ensures Redis has the latest budget data for RTB
      await this.budgetRedisSyncService.syncAllActiveCampaigns();

      const processingTime = Date.now() - startTime;

      this.logger.log('✅ Daily campaign budget job completed successfully', {
        processingTimeMs: processingTime,
        campaignsInitialized: initResult.campaignsProcessed,
        hasErrors: !initResult.success,
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('❌ Daily campaign budget job failed', {
        error: error.message,
        stack: error.stack,
        processingTimeMs: processingTime,
      });

      // You might want to send alerts here for critical failures
      // await this.sendFailureAlert(error);
    }
  }

  /**
   * Manual trigger for testing or emergency budget reset
   */
  async triggerManualReset(): Promise<{
    success: boolean;
    initResult: any;
    processingTime: number;
  }> {
    const startTime = Date.now();

    this.logger.log('🔄 Manual daily budget reset triggered');

    try {
      const initResult =
        await this.budgetInitializationService.initializeDailyBudgets();
      await this.budgetRedisSyncService.syncAllActiveCampaigns();

      const processingTime = Date.now() - startTime;

      return {
        success: initResult.success,
        initResult,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('Manual budget reset failed', {
        error: error.message,
      });

      return {
        success: false,
        initResult: null,
        processingTime,
      };
    }
  }

  /**
   * Quick health check for budget system
   */
  async checkBudgetHealth(): Promise<{
    activeCampaigns: number;
    campaignsWithBudgets: number;
    campaignsInRedis: number;
    healthScore: number;
  }> {
    try {
      // Check active campaigns count
      const activeCampaigns = await this.prisma.campaign.count({
        where: { status: 'ACTIVE' },
      });

      // Check campaigns with daily budgets for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const campaignsWithBudgets = await this.prisma.campaignDailyBudget.count({
        where: { date: today },
      });

      // Check campaigns in Redis (approximate)
      const redisKeys = await this.redis.keys('campaign:budget:limit:*');
      const campaignsInRedis = redisKeys.length;

      // Calculate health score
      let healthScore = 100;

      if (activeCampaigns > 0) {
        const budgetCoverage = (campaignsWithBudgets / activeCampaigns) * 100;
        const redisCoverage = (campaignsInRedis / activeCampaigns) * 100;

        healthScore = Math.min(budgetCoverage, redisCoverage);
      }

      return {
        activeCampaigns,
        campaignsWithBudgets,
        campaignsInRedis,
        healthScore: Math.round(healthScore),
      };
    } catch (error) {
      this.logger.error('Budget health check failed', {
        error: error.message,
      });

      return {
        activeCampaigns: 0,
        campaignsWithBudgets: 0,
        campaignsInRedis: 0,
        healthScore: 0,
      };
    }
  }
}
