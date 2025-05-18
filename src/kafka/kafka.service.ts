// src/kafka/kafka.service.ts
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Kafka, Producer, Consumer, EachMessagePayload } from 'kafkajs';
import { getKafkaConfig, kafkaTopics } from './constants/kafka.config';
import { ConfigService } from '@nestjs/config';
import { WithRetry } from 'src/common/resilience/retry.decorator';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka;
  private producer: Producer;
  private consumers: Map<string, Consumer> = new Map();
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {
    let kafkaConfig = getKafkaConfig(this.configService);
    this.kafka = new Kafka(kafkaConfig);
    this.producer = this.kafka.producer({
      retry: {
        initialRetryTime: 300,
        retries: 5,
        maxRetryTime: 30000,
        factor: 2,
      },
    });
  }

  async onModuleInit() {
    await this.connectWithRetry();
  }

  async onModuleDestroy() {
    try {
      await this.producer.disconnect();

      // Disconnect all consumers
      for (const [groupId, consumer] of this.consumers) {
        await consumer.disconnect();
      }

      this.isConnected = false;
      this.logger.log('Kafka connections closed');
    } catch (error) {
      this.logger.error('Error disconnecting Kafka:', error);
    }
  }

  private async connectWithRetry(maxRetries = 10) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.producer.connect();
        this.isConnected = true;
        this.logger.log('Kafka producer connected successfully');
        return;
      } catch (error) {
        this.logger.warn(
          `Kafka connection attempt ${attempt}/${maxRetries} failed: ${error.message}`,
        );

        if (attempt === maxRetries) {
          this.logger.error(
            'Failed to connect to Kafka after all retries. Application will continue without Kafka.',
          );
          // Don't throw error - let the application start without Kafka
          return;
        }

        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  @WithRetry(3, 200, 2, [Error])
  async publish(
    topic: string,
    message: { key: string; value: any },
  ): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn(
        'Kafka producer not connected. Skipping message publish.',
      );
      return;
    }

    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key: message.key,
            value: JSON.stringify(message.value),
            timestamp: Date.now().toString(),
          },
        ],
      });
    } catch (error) {
      this.logger.error('Error publishing message to Kafka:', error);
      // Try to reconnect if connection is lost
      if (error.name?.includes('Connection') || error.code === 'ECONNREFUSED') {
        this.isConnected = false;
        this.connectWithRetry();
      }
      throw error;
    }
  }

  @WithRetry(3, 200, 2, [Error])
  async publishBatch(
    topic: string,
    messages: Array<{ key: string; value: any }>,
  ): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('Kafka producer not connected. Skipping batch publish.');
      return;
    }

    try {
      const kafkaMessages = messages.map((msg) => ({
        key: msg.key,
        value: JSON.stringify(msg.value),
        timestamp: Date.now().toString(),
      }));

      await this.producer.send({
        topic,
        messages: kafkaMessages,
      });
    } catch (error) {
      this.logger.error('Error publishing batch to Kafka:', error);
      if (error.name?.includes('Connection') || error.code === 'ECONNREFUSED') {
        this.isConnected = false;
        this.connectWithRetry();
      }
      throw error;
    }
  }

  async subscribe(
    topic: string,
    groupId: string,
    handler: (payload: {
      key: string;
      value: any;
      topic: string;
      partition: number;
      offset: string;
    }) => Promise<void>,
  ): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn(`Cannot subscribe to ${topic}. Kafka not connected.`);
      return;
    }

    try {
      // Check if consumer already exists for this group
      if (this.consumers.has(groupId)) {
        this.logger.warn(`Consumer with groupId ${groupId} already exists`);
        return;
      }

      const consumer = this.kafka.consumer({ groupId });
      this.consumers.set(groupId, consumer);

      await consumer.connect();
      await consumer.subscribe({ topic, fromBeginning: false });

      await consumer.run({
        eachMessage: async ({
          topic,
          partition,
          message,
        }: EachMessagePayload) => {
          try {
            const value = JSON.parse(message.value?.toString() || '{}');
            const key = message.key?.toString() || '';

            await handler({
              key,
              value,
              topic,
              partition,
              offset: message.offset,
            });
          } catch (error) {
            this.logger.error('Error processing message:', error);
            // You might want to implement dead letter queue here
          }
        },
      });

      this.logger.log(
        `Kafka consumer subscribed to ${topic} with groupId ${groupId}`,
      );
    } catch (error) {
      this.logger.error('Error subscribing to Kafka topic:', error);
      throw error;
    }
  }

  // Utility method to create topics (useful for development)
  async createTopics(
    topics: Array<{
      topic: string;
      numPartitions?: number;
      replicationFactor?: number;
    }>,
  ): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('Cannot create topics. Kafka not connected.');
      return;
    }

    try {
      const admin = this.kafka.admin();
      await admin.connect();

      const existingTopics = await admin.listTopics();
      const topicsToCreate = topics.filter(
        (t) => !existingTopics.includes(t.topic),
      );

      if (topicsToCreate.length > 0) {
        await admin.createTopics({
          topics: topicsToCreate.map((t) => ({
            topic: t.topic,
            numPartitions: t.numPartitions || 3,
            replicationFactor: t.replicationFactor || 1,
          })),
        });
        this.logger.log(
          'Created topics:',
          topicsToCreate.map((t) => t.topic),
        );
      }

      await admin.disconnect();
    } catch (error) {
      this.logger.error('Error creating topics:', error);
      throw error;
    }
  }

  // Health check method
  isConnectedToKafka(): boolean {
    return this.isConnected;
  }
}
