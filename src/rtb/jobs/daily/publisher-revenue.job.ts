import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisService } from 'src/redis/redis.service';
import { CLICK_AND_IMPRESSION_KEYS } from 'src/rtb/constants/cache-keys';

@Injectable()
export class PublisherRevenueJob {
  private readonly logger = new Logger(PublisherRevenueJob.name);
  constructor(private readonly redis: RedisService) {}
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {}
}
