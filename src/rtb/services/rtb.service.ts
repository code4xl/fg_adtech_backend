import { Logger } from '@nestjs/common';
import { CreateBidRequestDto } from '../dto';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from 'src/prisma/prisma.service';
import { RtbCacheService } from '../cache/rtb-cache.service';
import AuctionProducer from '../producers/auction.producer';
import {
  BidRequestWithAuction,
  EnrichedBidRequest,
  ProcessBidRequestResponse,
  ServerContext,
} from '../types/bid-request.types';

// Define core types

export class RtbService {
  private readonly logger = new Logger(RtbService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rtbCacheService: RtbCacheService,
    private readonly auctionProducer: AuctionProducer,
  ) {}

  async processBidRequest(
    bidRequestData: CreateBidRequestDto,
  ): Promise<ProcessBidRequestResponse> {
    const startTime = Date.now();

    try {
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

      this.logger.log('Bid request processed successfully', {
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
    };
  }

  private async createBidRequest(
    enrichedRequest: EnrichedBidRequest,
    auctionId: string,
  ): Promise<BidRequestWithAuction> {
    try {
      let bidRequest = await this.prisma.bidRequest.create({
        data: {
          externalRequestId: enrichedRequest.externalRequestId,
          inventoryId: enrichedRequest.inventoryId,
          publisherId: enrichedRequest.publisherId,
          websiteId: enrichedRequest.websiteId,
          userContext: JSON.parse(JSON.stringify(enrichedRequest.userContext)),
          adSlotContext: JSON.parse(
            JSON.stringify(enrichedRequest.adSlotContext),
          ),
          floorPrice: enrichedRequest.floorPrice,
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
        floorPrice: bidRequest.floorPrice.toNumber(),
        auctionId,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('Failed to store bid request', {
        error: errorMessage,
        externalRequestId: enrichedRequest.externalRequestId,
      });

      throw error;
    }
  }
}
