// Create new file: src/rtb/consumers/auction-completion.consumer.ts

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { KafkaService } from '../../kafka/kafka.service';
import { kafkaTopics } from '../../kafka/constants/kafka.config';
import { AuctionProcessor } from './auction.consumer'; // Your existing auction consumer
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuctionCompletionConsumer implements OnModuleInit {
    private readonly logger = new Logger(AuctionCompletionConsumer.name);

    constructor(
        private readonly kafka: KafkaService,
        private readonly prisma: PrismaService,
        private readonly auctionProcessor: AuctionProcessor,
    ) {
        this.logger.log('Auction Completion Consumer initialized');
    }

    async onModuleInit() {
        try {
            this.logger.log('Subscribing to auction completion events...');

            await this.kafka.subscribe(
                kafkaTopics.AUCTION_COMPLETION,
                'auction-completion-processor',
                this.processAuctionCompletion.bind(this),
            );

            this.logger.log('✅ Subscribed to auction completion topic');
        } catch (error) {
            this.logger.error('❌ Failed to subscribe to auction completion', {
                error: error.message,
            });
            throw error;
        }
    }

    private async processAuctionCompletion(payload: {
        key: string;
        value: any;
        topic: string;
        partition: number;
        offset: string;
    }): Promise<void> {
        const startTime = Date.now();

        try {
            this.logger.debug('Processing auction completion', {
                auctionId: payload.key,
                partition: payload.partition,
            });

            const auctionData = payload.value;

            this.logger.debug("Auction Data payload", {
                auctionData,
            })

            // Store auction log in database
            await this.storeAuctionLog(auctionData);

            // Use existing auction processor for analytics
            // await this.auctionProcessor.processAuctionCompletion(auctionData);

            const processingTime = Date.now() - startTime;
            this.logger.log('✅ Auction completion processed', {
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

    private async storeAuctionLog(auctionData: any): Promise<void> {
        try {
            await this.prisma.auctionLog.create({
                data: {
                    bidRequestId: auctionData.requestId,
                    auctionType: auctionData.auctionType || 'SECOND_PRICE',
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

            this.logger.debug('Auction log stored in database successfully', {
                auctionId: auctionData.auctionId,
                status: auctionData.winner ? 'COMPLETED' : 'NO_BIDS',
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