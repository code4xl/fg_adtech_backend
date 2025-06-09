// src/rtb/rtb.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { KafkaModule } from '../kafka/kafka.module';

// Controllers
import { RTBController } from './controllers/rtb.controller';
import { RTBService } from './services/rtb.service';
import { CampaignEligibilityService } from './services/campaign-eligibility.service';

// import { TrackingController } from './controllers/tracking.controller';

// // Core Services
// import { AuctionService } from './services/auction.service';
// import { BidEvaluationService } from './services/bid-evaluation.service';

// // Processing Services
// import { BidRequestProcessor } from './processors/bid-request.processor';
// import { AuctionProcessor } from './processors/auction.processor';
// import { BidResponseProcessor } from './processors/bid-response.processor';

// // Tracking Services
// import { ImpressionTrackingService } from './services/impression-tracking.service';
// import { ClickTrackingService } from './services/click-tracking.service';

// // Kafka Consumers
// import { RTBKafkaConsumer } from './consumers/rtb-kafka.consumer';
// import { TrackingKafkaConsumer } from './consumers/tracking-kafka.consumer';

// Utility Services
import { RTBCacheService } from './services/rtb-cache.service';
import { RTBMetricsService } from './services/rtb-metrics.service';

/**
 * RTB Module - Phase 1 Implementation
 * 
 * This module encapsulates all Real-Time Bidding functionality including:
 * - Bid request processing
 * - Auction management
 * - Campaign eligibility evaluation
 * - Performance tracking
 * - Caching and metrics
 * 
 * Dependencies:
 * - PrismaModule: Database operations
 * - RedisModule: Caching and counters
 * - KafkaModule: Async message processing
 */
@Module({
  imports: [
    PrismaModule,  // For database operations
    RedisModule,   // For caching and real-time counters
    KafkaModule,   // For async processing
  ],
  controllers: [
    RTBController,      // Main RTB endpoints
    // TrackingController, // Impression/click tracking
  ],
  providers: [
    // === Core Business Logic Services ===
    RTBService,                    // Main RTB orchestration
    // AuctionService,               // Auction logic and winner determination
    // BidEvaluationService,         // Bid price calculation
    CampaignEligibilityService,   // Campaign targeting evaluation

    // === Message Processing Services ===
    // BidRequestProcessor,          // Process incoming bid requests
    // AuctionProcessor,             // Handle auction workflows
    // BidResponseProcessor,         // Generate bid responses

    // // === Tracking Services ===
    // ImpressionTrackingService,    // Track ad impressions
    // ClickTrackingService,         // Track ad clicks

    // // === Kafka Consumers ===
    // RTBKafkaConsumer,            // Consume RTB-related messages
    // TrackingKafkaConsumer,       // Consume tracking events

    // === Utility Services ===
    RTBCacheService,             // RTB-specific caching
    RTBMetricsService,           // Performance metrics
  ],
  exports: [
    RTBService,                  // Export main service for other modules
    RTBCacheService,             // Export cache service for other modules
    RTBMetricsService,           // Export metrics service for other modules
  ],
})
export class RTBModule { }