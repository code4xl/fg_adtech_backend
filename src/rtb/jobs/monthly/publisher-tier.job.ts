import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BudgetManagerService } from 'src/rtb/services/budget-manager.service';

@Injectable()
export class PublisherTierJob {
  private readonly logger = new Logger(PublisherTierJob.name);
  constructor(private readonly budgetManagerService: BudgetManagerService) {}
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT, {
    name: 'syncPublisherRevenueTiers',
    timeZone: 'Asia/Kolkata', // Set to Indian Standard Time
  })
  async handle() {
    try {
      await this.budgetManagerService.syncPublisherRevenueTiers();
      this.logger.debug('Publisher tiers updated successfully');
    } catch (error) {
      this.logger.error('Failed to update publisher tiers', {
        error: error.message,
      });
    }
  }
}
