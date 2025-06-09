// src/kafka/kafka.init.ts
import {
  Injectable,
  OnApplicationBootstrap,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { KafkaService } from './kafka.service';
import { kafkaTopics } from './constants/kafka.config';

@Injectable()
export class KafkaInitService implements OnModuleInit {
  private readonly logger = new Logger(KafkaInitService.name);

  constructor(private readonly kafkaService: KafkaService) {}

  async onModuleInit() {
    try {
      this.logger.log('Creating Kafka topics...');

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
          topic: kafkaTopics.BID_RESPONSES,
          numPartitions: 3,
          replicationFactor: 1,
        },
        {
          topic: kafkaTopics.CAMPAIGN_METRICS,
          numPartitions: 3,
          replicationFactor: 1,
        },
        {
          topic: kafkaTopics.CLICKS,
          numPartitions: 3,
          replicationFactor: 1,
        },
        {
          topic: kafkaTopics.DLQ_BID_REQUESTS,
          numPartitions: 3,
          replicationFactor: 1,
        },
        {
          topic: kafkaTopics.DLQ_TRACKING,
          numPartitions: 3,
          replicationFactor: 1,
        },
        {
          topic: kafkaTopics.IMPRESSIONS,
          numPartitions: 3,
          replicationFactor: 1,
        },
        {
          topic: kafkaTopics.TIMESTREAM_SYNC,
          numPartitions: 3,
          replicationFactor: 1,
        },
      ]);

      this.logger.log('Kafka topics created successfully');
    } catch (error) {
      this.logger.error('Failed to create Kafka topics:', error);
    }
  }
}
