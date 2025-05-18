// src/kafka/kafka.init.ts
import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { KafkaService } from './kafka.service';
import { kafkaTopics } from './constants/kafka.config';

@Injectable()
export class KafkaInitService implements OnApplicationBootstrap {
  private readonly logger = new Logger(KafkaInitService.name);

  constructor(private readonly kafkaService: KafkaService) {}

  async onApplicationBootstrap() {
    try {
      this.logger.log('Creating Kafka topics...');

      // Wait for Kafka service to be connected first
      await this.waitForKafkaConnection();

      // Create required topics on startup
      await this.kafkaService.createTopics([
        {
          topic: kafkaTopics.BID_REQUESTS,
          numPartitions: 3,
          replicationFactor: 1,
        },
        {
          topic: kafkaTopics.AUCTION_RESULTS,
          numPartitions: 3,
          replicationFactor: 1,
        },
        {
          topic: kafkaTopics.TRACKING_EVENTS,
          numPartitions: 3,
          replicationFactor: 1,
        },
        {
          topic: kafkaTopics.CAMPAIGN_UPDATES,
          numPartitions: 3,
          replicationFactor: 1,
        },
      ]);

      this.logger.log('Kafka topics created successfully');

      // Small delay to ensure topics are ready before consumers start
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      this.logger.error('Failed to create Kafka topics:', error);
      // Don't throw error to prevent application startup failure
    }
  }

  private async waitForKafkaConnection(maxAttempts = 30) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (this.kafkaService.isConnectedToKafka()) {
        this.logger.log('Kafka connection confirmed');
        return;
      }

      this.logger.log(
        `Waiting for Kafka connection... (${attempt}/${maxAttempts})`,
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error('Kafka connection timeout');
  }
}
