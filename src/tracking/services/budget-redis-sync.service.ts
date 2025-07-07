import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { REDIS_KEYS } from 'src/rtb/constants/cache-keys';

@Injectable()
export class BudgetRedisSyncService {
  private readonly logger = new Logger(BudgetRedisSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Sync single campaign budget from PostgreSQL to Redis
   */
  async syncCampaignBudgetToRedis(campaignId: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get budget data from PostgreSQL
      const [campaignBudget, dailyBudget] = await Promise.all([
        this.prisma.campaignBudget.findUnique({
          where: { campaignId },
          select: { dailyBudget: true },
        }),
        this.prisma.campaignDailyBudget.findUnique({
          where: { campaignId_date: { campaignId, date: new Date(today) } },
          select: { spentToday: true, isExhausted: true },
        }),
      ]);

      if (!campaignBudget) {
        this.logger.warn(`No campaign budget found for ${campaignId}`);
        return;
      }

      // Sync to Redis with TTL
      const pipeline = this.redis.pipeline();

      // Campaign budget limit - TTL: 30 days
      pipeline.setex(
        REDIS_KEYS.DAILY_BUDGET_LIMIT(campaignId),
        30 * 24 * 60 * 60,
        campaignBudget.dailyBudget.toString(),
      );

      // Daily spend - TTL: 24 hours
      pipeline.setex(
        REDIS_KEYS.DAILY_BUDGET_SPEND(campaignId, today),
        24 * 60 * 60,
        (dailyBudget?.spentToday || 0).toString(),
      );

      // Campaign status - TTL: 24 hours
      pipeline.setex(
        REDIS_KEYS.CAMPAIGN_STATUS(campaignId),
        24 * 60 * 60,
        dailyBudget?.isExhausted ? 'BUDGET_EXHAUSTED' : 'ACTIVE',
      );

      await pipeline.exec();

      this.logger.debug(`✅ Synced budget to Redis for campaign ${campaignId}`);
    } catch (error) {
      this.logger.error(
        `Failed to sync budget for campaign ${campaignId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Bulk sync all active campaigns (startup/recovery)
   */
  async syncAllActiveCampaigns(): Promise<void> {
    try {
      const activeCampaigns = await this.prisma.campaign.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
      });

      this.logger.debug(
        `Syncing ${activeCampaigns.length} active campaigns to Redis`,
      );

      // Process in batches to avoid overwhelming Redis
      const batchSize = 10;
      for (let i = 0; i < activeCampaigns.length; i += batchSize) {
        const batch = activeCampaigns.slice(i, i + batchSize);

        await Promise.all(
          batch.map((campaign) => this.syncCampaignBudgetToRedis(campaign.id)),
        );

        // Small delay between batches
        if (i + batchSize < activeCampaigns.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      this.logger.debug(
        `✅ Completed bulk sync of ${activeCampaigns.length} campaigns`,
      );
    } catch (error) {
      this.logger.error('Failed to sync all active campaigns:', error);
      throw error;
    }
  }
}
