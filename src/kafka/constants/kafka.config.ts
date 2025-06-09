// src/config/kafka.config.ts
import { ConfigService } from '@nestjs/config';
import { KafkaConfig } from 'kafkajs';

export const getKafkaConfig = (configService: ConfigService): KafkaConfig => ({
  clientId: 'ocean-ad-network',
  brokers: [configService.get<string>('kafka.brokers') || 'kafka:9092'],
  connectionTimeout: 3000,
  retry: {
    initialRetryTime: 100,
    retries: 3,
  },
});

export const kafkaTopics = {
  // RTB Flow
  BID_REQUESTS: 'rtb.bid-requests.v2',
  BID_RESPONSES: 'rtb.bid-responses.v2',
  AUCTION_RESULTS: 'rtb.auction-results.v2',

  // Tracking Events
  IMPRESSIONS: 'tracking.impressions.v2',
  CLICKS: 'tracking.clicks.v2',

  // Analytics & Aggregation
  CAMPAIGN_METRICS: 'analytics.campaign-metrics.v2',
  TIMESTREAM_SYNC: 'analytics.timestream-sync.v2',

  // Error Handling
  DLQ_BID_REQUESTS: 'dlq.bid-requests',
  DLQ_TRACKING: 'dlq.tracking-events',

  // New optimization topics
  RTB_OPTIMIZATION: 'rtb.optimization.v1',
  CAMPAIGN_BUDGET_ALERTS: 'alerts.campaign-budget.v1',
  PERFORMANCE_UPDATES: 'analytics.performance-updates.v1',

  // Google Inventory integration (future)
  GOOGLE_BID_REQUESTS: 'external.google.bid-requests.v1',
  GOOGLE_BID_RESPONSES: 'external.google.bid-responses.v1',

  // NEW: Enhanced RTB topics
  BID_ELIGIBILITY_CHECK: 'rtb.bid-eligibility.v1',
  AUCTION_PREPROCESSING: 'rtb.auction-preprocessing.v1',
  CREATIVE_PERFORMANCE_UPDATE: 'analytics.creative-performance.v1',
  BUDGET_EXHAUSTION_ALERT: 'alerts.budget-exhaustion.v1',
  FRAUD_DETECTION: 'security.fraud-detection.v1',

  // Batch processing topics
  TIMESTREAM_BATCH_IMPRESSIONS: 'timestream.batch.impressions.v1',
  TIMESTREAM_BATCH_CLICKS: 'timestream.batch.clicks.v1',
};
