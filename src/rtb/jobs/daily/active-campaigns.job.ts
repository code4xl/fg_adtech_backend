import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BudgetRedisSyncService } from 'src/tracking/services/budget-redis-sync.service';

@Injectable()
export class ActiveCampaignsJob {
  // This job will run daily to sync active campaigns
  constructor(
    private readonly budgetRedisSyncService: BudgetRedisSyncService,
  ) {}
  @Cron(CronExpression.EVERY_DAY_AT_2AM, {
    name: 'syncActiveCampaigns',
    timeZone: 'Asia/Kolkata', // Set to Indian Standard Time
  })
  async handle() {
    try {
      // Sync all active campaigns to Redis
      await this.budgetRedisSyncService.syncAllActiveCampaigns();
    } catch (error) {
      console.error('Failed to sync active campaigns:', error);
    }
  }
}
