import { Injectable, Logger } from '@nestjs/common';
import { BidResponseDto, CreateBidRequestDto } from '../dto';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { RtbCacheService } from '../cache/rtb-cache.service';
import AuctionProducer from '../producers/auction.producer';
import {
  BidRequestWithAuction,
  EnrichedBidRequest,
  ProcessBidRequestResponse,
  ServerContext,
} from '../types/bid-request.types';
import { RtbHelper } from '../utils/helpers';
import { SSE_REDIS_KEYS } from '../sse/constants/sse.constants';

@Injectable()
export class RtbService {
  private readonly logger = new Logger(RtbService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rtbCacheService: RtbCacheService,
    private readonly auctionProducer: AuctionProducer,
    private readonly rtbHelper: RtbHelper,
  ) { }
 /**
     * Store SSE metadata for request tracking
     * Called when SSE is enabled for a request
     */
  async storeSSEMetadata(
    requestId: string,
    metadata: {
        publisherId: string;
        websiteId: string;
        inventoryId: string;
        auctionId: string;
        sseEnabled: boolean;
        sseTimeout?: number;
    }
  ): Promise<void> {
    try {
        const key = SSE_REDIS_KEYS.REQUEST_INFO(requestId);
        const data = {
            requestId,
            ...metadata,
            status: 'pending',
            createdAt: new Date().toISOString(),
            ttl: 300, // 5 minutes
        };

        await this.redis.set(
            key,
            JSON.stringify(data),
            300 // 5 minutes TTL
        );

        this.logger.debug('SSE metadata stored', { requestId, metadata });
    } catch (error) {
        // Non-blocking error - SSE is optional enhancement
        this.logger.warn('Failed to store SSE metadata', {
            error: error.message,
            requestId,
        });
    }
  }

  async processBidRequest(
    bidRequestData: CreateBidRequestDto,
  ): Promise<ProcessBidRequestResponse> {
    const startTime = Date.now();

    try {
      await this.rtbHelper.validateInventoryAdSlotContext(
        bidRequestData.inventoryId,
        bidRequestData.adSlotContext
      );

      this.logger.debug('Processing bid request', {
        externalRequestId: bidRequestData.externalRequestId,
        inventoryId: bidRequestData.inventoryId,
      });

      // 1. Generate internal request ID and auction ID
      const requestId: string = uuidv4();
      const auctionId: string = uuidv4();

      // 2. Enrich bid request with additional context
      const enrichedRequest: EnrichedBidRequest = await this.enrichBidRequest(
        bidRequestData,
        requestId,
      );

      // 3. Store bid request in database
      const bidRequest: BidRequestWithAuction = await this.createBidRequest(
        enrichedRequest,
        auctionId,
      );

      // 4. Cache bid request in Redis for fast access
      await this.rtbCacheService.cacheBidRequest(bidRequest);

      // 5. Publish to Kafka for async auction processing
      await this.auctionProducer.publishBidRequestForProcessing(bidRequest);

      // 6. Record processing metrics
      const processingTime = Date.now() - startTime;
      await this.rtbCacheService.recordProcessingMetrics(
        requestId,
        processingTime,
      );

      this.logger.debug('Bid request processed successfully', {
        requestId,
        auctionId,
        processingTime: `${processingTime}ms`,
      });

      return {
        requestId: bidRequest.id,
        auctionId,
        status: 'processing',
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('Bid request processing failed', {
        error: errorMessage,
        externalRequestId: bidRequestData.externalRequestId,
        processingTime: `${processingTime}ms`,
      });

      // Record error metrics
      await this.rtbCacheService.recordErrorMetrics(
        bidRequestData.externalRequestId,
        errorMessage,
      );

      throw error;
    }
  }

  private async enrichBidRequest(
    bidRequestData: CreateBidRequestDto,
    requestId: string,
  ): Promise<EnrichedBidRequest> {
    const serverContext: ServerContext = {
      processedAt: new Date().toISOString(),
      version: '1.0.0',
      requestId,
    };

    return {
      ...bidRequestData,
      id: requestId,
      requestTimestamp: new Date(),
      serverContext,
      sseEnabled: bidRequestData.enableSSE || false,
      responseMode: bidRequestData.responseMode || 'polling',
  };
  }

  private async createBidRequest(
    enrichedRequest: EnrichedBidRequest,
    auctionId: string,
  ): Promise<BidRequestWithAuction> {
    try {
      let bidRequest = await this.prisma.bidRequest.create({
        data: {
          externalRequestId: enrichedRequest.id,
          inventoryId: enrichedRequest.inventoryId,
          publisherId: enrichedRequest.publisherId,
          websiteId: enrichedRequest.websiteId,
          userContext: JSON.parse(JSON.stringify(enrichedRequest.userContext)),
          adSlotContext: JSON.parse(
            JSON.stringify(enrichedRequest.adSlotContext),
          ),
          floorPrice: enrichedRequest.floorPrice || 0,
          auctionType: enrichedRequest.auctionType || 'SECOND_PRICE',
          timeout: enrichedRequest.timeout || 200,
          requestTimestamp: enrichedRequest.requestTimestamp,
        },
      });

      this.logger.debug('Bid request stored in database', {
        requestId: bidRequest.id,
        auctionId,
      });
      return {
        ...bidRequest,
        floorPrice: bidRequest.floorPrice?.toNumber() || 0,
        auctionId,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('Failed to store bid request', {
        error: error,
        externalRequestId: enrichedRequest.externalRequestId,
      });

      throw error;
    }
  }
  /**
       * Publish SSE event when auction state changes
       * This will be called by Kafka consumers during processing
       */
  async publishSSEEvent(
    requestId: string,
    eventType: 'bid_update' | 'bid_complete' | 'error',
    data: any
  ): Promise<void> {
    try {
        const channelKey = SSE_REDIS_KEYS.EVENT_CHANNEL(requestId);
        const event = {
            type: eventType,
            requestId,
            timestamp: new Date().toISOString(),
            data,
        };

        // Publish to Redis pub/sub channel
        await this.redis.publish(channelKey, JSON.stringify(event));

        // Also store in event queue for replay capability
        const queueKey = SSE_REDIS_KEYS.EVENT_QUEUE(requestId);
        await this.redis.rpush(queueKey, JSON.stringify(event));
        await this.redis.expire(queueKey, 300); // 5 minutes TTL

        this.logger.debug('SSE event published', { requestId, eventType });
    } catch (error) {
        // Non-blocking - SSE failures shouldn't affect core RTB
        this.logger.error('Failed to publish SSE event', {
            error: error.message,
            requestId,
            eventType,
        });
    }
  }

  /**
  * Check if SSE is enabled for a request
  * Used by Kafka consumers to determine if they should publish SSE events
  */
  async isSSEEnabled(requestId: string): Promise<boolean> {
    try {
        const key = SSE_REDIS_KEYS.REQUEST_INFO(requestId);
        const data = await this.redis.get<string>(key);
        
        if (!data) {
            return false;
        }

        const metadata = JSON.parse(data);
        return metadata.sseEnabled === true;
    } catch (error) {
        this.logger.error('Failed to check SSE status', {
            error: error.message,
            requestId,
        });
        return false;
    }
  }
  async getBidResponse(requestId: string): Promise<BidResponseDto | null> {
    this.logger.debug('Getting bid response', { requestId });

    try {
      // 1. Check Redis cache first for fast response
      const cachedResponse = await this.rtbCacheService.getCachedBidResponse(requestId);
      if (cachedResponse) {
        this.logger.debug('Bid response cache hit', { requestId });
        return cachedResponse;
      }

      // 2. Get from database if not cached
      const bidResponse = await this.getBidResponseFromDatabase(requestId);
      if (!bidResponse) {
        this.logger.warn('Bid response not found', { requestId });
        return null;
      }

      // 3. Cache the response for future requests (if completed)
      if (bidResponse.status === 'completed') {
        await this.rtbCacheService.setCacheBidResponse(requestId, bidResponse);
      }

      return bidResponse;
    } catch (error) {
      this.logger.error('Failed to get bid response', {
        error: error.message,
        requestId,
      });
      throw error;
    }
  }

  private async getBidResponseFromDatabase(
    requestId: string,
  ): Promise<BidResponseDto | null> {
    try {
      // Get bid request first
      const bidRequest = await this.prisma.bidRequest.findFirst({
        where: {
          OR: [{ id: requestId }, { externalRequestId: requestId }],
        },
        include: {
          bidResponses: {
            include: {
              creative: true,
              campaign: true,
            },
          },
          auctionLog: true,
        },
      });

      if (!bidRequest) {
        return null;
      }

      // Check auction status
      if (!bidRequest.auctionLog) {
        return {
          requestId,
          status: 'processing',
          message: 'Auction in progress',
        };
      }

      // Check if auction completed with no bids
      if (bidRequest.auctionLog.status === 'NO_BIDS') {
        return {
          requestId,
          status: 'no_bids',
          message: 'No eligible campaigns found',
        };
      }

      // Find winning bid
      const winningBid = bidRequest.bidResponses.find(
        (bid) => bid.status === 'WON',
      );

      if (!winningBid) {
        return {
          requestId,
          status: 'no_bids',
          message: 'Auction completed with no winner',
        };
      }

      // Format winning bid response
      return {
        requestId,
        status: 'completed',
        winningBid: {
          price: Number(winningBid.finalPrice || winningBid.bidPrice),
          currency: winningBid.currency,
          campaignId: winningBid.campaignId,
          creativeId: winningBid.creativeId,
          adMarkup: winningBid.adMarkup || '',
          impressionUrls: winningBid.impressionUrls || [],
          clickUrls: winningBid.clickUrls || [],
          landingUrl: winningBid.creative?.landingUrl,
        },
        auctionData: {
          totalBids: bidRequest.auctionLog.totalBids,
          validBids: bidRequest.auctionLog.validBids,
          auctionDuration: `${bidRequest.auctionLog.auctionDuration || 0}ms`,
          timestamp:
            bidRequest.auctionLog.completedAt?.toISOString() ||
            new Date().toISOString(),
          floorPrice: Number(bidRequest.floorPrice) || undefined,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get bid response from database', {
        error: error.message,
        requestId,
      });
      throw error;
    }
  }
}
