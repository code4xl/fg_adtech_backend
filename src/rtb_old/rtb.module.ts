// import { Module } from '@nestjs/common';
// import { PrismaModule } from '../prisma/prisma.module';
// import { RedisModule } from '../redis/redis.module';
// import { KafkaModule } from '../kafka/kafka.module';
// import { RTBController } from './controllers/rtb.controller';
// import { RTBService } from './services/rtb.service';
// import { CampaignEligibilityService } from './services/campaign-eligibility.service';
// import { AuctionService } from './services/auction.service';
// import { BidEvaluationService } from './services/bid-evalutation.service';
// import { RTBKafkaConsumer } from './consumers/rtb-kafka.consumer';
// import { AuctionProcessor } from './consumers/auction.consumer';
// import { RTBCacheService } from './services/rtb-cache.service';
// import { RTBMetricsService } from './services/rtb-metrics.service';
// import RTBProducer from './producer/rtb.producer';
// import { AuctionCompletionConsumer } from './consumers/auction-completion.consumer';
// import { BidRequestProcessor } from 'src/rtb/processors/bid-request.processor';
// import { BidResponseProcessor } from 'src/rtb/processors/bid-response.processor';

// @Module({
//   imports: [
//     PrismaModule,
//     RedisModule,
//     KafkaModule,
//     //  TimescaleModule
//   ],
//   controllers: [
//     RTBController,
//     // TrackingController
//   ],
//   providers: [
//     RTBService,
//     AuctionService,
//     BidEvaluationService,
//     CampaignEligibilityService,
//     // ImpressionTrackingService,
//     // ClickTrackingService,
//     BidRequestProcessor,
//     BidResponseProcessor,
//     // TrackingKafkaConsumer,
//     RTBKafkaConsumer,
//     AuctionProcessor,
//     RTBCacheService,
//     RTBMetricsService,
//     RTBProducer,
//     AuctionCompletionConsumer,
//     // TimescaleSyncConsumer,
//   ],
//   exports: [
//     RTBService,
//     AuctionService,
//     CampaignEligibilityService,
//     BidEvaluationService,
//     // ImpressionTrackingService,
//     // ClickTrackingService,
//     RTBCacheService,
//     RTBMetricsService,
//     RTBProducer,
//   ],
// })
// export class RTBModule { }
