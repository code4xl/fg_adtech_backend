import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaService } from '../kafka/kafka.service';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdMarkupService } from './ad-markup.service';
import { kafkaTopics } from '../kafka/constants/kafka.config';

@Injectable()
export class BidResponseConsumerService implements OnModuleInit {
  private readonly logger = new Logger(BidResponseConsumerService.name);
  private readonly CACHE_TTL = 60 * 5; // 5 minutes

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly adMarkupService: AdMarkupService,
  ) {}

  onModuleInit() {
    this.subscribeToAuctionResults();
  }

  async subscribeToAuctionResults() {
    const topic = kafkaTopics.AUCTION_RESULTS;
    const groupId = 'rtb-bid-response-service';

    this.logger.log(`Subscribing to topic: ${topic} with groupId: ${groupId}`);

    this.kafkaService.subscribe(
      topic,
      groupId,
      async ({ key, value, topic, partition, offset }) => {
        try {
          this.logger.debug(
            `Received auction result: ${JSON.stringify(value)} from topic: ${topic}, partition: ${partition}, offset: ${offset}`,
          );

          // Handle no-bid cases
          if (value.noBids) {
            this.logger.debug(`No bids for auction: ${value.auctionId}`);
            return;
          }

          await this.processAuctionResult(value);
        } catch (error) {
          this.logger.error(
            `Error processing auction result: ${error.message}`,
            error.stack,
          );
        }
      },
    );
    this.logger.log(`Subscribed to topic: ${topic} with groupId: ${groupId}`);
  }

  /**
   * Process auction result and prepare bid response
   */
  async processAuctionResult(auctionResult: any) {
    try {
      const { auctionId, bidRequestId, winningBid } = auctionResult;

      if (!winningBid || !bidRequestId) {
        this.logger.warn(
          `Invalid auction result data for auction: ${auctionId}`,
        );
        return;
      }

      // Get bid request to retrieve the original requestId
      const bidRequest = await this.prisma.bidRequest.findUnique({
        where: { id: bidRequestId },
        select: { requestId: true },
      });

      if (!bidRequest) {
        this.logger.warn(
          `Bid request not found for auction result: ${auctionId}`,
        );
        return;
      }

      // Get creative details for the winning bid
      const creative = await this.prisma.creative.findUnique({
        where: { id: winningBid.creativeId },
      });

      if (!creative) {
        this.logger.warn(
          `Creative not found for winning bid: ${winningBid.id}`,
        );
        return;
      }

      // Generate ad markup
      const adMarkup = this.adMarkupService.generateAdMarkup(creative, {
        auctionId,
        price: winningBid.finalPrice,
      });

      // Update bid response with the markup
      await this.prisma.bidResponse.update({
        where: { id: winningBid.bidResponseId },
        data: { adMarkup },
      });

      // Cache the response for quick retrieval by the SDK
      const cacheKey = `bid-response:${bidRequest.requestId}`;
      await this.redis.set(cacheKey, adMarkup, this.CACHE_TTL);

      this.logger.debug(
        `Processed auction result for bid request: ${bidRequest.requestId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing auction result: ${error.message}`,
        error.stack,
      );
    }
  }
}
