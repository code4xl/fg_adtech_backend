import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { KafkaService } from "src/kafka/kafka.service";
import { PrismaService } from "src/prisma/prisma.service";
import { RedisService } from "src/redis/redis.service";
import { AuctionService } from "../services/auction.service";
import { RtbService } from '../services/rtb.service';
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
        private readonly redis: RedisService,
        private readonly rtbService: RtbService
    ) {
        this.trackingBaseUrl =
            this.config.get<string>('APP_URL') || 'https://track.oceanadtech.com';
        this.logger.log('Bid Response Processor initialized - Phase 4');
    }

    // Deprecated: This method is no longer used
    // async generateBidResponses(auctionResult: CompleteAuctionResult): Promise<WinningBidResponse[] | HandleNoBidsResult[] | ErrorAuctionResult[]> {
    //     this.logger.debug(
    //         'Generating bid responses' +
    //         JSON.stringify({
    //             // auctionResult: auctionResult,
    //             auctionId: auctionResult.auctionId,
    //             hasWinner: !!auctionResult.winner,
    //             // status: auctionResult.auctionStatus,
    //         }),
    //     );

    //     try {
    //         // Handle different auction outcomes
    //         switch (auctionResult.auctionStatus) {
    //             case 'NO_BIDS':
    //                 return await this.generateNoBidsResponse(auctionResult);

    //             case 'ERROR':
    //                 return await this.generateErrorResponse(auctionResult);

    //             default:
    //                 return await this.generateCompletedAuctionResponses(auctionResult);
    //         }
    //     } catch (error) {
    //         this.logger.error('Failed to generate bid responses', {
    //             error: error,
    //             auctionId: auctionResult.auctionId,
    //         });
    //         throw error;
    //     }
    // }

    async generateCompletedAuctionResponses(
        auctionResult: AuctionBidResult,
    ): Promise<WinningBidResponse[]> {
        const responses: WinningBidResponse[] = [];

        this.logger.debug('Generating responses for completed auction', {
            auctionId: auctionResult.auctionId,
            hasWinner: !!auctionResult.winner,
            finalPrice: auctionResult.finalPrice
        });

        if (auctionResult.winner) {
            // Generate winning bid response
            const winningResponse = await this.generateWinningBidResponse(auctionResult);
            responses.push(winningResponse);

            // Update campaign spend atomically - budget management error
            // await this.updateCampaignSpend(
            //     auctionResult.winner.campaignId,
            //     auctionResult.finalPrice,
            // );
        }

        return responses;
    }

    // Deprecated: This method is no longer used
    // public async generateWinningBidResponse(auctionResult: AuctionBidResult): Promise<WinningBidResponse> {
    //     const winner = auctionResult.winner;
    //     const creativeId = winner.creativeId;
    //     const auctionId = auctionResult.auctionId;

    //     this.logger.debug('Generating winning bid response', {
    //         auctionId,
    //         winnerId: winner.id,
    //         finalPrice: winner.finalPrice,
    //         creativeId,
    //         auctionResult,
    //         adSlotContext: auctionResult.originalBidRequest.adSlotContext,
    //     });
    //     // Use auction service for tracking URLs
    //     const trackingUrls = this.auctionService.generateTrackingUrls(
    //         auctionId,
    //         winner.id,
    //     );
    //     const adSlotContextData = auctionResult.originalBidRequest.adSlotContext;

    //     // Use auction service for ad markup
    //     const adMarkup = this.auctionService.generateAdMarkup(
    //         creativeId,
    //         trackingUrls,
    //         {
    //             width: adSlotContextData.width,
    //             height: adSlotContextData.height,
    //             format: adSlotContextData.format,
    //         },
    //     );

    //     return {
    //         requestId: auctionResult.originalBidRequest.externalRequestId,
    //         status: 'COMPLETED',
    //         winningBid: {
    //             price: winner.finalPrice,
    //             currency: winner.currency || 'INR',
    //             campaignId: winner.campaignId,
    //             creativeId: winner.creativeId,
    //             adMarkup,
    //             impressionUrls: trackingUrls.impression,
    //             clickUrls: trackingUrls.click,
    //             landingUrl: winner.landingUrl,
    //         },
    //         auctionData: {
    //             totalBids: auctionResult.totalBids || 1,
    //             validBids: auctionResult.validBids || 1,
    //             auctionDuration: `${auctionResult.processingTime || 0}ms`,
    //             timestamp: new Date().toISOString(),
    //             floorPrice: auctionResult.floorPrice,
    //         },
    //     };
    // }

    private async generateWinningBidResponse(auctionResult: AuctionBidResult): Promise<WinningBidResponse> {
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

    async generateNoBidsResponse(auctionResult: HandleNoBidsResult): Promise<HandleNoBidsResult[]> {
        this.logger.debug('Generating no bids response', {
            auctionId: auctionResult.auctionId,
            totalBids: auctionResult.totalBids,
            processingTime: auctionResult.processingTime
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

    async generateErrorResponse(auctionResult: ErrorAuctionResult): Promise<ErrorAuctionResult[]> {
        this.logger.error('Generating error response', {
            auctionId: auctionResult.auctionId,
            errorMessage: auctionResult.errorMessage,
            errorCode: auctionResult.errorCode
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

    async storeBidResponses(bidResponses: WinningBidResponse[] | HandleNoBidsResult[] | ErrorAuctionResult[]): Promise<void> {
        try {
            this.logger.debug("In Storing Bid Responses", {
                bidResponses,
            });
    
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
    
                const cacheKey = RTB_KEYS.AUCTION_RESULT(requestId);
    
                await this.redis.set(cacheKey, JSON.stringify(response), RTB_CACHE_TTL.AUCTION_RESULT);
    
                this.logger.debug('Bid response cached', {
                    requestId,
                    status,
                    auctionId: 'auctionId' in response ? response.auctionId : 'N/A'
                });
    
                // *** NEW SSE PUBLISHING CODE START ***
                try {
                    // Check if SSE is enabled for this request
                    const sseEnabled = await this.rtbService.isSSEEnabled(requestId);
                    
                    if (sseEnabled) {
                        // Format the SSE event data based on response type
                        let sseEventData: any;
                        
                        if ('requestId' in response && 'winningBid' in response) {
                            // This is a WinningBidResponse
                            sseEventData = {
                                status: 'complete',
                                slots: [{
                                    inventoryId: response.winningBid.creativeId, // Using creativeId as we don't have inventoryId
                                    status: 'filled',
                                    bid: {
                                        campaignId: response.winningBid.campaignId,
                                        price: response.winningBid.price,
                                        currency: response.winningBid.currency || 'INR',
                                        cpm: response.winningBid.price,
                                    },
                                    creative: {
                                        creativeId: response.winningBid.creativeId,
                                        adMarkup: response.winningBid.adMarkup,
                                        impressionUrls: response.winningBid.impressionUrls || [],
                                        clickUrls: response.winningBid.clickUrls || [],
                                        landingUrl: response.winningBid.landingUrl,
                                    },
                                }],
                                processingTime: parseInt(response.auctionData?.auctionDuration) || 0,
                                auctionStats: {
                                    totalBids: response.auctionData?.totalBids || 0,
                                    validBids: response.auctionData?.validBids || 0,
                                    auctionType: 'SECOND_PRICE',
                                    timestamp: response.auctionData?.timestamp || new Date().toISOString(),
                                    floorPrice: response.auctionData?.floorPrice,
                                },
                            };
                        } else {
                            // This is HandleNoBidsResult or ErrorAuctionResult
                            const isError = 'errorMessage' in response;
                            sseEventData = {
                                status: isError ? 'error' : 'partial',
                                slots: [{
                                    inventoryId: response.originalBidRequest?.inventoryId || 'unknown',
                                    status: 'unfilled',
                                    error: isError 
                                        ? (response as ErrorAuctionResult).errorMessage 
                                        : 'No eligible campaigns found',
                                }],
                                processingTime: response.processingTime || 0,
                                auctionStats: {
                                    totalBids: response.totalBids || 0,
                                    validBids: response.validBids || 0,
                                    auctionType: response.auctionType || 'SECOND_PRICE',
                                    timestamp: response.processedAt || new Date().toISOString(),
                                },
                            };
                        }
    
                        // Publish the SSE complete event
                        await this.rtbService.publishSSEEvent(
                            requestId,
                            'bid_complete',
                            sseEventData
                        );
    
                        this.logger.log('SSE complete event published', {
                            requestId,
                            status: sseEventData.status,
                            hasWinner: 'requestId' in response && 'winningBid' in response,
                        });
                    }
                } catch (sseError) {
                    // Don't let SSE errors affect the main flow
                    this.logger.error('Failed to publish SSE event', {
                        requestId,
                        error: sseError.message,
                    });
                }
                // *** NEW SSE PUBLISHING CODE END ***
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