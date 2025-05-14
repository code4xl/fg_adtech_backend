import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { KafkaService } from './kafka/kafka.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly kafkaService: KafkaService, // Inject
  ) {}

  @Get('/health')
  getHello(): any {
    return 'Health 100%';
  }

  // In your controller
  // @Get('kafka-test')
  // async testKafka() {
  //   const testTopic = 'test-topic1';

  //   // Create topic if it doesn't exist
  //   try {
  //     await this.kafkaService.createTopic(testTopic);
  //   } catch (error) {
  //     // Topic might already exist, which is fine
  //   }

  //   // Send test message
  //   await this.kafkaService.sendMessage(testTopic, {
  //     test: true,
  //     timestamp: new Date().toISOString(),
  //   });

  //   return { success: true, message: 'Test message sent to Kafka' };
  // }
  // @Get('kafka-test-consumer')
  // async initTestConsumer() {
  //   const consumer = await this.kafkaService.createConsumer(
  //     'test-consumer-group',
  //   );
  //   await consumer.subscribe({ topic: 'test-topic1', fromBeginning: true });

  //   await consumer.run({
  //     eachMessage: async ({ topic, partition, message }) => {
  //       console.log(`Received message from topic ${topic}: ${message.value}`);
  //     },
  //   });
  //   return;
  // }
}
