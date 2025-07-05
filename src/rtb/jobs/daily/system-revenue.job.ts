import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisService } from 'src/redis/redis.service';
import { CLICK_AND_IMPRESSION_KEYS } from 'src/rtb/constants/cache-keys';

@Injectable()
export class SystemRevenueJob {
  private readonly logger = new Logger(SystemRevenueJob.name);
  constructor(private readonly redis: RedisService) {}
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    this.logger.log('Running system revenue job at midnight');
    // Get the current date in YYYY-MM-DD format
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    this.logger.debug(`Today's date: ${dateStr}`);
    // Get the system revenue for today

    const dailySystemRevenue = await this.redis.get(
      CLICK_AND_IMPRESSION_KEYS.SYSTEM_REVENUE(dateStr),
    );
    this.logger.log('Successfully executed system revenue job');
  }
}
