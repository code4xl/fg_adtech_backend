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
  // Existing RTB topics (keep these)
  BID_REQUESTS: 'rtb.bid-requests.v2',
  BID_RESPONSES: 'rtb.bid-responses.v2',
  AUCTION_RESULTS: 'rtb.auction-results.v2',
  AUCTION_PROCESSING: 'rtb.auction-processing.v2',

  // Phase 5: NEW - Tracking Events Topics
  IMPRESSIONS: 'tracking.impressions.v2',
  CLICKS: 'tracking.clicks.v2',

  // Phase 5: NEW - Analytics Topics
  CAMPAIGN_METRICS: 'analytics.campaign-metrics.v2',
  TIMESTREAM_SYNC: 'analytics.timestream-sync.v2',

  // Existing error handling topics (keep these)
  DLQ_BID_REQUESTS: 'dlq.bid-requests',

  // Phase 5: NEW - Tracking Error Handling
  DLQ_TRACKING: 'dlq.tracking-events',

  // Existing optimization topics (keep these)
  RTB_OPTIMIZATION: 'rtb.optimization.v1',
  CAMPAIGN_BUDGET_ALERTS: 'alerts.campaign-budget.v1',
  PERFORMANCE_UPDATES: 'analytics.performance-updates.v1',

  // Phase 5: NEW - Additional Alert Topics
  FRAUD_ALERTS: 'alerts.fraud-detection.v1',
  PERFORMANCE_ALERTS: 'alerts.performance.v1',

  // Existing future integration topics (keep these)
  GOOGLE_BID_REQUESTS: 'external.google.bid-requests.v1',
  GOOGLE_BID_RESPONSES: 'external.google.bid-responses.v1',

  // Existing enhanced RTB topics (keep these)
  BID_ELIGIBILITY_CHECK: 'rtb.bid-eligibility.v1',
  AUCTION_PREPROCESSING: 'rtb.auction-preprocessing.v1',
  CREATIVE_PERFORMANCE_UPDATE: 'analytics.creative-performance.v1',
  BUDGET_EXHAUSTION_ALERT: 'alerts.budget-exhaustion.v1',
  FRAUD_DETECTION: 'security.fraud-detection.v1',

  // Phase 5: NEW - Timestream Batch Processing
  TIMESTREAM_BATCH_IMPRESSIONS: 'timestream.batch.impressions.v1',
  TIMESTREAM_BATCH_CLICKS: 'timestream.batch.clicks.v1',

  // Existing aggregation topics (keep these)
  HOURLY_AGGREGATION: 'analytics.hourly.v2',
  DLQ_AUCTIONS: 'dlq.auctions',
};
