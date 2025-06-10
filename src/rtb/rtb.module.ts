import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { KafkaModule } from '../kafka/kafka.module';
import { RTBController } from './controllers/rtb.controller';
import { RTBService } from './services/rtb.service';
import { CampaignEligibilityService } from './services/campaign-eligibility.service';
import { AuctionService } from './services/auction.service';
import { BidEvaluationService } from './services/bid-evalutation.service';
import { BidRequestProcessor } from './processors/bid-request.processor';
import { BidResponseProcessor } from './processors/bid-response.processor';
import { RTBKafkaConsumer } from './consumers/rtb-kafka.consumer';
import { AuctionProcessor } from './consumers/auction.consumer';
import { RTBCacheService } from './services/rtb-cache.service';
import { RTBMetricsService } from './services/rtb-metrics.service';
import { RTBRedisService } from 'src/redis/services/rtb-redis.service';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    KafkaModule,
    //  TimescaleModule
  ],
  controllers: [
    RTBController,
    // TrackingController
  ],
  providers: [
    RTBRedisService,
    RTBService,
    AuctionService,
    BidEvaluationService,
    CampaignEligibilityService,
    // ImpressionTrackingService,
    // ClickTrackingService,
    BidRequestProcessor,
    BidResponseProcessor,
    // TrackingKafkaConsumer,
    RTBKafkaConsumer,
    AuctionProcessor,
    RTBCacheService,
    RTBMetricsService,
    // TimescaleSyncConsumer,
  ],
  exports: [
    RTBRedisService,
    RTBService,
    AuctionService,
    CampaignEligibilityService,
    BidEvaluationService,
    // ImpressionTrackingService,
    // ClickTrackingService,
    RTBCacheService,
    RTBMetricsService,
  ],
})
export class RTBModule {}
