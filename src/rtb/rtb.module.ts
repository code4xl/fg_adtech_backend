import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { KafkaModule } from '../kafka/kafka.module';
import { RTBController } from './controllers/rtb.controller';
import { CampaignEligibilityService } from './services/campaign-eligibility.service';
import { AuctionService } from './services/auction.service';
import { BidRequestProcessor } from 'src/rtb/processors/bid-request.processor';
import { BidResponseProcessor } from 'src/rtb/processors/bid-response.processor';
import { AuctionCompletionConsumer } from 'src/rtb_old/consumers/auction-completion.consumer';
import { AuctionProcessor } from 'src/rtb_old/consumers/auction.consumer';
import { RTBKafkaConsumer } from 'src/rtb_old/consumers/rtb-kafka.consumer';
import RTBProducer from 'src/rtb_old/producer/rtb.producer';
import { RTBCacheService } from 'src/rtb_old/services/rtb-cache.service';
import { RTBMetricsService } from 'src/rtb_old/services/rtb-metrics.service';
import { RTBService } from 'src/rtb_old/services/rtb.service';
import { BidEvaluationService } from './services/bid-evaluation.service';

@Module({
    imports: [
        PrismaModule,
        RedisModule,
        KafkaModule,
        //  TimescaleModule
    ],
    controllers: [
        RTBController,
        // TrackingController
    ],
    providers: [
        RTBService,
        AuctionService,
        BidEvaluationService,
        CampaignEligibilityService,
        // ImpressionTrackingService,
        // ClickTrackingService,
        BidRequestProcessor,
        BidResponseProcessor,
        // TrackingKafkaConsumer,
        RTBKafkaConsumer,
        AuctionProcessor,
        RTBCacheService,
        RTBMetricsService,
        RTBProducer,
        AuctionCompletionConsumer,
        // TimescaleSyncConsumer,
    ],
    exports: [
        RTBService,
        AuctionService,
        CampaignEligibilityService,
        BidEvaluationService,
        // ImpressionTrackingService,
        // ClickTrackingService,
        RTBCacheService,
        RTBMetricsService,
        RTBProducer,
    ],
})
export class RTBModule { }
