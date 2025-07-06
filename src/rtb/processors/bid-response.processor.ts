import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RedisService } from 'src/redis/redis.service';
import { AuctionService } from '../services/auction.service';

import {
  AuctionBidResult,
  ErrorAuctionResult,
  HandleNoBidsResult,
} from '../types/auction-result.types';
import { WinningBidResponse } from '../types/bid-response.types';
import { RTB_CACHE_TTL, REDIS_KEYS } from '../constants/cache-keys';
import { AdMarkupService } from '../services/ad-markup.service';

@Injectable()
export class BidResponseProcessor {
  private readonly logger = new Logger(BidResponseProcessor.name);
  private readonly trackingBaseUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly auctionService: AuctionService,
    private readonly redis: RedisService,
    private readonly adMarkupService: AdMarkupService,
  ) {
    this.trackingBaseUrl =
      this.config.get<string>('APP_URL') || 'https://track.oceanadtech.com';
    this.logger.log('Bid Response Processor initialized - Phase 4');
  }

  async generateCompletedAuctionResponses(
    auctionResult: AuctionBidResult,
  ): Promise<WinningBidResponse[]> {
    const responses: WinningBidResponse[] = [];

    this.logger.debug('Generating responses for completed auction', {
      auctionId: auctionResult.auctionId,
      hasWinner: !!auctionResult.winner,
      finalPrice: auctionResult.finalPrice,
    });

    if (auctionResult.winner) {
      // Generate winning bid response
      const winningResponse =
        await this.generateWinningBidResponse(auctionResult);
      responses.push(winningResponse);

      // Update campaign spend atomically - budget management error
      // await this.updateCampaignSpend(
      //     auctionResult.winner.campaignId,
      //     auctionResult.finalPrice,
      // );
    }

    return responses;
  }

  private async generateWinningBidResponse(
    auctionResult: AuctionBidResult,
  ): Promise<WinningBidResponse> {
    const winner = auctionResult.winner;
    const creativeId = winner.creativeId;
    const auctionId = auctionResult.auctionId;

    this.logger.debug('Generating winning bid response', {
      auctionId,
      winnerId: winner.id,
      finalPrice: auctionResult.finalPrice, // Use finalPrice from auction result
      creativeId,
      adSlotContext: auctionResult.originalBidRequest.adSlotContext,
    });

    // Use auction service for tracking URLs
    const trackingUrls = this.adMarkupService.generateTrackingUrls(
      auctionId,
      winner.id,
    );
    const adSlotContextData = auctionResult.originalBidRequest.adSlotContext;

    // Use auction service for ad markup
    const adMarkup = this.adMarkupService.generateAdMarkup(
      creativeId,
      trackingUrls,
      {
        width: adSlotContextData.width,
        height: adSlotContextData.height,
        format: adSlotContextData.format,
      },
    );

    return {
      requestId: auctionResult.originalBidRequest.externalRequestId,
      auctionId: auctionId,
      status: 'COMPLETED',
      winningBid: {
        price: auctionResult.finalPrice, // Type-safe access to finalPrice
        currency: winner.currency || 'INR',
        campaignId: winner.campaignId,
        creativeId: winner.creativeId,
        adMarkup,
        impressionUrls: trackingUrls.impression,
        clickUrls: trackingUrls.click,
        landingUrl: winner.landingUrl,
      },
      auctionData: {
        totalBids: auctionResult.totalBids || 1,
        validBids: auctionResult.validBids || 1,
        auctionDuration: `${auctionResult.processingTime || 0}ms`,
        timestamp: new Date().toISOString(),
        floorPrice: auctionResult.floorPrice,
      },
    };
  }

  async generateNoBidsResponse(
    auctionResult: HandleNoBidsResult,
  ): Promise<HandleNoBidsResult[]> {
    this.logger.debug('Generating no bids response', {
      auctionId: auctionResult.auctionId,
      totalBids: auctionResult.totalBids,
      processingTime: auctionResult.processingTime,
    });

    return [
      {
        auctionId: auctionResult.auctionId,
        auctionStatus: 'NO_BIDS',
        totalBids: auctionResult.totalBids || 0,
        validBids: auctionResult.validBids || 0,
        processingTime: auctionResult.processingTime || 0,
        originalBidRequest: auctionResult.originalBidRequest,
        processedAt: new Date().toISOString(),
        winner: null,
        auctionType: auctionResult.auctionType || 'SECOND_PRICE',
      },
    ];
  }

  async generateErrorResponse(
    auctionResult: ErrorAuctionResult,
  ): Promise<ErrorAuctionResult[]> {
    this.logger.error('Generating error response', {
      auctionId: auctionResult.auctionId,
      errorMessage: auctionResult.errorMessage,
      errorCode: auctionResult.errorCode,
    });

    return [
      {
        auctionId: auctionResult.auctionId,
        auctionStatus: 'ERROR',
        totalBids: auctionResult.totalBids || 0,
        validBids: auctionResult.validBids || 0,
        processingTime: auctionResult.processingTime || 0,
        originalBidRequest: auctionResult.originalBidRequest,
        processedAt: new Date().toISOString(),
        winner: null,
        errorMessage: auctionResult.errorMessage || 'Auction processing failed',
        errorCode: auctionResult.errorCode || 'UNKNOWN_ERROR',
        auctionType: auctionResult.auctionType || 'SECOND_PRICE',
      },
    ];
  }

  async storeBidResponses(
    bidResponses:
      | WinningBidResponse[]
      | HandleNoBidsResult[]
      | ErrorAuctionResult[],
  ): Promise<void> {
    try {
      //   this.logger.debug(
      //     'In Storing Bid Responses',
      //     //     , {
      //     //     bidResponses,
      //     // }
      //   );

      if (bidResponses.length === 0) {
        this.logger.debug('No bid responses to store');
        return;
      }

      // Store each response by its request ID
      const storePromises = bidResponses.map(async (response) => {
        let requestId: string;
        let status: string;

        // Type-safe extraction of requestId and status
        if ('requestId' in response) {
          // This is a WinningBidResponse
          requestId = response.requestId;
          status = response.status;
        } else {
          // This is HandleNoBidsResult or ErrorAuctionResult
          requestId = response.originalBidRequest?.externalRequestId;
          status = response.auctionStatus;
        }

        const cacheKey = REDIS_KEYS.AUCTION_RESULT(requestId);

        await this.redis.set(
          cacheKey,
          JSON.stringify(response),
          RTB_CACHE_TTL.AUCTION_RESULT,
        );

        // this.logger.debug('Bid response cached', {
        //   requestId,
        //   status,
        //   auctionId: response.auctionId,
        // });
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
}
