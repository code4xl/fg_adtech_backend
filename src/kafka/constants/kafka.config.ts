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
};
