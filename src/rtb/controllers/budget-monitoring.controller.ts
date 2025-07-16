// src/rtb/controllers/budget-test.controller.ts
import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { BudgetInitializationService } from 'src/tracking/services/budget-initialization.service';
import { BudgetRedisSyncService } from 'src/tracking/services/budget-redis-sync.service';
import { ActiveCampaignsJob } from 'src/rtb/jobs/daily/active-campaigns.job';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { REDIS_KEYS } from '../constants/cache-keys';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Budget Monitoring')
@Controller('test/budget')
export class BudgetMonitoringController {
  constructor(
    private readonly budgetInitService: BudgetInitializationService,
    private readonly budgetRedisSyncService: BudgetRedisSyncService,
    private readonly activeCampaignsJob: ActiveCampaignsJob,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // 🎯 Manual trigger for daily budget initialization
  @Post('initialize-daily/only-postgres')
  async initializeDailyBudgetsinPostgres() {
    return await this.budgetInitService.initializeDailyBudgets();
  }
  // 🎯 Manual trigger for daily budget initialization in redis
  @Post('initialize-daily/only-postgres')
  async initializeDailyBudgetsinRedis() {
    return await this.budgetRedisSyncService.syncAllActiveCampaigns();
  }

  // 🎯 Manual trigger for full cron job
  @Post('trigger-cron')
  async triggerCronJob() {
    return await this.activeCampaignsJob.triggerManualReset();
  }

  // 🎯 Initialize single campaign budget
  @Post('initialize/:campaignId')
  async initializeSingleCampaign(@Param('campaignId') campaignId: string) {
    return await this.budgetInitService.initializeSingleCampaignBudget(
      campaignId,
    );
  }

  // 🎯 Sync specific campaign to Redis
  @Post('sync-redis/:campaignId')
  async syncCampaignToRedis(@Param('campaignId') campaignId: string) {
    await this.budgetRedisSyncService.syncCampaignBudgetToRedis(campaignId);
    return { success: true, message: `Campaign ${campaignId} synced to Redis` };
  }

  // 🎯 Get campaign budget status from PostgreSQL
  @Get('postgres-status/:campaignId')
  async getPostgresBudgetStatus(@Param('campaignId') campaignId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [campaign, campaignBudget, dailyBudget] = await Promise.all([
      this.prisma.campaign.findUnique({
        where: { id: campaignId },
        select: {
          id: true,
          name: true,
          status: true,
          startDate: true,
          endDate: true,
        },
      }),
      this.prisma.campaignBudget.findUnique({
        where: { campaignId },
        select: { dailyBudget: true, totalBudget: true, isExhausted: true },
      }),
      this.prisma.campaignDailyBudget.findUnique({
        where: { campaignId_date: { campaignId, date: today } },
        select: {
          spentToday: true,
          remainingToday: true,
          isExhausted: true,
          lastUpdated: true,
        },
      }),
    ]);

    return {
      campaign,
      campaignBudget,
      dailyBudget,
      today: today.toISOString().split('T')[0],
    };
  }

  // 🎯 Get campaign budget status from Redis
  @Get('redis-status/:campaignId')
  async getRedisBudgetStatus(@Param('campaignId') campaignId: string) {
    const today = new Date().toISOString().split('T')[0];

    const [dailyLimit, dailySpend, status] = await Promise.all([
      this.redis.get(REDIS_KEYS.DAILY_BUDGET_LIMIT(campaignId)),
      this.redis.get(REDIS_KEYS.DAILY_BUDGET_SPEND(campaignId, today)),
      this.redis.get(REDIS_KEYS.CAMPAIGN_STATUS(campaignId)),
    ]);

    return {
      campaignId,
      date: today,
      dailyLimit: dailyLimit ? parseFloat(dailyLimit as string) : null,
      dailySpend: dailySpend ? parseFloat(dailySpend as string) : null,
      status: status as string,
      remaining:
        dailyLimit && dailySpend
          ? parseFloat(dailyLimit as string) - parseFloat(dailySpend as string)
          : null,
    };
  }

  // 🎯 Compare PostgreSQL vs Redis data
  @Get('compare/:campaignId')
  async compareBudgetData(@Param('campaignId') campaignId: string) {
    const [postgresData, redisData] = await Promise.all([
      this.getPostgresBudgetStatus(campaignId),
      this.getRedisBudgetStatus(campaignId),
    ]);

    const isConsistent =
      Number(postgresData.campaignBudget?.dailyBudget || 0) ==
        redisData.dailyLimit &&
      Number(postgresData.dailyBudget?.spentToday || 0) ==
        redisData.dailySpend &&
      (postgresData.dailyBudget?.isExhausted
        ? 'BUDGET_EXHAUSTED'
        : 'ACTIVE') === redisData.status;

    return {
      postgres: postgresData,
      redis: redisData,
      isConsistent,
      differences: isConsistent
        ? null
        : {
            dailyBudget: {
              postgres: Number(postgresData.campaignBudget?.dailyBudget || 0),
              redis: redisData.dailyLimit,
            },
            spentToday: {
              postgres: Number(postgresData.dailyBudget?.spentToday || 0),
              redis: redisData.dailySpend,
            },
            status: {
              postgres: postgresData.dailyBudget?.isExhausted
                ? 'BUDGET_EXHAUSTED'
                : 'ACTIVE',
              redis: redisData.status,
            },
          },
    };
  }

  // 🎯 Get health check
  @Get('health')
  async getBudgetHealth() {
    return await this.activeCampaignsJob.checkBudgetHealth();
  }

  // 🎯 Simulate spend (for testing)
  @Post('simulate-spend/:campaignId')
  async simulateSpend(
    @Param('campaignId') campaignId: string,
    @Body() body: { amount: number },
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Update PostgreSQL
    const updated = await this.prisma.campaignDailyBudget.update({
      where: { campaignId_date: { campaignId, date: today } },
      data: {
        spentToday: { increment: body.amount },
        remainingToday: { decrement: body.amount },
        lastUpdated: new Date(),
      },
    });

    // Update Redis
    const todayStr = today.toISOString().split('T')[0];
    await this.redis.incrbyfloat(
      REDIS_KEYS.DAILY_BUDGET_SPEND(campaignId, todayStr),
      body.amount,
    );

    return {
      success: true,
      message: `Simulated spend of $${body.amount} for campaign ${campaignId}`,
      updatedBudget: {
        spentToday: Number(updated.spentToday),
        remainingToday: Number(updated.remainingToday),
      },
    };
  }

  // 🎯 Get all active campaigns
  @Get('active-campaigns')
  async getActiveCampaigns() {
    const today = new Date();

    const campaigns = await this.prisma.campaign.findMany({
      where: {
        status: 'ACTIVE',
        startDate: { lte: today },
        endDate: { gte: today },
      },
      include: {
        campaignBudget: true,
        dailyBudgets: {
          where: { date: { gte: today } },
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    return {
      count: campaigns.length,
      campaigns: campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        dailyBudget: Number(c.campaignBudget?.dailyBudget || 0),
        todaySpent: Number(c.dailyBudgets[0]?.spentToday || 0),
        todayRemaining: Number(c.dailyBudgets[0]?.remainingToday || 0),
        isExhausted: c.dailyBudgets[0]?.isExhausted || false,
      })),
    };
  }
}
