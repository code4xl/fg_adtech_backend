import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { kafkaTopics } from '../constants/kafka-topics';
import { KafkaService } from 'src/kafka/kafka.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { BidResponseProcessor } from '../processors/bid-response.processor';
import AuctionProducer from '../producers/auction.producer';
import {
  AuctionBidResult,
  HandleNoBidsResult,
  ErrorAuctionResult,
} from '../types/auction-result.types';
import { ProcessAuctionResultPayload } from '../types/bid-request.types';
import { WinningBidResponse } from '../types/bid-response.types';
import { RtbHelper } from '../utils/helpers';
import { SSE_EVENTS, SSE_REDIS_KEYS } from '../sse/constants/sse.constants';

@Injectable()
export class AuctionResultKafkaConsumer implements OnModuleInit {
  private readonly logger = new Logger(AuctionResultKafkaConsumer.name);

  constructor(
    private readonly kafka: KafkaService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    // private readonly auctionProcessor: AuctionProcessor,
    private readonly bidResponseProcessor: BidResponseProcessor,
    private readonly auctionProducer: AuctionProducer,
    private readonly rtbHelper: RtbHelper,
  ) {
    this.logger.debug('Auction Completion Consumer initialized');
  }

  async onModuleInit() {
    try {
      // Generate bid responses from auction results
      await this.subscribeToAuctionResults();
    } catch (error) {
      this.logger.error('Failed to initialize RTB Kafka Consumer', {
        error: error.message,
      });
      throw error;
    }
  }

  private async subscribeToAuctionResults(): Promise<void> {
    await this.kafka.subscribe(
      kafkaTopics.AUCTION_RESULTS,
      'rtb-response-generator',
      this.processAuctionResult.bind(this),
    );
  }

  // Type guards for auction result discrimination
  private isSuccessfulBidResult(result: any): result is AuctionBidResult {
    return result.auctionStatus === 'COMPLETED' && result.winner !== null;
  }

  private isNoBidsResult(result: any): result is HandleNoBidsResult {
    return result.auctionStatus === 'NO_BIDS';
  }

  private isErrorResult(result: any): result is ErrorAuctionResult {
    return result.auctionStatus === 'ERROR';
  }

  private async processAuctionResult(
    payload: ProcessAuctionResultPayload,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.debug(
        'Processing auction result new one',
        //     {
        //     key: payload.key,
        //     value: payload.value,
        //     partition: payload.partition,
        // }
      );

      // 1. Deserialize auction result
      const auctionResult = this.deserializeAuctionResult(payload.value);

      // 2. Type-safe processing based on auction status
      let bidResponses:
        | WinningBidResponse[]
        | HandleNoBidsResult[]
        | ErrorAuctionResult[];
      let auctionType: string;

      if (this.isSuccessfulBidResult(auctionResult)) {
        // TypeScript now knows this is AuctionBidResult
        this.logger.debug('Processing successful auction result', {
          auctionId: auctionResult.auctionId,
          winnerId: auctionResult.winnerId,
          finalPrice: auctionResult.finalPrice,
        });

        auctionType = 'SUCCESS';
        bidResponses =
          await this.bidResponseProcessor.generateCompletedAuctionResponses(
            auctionResult,
          );
      } else if (this.isNoBidsResult(auctionResult)) {
        // TypeScript now knows this is HandleNoBidsResult
        this.logger.debug('Processing no bids auction result', {
          auctionId: auctionResult.auctionId,
          totalBids: auctionResult.totalBids,
          processingTime: auctionResult.processingTime,
        });

        auctionType = 'NO_BIDS';
        bidResponses =
          await this.bidResponseProcessor.generateNoBidsResponse(auctionResult);
      } else if (this.isErrorResult(auctionResult)) {
        // TypeScript now knows this is ErrorAuctionResult
        this.logger.error('Processing error auction result', {
          auctionId: auctionResult.auctionId,
          errorMessage: auctionResult.errorMessage,
          errorCode: auctionResult.errorCode,
        });

        auctionType = 'ERROR';
        bidResponses =
          await this.bidResponseProcessor.generateErrorResponse(auctionResult);
      } else {
        throw new Error(
          `Unknown auction status: ${(auctionResult as any).auctionStatus}`,
        );
      }

      this.logger.debug('✅ Bid responses generated', {
        responseCount: bidResponses.length,
        auctionType,
        auctionId: auctionResult.auctionId,
        requestId: auctionResult.originalBidRequest?.externalRequestId,
      });

      // 3. Store responses in cache for SDK polling
      await this.bidResponseProcessor.storeBidResponses(bidResponses);

      // 3.5. Publish to SSE Redis channel for real-time streaming
      await this.publishToSSE(bidResponses, auctionResult);

      // 4. Publish auction completion for log storage and analytics
      await this.auctionProducer.publishAuctionCompletion(auctionResult);

      // 5. Send win notifications if applicable (later phase)
      // if (this.isSuccessfulBidResult(auctionResult) && auctionResult.winner) {
      //     // await this.bidResponseProcessor.sendWinNotifications(auctionResult);
      // }

      const processingTime = Date.now() - startTime;

      this.logger.debug(' Auction result processed', {
        auctionId: auctionResult.auctionId,
        auctionType,
        processingTime: `${processingTime}ms`,
        responseCount: bidResponses.length,
      });
    } catch (error) {
      this.logger.error('❌ Auction result processing failed', {
        error: error.message,
        partition: payload.partition,
        offset: payload.offset,
      });

      // Send to DLQ for manual review
      await this.rtbHelper.handleProcessingError(
        payload,
        error,
        'auction_result',
      );
    }
  }

  private deserializeAuctionResult(
    data: any,
  ): AuctionBidResult | HandleNoBidsResult | ErrorAuctionResult {
    try {
      let parsedData: any;

      if (typeof data === 'string') {
        parsedData = JSON.parse(data);
      } else {
        parsedData = data;
      }

      // Validate that we have the required auctionStatus field
      if (!parsedData.auctionStatus) {
        throw new Error('Missing auctionStatus field in auction result');
      }

      // Validate auctionStatus is one of the expected values
      const validStatuses = ['COMPLETED', 'NO_BIDS', 'ERROR'];
      if (!validStatuses.includes(parsedData.auctionStatus)) {
        throw new Error(`Invalid auctionStatus: ${parsedData.auctionStatus}`);
      }

      return parsedData;
    } catch (error) {
      throw new Error(`Invalid auction result format: ${error.message}`);
    }
  }

  /**
   * Publish auction results to SSE Redis channel for real-time streaming
   */
  private async publishToSSE(
    bidResponses: any[],
    auctionResult: AuctionBidResult | HandleNoBidsResult | ErrorAuctionResult,
  ): Promise<void> {
    try {
      this.logger.debug('PublishToSSE called', {
        responseCount: bidResponses?.length || 0,
        auctionId: auctionResult.auctionId,
        auctionStatus: auctionResult.auctionStatus,
        hasOriginalBidRequest: !!auctionResult.originalBidRequest,
        externalRequestId: auctionResult.originalBidRequest?.externalRequestId,
      });
      
      if (!auctionResult.originalBidRequest) {
        this.logger.error('No originalBidRequest in auction result');
        return;
      }

      // CRITICAL FIX: Use the internal request ID (bidRequest.id) for SSE channel
      // The SDK connects to SSE using the requestId returned from /bid-request endpoint
      // which is the internal ID, not the externalRequestId
      const requestId = auctionResult.originalBidRequest.id;
      
      if (!requestId) {
        this.logger.error('No internal request ID found in originalBidRequest', {
          bidRequestKeys: Object.keys(auctionResult.originalBidRequest),
          externalRequestId: auctionResult.originalBidRequest.externalRequestId,
        });
        return;
      }
      
      this.logger.debug('Using internal request ID for SSE channel', {
        internalRequestId: requestId,
        externalRequestId: auctionResult.originalBidRequest.externalRequestId,
        auctionId: auctionResult.auctionId,
      });

      // Create slot responses for the SDK
      const slots = [];
      
      if (bidResponses && bidResponses.length > 0) {
        // Handle winning bid responses
        for (const response of bidResponses) {
          this.logger.debug('Processing bid response for SSE', {
            responseType: response.constructor.name,
            hasWinningBid: !!response.winningBid,
            responseKeys: Object.keys(response),
          });
          
          // Check if this is a WinningBidResponse
          if (response.winningBid && response.requestId) {
            const inventoryId = auctionResult.originalBidRequest.inventoryId;
            
            this.logger.debug('Creating filled slot response', {
              inventoryId,
              bidPrice: response.winningBid.price,
              campaignId: response.winningBid.campaignId,
              creativeId: response.winningBid.creativeId,
              hasAdMarkup: !!response.winningBid.adMarkup,
              adMarkupLength: response.winningBid.adMarkup?.length,
              adMarkupPreview: response.winningBid.adMarkup?.substring(0, 200),
              adSlotWidth: auctionResult.originalBidRequest.adSlotContext?.width,
              adSlotHeight: auctionResult.originalBidRequest.adSlotContext?.height,
            });
            
            slots.push({
              inventoryId: inventoryId,
              elementId: '',
              status: 'filled' as const,
              bid: {
                bidId: `bid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                price: response.winningBid.price,
                advertiser: 'Ocean Ads Network',
                campaignId: response.winningBid.campaignId,
              },
              creative: {
                type: 'banner' as const,
                markup: response.winningBid.adMarkup,
                width: auctionResult.originalBidRequest.adSlotContext?.width || 300,
                height: auctionResult.originalBidRequest.adSlotContext?.height || 250,
                trackers: {
                  impression: response.winningBid.impressionUrls?.[0] || '',
                  click: response.winningBid.clickUrls?.[0] || '',
                },
              },
            });
          }
        }
      }
      
      // If no winning bids, send no_bid response
      if (slots.length === 0) {
        const inventoryId = auctionResult.originalBidRequest.inventoryId;
        slots.push({
          inventoryId: inventoryId,
          elementId: '',
          status: 'no_bid' as const,
          fallback: {
            type: 'blank' as const,
            markup: '',
          },
        });
      }

      // Prepare the SSE event data (AdResponse format)
      const adResponse = {
        meta: {
          requestId: requestId,
          processingTime: auctionResult.processingTime || 100,
          timestamp: Date.now(),
        },
        slots: slots,
      };

      // Wrap in SSE event structure for the SSE service
      const sseEvent = {
        type: SSE_EVENTS.BID_COMPLETE,
        requestId: requestId,
        timestamp: new Date().toISOString(),
        data: adResponse, // The SSE service will send this as event data
      };

      // Publish to Redis SSE channel
      const channelKey = SSE_REDIS_KEYS.EVENT_CHANNEL(requestId);
      
      this.logger.debug('🚀 Publishing auction result to SSE channel', {
        requestId,
        channelKey,
        auctionId: auctionResult.auctionId,
        auctionStatus: auctionResult.auctionStatus,
        slotCount: slots.length,
        firstSlotStatus: slots[0]?.status,
        hasWinningBid: slots.some(s => s.status === 'filled'),
        eventType: SSE_EVENTS.BID_COMPLETE,
      });
      
      await this.redis.publish(channelKey, JSON.stringify(sseEvent));
      
      this.logger.debug('✅ Successfully published to SSE channel', {
        requestId,
        channelKey,
        eventSent: true,
      });
    } catch (error) {
      this.logger.error('Failed to publish to SSE channel', {
        error: error.message,
        auctionId: auctionResult.auctionId,
      });
      // Don't throw - SSE failure shouldn't break the main flow
    }
  }
}
