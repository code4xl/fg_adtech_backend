import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { KafkaModule } from '../kafka/kafka.module';

import { RTBController } from './controllers/rtb.controller';

import { TrackingController } from './controllers/tracking.controller';

import { RTBService } from './services/rtb.service';
import { CampaignEligibilityService } from './services/campaign-eligibility.service';
import { AuctionService } from './services/auction.service';
import { BidEvaluationService } from './services/bid-evalutation.service';

import { ImpressionTrackingService } from './services/impression-tracking.service';
import { ClickTrackingService } from './services/click-tracking.service';

import { TrackingKafkaConsumer } from './consumers/tracking-kafka.consumer';

import { BidRequestProcessor } from './processors/bid-request.processor';
import { BidResponseProcessor } from './processors/bid-response.processor';

import { RTBKafkaConsumer } from './consumers/rtb-kafka.consumer';
import { AuctionProcessor } from './consumers/auction.consumer';

import { RTBCacheService } from './services/rtb-cache.service';
import { RTBMetricsService } from './services/rtb-metrics.service';
import { TimescaleModule } from 'src/timescale/timescale.module';
import { TimescaleSyncConsumer } from 'src/timescale/consumers/timescale-sync.consumer';

/**
 * RTB Module - Phase 5 Complete Implementation
 *
 * **Phase 5 Additions:**
 * - TrackingController: HTTP endpoints for impression/click tracking
 * - ImpressionTrackingService: Complete impression processing pipeline
 * - ClickTrackingService: Complete click processing and CTR calculation
 * - TrackingKafkaConsumer: Async processing of tracking events
 *
 * **Why these additions are essential:**
 * - Enables real-time campaign performance measurement
 * - Provides accurate billing data for impressions and clicks
 * - Supports fraud detection and quality filtering
 * - Creates foundation for conversion tracking and attribution
 *
 * **Integration Points:**
 * - Tracking services use existing Redis counters for real-time metrics
 * - Kafka integration enables scalable analytics pipeline
 * - Prisma integration stores comprehensive tracking data
 * - RTBRedisService provides sophisticated counter management
 */
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
