import { Injectable, Logger } from '@nestjs/common';

import { KafkaService } from 'src/kafka/kafka.service';
import { kafkaTopics } from '../constants/kafka-topics';
import { BidRequestWithAuction } from '../types/bid-request.types';
import { RtbHelper } from '../utils/helpers';
import { AuctionBidResult, ErrorAuctionResult, HandleNoBidsResult } from '../types/auction-result.types';
import { AuctionCompletionData, SuccessfulAuctionCompletionData, NoBidsAuctionCompletionData, ErrorAuctionCompletionData } from '../types/auction-completion.type';

@Injectable()
export default class AuctionProducer {
  private readonly logger: Logger = new Logger(AuctionProducer.name);
  constructor(
    private readonly kafka: KafkaService,
    private readonly rtbHelper: RtbHelper,
  ) { }

  public async publishAuctionResult(
    auctionResult: AuctionBidResult | HandleNoBidsResult | ErrorAuctionResult,
    bidRequest: BidRequestWithAuction,
  ): Promise<void> {
    try {
      this.logger.debug("Publishing Auction Result", {
        auctionResult,
        bidRequest,
      });

      await this.kafka.publish(kafkaTopics.AUCTION_RESULTS, {
        key: bidRequest.auctionId,
        value: {
          ...auctionResult,
          // auctionId: bidRequest.auctionId,
          // originalBidRequest: bidRequest,
          // auctionStatus: auctionResult.auctionStatus,
          processedAt: new Date().toISOString(),
        },
      });
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

  public async publishAuctionCompletion(
    auctionResult: AuctionBidResult | HandleNoBidsResult | ErrorAuctionResult
  ): Promise<void> {
    try {
      // Extract bidRequest from auctionResult
      const bidRequest = auctionResult.originalBidRequest;

      this.logger.debug('Publishing Auction Completion', {
        auctionId: auctionResult.auctionId,
        auctionStatus: auctionResult.auctionStatus
      });

      // Type-safe data preparation based on auction status
      let auctionCompletionData: AuctionCompletionData;

      switch (auctionResult.auctionStatus) {
        case 'COMPLETED':
          auctionCompletionData = this.prepareSuccessfulAuctionData(auctionResult);
          break;

        case 'NO_BIDS':
          auctionCompletionData = this.prepareNoBidsAuctionData(auctionResult);
          break;

        case 'ERROR':
          auctionCompletionData = this.prepareErrorAuctionData(auctionResult);
          break;

        default:
          throw new Error(`Unknown auction status: ${(auctionResult as any).auctionStatus}`);
      }

      this.logger.debug('Publishing auction completion', {
        auctionId: auctionResult.auctionId,
        auctionStatus: auctionResult.auctionStatus,
        hasWinner: !!auctionCompletionData.winner
      });

      await this.kafka.publish(kafkaTopics.AUCTION_COMPLETION, {
        key: bidRequest.auctionId || auctionResult.auctionId,
        value: auctionCompletionData,
      });

      this.logger.debug('Auction completion published successfully', {
        auctionId: auctionResult.auctionId,
        auctionStatus: auctionResult.auctionStatus,
        hasWinner: !!auctionCompletionData.winner,
      });
    } catch (error) {
      this.logger.error('Failed to publish auction completion', {
        error: error.message,
        auctionId: auctionResult.auctionId,
        auctionStatus: auctionResult.auctionStatus,
      });
      // Don't throw - this shouldn't break the main flow
    }
  }

  private prepareSuccessfulAuctionData(auctionResult: AuctionBidResult): SuccessfulAuctionCompletionData {
    let bidRequest = auctionResult.originalBidRequest;

    return {
      auctionId: bidRequest.auctionId || auctionResult.auctionId,
      requestId: bidRequest.id || bidRequest.externalRequestId,
      inventoryId: bidRequest.inventoryId,
      bidRequest,

      // Successful auction specific data
      campaignIds: auctionResult.winner ? [auctionResult.winner.campaignId] : [],
      winner: {
        id: auctionResult.winner?.id,
        campaignId: auctionResult.winner?.campaignId,
        creativeId: auctionResult.winner?.creativeId,
        bidPrice: auctionResult.winner?.bidPrice,
        finalPrice: auctionResult.finalPrice,
        currency: auctionResult.winner?.currency || 'INR',
        landingUrl: auctionResult.winner?.landingUrl,
      },

      // Auction metrics
      totalBids: auctionResult.totalBids || 1,
      validBids: auctionResult.validBids || 1,
      processingTime: auctionResult.processingTime || 0,
      auctionType: auctionResult.auctionType,

      // Pricing information (only available for successful auctions)
      floorPrice: auctionResult.floorPrice || 0,
      finalPrice: auctionResult.finalPrice,

      // Status and timestamp
      auctionStatus: 'COMPLETED',
      timestamp: new Date().toISOString(),

      // Additional metadata for successful auctions
      revenue: auctionResult.finalPrice,
      profit: auctionResult.finalPrice - (auctionResult.winner?.bidPrice || 0),
    };
  }

  private prepareNoBidsAuctionData(auctionResult: HandleNoBidsResult): NoBidsAuctionCompletionData {
    let bidRequest = auctionResult.originalBidRequest;

    return {
      auctionId: bidRequest.auctionId || auctionResult.auctionId,
      requestId: bidRequest.id || bidRequest.externalRequestId,
      inventoryId: bidRequest.inventoryId,
      bidRequest,

      // No bids specific data
      campaignIds: [], // No campaigns participated
      winner: null,

      // Auction metrics
      totalBids: auctionResult.totalBids || 0,
      validBids: auctionResult.validBids || 0,
      processingTime: auctionResult.processingTime || 0,
      auctionType: auctionResult.auctionType,

      // No pricing information for no bids
      floorPrice: bidRequest.floorPrice || 0,
      finalPrice: null,

      // Status and timestamp
      auctionStatus: 'NO_BIDS',
      timestamp: new Date().toISOString(),

      // Additional metadata for no bids scenarios
      revenue: 0,
      reason: 'No eligible campaigns found',
      inventoryQuality: this.rtbHelper.assessInventoryQuality(bidRequest),
    };
  }

  private prepareErrorAuctionData(auctionResult: ErrorAuctionResult): ErrorAuctionCompletionData {
    let bidRequest = auctionResult.originalBidRequest;

    return {
      auctionId: bidRequest.auctionId || auctionResult.auctionId,
      requestId: bidRequest.id || bidRequest.externalRequestId,
      inventoryId: bidRequest.inventoryId,
      bidRequest,

      // Error specific data
      campaignIds: [], // No campaigns could participate due to error
      winner: null,

      // Auction metrics (limited due to error)
      totalBids: auctionResult.totalBids || 0,
      validBids: auctionResult.validBids || 0,
      processingTime: auctionResult.processingTime || 0,
      auctionType: auctionResult.auctionType || 'SECOND_PRICE',

      // No pricing information for errors
      floorPrice: bidRequest.floorPrice || 0,
      finalPrice: null,

      // Status and timestamp
      auctionStatus: 'ERROR',
      timestamp: new Date().toISOString(),

      // Error specific metadata
      errorMessage: auctionResult.errorMessage.toString() || 'Auction processing failed',
      errorCode: auctionResult.errorCode || 'UNKNOWN_ERROR',
      errorType: "unknown", // Could be 'timeout', 'validation', etc.
      revenue: 0,
    };
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

  public async publishBidRequestForProcessing(
    bidRequest: BidRequestWithAuction,
  ): Promise<void> {
    try {
      await this.kafka.publish(kafkaTopics.AUCTION_PROCESSING, {
        key: bidRequest.id,
        value: {
          bidRequest,
          publishedAt: new Date().toISOString(),
          priority: this.rtbHelper.calculateProcessingPriority(bidRequest),
        },
      });

      this.logger.debug('Bid request published to Kafka', {
        requestId: bidRequest.id,
        topic: kafkaTopics.BID_REQUESTS,
      });
    } catch (error) {
      this.logger.error('Failed to publish bid request to Kafka', {
        error: error.message,
        requestId: bidRequest.id,
      });
    }
  }
}
