// src/kafka/kafka.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer, Consumer, EachMessagePayload } from 'kafkajs';
import { getKafkaConfig } from './constants/kafka.config';
import { ConfigService } from '@nestjs/config';
import { WithRetry } from 'src/common/resilience/retry.decorator';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private producer: Producer;
  private consumers: Map<string, Consumer> = new Map();

  constructor(private readonly configService: ConfigService) {
    let kafkaConfig = getKafkaConfig(this.configService);
    this.kafka = new Kafka(kafkaConfig);
    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      retry: {
        initialRetryTime: 300,
        retries: 5,
        maxRetryTime: 30000,
        factor: 2,
      },
    });
  }

  async onModuleInit() {
    try {
      await this.producer.connect();
      console.log('Kafka producer connected');
    } catch (error) {
      console.error('Failed to connect Kafka producer:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.producer.disconnect();

      // Disconnect all consumers
      for (const [groupId, consumer] of this.consumers) {
        await consumer.disconnect();
      }

      console.log('Kafka connections closed');
    } catch (error) {
      console.error('Error disconnecting Kafka:', error);
    }
  }
  @WithRetry(3, 200, 2, [Error])
  async publish(
    topic: string,
    message: { key: string; value: any },
  ): Promise<void> {
    try {
      this.producer.send({
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
      console.error('Error publishing message to Kafka:', error);
      throw error;
    }
  }
  @WithRetry(3, 200, 2, [Error])
  async publishBatch(
    topic: string,
    messages: Array<{ key: string; value: any }>,
  ): Promise<void> {
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
      console.error('Error publishing batch to Kafka:', error);
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
    try {
      // Check if consumer already exists for this group
      if (this.consumers.has(groupId)) {
        console.warn(`Consumer with groupId ${groupId} already exists`);
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
            console.error('Error processing message:', error);
            // You might want to implement dead letter queue here
          }
        },
      });

      console.log(
        `Kafka consumer subscribed to ${topic} with groupId ${groupId}`,
      );
    } catch (error) {
      console.error('Error subscribing to Kafka topic:', error);
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
        console.log(
          'Created topics:',
          topicsToCreate.map((t) => t.topic),
        );
      }

      await admin.disconnect();
    } catch (error) {
      console.error('Error creating topics:', error);
      throw error;
    }
  }

  async checkTopicExists(topic: string): Promise<boolean> {
    try {
      const admin = this.kafka.admin();
      await admin.connect();

      const topics = await admin.listTopics();
      const exists = topics.includes(topic);
      await admin.disconnect();
      return exists;
    } catch (error) {
      console.error('Error checking topic existence:', error);
      throw error;
    }
  }
}
