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
  BID_REQUESTS: 'rtb.bid-requests.v2',
  BID_RESPONSES: 'rtb.bid-responses.v2',
  AUCTION_RESULTS: 'rtb.auction-results.v2',

  IMPRESSIONS: 'tracking.impressions.v2',
  CLICKS: 'tracking.clicks.v2',

  CAMPAIGN_METRICS: 'analytics.campaign-metrics.v2',
  TIMESTREAM_SYNC: 'analytics.timestream-sync.v2',

  DLQ_BID_REQUESTS: 'dlq.bid-requests',
  DLQ_TRACKING: 'dlq.tracking-events',

  RTB_OPTIMIZATION: 'rtb.optimization.v1',
  CAMPAIGN_BUDGET_ALERTS: 'alerts.campaign-budget.v1',
  PERFORMANCE_UPDATES: 'analytics.performance-updates.v1',

  GOOGLE_BID_REQUESTS: 'external.google.bid-requests.v1',
  GOOGLE_BID_RESPONSES: 'external.google.bid-responses.v1',

  BID_ELIGIBILITY_CHECK: 'rtb.bid-eligibility.v1',
  AUCTION_PREPROCESSING: 'rtb.auction-preprocessing.v1',
  CREATIVE_PERFORMANCE_UPDATE: 'analytics.creative-performance.v1',
  BUDGET_EXHAUSTION_ALERT: 'alerts.budget-exhaustion.v1',
  FRAUD_DETECTION: 'security.fraud-detection.v1',

  TIMESTREAM_BATCH_IMPRESSIONS: 'timestream.batch.impressions.v1',
  TIMESTREAM_BATCH_CLICKS: 'timestream.batch.clicks.v1',

  AUCTION_PROCESSING: 'rtb.auction-processing.v2',
  HOURLY_AGGREGATION: 'analytics.hourly.v2',
  DLQ_AUCTIONS: 'dlq.auctions',
};
