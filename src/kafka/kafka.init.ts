// src/kafka/kafka-init.ts
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { KafkaService } from './kafka.service';
import { kafkaTopics } from './constants/kafka.config';

@Injectable()
export class KafkaInitService implements OnApplicationBootstrap {
  constructor(private readonly kafkaService: KafkaService) {}

  async onApplicationBootstrap() {
    // Create required topics on startup
    await this.kafkaService.createTopics([
      { topic: kafkaTopics.BID_REQUESTS },
      { topic: kafkaTopics.AUCTION_RESULTS },
      { topic: kafkaTopics.TRACKING_EVENTS },
      { topic: kafkaTopics.CAMPAIGN_UPDATES },
    ]);
  }
}
