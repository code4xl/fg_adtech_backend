import { Injectable, Logger } from '@nestjs/common';
import { BidRequestWithAuction } from '../types/bid-request.types';
import { AuctionService } from '../services/auction.service';
import { RedisService } from 'src/redis/redis.service';
import { METRICS_KEYS, RTB_CACHE_TTL, RTB_KEYS } from '../constants/cache-keys';
import { CampaignWithTargeting } from '../types/campaign.types';
import AuctionProducer from '../producers/auction.producer';
import {
  AuctionBidResult,
  ErrorAuctionResult,
  HandleNoBidsResult,
  ProcessedAuctionResult,
} from '../types/auction-result.types';
import { CreatedBidResponse } from '../types/bid-response.types';

@Injectable()
export class BidRequestProcessor {
  private readonly logger = new Logger(BidRequestProcessor.name);

  constructor(
    private readonly auctionService: AuctionService,
    private readonly redis: RedisService,
    private readonly auctionProducer: AuctionProducer,
  ) {}

  async processBidRequest(
    bidRequest: BidRequestWithAuction,
  ): Promise<ProcessedAuctionResult> {
    const startTime = Date.now();

    this.logger.debug('Starting bid request processing', {
      auctionId: bidRequest.auctionId,
      requestId: bidRequest.id,
      inventoryId: bidRequest.inventoryId,
    });

    try {
      // 1. Set processing lock to prevent duplicate processing
      // if two time request comes for same request id
      const lockAcquired = await this.setProcessingLock(bidRequest.id);
      if (!lockAcquired) {
        throw new Error('Request already being processed');
      }

      // 2. Find eligible campaigns with caching optimization
      const eligibleCampaigns: CampaignWithTargeting[] =
        await this.findEligibleCampaigns(bidRequest);

      this.logger.debug('Found eligible campaigns', {
        auctionId: bidRequest.auctionId,
        campaignCount: eligibleCampaigns.length,
      });

      if (eligibleCampaigns.length === 0) {
        return await this.handleNoBidsAuction(
          bidRequest.auctionId,
          bidRequest,
          startTime,
        );
      }

      // 3. Generate bid responses for all eligible campaigns
      const bidResponses = await this.auctionService.generateBidResponses(
        bidRequest,
        eligibleCampaigns,
        bidRequest.auctionId,
      );

      this.logger.debug('Generated bid responses', {
        auctionId: bidRequest.auctionId,
        totalCampaigns: eligibleCampaigns.length,
        validBids: bidResponses.length,
      });

      if (bidResponses.length === 0) {
        return await this.handleNoBidsAuction(
          bidRequest.auctionId,
          bidRequest,
          startTime,
        );
      }

      // 4. Execute auction algorithm to determine winner
      const auctionResult = await this.executeAuction(bidResponses, bidRequest);

      this.logger.debug(
        'Auction executed',
        //     {
        //     auctionResult,
        // }
      );

      // 5. Update performance metrics and counters
      await this.updateMetrics(bidRequest, auctionResult, startTime);

      // 6. Publish results for response generation
      await this.auctionProducer.publishAuctionResult(
        auctionResult,
        bidRequest,
      );

      const processingTime = Date.now() - startTime;

      this.logger.log('✅ Bid request processed successfully', {
        auctionId: bidRequest.auctionId,
        winnerId: auctionResult.winner?.id,
        finalPrice: auctionResult.finalPrice,
        totalBids: bidResponses.length,
        res: auctionResult,
        processingTime: `${processingTime}ms`,
      });

      return {
        auctionId: bidRequest.auctionId,
        winner: auctionResult.winner,
        totalBids: bidResponses.length,
        validBids: bidResponses.length,
        processingTime,
        auctionType: bidRequest.auctionType || 'SECOND_PRICE',
        floorPrice: bidRequest.floorPrice,
        auctionStatus: auctionResult.auctionStatus || 'COMPLETED',
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('❌ Bid request processing failed', {
        auctionId: bidRequest.auctionId,
        error: error.message,
        processingTime: `${processingTime}ms`,
      });

      // Handle processing error appropriately
      await this.handleProcessingError(
        bidRequest,
        bidRequest.auctionId,
        error,
        startTime,
      );

      throw error;
    } finally {
      // Always clear processing lock
      await this.clearProcessingLock(bidRequest.id);
    }
  }

  private async setProcessingLock(requestId: string): Promise<boolean> {
    try {
      const lockKey = RTB_KEYS.BID_REQUEST_LOCK(requestId);
      const lockValue = `${Date.now()}_${Math.random()}`;

      // Use Redis SET with NX (only if not exists) and EX (expiration)
      await this.redis.set(lockKey, lockValue, RTB_CACHE_TTL.BID_REQUEST_LOCK);

      const res = await this.redis.get(lockKey);

      if (res) {
        this.logger.debug('Processing lock acquired', { requestId });
        return true;
      } else {
        this.logger.warn('Processing lock already exists', { requestId });
        return false;
      }
    } catch (error) {
      this.logger.error('Failed to set processing lock', {
        error: error.message,
        requestId,
      });
      return false;
    }
  }

  private async clearProcessingLock(requestId: string): Promise<void> {
    try {
      const lockKey = RTB_KEYS.BID_REQUEST_LOCK(requestId);
      await this.redis.del(lockKey);

      //   this.logger.debug('Processing lock cleared', { requestId });
    } catch (error) {
      this.logger.warn('Failed to clear processing lock', {
        error: error.message,
        requestId,
      });
    }
  }

  private async findEligibleCampaigns(
    bidRequest: BidRequestWithAuction,
  ): Promise<CampaignWithTargeting[]> {
    return await this.auctionService.findEligibleCampaigns(bidRequest);
  }

  private async executeAuction(
    bidResponses: CreatedBidResponse[],
    bidRequest: BidRequestWithAuction,
  ): Promise<AuctionBidResult> {
    return await this.auctionService.runAuction(bidResponses, bidRequest);
  }

  private async handleNoBidsAuction(
    auctionId: string,
    bidRequest: BidRequestWithAuction,
    startTime: number,
  ): Promise<HandleNoBidsResult> {
    const processingTime = Date.now() - startTime;

    this.logger.log('Auction completed with no bids', {
      auctionId,
      requestId: bidRequest.id,
      processingTime: `${processingTime}ms`,
    });

    // Publish no-bids result with proper typing
    const noBidsResult: HandleNoBidsResult = {
      auctionId,
      winner: null,
      totalBids: 0,
      validBids: 0,
      processingTime,
      auctionType: bidRequest.auctionType || 'SECOND_PRICE',
      auctionStatus: 'NO_BIDS',
      originalBidRequest: bidRequest,
      processedAt: new Date().toISOString(),
    };

    // Publish no-bids result
    await this.auctionProducer.publishAuctionResult(noBidsResult, bidRequest);

    return noBidsResult;
  }

  private async updateMetrics(
    bidRequest: BidRequestWithAuction,
    auctionResult: AuctionBidResult,
    startTime: number,
  ): Promise<void> {
    try {
      const processingTime = Date.now() - startTime;

      // Update Redis counters for real-time metrics
      const hour = new Date().getHours();
      const dateHour = `${new Date().toISOString().split('T')[0]}_${hour}`;

      await Promise.all([
        // Auction count metrics
        this.redis.incr(METRICS_KEYS.HOURLY_TOTAL_AUCTION_METRICS(hour)),
        this.redis.incr(
          METRICS_KEYS.HOURLY_AUCTION_WINNER_METRICS(
            auctionResult.winner ? true : false,
            hour,
          ),
        ),

        // Performance metrics
        this.redis.incrby(
          METRICS_KEYS.HOURLY_PROCESSING_TIME_METRICS(hour),
          processingTime,
        ),

        // Inventory metrics
        this.redis.incr(
          METRICS_KEYS.HOURLY_INVENTORY_REQUEST_METRICS(
            bidRequest.inventoryId,
            hour,
          ),
        ),

        // Set expiration for metrics (keep for 7 days)
        this.redis.expire(
          METRICS_KEYS.HOURLY_TOTAL_AUCTION_METRICS(hour),
          RTB_CACHE_TTL.HOURLY_TOTAL_AUCTION_METRICS,
        ),
        this.redis.expire(
          METRICS_KEYS.HOURLY_PROCESSING_TIME_METRICS(hour),
          RTB_CACHE_TTL.HOURLY_PROCESSING_TIME_METRICS,
        ),
      ]);

      this.logger.debug('Metrics updated', {
        auctionId: bidRequest.auctionId || 'unknown',
        processingTime,
        hasWinner: !!auctionResult.winner,
      });
    } catch (error) {
      this.logger.warn('Failed to update metrics', {
        error: error.message,
      });
    }
  }

  private async handleProcessingError(
    bidRequest: BidRequestWithAuction,
    auctionId: string,
    error: Error,
    startTime: number,
  ): Promise<void> {
    const processingTime = Date.now() - startTime;

    // Publish error result for tracking
    try {
      this.logger.error('Processing error in publushing auction result', {
        bidRequest,
      });

      this.logger.error('Processing error', {
        auctionId,
        error: error.message,
        processingTime: `${processingTime}ms`,
      });

      // Publish no-bids result with proper typing
      const errorBidResult: ErrorAuctionResult = {
        auctionId,
        auctionStatus: 'ERROR',
        winner: null,
        totalBids: 0,
        validBids: 0,
        errorMessage: error.message,
        processingTime,
        auctionType: bidRequest.auctionType || 'SECOND_PRICE',
        originalBidRequest: bidRequest,
        processedAt: new Date().toISOString(),
      };

      await this.auctionProducer.publishAuctionResult(
        errorBidResult,
        bidRequest,
      );
    } catch (publishError) {
      this.logger.error('Failed to publish error result', {
        error: publishError.message,
        originalError: error.message,
        auctionId,
      });
    }

    // Update error metrics
    try {
      const hour = new Date().getHours();
      const dateHour = `${new Date().toISOString().split('T')[0]}_${hour}`;
      await this.redis.incr(`metrics:auctions:error:${dateHour}`);
    } catch (metricsError) {
      this.logger.warn('Failed to update error metrics', {
        error: metricsError.message,
      });
    }
  }
}
