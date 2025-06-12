import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { KafkaService } from "src/kafka/kafka.service";
import { AuctionService } from "../services/auction.service";
import { kafkaTopics } from "../constants/kafka-topics";
import { BidRequestPayload, BidRequestWithAuction, ProcessAuctionResultPayload, ProcessBidRequestPayload } from "../types/bid-request.types";
import { RtbHelper } from "../utils/helpers";
import { BidRequestProcessor } from "../processors/bid-request.processor";
import { AuctionBidResult, ErrorAuctionResult, HandleNoBidsResult } from "../types/auction-result.types";
import { BidResponseProcessor } from "../processors/bid-response.processor";
import AuctionProducer from "../producers/auction.producer";





@Injectable()
export class BidRequestKafkaConsumer implements OnModuleInit {
    private readonly logger = new Logger(BidRequestKafkaConsumer.name);

    constructor(
        private readonly kafka: KafkaService,
        private readonly auctionService: AuctionService,
        private readonly bidRequestProcessor: BidRequestProcessor,
        private readonly bidResponseProcessor: BidResponseProcessor,
        private readonly auctionProducer: AuctionProducer,
        private readonly rtbHelper: RtbHelper,
    ) {
        this.logger.log('RTB Kafka Consumer initialized - Phase 4');
    }

    async onModuleInit() {
        try {
            // Primary subscription: Process incoming bid requests
            await this.subscribeToAuctionProcessing();

            // Secondary subscription: Generate bid responses from auction results
            await this.subscribeToAuctionResults();

            // // Error handling subscription: Process failed messages
            // await this.subscribeToDeadLetterQueues();
        } catch (error) {
            this.logger.error('❌ Failed to initialize RTB Kafka Consumer', {
                error: error.message,
            });
            throw error;
        }
    }

    private async subscribeToAuctionProcessing(): Promise<void> {
        await this.kafka.subscribe(
            kafkaTopics.AUCTION_PROCESSING,
            'rtb-auction-processor',
            this.processBidRequestForAuction.bind(this),
        );
    }

    private async subscribeToAuctionResults(): Promise<void> {
        await this.kafka.subscribe(
            kafkaTopics.AUCTION_RESULTS,
            'rtb-response-generator',
            this.processAuctionResult.bind(this),
        );
    }


    private async processBidRequestForAuction(payload: ProcessBidRequestPayload): Promise<void> {
        const startTime = Date.now();
        let auctionId: string | undefined;

        try {
            this.logger.debug('Processing auction request', {
                key: payload.key,
                partition: payload.partition,
                offset: payload.offset,
            });

            // 1. Deserialize bid request with validation
            const bidRequestData = this.deserializeBidRequest(payload.value);
            auctionId = bidRequestData.bidRequest.auctionId;

            // 2. Validate message structure and required fields
            this.rtbHelper.validateBidRequest(bidRequestData.bidRequest);

            // 3. Process auction with timeout protection (max 150ms)
            const auctionResult = await Promise.race([
                this.bidRequestProcessor.processBidRequest(bidRequestData.bidRequest),
                // this.createTimeoutPromise(150, auctionId),
            ]);

            this.logger.debug(
                'Auction processed successfully and Sending to publush auction result',
                {
                    bidRequest: bidRequestData,
                    auctionId: auctionResult.auctionId,
                    winnerId: auctionResult.winner.id,
                },
            );

            // 4. Publish auction results for response generation
            // await this.rtbProducer.publishAuctionResult(
            //   auctionResult,
            //   bidRequestData,
            // );

            // 5. Record processing metrics
            const processingTime = Date.now() - startTime;

            await this.recordProcessingMetrics(auctionId, processingTime, 'success');

            this.logger.log('✅ Auction processed successfully', {
                auctionId,
                processingTime: `${processingTime}ms`,
                winner: auctionResult.winner ? 'yes' : 'no',
            });
        } catch (error) {
            const processingTime = Date.now() - startTime;

            this.logger.error('❌ Auction processing failed', {
                auctionId,
                error: error,
                processingTime: `${processingTime}ms`,
                partition: payload.partition,
                offset: payload.offset,
            });

            // Send to DLQ for manual review if critical error
            await this.handleProcessingError(payload, error, 'auction_processing');

            // Record failure metrics
            await this.recordProcessingMetrics(auctionId, processingTime, 'error');
        }
    }

    private async processAuctionResult(payload: ProcessAuctionResultPayload): Promise<void> {
        const startTime = Date.now();

        try {
            this.logger.debug('Processing auction result', {
                key: payload.key,
                partition: payload.partition,
            });

            // 1. Deserialize auction result
            const auctionResult = this.deserializeAuctionResult(payload.value);
            // this.logger.debug('Auction result deserialized & now going to hell', {
            //   auctionResult,
            // });

            // 2. Generate bid responses and ad markup
            const bidResponses =
                await this.bidResponseProcessor.generateBidResponses(auctionResult);
            this.logger.debug('Bid responses generated', {
                responseCount: bidResponses.length,
            });

            // 3. Store responses in cache for SDK polling
            await this.bidResponseProcessor.storeBidResponses(bidResponses);

            // 4. *** NEW *** Publish auction completion for log storage and analytics
            await this.auctionProducer.publishAuctionCompletion(auctionResult);

            // 5. Send win notifications if applicable (later phase)
            // if (auctionResult.winner) {
            //   await this.bidResponseProcessor.sendWinNotifications(auctionResult);
            // }

            const processingTime = Date.now() - startTime;

            this.logger.log('✅ Auction result processed', {
                auctionId: auctionResult.auctionId,
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
            await this.handleProcessingError(payload, error, 'auction_result');
        }
    }

    private deserializeBidRequest(data: BidRequestPayload): BidRequestPayload {
        try {
            this.logger.debug(
                'Deserializing bid request while consumption',
                // ` - : ${JSON.stringify(data)}`,
            );
            if (typeof data === 'string') {
                return JSON.parse(data);
            }
            return data;
        } catch (error) {
            throw new Error(`Invalid bid request format: ${error.message}`);
        }
    }

    private deserializeAuctionResult(data: AuctionBidResult | HandleNoBidsResult | ErrorAuctionResult): AuctionBidResult | HandleNoBidsResult | ErrorAuctionResult {
        try {
            if (typeof data === 'string') {
                return JSON.parse(data);
            }
            return data;
        } catch (error) {
            throw new Error(`Invalid auction result format: ${error.message}`);
        }
    }

    private async handleProcessingError(
        payload: any,
        error: Error,
        processingStage: string,
    ): Promise<void> {
        const errorCategory = this.categorizeError(error);

        // Only send recoverable errors to DLQ
        if (errorCategory === 'transient' || errorCategory === 'timeout') {
            try {
                await this.kafka.publish(kafkaTopics.DLQ_AUCTIONS, {
                    key: payload.key,
                    value: {
                        originalMessage: payload.value,
                        originalTopic: payload.topic,
                        errorType: errorCategory,
                        errorMessage: error.message,
                        processingStage,
                        timestamp: new Date().toISOString(),
                        retryCount: 0,
                        maxRetries: 3,
                    },
                });

                this.logger.warn('Message sent to DLQ', {
                    key: payload.key,
                    errorCategory,
                    processingStage,
                });
            } catch (dlqError) {
                this.logger.error('Failed to send message to DLQ', {
                    error: dlqError.message,
                    originalError: error.message,
                });
            }
        } else {
            // Log permanent failures for monitoring
            this.logger.error('Permanent processing failure', {
                key: payload.key,
                errorCategory,
                errorMessage: error.message,
                processingStage,
            });
        }
    }

    private categorizeError(
        error: Error,
    ): 'validation' | 'transient' | 'timeout' | 'critical' {
        const message = error.message.toLowerCase();

        if (message.includes('timeout')) {
            return 'timeout';
        }

        if (message.includes('missing') || message.includes('invalid')) {
            return 'validation';
        }

        if (message.includes('connection') || message.includes('network')) {
            return 'transient';
        }

        return 'critical';
    }

    private async recordProcessingMetrics(
        auctionId: string | undefined,
        processingTime: number,
        status: 'success' | 'error',
    ): Promise<void> {
        try {
            // This would integrate with your metrics service
            this.logger.debug('Recording processing metrics', {
                auctionId,
                processingTime,
                status,
            });

            // TODO: Implement actual metrics recording
            // await this.metricsService.recordAuctionProcessing({
            //     auctionId,
            //     processingTime,
            //     status,
            //     timestamp: new Date()
            // });
        } catch (error) {
            this.logger.warn('Failed to record metrics', {
                error: error.message,
            });
        }
    }
}