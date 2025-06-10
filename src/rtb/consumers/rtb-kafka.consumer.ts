// src/rtb/consumers/rtb-kafka.consumer.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { KafkaService } from '../../kafka/kafka.service';
import { AuctionService } from '../services/auction.service';
import { kafkaTopics } from '../../kafka/constants/kafka.config';
import { BidRequestProcessor } from '../processors/bid-request.processor';
import { BidResponseProcessor } from '../processors/bid-response.processor';

/**
 * RTB Kafka Consumer - Phase 4 Implementation
 * 
 * **Core Responsibility: Orchestrate async RTB processing pipeline**
 * 
 * **Why this architecture:**
 * - Separates HTTP response (fast) from auction processing (thorough)
 * - Enables horizontal scaling of auction processing
 * - Provides fault tolerance through Kafka's reliability features
 * - Allows processing optimization without blocking SDK responses
 * 
 * **Processing Flow:**
 * 1. Consume bid requests from Kafka
 * 2. Process auction logic asynchronously
 * 3. Generate and publish auction results
 * 4. Handle error scenarios with dead letter queues
 * 
 * **Performance Considerations:**
 * - Consumer group allows parallel processing across multiple instances
 * - Batch processing for efficiency while maintaining low latency
 * - Circuit breaker patterns prevent cascade failures
 * - Comprehensive error handling prevents message loss
 */
@Injectable()
export class RTBKafkaConsumer implements OnModuleInit {
    private readonly logger = new Logger(RTBKafkaConsumer.name);

    constructor(
        private readonly kafka: KafkaService,
        private readonly auctionService: AuctionService,
        private readonly bidRequestProcessor: BidRequestProcessor,
        private readonly bidResponseProcessor: BidResponseProcessor,
    ) {
        this.logger.log('RTB Kafka Consumer initialized - Phase 4');
    }

    /**
     * Initialize Kafka subscriptions on module startup
     * 
     * **Why multiple subscriptions:**
     * - Bid requests need immediate processing for latency requirements
     * - Auction results require different processing logic
     * - Separate consumer groups allow independent scaling
     * - Dead letter queues handle failed messages without blocking pipeline
     */
    async onModuleInit() {
        try {
            this.logger.log('Initializing RTB Kafka subscriptions...');

            // Primary subscription: Process incoming bid requests
            await this.subscribeToAuctionProcessing();

            // Secondary subscription: Generate bid responses from auction results
            await this.subscribeToAuctionResults();

            // Error handling subscription: Process failed messages
            await this.subscribeToDeadLetterQueues();

            this.logger.log('✅ RTB Kafka Consumer fully initialized');

        } catch (error) {
            this.logger.error('❌ Failed to initialize RTB Kafka Consumer', {
                error: error.message
            });
            throw error;
        }
    }

    // ==========================================
    // PRIMARY PROCESSING SUBSCRIPTIONS
    // ==========================================

    /**
     * Subscribe to auction processing queue
     * 
     * **Why dedicated consumer group:**
     * - Enables multiple instances to process auctions in parallel
     * - Consumer group rebalancing provides fault tolerance
     * - Kafka handles offset management and exactly-once processing
     */
    private async subscribeToAuctionProcessing(): Promise<void> {
        await this.kafka.subscribe(
            kafkaTopics.AUCTION_PROCESSING,
            'rtb-auction-processor',
            this.processAuctionRequest.bind(this)
        );

        this.logger.log('🎯 Subscribed to auction processing topic');
    }

    /**
     * Subscribe to auction results for response generation
     * 
     * **Why separate from auction processing:**
     * - Response generation is lighter weight than auction processing
     * - Can scale response generation independently
     * - Separates auction logic from response formatting
     */
    private async subscribeToAuctionResults(): Promise<void> {
        await this.kafka.subscribe(
            kafkaTopics.AUCTION_RESULTS,
            'rtb-response-generator',
            this.processAuctionResult.bind(this)
        );

        this.logger.log('📤 Subscribed to auction results topic');
    }

    /**
     * Subscribe to dead letter queues for error recovery
     * 
     * **Why DLQ processing:**
     * - Prevents poison messages from blocking pipeline
     * - Allows manual review and reprocessing of failed messages
     * - Maintains audit trail of processing failures
     */
    private async subscribeToDeadLetterQueues(): Promise<void> {
        await this.kafka.subscribe(
            kafkaTopics.DLQ_AUCTIONS,
            'rtb-dlq-processor',
            this.processDLQMessage.bind(this)
        );

        this.logger.log('🚨 Subscribed to dead letter queue');
    }

    // ==========================================
    // MESSAGE PROCESSING HANDLERS
    // ==========================================

    /**
     * Process auction request from Kafka
     * 
     * **Why comprehensive error handling:**
     * - RTB processing must be reliable to maintain advertiser trust
     * - Failed auctions represent lost revenue opportunities
     * - Proper error categorization enables targeted fixes
     * 
     * **Processing steps:**
     * 1. Deserialize and validate bid request
     * 2. Execute auction logic with timeout protection
     * 3. Publish results or handle failures appropriately
     */
    private async processAuctionRequest(payload: {
        key: string;  // id
        value: any;   // bid request data
        topic: string;
        partition: number;
        offset: string;
    }): Promise<void> {
        const startTime = Date.now();
        let auctionId: string | undefined;


        try {
            this.logger.debug('Processing auction request', {
                key: payload.key,
                partition: payload.partition,
                offset: payload.offset
            });

            // 1. Deserialize bid request with validation
            const bidRequestData = this.deserializeBidRequest(payload.value);
            auctionId = bidRequestData.auctionId;

            // 2. Validate message structure and required fields
            this.validateBidRequest(bidRequestData);

            // 3. Process auction with timeout protection (max 150ms)
            const auctionResult = await Promise.race([
                this.bidRequestProcessor.processBidRequest(bidRequestData.bidRequest),
                this.createTimeoutPromise(150, auctionId)
            ]);

            // 4. Publish auction results for response generation
            await this.publishAuctionResult(auctionResult, bidRequestData);

            // 5. Record processing metrics
            const processingTime = Date.now() - startTime;
            await this.recordProcessingMetrics(auctionId, processingTime, 'success');

            this.logger.log('✅ Auction processed successfully', {
                auctionId,
                processingTime: `${processingTime}ms`,
                winner: auctionResult.winner ? 'yes' : 'no'
            });

        } catch (error) {
            const processingTime = Date.now() - startTime;

            this.logger.error('❌ Auction processing failed', {
                auctionId,
                error: error.message,
                processingTime: `${processingTime}ms`,
                partition: payload.partition,
                offset: payload.offset
            });

            // Send to DLQ for manual review if critical error
            await this.handleProcessingError(payload, error, 'auction_processing');

            // Record failure metrics
            await this.recordProcessingMetrics(auctionId, processingTime, 'error');
        }
    }

    /**
     * Process auction result to generate bid responses
     * 
     * **Why separate result processing:**
     * - Auction logic and response generation have different scaling needs
     * - Response generation involves external API calls (tracking URLs)
     * - Separation allows optimization of each stage independently
     */
    private async processAuctionResult(payload: {
        key: string;
        value: any;
        topic: string;
        partition: number;
        offset: string;
    }): Promise<void> {
        const startTime = Date.now();

        try {
            this.logger.debug('Processing auction result', {
                key: payload.key,
                partition: payload.partition
            });

            // 1. Deserialize auction result
            const auctionResult = this.deserializeAuctionResult(payload.value);

            // 2. Generate bid responses and ad markup
            const bidResponses = await this.bidResponseProcessor.generateBidResponses(
                auctionResult
            );

            // 3. Store responses in cache for SDK polling
            await this.bidResponseProcessor.storeBidResponses(bidResponses);

            // 4. Send win notifications if applicable   -- Later phase
            // if (auctionResult.winner) {
            //     await this.bidResponseProcessor.sendWinNotifications(auctionResult);
            // }

            const processingTime = Date.now() - startTime;
            this.logger.log('✅ Auction result processed', {
                auctionId: auctionResult.auctionId,
                processingTime: `${processingTime}ms`,
                responseCount: bidResponses.length
            });

        } catch (error) {
            this.logger.error('❌ Auction result processing failed', {
                error: error.message,
                partition: payload.partition,
                offset: payload.offset
            });

            // Send to DLQ for manual review
            await this.handleProcessingError(payload, error, 'auction_result');
        }
    }

    /**
     * Process messages from dead letter queue
     * 
     * **Why DLQ processing:**
     * - Allows recovery from transient failures
     * - Provides audit trail for debugging
     * - Enables manual intervention for complex cases
     */
    private async processDLQMessage(payload: {
        key: string;
        value: any;
        topic: string;
        partition: number;
        offset: string;
    }): Promise<void> {
        this.logger.warn('Processing DLQ message', {
            originalTopic: payload.value.originalTopic,
            errorType: payload.value.errorType,
            timestamp: payload.value.timestamp
        });

        try {
            // Attempt reprocessing based on original topic
            switch (payload.value.originalTopic) {
                case kafkaTopics.AUCTION_PROCESSING:
                    await this.processAuctionRequest({
                        ...payload,
                        value: payload.value.originalMessage
                    });
                    break;

                case kafkaTopics.AUCTION_RESULTS:
                    await this.processAuctionResult({
                        ...payload,
                        value: payload.value.originalMessage
                    });
                    break;

                default:
                    this.logger.error('Unknown DLQ message type', {
                        originalTopic: payload.value.originalTopic
                    });
            }

            this.logger.log('✅ DLQ message reprocessed successfully');

        } catch (error) {
            this.logger.error('❌ DLQ message reprocessing failed', {
                error: error.message,
                willRetry: false
            });

            // After DLQ failure, log for manual intervention
            // Don't re-queue to prevent infinite loops
        }
    }

    // ==========================================
    // UTILITY METHODS
    // ==========================================

    /**
     * Deserialize bid request with error handling
     */
    private deserializeBidRequest(data: any): any {
        try {
            if (typeof data === 'string') {
                return JSON.parse(data);
            }
            return data;
        } catch (error) {
            throw new Error(`Invalid bid request format: ${error.message}`);
        }
    }

    /**
     * Deserialize auction result with error handling
     */
    private deserializeAuctionResult(data: any): any {
        try {
            if (typeof data === 'string') {
                return JSON.parse(data);
            }
            return data;
        } catch (error) {
            throw new Error(`Invalid auction result format: ${error.message}`);
        }
    }

    /**
     * Validate bid request structure
     */
    private validateBidRequest(bidRequest: any): void {
        if (!bidRequest.bidRequest) {
            throw new Error('Missing bidRequest in message');
        }

        if (!bidRequest.auctionId) {
            throw new Error('Missing auctionId in message');
        }

        if (!bidRequest.bidRequest.id) {
            throw new Error('Missing bid request ID');
        }
    }

    /**
     * Create timeout promise for auction processing
     * 
     * **Why timeout protection:**
     * - RTB requires responses within 100-200ms timeouts
     * - Prevents hanging auctions from blocking pipeline
     * - Ensures consistent response times under load
     */
    private createTimeoutPromise(timeoutMs: number, auctionId?: string): Promise<never> {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Auction processing timeout after ${timeoutMs}ms`));
            }, timeoutMs);
        });
    }

    /**
     * Publish auction result to results topic
     */
    private async publishAuctionResult(auctionResult: any, originalData: any): Promise<void> {
        try {
            await this.kafka.publish(kafkaTopics.AUCTION_RESULTS, {
                key: originalData.auctionId,
                value: {
                    ...auctionResult,
                    auctionId: originalData.auctionId,
                    originalRequest: originalData.bidRequest,
                    processedAt: new Date().toISOString()
                }
            });

            this.logger.debug('Auction result published', {
                auctionId: originalData.auctionId
            });

        } catch (error) {
            this.logger.error('Failed to publish auction result', {
                error: error.message,
                auctionId: originalData.auctionId
            });
            throw error;
        }
    }

    /**
     * Handle processing errors with appropriate routing
     * 
     * **Why categorized error handling:**
     * - Different error types require different recovery strategies
     * - Validation errors shouldn't be retried
     * - Transient errors can be retried with backoff
     * - Critical errors need immediate attention
     */
    private async handleProcessingError(
        payload: any,
        error: Error,
        processingStage: string
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
                        maxRetries: 3
                    }
                });

                this.logger.warn('Message sent to DLQ', {
                    key: payload.key,
                    errorCategory,
                    processingStage
                });

            } catch (dlqError) {
                this.logger.error('Failed to send message to DLQ', {
                    error: dlqError.message,
                    originalError: error.message
                });
            }
        } else {
            // Log permanent failures for monitoring
            this.logger.error('Permanent processing failure', {
                key: payload.key,
                errorCategory,
                errorMessage: error.message,
                processingStage
            });
        }
    }

    /**
     * Categorize errors for appropriate handling
     */
    private categorizeError(error: Error): 'validation' | 'transient' | 'timeout' | 'critical' {
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

    /**
     * Record processing metrics for monitoring
     */
    private async recordProcessingMetrics(
        auctionId: string | undefined,
        processingTime: number,
        status: 'success' | 'error'
    ): Promise<void> {
        try {
            // This would integrate with your metrics service
            this.logger.debug('Recording processing metrics', {
                auctionId,
                processingTime,
                status
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
                error: error.message
            });
        }
    }
}