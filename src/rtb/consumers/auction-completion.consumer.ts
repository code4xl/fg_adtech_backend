import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { KafkaService } from "src/kafka/kafka.service";
import { PrismaService } from "src/prisma/prisma.service";
import { kafkaTopics } from "../constants/kafka-topics";
import { AuctionCompletionData } from "../types/auction-completion.type";

export interface processAuctionCompletionPayload {
    key: string;
    value: AuctionCompletionData;
    topic: string;
    partition: number;
    offset: string;
}

@Injectable()
export class AuctionCompletionKafkaConsumer implements OnModuleInit {
    private readonly logger = new Logger(AuctionCompletionKafkaConsumer.name);

    constructor(
        private readonly kafka: KafkaService,
        private readonly prisma: PrismaService,
    ) { }

    async onModuleInit() {
        try {
            // Add delay to ensure Kafka is fully ready
            await new Promise(resolve => setTimeout(resolve, 7000));
            
            this.logger.debug('🚀 Initializing Auction Completion Kafka Consumer...');
            
            await this.kafka.subscribe(
                kafkaTopics.AUCTION_COMPLETION,
                'auction-completion-processor',
                this.processAuctionCompletion.bind(this),
            );

            this.logger.debug('✅ Auction Completion Kafka Consumer initialized successfully');
        } catch (error) {
            this.logger.error('❌ Failed to initialize Auction Completion Kafka Consumer', {
                error: error.message,
            });
            throw error;
        }
    }

    private async processAuctionCompletion(payload: processAuctionCompletionPayload): Promise<void> {
        const startTime = Date.now();

        try {
            this.logger.debug('Processing auction completion', {
                auctionId: payload.key,
                partition: payload.partition,
            });

            const auctionData = payload.value;

            //   this.logger.debug('Auction Data payload', {
            //     auctionData,
            //   });

            //  Store auction log in database
            await this.storeAuctionLog(auctionData);

            // Use existing auction processor for analytics  --> Aski mit about this 
            // await this.auctionProcessor.processAuctionCompletion(auctionData);

            const processingTime = Date.now() - startTime;
            this.logger.debug('✅ Auction completion processed', {
                auctionId: auctionData.auctionId,
                processingTime: `${processingTime}ms`,
                hasWinner: !!auctionData.winner,
            });
        } catch (error) {
            this.logger.error('❌ Auction completion processing failed', {
                error: error.message,
                auctionId: payload.key,
                partition: payload.partition,
            });

            // Could implement retry logic or DLQ here
            throw error;
        }
    }

    private async storeAuctionLog(auctionData: AuctionCompletionData): Promise<void> {
        try {
            // Check if auction log already exists
            const existingLog = await this.prisma.auctionLog.findUnique({
                where: { bidRequestId: auctionData.bidRequest.id },
            });

            if (existingLog) {
                this.logger.warn('Auction log already exists, updating...', {
                    auctionId: auctionData.auctionId,
                    bidRequestId: auctionData.bidRequest.id,
                });
            }

            // Use upsert to handle duplicate messages gracefully
            await this.prisma.auctionLog.upsert({
                where: {
                    bidRequestId: auctionData.bidRequest.id,
                },
                update: {
                    // Update these fields if record already exists
                    auctionType: auctionData.auctionType,
                    floorPrice: auctionData.floorPrice,
                    winningBidId: auctionData.winner?.id,
                    finalPrice: auctionData.finalPrice,
                    totalBids: auctionData.totalBids,
                    validBids: auctionData.validBids,
                    auctionDuration: auctionData.processingTime,
                    status: auctionData.winner ? 'COMPLETED' : 'NO_BIDS',
                    completedAt: new Date(),
                },
                create: {
                    // Create new record if it doesn't exist
                    bidRequestId: auctionData.bidRequest.id,
                    auctionType: auctionData.auctionType,
                    floorPrice: auctionData.floorPrice,
                    winningBidId: auctionData.winner?.id,
                    finalPrice: auctionData.finalPrice,
                    totalBids: auctionData.totalBids,
                    validBids: auctionData.validBids,
                    auctionDuration: auctionData.processingTime,
                    status: auctionData.winner ? 'COMPLETED' : 'NO_BIDS',
                    startedAt: new Date(Date.now() - auctionData.processingTime),
                    completedAt: new Date(),
                },
            });

            this.logger.debug(existingLog ? 'Auction log updated successfully' : 'Auction log created successfully', {
                auctionId: auctionData.auctionId,
                status: auctionData.winner ? 'COMPLETED' : 'NO_BIDS',
                bidRequestId: auctionData.bidRequest.id,
            });
        } catch (error) {
            this.logger.error('Failed to store auction log', {
                error: error.message,
                auctionId: auctionData.auctionId,
            });
            throw error;
        }
    }
}