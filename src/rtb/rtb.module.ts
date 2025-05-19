import { Module } from '@nestjs/common';
import { BidRequestController } from './bid-request.controller';
import { BidRequestService } from './bid-request.service';
import { RtbEnrichmentService } from './rtb-enrichment.service';
import { PrismaModule } from 'src/prisma/prisma.module';

import { KafkaModule } from 'src/kafka/kafka.module';
import { AdMarkupService } from './ad-markup.service';
import { BidResponseConsumerService } from './bid-response-consumer.service';
import { BidResponseController } from './bid-response.controller';
import { BidResponseService } from './bid-response.service';
import { TrackingController } from './tracking.controller';
import { RedisModule } from 'src/redis/redis.module';
import { AuctionModule } from './auction.module';
import { TrackingConsumerService } from './tracking-consumer.service';
import { DailyAggregationService } from './daily-aggregation.service';

@Module({
  imports: [PrismaModule, KafkaModule, AuctionModule, RedisModule],
  controllers: [
    BidRequestController,
    BidResponseController,
    TrackingController,
  ],
  providers: [
    BidRequestService,
    RtbEnrichmentService,
    AdMarkupService,
    BidResponseService,
    BidResponseConsumerService,
    TrackingConsumerService,
    // DailyAggregationService,
  ],
})
export class RtbModule {}
