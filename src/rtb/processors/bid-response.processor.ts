import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { RTBRedisService } from '../../redis/services/rtb-redis.service';
import { KafkaService } from '../../kafka/kafka.service';
import { ConfigService } from '@nestjs/config';
import { REDIS_KEYS } from '../../redis/constants/redis-keys';
import { kafkaTopics } from '../../kafka/constants/kafka.config';
import { AuctionService } from '../services/auction.service';

@Injectable()
export class BidResponseProcessor {
  private readonly logger = new Logger(BidResponseProcessor.name);
  private readonly trackingBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rtbRedis: RTBRedisService,
    private readonly kafka: KafkaService,
    private readonly config: ConfigService,
    private readonly auctionService: AuctionService,
  ) {
    this.trackingBaseUrl =
      this.config.get<string>('APP_URL') || 'https://track.oceanadtech.com';
    this.logger.log('Bid Response Processor initialized - Phase 4');
  }

  async generateBidResponses(auctionResult: any): Promise<any[]> {
    // Extract auction metadata with fallback handling


    this.logger.debug(
      'Generating bid responses mitt' +
      JSON.stringify({
        auctionResult: auctionResult,
        auctionId: auctionResult.auctionId,
        hasWinner: !!auctionResult.winner,
        // status: auctionResult.auctionStatus,
      }),
    );

    try {
      // Handle different auction outcomes
      switch (auctionResult.auctionStatus) {
        case 'NO_BIDS':
          return await this.generateNoBidsResponse(auctionResult);

        case 'ERROR':
          return await this.generateErrorResponse(auctionResult);

        default:
          return await this.generateCompletedAuctionResponses(auctionResult);
      }
    } catch (error) {
      this.logger.error('Failed to generate bid responses', {
        error: error,
        auctionId: auctionResult.auctionId,
      });
      throw error;
    }
  }

  async storeBidResponses(bidResponses: any[]): Promise<void> {
    try {
      if (bidResponses.length === 0) {
        this.logger.debug('No bid responses to store');
        return;
      }

      // Store each response by its request ID
      const storePromises = bidResponses.map(async (response) => {
        const cacheKey = REDIS_KEYS.AUCTION_RESULT(response.requestId);
        const ttl = 3600; // 1 hour TTL

        await this.redis.set(cacheKey, JSON.stringify(response), ttl);

        this.logger.debug('Bid response cached', {
          requestId: response.requestId,
          status: response.status,
        });
      });

      await Promise.all(storePromises);

      this.logger.log('✅ Bid responses stored in cache', {
        count: bidResponses.length,
      });
    } catch (error) {
      this.logger.error('Failed to store bid responses', {
        error: error.message,
        responseCount: bidResponses.length,
      });
      throw error;
    }
  }

  async sendWinNotifications(auctionResult: any): Promise<void> {
    if (!auctionResult.winner) {
      this.logger.debug('No winner to notify', {
        auctionId: auctionResult.auctionId,
      });
      return;
    }

    try {
      const winNotification = await this.generateWinNotification(auctionResult);

      // Send notification asynchronously via Kafka
      await this.kafka.publish('win-notifications', {
        key: auctionResult.winner.id,
        value: winNotification,
      });

      // Update bid response with notification sent flag
      await this.updateBidResponseNotificationStatus(
        auctionResult.winner.id,
        true,
      );

      this.logger.log('✅ Win notification sent', {
        auctionId: auctionResult.auctionId,
        winnerId: auctionResult.winner.id,
        finalPrice: auctionResult.finalPrice,
      });
    } catch (error) {
      this.logger.error('Failed to send win notification', {
        error: error.message,
        auctionId: auctionResult.auctionId,
        winnerId: auctionResult.winner?.id,
      });
      // Don't throw - notification failure shouldn't block auction
    }
  }

  // ==========================================
  // RESPONSE GENERATION METHODS
  // ==========================================

  /**
   * Generate responses for completed auctions
   */
  private async generateCompletedAuctionResponses(
    auctionResult: any,
  ): Promise<any[]> {
    const responses = [];

    if (auctionResult.winner) {
      // Generate winning bid response
      const winningResponse =
        await this.generateWinningBidResponse(auctionResult);
      responses.push(winningResponse);

      // Update campaign spend atomically
      await this.updateCampaignSpend(
        auctionResult.winner.campaignId,
        auctionResult.finalPrice,
      );
    }

    // Generate responses for losing bids (if any)
    if (auctionResult.losingBids && auctionResult.losingBids.length > 0) {
      const losingResponses =
        await this.generateLosingBidResponses(auctionResult);
      responses.push(...losingResponses);
    }

    return responses;
  }

  private async generateWinningBidResponse(auctionResult: any): Promise<any> {
    const winner = auctionResult.winner;
    const creative = winner.creative;
    this.logger.debug('Generating winning bid response', {
      auctionId: auctionResult.auctionId,
      winnerId: winner.id,
      finalPrice: auctionResult.finalPrice,
      creativeId: creative.id,
    });
    // Use auction service for tracking URLs
    const trackingUrls = this.auctionService.generateTrackingUrls(
      auctionResult.auctionId,
      winner.id,
    );

    // Use auction service for ad markup
    const adMarkup = this.auctionService.generateAdMarkup(
      creative,
      trackingUrls,
      {
        width: auctionResult.originalRequest.adSlotContext.width,
        height: auctionResult.originalRequest.adSlotContext.height,
        format: auctionResult.originalRequest.adSlotContext.format,
      },
    );

    return {
      requestId: auctionResult.originalRequest.externalRequestId,
      status: 'COMPLETED',
      winningBid: {
        price: auctionResult.finalPrice,
        currency: winner.currency || 'INR',
        campaignId: winner.campaignId,
        creativeId: winner.creativeId,
        adMarkup,
        impressionUrls: trackingUrls.impression,
        clickUrls: trackingUrls.click,
        landingUrl: creative.landingUrl,
      },
      auctionData: {
        totalBids: auctionResult.totalBids || 1,
        validBids: auctionResult.validBids || 1,
        auctionDuration: `${auctionResult.processingTime || 0}ms`,
        timestamp: new Date().toISOString(),
        floorPrice: auctionResult.originalRequest.floorPrice,
      },
    };
  }

  /**
   * Generate responses for losing bids
   */
  private async generateLosingBidResponses(auctionResult: any): Promise<any[]> {
    return auctionResult.losingBids.map((losingBid) => ({
      requestId: auctionResult.originalRequest.externalRequestId,
      status: 'lost',
      bidId: losingBid.id,
      bidPrice: losingBid.bidPrice,
      message: 'Bid did not win auction',
    }));
  }

  /**
   * Generate no-bids response
   */
  private async generateNoBidsResponse(auctionResult: any): Promise<any[]> {
    return [
      {
        requestId:
          auctionResult.originalRequest?.externalRequestId || 'unknown',
        status: 'no_bids',
        message: auctionResult.message || 'No eligible campaigns found',
        auctionData: {
          totalBids: 0,
          validBids: 0,
          auctionDuration: `${auctionResult.processingTime || 0}ms`,
          timestamp: new Date().toISOString(),
        },
      },
    ];
  }

  /**
   * Generate error response
   */
  private async generateErrorResponse(auctionResult: any): Promise<any[]> {
    return [
      {
        requestId:
          auctionResult.originalRequest?.externalRequestId || 'unknown',
        status: 'error',
        errorMessage: auctionResult.error || 'Auction processing failed',
        auctionData: {
          totalBids: 0,
          validBids: 0,
          auctionDuration: `${auctionResult.processingTime || 0}ms`,
          timestamp: new Date().toISOString(),
        },
      },
    ];
  }

  // ==========================================
  // WIN NOTIFICATION METHODS
  // ==========================================

  /**
   * Generate win notification payload
   */
  private async generateWinNotification(auctionResult: any): Promise<any> {
    return {
      bidId: auctionResult.winner.id,
      auctionId: auctionResult.auctionId,
      campaignId: auctionResult.winner.campaignId,
      creativeId: auctionResult.winner.creativeId,
      advertiserId: auctionResult.winner.advertiserId,
      winPrice: auctionResult.finalPrice,
      currency: auctionResult.winner.currency || 'INR',
      timestamp: new Date().toISOString(),
      adMarkup: auctionResult.adMarkup || '',
      impressionUrls: auctionResult.trackingUrls?.impression || [],
      clickUrls: auctionResult.trackingUrls?.click || [],
    };
  }

  /**
   * Update bid response notification status
   */
  private async updateBidResponseNotificationStatus(
    bidResponseId: string,
    notificationSent: boolean,
  ): Promise<void> {
    try {
      // This would update the database record
      // await this.prisma.bidResponse.update({
      //     where: { id: bidResponseId },
      //     data: { winNotificationSent: notificationSent }
      // });

      this.logger.debug('Bid response notification status updated', {
        bidResponseId,
        notificationSent,
      });
    } catch (error) {
      this.logger.warn('Failed to update notification status', {
        error: error.message,
        bidResponseId,
      });
    }
  }

  private async updateCampaignSpend(
    campaignId: string,
    amount: number,
  ): Promise<void> {
    try {
      const spendResult = await this.rtbRedis.incrementCampaignSpend(
        campaignId,
        amount,
      );

      if (spendResult.success) {
        this.logger.debug('Campaign spend updated', {
          campaignId,
          amount,
          newTotal: spendResult.newTotal,
          remainingBudget: spendResult.remainingBudget,
        });

        // Check if budget is nearly exhausted
        if (spendResult.remainingBudget < amount * 10) {
          await this.sendBudgetWarning(campaignId, spendResult.remainingBudget);
        }
      } else {
        this.logger.warn('Campaign spend update failed - budget exhausted', {
          campaignId,
          requestedAmount: amount,
          remainingBudget: spendResult.remainingBudget,
        });
      }
    } catch (error) {
      this.logger.error('Failed to update campaign spend', {
        error: error.message,
        campaignId,
        amount,
      });
    }
  }

  /**
   * Send budget warning notification
   */
  private async sendBudgetWarning(
    campaignId: string,
    remainingBudget: number,
  ): Promise<void> {
    try {
      await this.kafka.publish(kafkaTopics.CAMPAIGN_BUDGET_ALERTS, {
        key: campaignId,
        value: {
          campaignId,
          alertType: 'budget_warning',
          remainingBudget,
          threshold: 0.1, // 10% remaining
          timestamp: new Date().toISOString(),
        },
      });

      this.logger.log('Budget warning sent', {
        campaignId,
        remainingBudget,
      });
    } catch (error) {
      this.logger.warn('Failed to send budget warning', {
        error: error.message,
        campaignId,
      });
    }
  }
}
