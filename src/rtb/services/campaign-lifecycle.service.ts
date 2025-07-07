import { Injectable, Logger } from '@nestjs/common';
import { BudgetRedisSyncService } from '../../tracking/services/budget-redis-sync.service';
import { BudgetInitializationService } from '../../tracking/services/budget-initialization.service';

@Injectable()
export class CampaignLifecycleService {
  private readonly logger = new Logger(CampaignLifecycleService.name);

  constructor(
    private readonly budgetRedisSyncService: BudgetRedisSyncService,
    private readonly budgetInitializationService: BudgetInitializationService,
  ) {}

  /**
   * Call this when campaign is activated
   */
  async onCampaignActivated(campaignId: string): Promise<void> {
    try {
      // Sync budget data to Redis for RTB
      await this.budgetRedisSyncService.syncCampaignBudgetToRedis(campaignId);

      this.logger.debug(
        `✅ Campaign ${campaignId} activated and synced to Redis`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to sync campaign ${campaignId} on activation:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Call this when campaign budget is updated
   */
  async onCampaignBudgetUpdated(campaignId: string): Promise<void> {
    try {
      // Refresh budget data in Redis
      await this.budgetRedisSyncService.syncCampaignBudgetToRedis(campaignId);

      this.logger.debug(
        `✅ Campaign ${campaignId} budget updated and synced to Redis`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to sync campaign ${campaignId} on budget update:`,
        error,
      );
      throw error;
    }
  }
}
