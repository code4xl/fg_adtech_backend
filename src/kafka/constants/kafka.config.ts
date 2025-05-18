// src/config/kafka.config.ts
import { ConfigService } from '@nestjs/config';
import { KafkaConfig } from 'kafkajs';

export const getKafkaConfig = (configService: ConfigService): KafkaConfig => ({
  clientId: 'ocean-ad-network',
  brokers: [configService.get<string>('KAFKA_BROKER') || 'kafka:9092'],
  connectionTimeout: 10000, // Increased timeout
  authenticationTimeout: 10000,
  reauthenticationThreshold: 30000,
  retry: {
    initialRetryTime: 300,
    retries: 8, // Increased retries
    maxRetryTime: 30000,
    factor: 2,
    multiplier: 2,
    restartOnFailure: async (e) => {
      console.log('Kafka restart on failure:', e);
      return true;
    },
  },
});

export const kafkaTopics = {
  BID_REQUESTS: 'bid-requests',
  AUCTION_RESULTS: 'auction-results',
  TRACKING_EVENTS: 'tracking-events',
  CAMPAIGN_UPDATES: 'campaign-updates',
};
