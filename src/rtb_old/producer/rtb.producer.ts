import { Injectable, Logger } from '@nestjs/common';
import { kafkaTopics } from 'src/kafka/constants/kafka.config';
import { KafkaService } from 'src/kafka/kafka.service';
@Injectable()
export default class RTBProducer {
  private readonly logger: Logger = new Logger(RTBProducer.name);
  constructor(private readonly kafka: KafkaService) {}

  public async publishAuctionResult(
    auctionResult: any,
    bidRequest: any,
  ): Promise<void> {
    try {
      let auctionId1 = auctionResult.auctionId || 'bc';
      let auctionId2 = bidRequest.auctionId || 'bc';
      // this.logger.debug('Auction ID 1, 2', { auctionId1, auctionId2 });
      // this.logger.debug('Publishing auction result', {
      //   auctionId: auctionResult.auctionId || bidRequest.auctionId,
      //   result: auctionResult,
      // });
      await this.kafka.publish(kafkaTopics.AUCTION_RESULTS, {
        key: bidRequest.auctionId,
        value: {
          ...auctionResult,
          auctionId: bidRequest.auctionId,
          originalBidRequest: bidRequest,
          auctionStatus: auctionResult.auctionStatus,
          processedAt: new Date().toISOString(),
        },
      });
      // this.logger.debug('AUction result topic ki mkb', {
      //   topic: kafkaTopics.AUCTION_RESULTS,
      //   bidRequest,
      //   newBidKaBhosda: bidRequest.bidRequest,
      // });
      this.logger.debug('Auction result published', {
        auctionId: bidRequest.auctionId,
      });
    } catch (error) {
      this.logger.error('Failed to publish auction result', {
        error: error,
        auctionId: bidRequest.auctionId,
      });
      throw error;
    }
  }

  public async publishToAnalyticsPipeline(auctionData: any): Promise<void> {
    try {
      await this.kafka.publish(kafkaTopics.HOURLY_AGGREGATION, {
        key: auctionData.auctionId,
        value: {
          type: 'auction_completed',
          data: auctionData,
          timestamp: new Date().toISOString(),
        },
      });

      this.logger.debug('Published to analytics pipeline', {
        auctionId: auctionData.auctionId,
      });
    } catch (error) {
      this.logger.warn('Failed to publish to analytics pipeline', {
        error: error.message,
        auctionId: auctionData.auctionId,
      });
    }
  }

  public async sendBudgetWarning(
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

  public async publishBidRequestForProcessing(bidRequest: any): Promise<void> {
    try {
      await this.kafka.publish(kafkaTopics.AUCTION_PROCESSING, {
        // changed topic to AUCTION_PROCESSING
        key: bidRequest.id,
        value: {
          bidRequest,
          publishedAt: new Date().toISOString(),
          priority: this.calculateProcessingPriority(bidRequest),
        },
      });

      this.logger.debug('Bid request published to Kafka', {
        requestId: bidRequest.id,
        topic: kafkaTopics.BID_REQUESTS,
      });
    } catch (error) {
      // Non-blocking error - auction can still proceed
      this.logger.error('Failed to publish bid request to Kafka', {
        error: error.message,
        requestId: bidRequest.id,
      });

      // Could implement fallback processing here
    }
  }

  private calculateProcessingPriority(
    bidRequest: any,
  ): 'high' | 'normal' | 'low' {
    // High priority for premium inventory or high floor prices
    if (bidRequest.floorPrice && bidRequest.floorPrice > 5.0) {
      return 'high';
    }

    // High priority for above-the-fold inventory
    if (bidRequest.adSlotContext?.position === 'above_fold') {
      return 'high';
    }

    return 'normal';
  }

  public async publishAuctionCompletion(auctionResult: any): Promise<void> {
    try {
      // Extract bidRequest from auctionResult
      const bidRequest = auctionResult.originalBidRequest || {};

      this.logger.debug('Publishing Auction Completion');

      // Prepare auction completion data
      const auctionCompletionData = {
        auctionId: bidRequest.auctionId,
        requestId: bidRequest.id || bidRequest.externalRequestId,
        inventoryId: bidRequest.inventoryId,
        bidRequest,
        campaignIds: auctionResult.winner
          ? [auctionResult.winner.campaignId]
          : [],
        winner: auctionResult.winner,
        totalBids: auctionResult.totalBids || 1,
        validBids: auctionResult.validBids || 1,
        processingTime: auctionResult.processingTime || 0,
        auctionType: auctionResult.auctionType || 'SECOND_PRICE',
        floorPrice: auctionResult.floorPrice,
        finalPrice: auctionResult.winner?.finalPrice,
        timestamp: new Date().toISOString(),
        auctionStatus: auctionResult.auctionStatus || 'COMPLETED',
      };

      this.logger.debug('Publishing auction completion', {
        auctionCompletionData,
      });

      await this.kafka.publish(kafkaTopics.AUCTION_COMPLETION, {
        key: bidRequest.auctionId,
        value: auctionCompletionData,
      });

      this.logger.debug('Auction completion published', {
        auctionId: bidRequest.auctionId,
        hasWinner: !!auctionResult.winner,
      });
    } catch (error) {
      this.logger.error('Failed to publish auction completion', {
        error: error.message,
        auctionId: auctionResult.auctionId,
      });
      // Don't throw - this shouldn't break the main flow
    }
  }
}
