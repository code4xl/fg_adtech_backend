// // src/kafka/kafka.service.ts
// import {
//   Injectable,
//   OnModuleInit,
//   OnModuleDestroy,
//   Logger,
// } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { Kafka, Producer, Consumer, logLevel } from 'kafkajs';

// @Injectable()
// export class KafkaService implements OnModuleInit, OnModuleDestroy {
//   private readonly kafka: Kafka;
//   private readonly producer: Producer;
//   private consumer: Consumer;
//   private readonly logger = new Logger(KafkaService.name);

//   constructor(private configService: ConfigService) {
//     // Updated to work with KRaft configuration
//     this.kafka = new Kafka({
//       clientId: 'ocean-adtech',
//       brokers: (
//         configService.get<string>('kafka.brokers') || 'kafka:9092'
//       ).split(','),
//       logLevel: logLevel.WARN,
//     });

//     this.producer = this.kafka.producer();
//   }

//   async onModuleInit() {
//     await this.producer.connect();
//     this.logger.log('Kafka producer connected');
//   }

//   async onModuleDestroy() {
//     await this.producer.disconnect();
//     if (this.consumer) {
//       await this.consumer.disconnect();
//     }
//     this.logger.log('Kafka producer and consumer disconnected');
//   }

//   async createConsumer(groupId: string) {
//     this.consumer = this.kafka.consumer({ groupId });
//     await this.consumer.connect();
//     this.logger.log(`Kafka consumer connected: ${groupId}`);
//     return this.consumer;
//   }

//   async sendMessage(topic: string, message: any) {
//     try {
//       await this.producer.send({
//         topic,
//         messages: [{ value: JSON.stringify(message) }],
//       });
//       this.logger.debug(`Message sent to topic: ${topic}`);
//       return true;
//     } catch (error) {
//       this.logger.error(`Error sending message to topic ${topic}`, error);
//       throw error;
//     }
//   }

//   // Add methods to create topics if needed
//   async createTopic(topic: string, numPartitions = 1, replicationFactor = 1) {
//     const admin = this.kafka.admin();
//     await admin.connect();

//     try {
//       await admin.createTopics({
//         topics: [{ topic, numPartitions, replicationFactor }],
//       });
//       this.logger.log(`Topic created: ${topic}`);
//     } catch (error) {
//       this.logger.error(`Error creating topic ${topic}`, error);
//       throw error;
//     } finally {
//       await admin.disconnect();
//     }
//   }
// }

// src/kafka/kafka.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer, Consumer, EachMessagePayload } from 'kafkajs';
import { getKafkaConfig, kafkaTopics } from './constants/kafka.config';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private producer: Producer;
  private consumers: Map<string, Consumer> = new Map();

  constructor(private readonly configService: ConfigService) {
    let kafkaConfig = getKafkaConfig(this.configService);
    this.kafka = new Kafka(kafkaConfig);
    this.producer = this.kafka.producer();
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

  async publish(
    topic: string,
    message: { key: string; value: any },
  ): Promise<void> {
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
      console.error('Error publishing message to Kafka:', error);
      throw error;
    }
  }

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
}
