// src/rtb/rtb.module.ts - UPDATE for Phase 5
// Add these imports and providers to your existing RTB module

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { KafkaModule } from '../kafka/kafka.module';

// Existing Controllers
import { RTBController } from './controllers/rtb.controller';

// Phase 5: NEW - Tracking Controller
import { TrackingController } from './controllers/tracking.controller';

// Existing Services
import { RTBService } from './services/rtb.service';
import { CampaignEligibilityService } from './services/campaign-eligibility.service';
import { AuctionService } from './services/auction.service';
import { BidEvaluationService } from './services/bid-evalutation.service';

// Phase 5: NEW - Tracking Services
import { ImpressionTrackingService } from './services/impression-tracking.service';
import { ClickTrackingService } from './services/click-tracking.service';

// Phase 5: NEW - Tracking Kafka Consumer
import { TrackingKafkaConsumer } from './consumers/tracking-kafka.consumer';

// Existing Processing Services
import { BidRequestProcessor } from './processors/bid-request.processor';
import { BidResponseProcessor } from './processors/bid-response.processor';

// Existing Consumers
import { RTBKafkaConsumer } from './consumers/rtb-kafka.consumer';
import { AuctionProcessor } from './consumers/auction.consumer';

// Existing Utility Services
import { RTBCacheService } from './services/rtb-cache.service';
import { RTBMetricsService } from './services/rtb-metrics.service';
import { TimescaleModule } from 'src/timescale/timescale.module';

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
    PrismaModule,  // For database operations
    RedisModule,   // For caching and real-time counters
    KafkaModule,   // For async processing
    TimescaleModule,
  ],
  controllers: [
    RTBController,      // Main RTB endpoints (bid-request, bid-response, health)

    // Phase 5: NEW - Tracking endpoints
    TrackingController, // Impression/click tracking endpoints (/track/*)
  ],
  providers: [
    // === Core Business Logic Services ===
    RTBService,                    // Main RTB orchestration and request handling
    AuctionService,               // Auction logic and winner determination
    BidEvaluationService,         // Bid price calculation with performance adjustments
    CampaignEligibilityService,   // Campaign targeting evaluation and budget checks

    // === Phase 5: NEW - Tracking Services ===
    ImpressionTrackingService,    // Process impression events and update counters
    ClickTrackingService,         // Process click events and calculate CTR

    // === Message Processing Services ===
    BidRequestProcessor,          // Process incoming bid requests via Kafka
    BidResponseProcessor,         // Generate and format bid responses

    // === Phase 5: NEW - Tracking Kafka Consumer ===
    TrackingKafkaConsumer,        // Process tracking events from Kafka

    // === Existing Kafka Consumers ===
    RTBKafkaConsumer,            // Consume RTB-related messages
    AuctionProcessor,            // Handle auction workflows and analytics

    // === Utility Services ===
    RTBCacheService,             // RTB-specific caching operations
    RTBMetricsService,           // Performance metrics collection and analysis
    TimescaleSyncConsumer,
  ],
  exports: [
    RTBService,                  // Export main service for other modules
    AuctionService,              // Export auction service for processors
    CampaignEligibilityService,  // Export eligibility service for reuse
    BidEvaluationService,        // Export bid evaluation for processors

    // Phase 5: NEW - Export tracking services
    ImpressionTrackingService,   // Export for external integrations
    ClickTrackingService,        // Export for external integrations

    RTBCacheService,             // Export cache service for other modules
    RTBMetricsService,           // Export metrics service for monitoring
  ],
})
export class RTBModule {
  constructor() {
    console.log('🚀 RTB Module loaded - Phase 5 Complete');
    console.log('📊 Available services:');
    console.log('  - RTB Service (main orchestration)');
    console.log('  - Auction Service (auction processing)');
    console.log('  - Campaign Eligibility Service (targeting evaluation)');
    console.log('  - Bid Evaluation Service (price calculation)');
    console.log('  - 👁️  Impression Tracking Service (NEW - Phase 5)');
    console.log('  - 👆 Click Tracking Service (NEW - Phase 5)');
    console.log('  - 📈 Tracking Kafka Consumer (NEW - Phase 5)');
    console.log('  - RTB Cache Service (performance optimization)');
    console.log('  - RTB Metrics Service (performance tracking)');
    console.log('');
    console.log('🎯 Phase 5 Features:');
    console.log('  - Real-time impression tracking with viewability');
    console.log('  - Click tracking with fraud detection');
    console.log('  - Batch processing for high-volume scenarios');
    console.log('  - Analytics pipeline via Kafka');
    console.log('  - Performance alerts and monitoring');
  }
}