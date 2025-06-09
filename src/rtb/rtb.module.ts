// src/rtb/rtb.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { KafkaModule } from '../kafka/kafka.module';
import { RedisModule } from '../redis/redis.module';
import { BidRequestConsumer } from './consumer/bid-request.consumer';
import { BidRequestController } from './controllers/bid-request.controller';
import { AuctionService } from './services/auction.service';
import { BidCalculationService } from './services/bid-calculation.service';
import { BidRequestService } from './services/bid-request.service';
import { CampaignEligibilityService } from './services/campaign-eligibility.service';
import { CreativePerformanceService } from './services/creative-performance.service';

@Module({
  imports: [PrismaModule, KafkaModule, RedisModule],
  controllers: [BidRequestController],
  providers: [
    BidRequestService,
    CampaignEligibilityService,
    AuctionService,
    BidCalculationService,
    CreativePerformanceService,
    BidRequestConsumer,
  ],
  exports: [BidRequestService, CampaignEligibilityService, AuctionService],
})
export class RtbModule {}
