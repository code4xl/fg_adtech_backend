import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaService } from 'src/kafka/kafka.service';
import { kafkaTopics } from '../constants/kafka-topics';
import {
  BidRequestPayload,
  ProcessBidRequestPayload,
} from '../types/bid-request.types';
import { RtbHelper } from '../utils/helpers';
import { BidRequestProcessor } from '../processors/bid-request.processor';

@Injectable()
export class BidRequestKafkaConsumer implements OnModuleInit {
  private readonly logger = new Logger(BidRequestKafkaConsumer.name);

  constructor(
    private readonly kafka: KafkaService,
    private readonly bidRequestProcessor: BidRequestProcessor,

    private readonly rtbHelper: RtbHelper,
  ) {}

  async onModuleInit() {
    try {
      // Process incoming bid requests
      await this.subscribeToAuctionProcessing();
    } catch (error) {
      this.logger.error('Failed to initialize RTB Kafka Consumer', {
        error: error.message,
      });
      throw error;
    }
  }

  private async subscribeToAuctionProcessing(): Promise<void> {
    await this.kafka.subscribe(
      kafkaTopics.AUCTION_PROCESSING,
      'rtb-auction-processor',
      this.processBidRequestForAuction.bind(this),
    );
  }

  private async processBidRequestForAuction(
    payload: ProcessBidRequestPayload,
  ): Promise<void> {
    const startTime = Date.now();
    let auctionId: string | undefined;

    try {
      this.logger.debug('Processing auction request', {
        key: payload.key,
        partition: payload.partition,
        offset: payload.offset,
      });

      // 1. Deserialize bid request with validation
      const bidRequestData = this.deserializeBidRequest(payload.value);
      auctionId = bidRequestData.bidRequest.auctionId;

      // 2. Validate message structure and required fields
      this.rtbHelper.validateBidRequest(bidRequestData.bidRequest);

      // 3. Process auction with timeout protection (max 150ms)
      const auctionResult = await Promise.race([
        this.bidRequestProcessor.processBidRequest(bidRequestData.bidRequest),
        // this.createTimeoutPromise(150, auctionId),
      ]);

      //   this.logger.debug(
      //     'Auction processed successfully and Sending to publush auction result',
      //     // {
      //     //     bidRequest: bidRequestData,
      //     //     auctionId: auctionResult.auctionId,
      //     //     winnerId: auctionResult?.winner?.id,
      //     // },
      //   );

      // 4. Publish auction results for response generation
      // await this.rtbProducer.publishAuctionResult(
      //   auctionResult,
      //   bidRequestData,
      // );

      // 5. Record processing metrics
      // const processingTime = Date.now() - startTime;

      //   this.logger.debug('Recording processing metrics', {
      //     auctionId: auctionResult.auctionId,
      //   });

      // await this.recordProcessingMetrics(
      //   auctionResult.auctionId,
      //   processingTime,
      //   'success',
      //   auctionResult.totalBids,
      // );

      //   this.logger.debug('Recording processing metrics done', {
      //     auctionId: auctionResult.auctionId,
      //   });

      this.logger.debug(' Auction processed successfully', {
        auctionId: auctionResult.auctionId,
        winner: auctionResult.winner ? 'yes' : 'no',
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('Auction processing failed', {
        error: error,
        processingTime: `${processingTime}ms`,
        partition: payload.partition,
        offset: payload.offset,
      });

      // Send to DLQ for manual review if critical error
      await this.rtbHelper.handleProcessingError(
        payload,
        error,
        'auction_processing',
      );

      // Record failure metrics
      // await this.recordProcessingMetrics(auctionId, processingTime, 'error');
    }
  }

  private deserializeBidRequest(data: BidRequestPayload): BidRequestPayload {
    try {
      this.logger.debug(
        'Deserializing bid request while consumption',
        // ` - : ${JSON.stringify(data)}`,
      );
      if (typeof data === 'string') {
        return JSON.parse(data);
      }
      return data;
    } catch (error) {
      throw new Error(`Invalid bid request format: ${error.message}`);
    }
  }
}
