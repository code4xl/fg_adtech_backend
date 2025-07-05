import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { kafkaTopics } from "../constants/kafka-topics";
import { KafkaService } from "src/kafka/kafka.service";
import { PrismaService } from "src/prisma/prisma.service";
import { BidResponseProcessor } from "../processors/bid-response.processor";
import AuctionProducer from "../producers/auction.producer";
import { AuctionBidResult, HandleNoBidsResult, ErrorAuctionResult } from "../types/auction-result.types";
import { ProcessAuctionResultPayload } from "../types/bid-request.types";
import { WinningBidResponse } from "../types/bid-response.types";
import { RtbHelper } from "../utils/helpers";

@Injectable()
export class AuctionResultKafkaConsumer implements OnModuleInit {
    private readonly logger = new Logger(AuctionResultKafkaConsumer.name);

    constructor(
        private readonly kafka: KafkaService,
        private readonly prisma: PrismaService,
        // private readonly auctionProcessor: AuctionProcessor,
        private readonly bidResponseProcessor: BidResponseProcessor,
        private readonly auctionProducer: AuctionProducer,
        private readonly rtbHelper: RtbHelper,
    ) {
        this.logger.log('Auction Completion Consumer initialized');
    }

    async onModuleInit() {
        try {
            // Add delay to ensure Kafka is fully ready
            await new Promise(resolve => setTimeout(resolve, 6000));
            
            this.logger.log('🚀 Initializing Auction Result Kafka Consumer...');
            
            // Generate bid responses from auction results
            await this.subscribeToAuctionResults();
            
            this.logger.log('✅ Auction Result Kafka Consumer initialized successfully');
        } catch (error) {
            this.logger.error('❌ Failed to initialize Auction Result Kafka Consumer', {
                error: error.message,
            });
            throw error;
        }
    }

    private async subscribeToAuctionResults(): Promise<void> {
        await this.kafka.subscribe(
            kafkaTopics.AUCTION_RESULTS,
            'rtb-response-generator',
            this.processAuctionResult.bind(this),
        );
    }

    // Type guards for auction result discrimination
    private isSuccessfulBidResult(result: any): result is AuctionBidResult {
        return result.auctionStatus === 'COMPLETED' && result.winner !== null;
    }

    private isNoBidsResult(result: any): result is HandleNoBidsResult {
        return result.auctionStatus === 'NO_BIDS';
    }

    private isErrorResult(result: any): result is ErrorAuctionResult {
        return result.auctionStatus === 'ERROR';
    }

    private async processAuctionResult(payload: ProcessAuctionResultPayload): Promise<void> {
        const startTime = Date.now();

        try {
            this.logger.debug('Processing auction result new one', {
                key: payload.key,
                value: payload.value,
                partition: payload.partition,
            });

            // 1. Deserialize auction result
            const auctionResult = this.deserializeAuctionResult(payload.value);

            // 2. Type-safe processing based on auction status
            let bidResponses: WinningBidResponse[] | HandleNoBidsResult[] | ErrorAuctionResult[];
            let auctionType: string;

            if (this.isSuccessfulBidResult(auctionResult)) {
                // TypeScript now knows this is AuctionBidResult
                this.logger.debug('Processing successful auction result', {
                    auctionId: auctionResult.auctionId,
                    winnerId: auctionResult.winnerId,
                    finalPrice: auctionResult.finalPrice
                });

                auctionType = 'SUCCESS';
                bidResponses = await this.bidResponseProcessor.generateCompletedAuctionResponses(auctionResult);

            } else if (this.isNoBidsResult(auctionResult)) {
                // TypeScript now knows this is HandleNoBidsResult
                this.logger.debug('Processing no bids auction result', {
                    auctionId: auctionResult.auctionId,
                    totalBids: auctionResult.totalBids,
                    processingTime: auctionResult.processingTime
                });

                auctionType = 'NO_BIDS';
                bidResponses = await this.bidResponseProcessor.generateNoBidsResponse(auctionResult);

            } else if (this.isErrorResult(auctionResult)) {
                // TypeScript now knows this is ErrorAuctionResult
                this.logger.error('Processing error auction result', {
                    auctionId: auctionResult.auctionId,
                    errorMessage: auctionResult.errorMessage,
                    errorCode: auctionResult.errorCode
                });

                auctionType = 'ERROR';
                bidResponses = await this.bidResponseProcessor.generateErrorResponse(auctionResult);

            } else {
                throw new Error(`Unknown auction status: ${(auctionResult as any).auctionStatus}`);
            }

            this.logger.debug('Bid responses generated', {
                responseCount: bidResponses.length,
                auctionType
            });

            // 3. Store responses in cache for SDK polling
            await this.bidResponseProcessor.storeBidResponses(bidResponses);

            // 4. Publish auction completion for log storage and analytics
            await this.auctionProducer.publishAuctionCompletion(auctionResult);

            // 5. Send win notifications if applicable (later phase)
            // if (this.isSuccessfulBidResult(auctionResult) && auctionResult.winner) {
            //     // await this.bidResponseProcessor.sendWinNotifications(auctionResult);
            // }

            const processingTime = Date.now() - startTime;

            this.logger.log('✅ Auction result processed', {
                auctionId: auctionResult.auctionId,
                auctionType,
                processingTime: `${processingTime}ms`,
                responseCount: bidResponses.length,
            });

        } catch (error) {
            this.logger.error('❌ Auction result processing failed', {
                error: error.message,
                partition: payload.partition,
                offset: payload.offset,
            });

            // Send to DLQ for manual review
            await this.rtbHelper.handleProcessingError(payload, error, 'auction_result');
        }
    }

    private deserializeAuctionResult(data: any): AuctionBidResult | HandleNoBidsResult | ErrorAuctionResult {
        try {
            let parsedData: any;

            if (typeof data === 'string') {
                parsedData = JSON.parse(data);
            } else {
                parsedData = data;
            }

            // Validate that we have the required auctionStatus field
            if (!parsedData.auctionStatus) {
                throw new Error('Missing auctionStatus field in auction result');
            }

            // Validate auctionStatus is one of the expected values
            const validStatuses = ['COMPLETED', 'NO_BIDS', 'ERROR'];
            if (!validStatuses.includes(parsedData.auctionStatus)) {
                throw new Error(`Invalid auctionStatus: ${parsedData.auctionStatus}`);
            }

            return parsedData;
        } catch (error) {
            throw new Error(`Invalid auction result format: ${error.message}`);
        }
    }
}