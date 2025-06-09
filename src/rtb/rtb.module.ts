// src/rtb/rtb.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { KafkaModule } from '../kafka/kafka.module';

// Controllers
import { RTBController } from './controllers/rtb.controller';
import { RTBService } from './services/rtb.service';
import { CampaignEligibilityService } from './services/campaign-eligibility.service';
import { AuctionService } from './services/auction.service';

// import { TrackingController } from './controllers/tracking.controller';

// // Core Services
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
import { BidEvaluationService } from './services/bid-evalutation.service';

/**
 * RTB Module - Phase 3 Complete Implementation
 * 
 * This module encapsulates all Real-Time Bidding functionality including:
 * - Bid request processing and validation
 * - Campaign eligibility evaluation with sophisticated targeting
 * - Auction management with multiple pricing strategies
 * - Bid evaluation with performance-based adjustments
 * - Performance tracking and metrics collection
 * - Caching and optimization services
 * 
 * **Why this modular architecture:**
 * - Separation of concerns (each service has specific responsibility)
 * - Easy testing and maintenance
 * - Scalable architecture for future enhancements
 * - Clear dependency injection patterns
 * 
 * Dependencies:
 * - PrismaModule: Database operations and ORM
 * - RedisModule: Caching, counters, and real-time data
 * - KafkaModule: Async message processing and event streaming
 */
@Module({
  imports: [
    PrismaModule,  // For database operations
    RedisModule,   // For caching and real-time counters
    KafkaModule,   // For async processing
  ],
  controllers: [
    RTBController,      // Main RTB endpoints (bid-request, bid-response, health)
    // TrackingController, // Impression/click tracking (Phase 4)
  ],
  providers: [
    // === Core Business Logic Services ===
    RTBService,                    // Main RTB orchestration and request handling
    AuctionService,               // Auction logic and winner determination
    BidEvaluationService,         // Bid price calculation with performance adjustments
    CampaignEligibilityService,   // Campaign targeting evaluation and budget checks

    // === Message Processing Services (Phase 4) ===
    // BidRequestProcessor,          // Process incoming bid requests via Kafka
    // AuctionProcessor,             // Handle auction workflows
    // BidResponseProcessor,         // Generate and format bid responses

    // // === Tracking Services (Phase 4) ===
    // ImpressionTrackingService,    // Track ad impressions and viewability
    // ClickTrackingService,         // Track ad clicks and conversions

    // // === Kafka Consumers (Phase 4) ===
    // RTBKafkaConsumer,            // Consume RTB-related messages
    // TrackingKafkaConsumer,       // Consume tracking events

    // === Utility Services ===
    RTBCacheService,             // RTB-specific caching operations
    RTBMetricsService,           // Performance metrics collection and analysis
  ],
  exports: [
    RTBService,                  // Export main service for other modules
    AuctionService,              // Export auction service for processors
    CampaignEligibilityService,  // Export eligibility service for reuse
    BidEvaluationService,        // Export bid evaluation for processors
    RTBCacheService,             // Export cache service for other modules
    RTBMetricsService,           // Export metrics service for monitoring
  ],
})
export class RTBModule {
  constructor() {
    console.log('🚀 RTB Module loaded - Phase 3 Complete');
    console.log('📊 Available services:');
    console.log('  - RTB Service (main orchestration)');
    console.log('  - Auction Service (auction processing)');
    console.log('  - Campaign Eligibility Service (targeting evaluation)');
    console.log('  - Bid Evaluation Service (price calculation)');
    console.log('  - RTB Cache Service (performance optimization)');
    console.log('  - RTB Metrics Service (performance tracking)');
  }
}