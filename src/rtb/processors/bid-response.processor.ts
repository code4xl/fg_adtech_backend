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
import { RTB_CACHE_TTL, REDIS_KEYS, RTB_KEYS } from '../constants/cache-keys';
import { AdMarkupService } from '../services/ad-markup.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class BidResponseProcessor {
  private readonly logger = new Logger(BidResponseProcessor.name);
  private readonly trackingBaseUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly auctionService: AuctionService,
    private readonly redis: RedisService,
    private readonly adMarkupService: AdMarkupService,
    private readonly prisma: PrismaService,
  ) {
    this.trackingBaseUrl =
      this.config.get<string>('APP_URL') || 'https://track.oceanadtech.com';
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
      finalPrice: auctionResult.finalPrice,
      creativeId,
      adSlotContext: auctionResult.originalBidRequest.adSlotContext,
    });

     // ✅ STEP 1: Try to get existing bid response that already has tracking URLs
    const existingBidResponse = await this.getExistingBidResponse(winner.id);

    if (existingBidResponse && this.isValidBidResponse(existingBidResponse)) {
      this.logger.debug('✅ Reusing existing bid response tracking URLs', {
        bidResponseId: winner.id,
        hasAdMarkup: !!existingBidResponse.adMarkup,
        hasImpressionUrls: !!existingBidResponse.impressionUrls?.length,
        hasClickUrls: !!existingBidResponse.clickUrls?.length,
      });

      // ✅ Reuse existing tracking URLs and ad markup - NO REGENERATION
      return {
        requestId: auctionResult.originalBidRequest.externalRequestId,
        auctionId: auctionId,
        status: 'COMPLETED',
        winningBid: {
          price: auctionResult.finalPrice,
          currency: winner.currency || 'INR',
          campaignId: winner.campaignId,
          creativeId: winner.creativeId,
          adMarkup: existingBidResponse.adMarkup,           // ✅ Reuse existing
          impressionUrls: existingBidResponse.impressionUrls, // ✅ Reuse existing  
          clickUrls: existingBidResponse.clickUrls,         // ✅ Reuse existing
          landingUrl: existingBidResponse.landingUrl,       // ✅ Reuse existing
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

    // ⚠️ FALLBACK: Generate new tracking URLs only if existing bid response not found
    this.logger.warn('⚠️ Existing bid response not found, generating new tracking URLs', {
      bidResponseId: winner.id,
      auctionId,
    });

    return await this.generateFallbackWinningResponse(auctionResult);
  }

  private async getExistingBidResponse(bidResponseId: string): Promise<any | null> {
    try {
      // First try Redis cache
      const cachedResponse = await this.redis.get(RTB_KEYS.BID_RESPONSE(bidResponseId));
      if (cachedResponse) {
        try {
          const parsed = typeof cachedResponse === 'string' 
            ? JSON.parse(cachedResponse) 
            : cachedResponse;
          
          this.logger.debug('Found bid response in Redis cache', {
            bidResponseId,
            hasAdMarkup: !!parsed.adMarkup,
          });
          return parsed;
        } catch (parseError) {
          this.logger.warn('Failed to parse cached bid response', { 
            bidResponseId, 
            error: parseError.message 
          });
        }
      }

      // Fallback to database
      const bidResponse = await this.prisma.bidResponse.findUnique({
        where: { id: bidResponseId },
        select: {
          id: true,
          adMarkup: true,
          impressionUrls: true,
          clickUrls: true,
          landingUrl: true,
          campaign: {
            select: {
              id: true,
            }
          },
          creative: {
            select: {
              id: true,
              landingUrl: true,
            }
          }
        },
      });

      if (bidResponse) {
        this.logger.debug('Found bid response in database', {
          bidResponseId,
          hasAdMarkup: !!bidResponse.adMarkup,
          hasImpressionUrls: !!bidResponse.impressionUrls?.length,
          hasClickUrls: !!bidResponse.clickUrls?.length,
        });

        // Cache it for future use
        await this.redis.setex(
          RTB_KEYS.BID_RESPONSE(bidResponseId),
          RTB_CACHE_TTL.BID_RESPONSE, // 5 minutes TTL
          JSON.stringify({
            id: bidResponse.id,
            adMarkup: bidResponse.adMarkup,
            impressionUrls: bidResponse.impressionUrls,
            clickUrls: bidResponse.clickUrls,
            landingUrl: bidResponse.landingUrl || bidResponse.creative?.landingUrl,
          })
        );

        return {
          id: bidResponse.id,
          adMarkup: bidResponse.adMarkup,
          impressionUrls: bidResponse.impressionUrls,
          clickUrls: bidResponse.clickUrls,
          landingUrl: bidResponse.landingUrl || bidResponse.creative?.landingUrl,
        };
      }

      this.logger.debug('No existing bid response found', { bidResponseId });
      return null;

    } catch (error) {
      this.logger.error('Failed to get existing bid response', {
        bidResponseId,
        error: error.message,
      });
      return null;
    }
  }

   private isValidBidResponse(bidResponse: any): boolean {
    const isValid = !!(
      bidResponse?.adMarkup &&
      bidResponse?.impressionUrls?.length > 0 &&
      bidResponse?.clickUrls?.length > 0 &&
      bidResponse?.landingUrl
    );

    if (!isValid) {
      this.logger.debug('Invalid bid response - missing required fields', {
        bidResponseId: bidResponse?.id,
        hasAdMarkup: !!bidResponse?.adMarkup,
        hasImpressionUrls: !!bidResponse?.impressionUrls?.length,
        hasClickUrls: !!bidResponse?.clickUrls?.length,
        hasLandingUrl: !!bidResponse?.landingUrl,
      });
    }

    return isValid;
  }

  private async generateFallbackWinningResponse(
    auctionResult: AuctionBidResult,
  ): Promise<WinningBidResponse> {
    const winner = auctionResult.winner;
    const creativeId = winner.creativeId;
    const auctionId = auctionResult.auctionId;

    // Fetch creative details from database
    const creative = await this.prisma.creative.findUnique({
      where: { id: creativeId },
    });

    if (!creative) {
      this.logger.error('Creative not found', { creativeId });
      throw new Error(`Creative ${creativeId} not found`);
    }

    // ⚠️ Generate NEW tracking URLs (should be rare)
    const trackingUrls = this.adMarkupService.generateTrackingUrls(
      auctionId,
      winner.id,
    );
    
    const adSlotContextData = auctionResult.originalBidRequest.adSlotContext;

    // Prepare creative object with all required properties
    const creativeData = {
      id: creative.id,
      name: creative.name,
      fileUrl: creative.fileUrl,
      landingUrl: creative.landingUrl,
      type: creative.type,
      format:
        creative.type === 'IMAGE' || creative.type === 'HTML5'
          ? 'BANNER'
          : creative.type === 'VIDEO'
            ? 'VIDEO'
            : creative.type === 'HTML'
              ? 'NATIVE'
              : 'BANNER',
    };

    // Generate new ad markup
    const adMarkup = this.adMarkupService.generateAdMarkup(
      creativeData,
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

      this.logger.debug(' Bid responses stored in cache', {
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
