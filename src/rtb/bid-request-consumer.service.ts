import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaService } from 'src/kafka/kafka.service';
import { kafkaTopics } from 'src/kafka/constants/kafka.config';
import { AuctionService } from './auction.service';
@Injectable()
export class BidRequestConsumerService implements OnModuleInit {
  private readonly logger = new Logger(BidRequestConsumerService.name);

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly configService: ConfigService,
    private readonly auctionService: AuctionService,
  ) {}

  onModuleInit() {
    this.subscribeToBidRequest();
  }

  async subscribeToBidRequest() {
    const topic = kafkaTopics.BID_REQUESTS;
    const groupId = 'rtb-auction-service';

    this.logger.log(`Subscribing to topic: ${topic} with groupId: ${groupId}`);

    this.kafkaService.subscribe(
      topic,
      groupId,
      async ({ key, value, topic, partition, offset }) => {
        try {
          this.logger.log(
            `Received bid request: ${value} from topic: ${topic}, partition: ${partition}, offset: ${offset}`,
          );

          await this.auctionService.processAuction(value);
        } catch (error) {
          this.logger.error(
            `Error processing bid request: ${error.message}`,
            error.stack,
          );
        }
      },
    );
    this.logger.log(`Subscribed to topic: ${topic} with groupId: ${groupId}`);
  }
}
