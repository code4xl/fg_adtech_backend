import { Injectable, Logger } from '@nestjs/common';
import { AuctionService } from '../services/auction.service';
import { KafkaService } from '../../kafka/kafka.service';
import { RedisService } from '../../redis/redis.service';
import { RTBRedisService } from '../../redis/services/rtb-redis.service';
import { kafkaTopics } from '../../kafka/constants/kafka.config';
import { REDIS_KEYS } from '../../redis/constants/redis-keys';
import { RTB_REDIS_KEYS } from 'src/redis/constants/rtb-keys';

@Injectable()
export class BidRequestProcessor {
  private readonly logger = new Logger(BidRequestProcessor.name);

  constructor(
    private readonly auctionService: AuctionService,
    private readonly kafka: KafkaService,
    private readonly redis: RedisService,
    private readonly rtbRedis: RTBRedisService,
  ) {
    this.logger.log('Bid Request Processor initialized - Phase 4');
  }

  async processBidRequest(bidRequest: any): Promise<{
    auctionId: string;
    winner: any | null;
    totalBids: number;
    validBids: number;
    processingTime: number;
    auctionType: string;
    floorPrice?: number;
    auctionStatus: string;
  }> {
    const startTime = Date.now();
    // const auctionId = this.generateAuctionId(bidRequest.id);

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
      const eligibleCampaigns = await this.findEligibleCampaigns(bidRequest);

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
      this.logger.debug('Auction executed', {
        auctionResult,
      });
      // 5. Update performance metrics and counters
      await this.updateMetrics(bidRequest, auctionResult, startTime);

      // 6. Publish results for response generation
      await this.publishAuctionResult(auctionResult, bidRequest.auctionId);

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
        auctionStatus: auctionResult.status || 'COMPLETED',
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

  // ==========================================
  // AUCTION PROCESSING STEPS
  // ==========================================

  private async setProcessingLock(requestId: string): Promise<boolean> {
    try {
      const lockKey = RTB_REDIS_KEYS.BID_REQUEST_LOCK(requestId);
      const lockValue = `${Date.now()}_${Math.random()}`;
      const lockTTL = 30; // 30 seconds TTL

      // Use Redis SET with NX (only if not exists) and EX (expiration)
      await this.redis.set(lockKey, lockValue, lockTTL);

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

  /**
   * Clear processing lock after completion
   */
  private async clearProcessingLock(requestId: string): Promise<void> {
    try {
      const lockKey = RTB_REDIS_KEYS.BID_REQUEST_LOCK(requestId);
      await this.redis.del(lockKey);

      this.logger.debug('Processing lock cleared', { requestId });
    } catch (error) {
      this.logger.warn('Failed to clear processing lock', {
        error: error.message,
        requestId,
      });
    }
  }

  private async findEligibleCampaigns(bidRequest: any): Promise<any[]> {
    return await this.auctionService.findEligibleCampaigns(bidRequest);
  }

  private async executeAuction(
    bidResponses: any[],
    bidRequest: any,
  ): Promise<any> {
    return await this.auctionService.runAuction(bidResponses, bidRequest);
  }

  // ==========================================
  // SUPPORT METHODS
  // ==========================================

  /**
   * Calculate bid price for campaign and context
   */
  private async calculateBidPrice(
    campaign: any,
    bidRequest: any,
  ): Promise<number> {
    try {
      // This would integrate with your BidEvaluationService
      // For now, using simplified calculation
      const baseBid = Number(campaign.bidAmount || 1.0);

      // Apply basic adjustments
      let adjustedBid = baseBid;

      // Device type adjustment
      if (bidRequest.userContext.deviceType === 'mobile') {
        adjustedBid *= 1.2; // 20% premium for mobile
      }

      // Geographic adjustment
      if (bidRequest.userContext.country === 'US') {
        adjustedBid *= 1.5; // 50% premium for US traffic
      }

      // Time-based adjustment
      const hour = new Date().getHours();
      if (hour >= 18 && hour <= 22) {
        adjustedBid *= 1.1; // 10% premium for prime time
      }

      return Math.round(adjustedBid * 100) / 100; // Round to 2 decimals
    } catch (error) {
      this.logger.warn('Bid calculation failed, using base bid', {
        error: error.message,
        campaignId: campaign.id,
      });
      return Number(campaign.bidAmount || 1.0);
    }
  }

  /**
   * Select appropriate creative for campaign and ad slot
   *
   * **Why creative selection matters:**
   * - Creative must match ad slot dimensions exactly
   * - Only approved creatives can be served
   * - Creative performance affects bid optimization
   */
  private async selectCreative(
    campaign: any,
    adSlotContext: any,
  ): Promise<any> {
    try {
      // Find creative that matches requirements
      const matchingCreative = campaign.creatives?.find(
        (creative) =>
          creative.status === 'APPROVED' &&
          creative.adSlotTemplate.width === adSlotContext.width &&
          creative.adSlotTemplate.height === adSlotContext.height &&
          creative.adSlotTemplate.format === adSlotContext.format,
      );

      if (matchingCreative) {
        this.logger.debug('Creative selected', {
          campaignId: campaign.id,
          creativeId: matchingCreative.id,
          dimensions: `${adSlotContext.width}x${adSlotContext.height}`,
        });
      }

      return matchingCreative || null;
    } catch (error) {
      this.logger.warn('Creative selection failed', {
        error: error.message,
        campaignId: campaign.id,
      });
      return null;
    }
  }

  private createBidResponse(
    bidRequest: any,
    campaign: any,
    creative: any,
    bidPrice: number,
    auctionId: string,
  ): any {
    return {
      id: this.generateBidResponseId(),
      campaignId: campaign.id,
      creativeId: creative.id,
      advertiserId: campaign.advertiserId,
      bidPrice,
      currency: 'INR',
      auctionId,
      bidRequest: {
        id: bidRequest.id,
        inventoryId: bidRequest.inventoryId,
      },
      creative: {
        id: creative.id,
        name: creative.name,
        fileUrl: creative.fileUrl,
        landingUrl: creative.landingUrl,
        adSlotTemplate: creative.adSlotTemplate,
      },
      campaign: {
        id: campaign.id,
        name: campaign.name,
        bidStrategy: campaign.bidStrategy,
      },
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Handle auction with no valid bids
   */
  private async handleNoBidsAuction(
    auctionId: string,
    bidRequest: any,
    startTime: number,
  ): Promise<any> {
    const processingTime = Date.now() - startTime;

    this.logger.log('Auction completed with no bids', {
      auctionId,
      requestId: bidRequest.id,
      processingTime: `${processingTime}ms`,
    });

    // Publish no-bids result
    await this.publishAuctionResult(
      {
        status: 'NO_BIDS',
        winner: null,
        totalBids: 0,
        message: 'No eligible campaigns found',
      },
      auctionId,
    );

    return {
      auctionId,
      winner: null,
      totalBids: 0,
      validBids: 0,
      processingTime,
      auctionType: bidRequest.auctionType || 'SECOND_PRICE',
    };
  }

  private async updateMetrics(
    bidRequest: any,
    auctionResult: any,
    startTime: number,
  ): Promise<void> {
    try {
      const processingTime = Date.now() - startTime;

      // Update Redis counters for real-time metrics
      const hour = new Date().getHours();
      const dateHour = `${new Date().toISOString().split('T')[0]}_${hour}`;

      await Promise.all([
        // Auction count metrics
        this.redis.incr(`metrics:auctions:total:${dateHour}`),
        this.redis.incr(
          `metrics:auctions:${auctionResult.winner ? 'filled' : 'unfilled'}:${dateHour}`,
        ),

        // Performance metrics
        this.redis.incrby(
          `metrics:processing_time:${dateHour}`,
          processingTime,
        ),

        // Inventory metrics
        this.redis.incr(
          `metrics:inventory:${bidRequest.inventoryId}:requests:${dateHour}`,
        ),

        // Set expiration for metrics (keep for 7 days)
        this.redis.expire(`metrics:auctions:total:${dateHour}`, 7 * 24 * 3600),
        this.redis.expire(`metrics:processing_time:${dateHour}`, 7 * 24 * 3600),
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

  /**
   * Publish auction result to results topic
   */
  private async publishAuctionResult(
    auctionResult: any,
    auctionId: string,
  ): Promise<void> {
    try {
      this.logger.debug('aaa Publishing auction result', {
        auctionId,
      });
      await this.kafka.publish(kafkaTopics.AUCTION_RESULTS, {
        key: auctionId,
        value: {
          ...auctionResult,
          auctionId,
          publishedAt: new Date().toISOString(),
        },
      });

      this.logger.debug('Auction result published', { auctionId });
    } catch (error) {
      this.logger.error('Failed to publish auction result', {
        error: error.message,
        auctionId,
      });
      throw error;
    }
  }

  /**
   * Handle processing errors with appropriate logging and cleanup
   */
  private async handleProcessingError(
    bidRequest: any,
    auctionId: string,
    error: Error,
    startTime: number,
  ): Promise<void> {
    const processingTime = Date.now() - startTime;

    // Publish error result for tracking
    try {
      await this.publishAuctionResult(
        {
          status: 'ERROR',
          winner: null,
          totalBids: 0,
          error: error.message,
          processingTime,
        },
        auctionId,
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

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Generate unique auction ID
   */
  private generateAuctionId(requestId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `auction_${timestamp}_${random}_${requestId.substring(0, 8)}`;
  }

  /**
   * Generate unique bid response ID
   */
  private generateBidResponseId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `bid_${timestamp}_${random}`;
  }
}
