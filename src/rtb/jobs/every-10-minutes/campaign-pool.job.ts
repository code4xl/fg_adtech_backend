import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CampaignPoolWarmupService } from 'src/rtb/cache/warmup/campaign-pool.warmup';
@Injectable()
export class CampaignPoolJob {
  // This job will run every 10 minutes to warm up the campaign pool cache
  private readonly logger = new Logger(CampaignPoolJob.name);
  constructor(
    private readonly campaignPoolWarmupService: CampaignPoolWarmupService,
  ) {}
  @Cron(CronExpression.EVERY_10_MINUTES, {
    name: 'warmupCampaignPoolCache',
    timeZone: 'Asia/Kolkata', // Set to Indian Standard Time
  })
  async handle() {
    try {
      this.logger.debug('Starting campaign pool cache warmup...');
      await this.campaignPoolWarmupService.warmupCaches();
      this.logger.debug('Campaign pool cache warmup completed successfully.');
    } catch (error) {
      console.error('Failed to warm up campaign pool cache:', error);
    }
  }
}
