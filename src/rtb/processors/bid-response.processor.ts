import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { KafkaService } from "src/kafka/kafka.service";
import { PrismaService } from "src/prisma/prisma.service";
import { RedisService } from "src/redis/redis.service";
import { AuctionService } from "../services/auction.service";
import AuctionProducer from "../producers/auction.producer";
import { AuctionBidResult, CompleteAuctionResult, ErrorAuctionResult, HandleNoBidsResult } from "../types/auction-result.types";
import { WinningBidResponse } from "../types/bid-response.types";
import { RTB_CACHE_TTL, RTB_KEYS } from "../constants/cache-keys";

@Injectable()
export class BidResponseProcessor {
    private readonly logger = new Logger(BidResponseProcessor.name);
    private readonly trackingBaseUrl: string;

    constructor(
        private readonly config: ConfigService,
        private readonly auctionService: AuctionService,
        private readonly redis: RedisService
    ) {
        this.trackingBaseUrl =
            this.config.get<string>('APP_URL') || 'https://track.oceanadtech.com';
        this.logger.log('Bid Response Processor initialized - Phase 4');
    }

    async generateBidResponses(auctionResult: CompleteAuctionResult): Promise<WinningBidResponse[] | HandleNoBidsResult[] | ErrorAuctionResult[]> {
        this.logger.debug(
            'Generating bid responses' +
            JSON.stringify({
                // auctionResult: auctionResult,
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

    private async generateCompletedAuctionResponses(
        auctionResult: AuctionBidResult,
    ): Promise<WinningBidResponse[]> {
        const responses = [];

        this.logger.debug('Generating responses for completed auction', {
            auctionResult,
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

    private async generateWinningBidResponse(auctionResult: AuctionBidResult): Promise<WinningBidResponse> {
        const winner = auctionResult.winner;
        const creativeId = winner.creativeId;
        const auctionId = auctionResult.auctionId;

        this.logger.debug('Generating winning bid response', {
            auctionId,
            winnerId: winner.id,
            finalPrice: winner.finalPrice,
            creativeId,
            auctionResult,
            adSlotContext: auctionResult.originalBidRequest.adSlotContext,
        });
        // Use auction service for tracking URLs
        const trackingUrls = this.auctionService.generateTrackingUrls(
            auctionId,
            winner.id,
        );
        const adSlotContextData = auctionResult.originalBidRequest.adSlotContext;

        // Use auction service for ad markup
        const adMarkup = this.auctionService.generateAdMarkup(
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
            status: 'COMPLETED',
            winningBid: {
                price: winner.finalPrice,
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

    private async generateNoBidsResponse(auctionResult: HandleNoBidsResult): Promise<HandleNoBidsResult[]> {
        return [
            {
                auctionId: auctionResult.auctionId,
                auctionStatus: 'NO_BIDS',
                totalBids: 0,
                validBids: 0,
                processingTime: auctionResult.processingTime || 0,
                originalBidRequest: auctionResult.originalBidRequest || {},
                processedAt: new Date().toISOString(),
                winner: null,
                auctionType: auctionResult.auctionType || 'SECOND_PRICE',
            },
        ];
    }

    private async generateErrorResponse(auctionResult: ErrorAuctionResult): Promise<ErrorAuctionResult[]> {
        return [
            {
                auctionId: auctionResult.auctionId,
                auctionStatus: 'ERROR',
                totalBids: 0,
                validBids: 0,
                processingTime: auctionResult.processingTime || 0,
                originalBidRequest: auctionResult.originalBidRequest || {},
                processedAt: new Date().toISOString(),
                winner: null,
                errorMessage: auctionResult.errorMessage || 'Auction processing failed',
                errorCode: auctionResult.errorCode || 'UNKNOWN_ERROR',
                auctionType: auctionResult.auctionType || 'SECOND_PRICE',
            },
        ];
    }


    async storeBidResponses(bidResponses: WinningBidResponse[] | HandleNoBidsResult[] | ErrorAuctionResult[]): Promise<void> {
        try {
            if (bidResponses.length === 0) {
                this.logger.debug('No bid responses to store');
                return;
            }

            // Store each response by its request ID
            const storePromises = bidResponses.map(async (response) => {
                const cacheKey = RTB_KEYS.AUCTION_RESULT(response.requestId);

                await this.redis.set(cacheKey, JSON.stringify(response), RTB_CACHE_TTL.AUCTION_RESULT);

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
}