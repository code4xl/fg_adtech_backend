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
  BID_REQUESTS: 'bid-requests',
  AUCTION_RESULTS: 'auction-results',
  TRACKING_EVENTS: 'tracking-events',
  CAMPAIGN_UPDATES: 'campaign-updates',
};
