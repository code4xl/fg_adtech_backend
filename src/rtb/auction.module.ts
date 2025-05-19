import { Module } from '@nestjs/common';
import { KafkaModule } from 'src/kafka/kafka.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RedisModule } from 'src/redis/redis.module';
import { AuctionResultService } from './auction-result.service';
import { AuctionService } from './auction.service';
import { BidCalculationService } from './bid-calculation.service';
import { BidRequestConsumerService } from './bid-request-consumer.service';
import { CampaignEligibilityService } from './campaign-eligibility.service';
import { AdMarkupService } from './ad-markup.service';
@Module({
  imports: [PrismaModule, KafkaModule, RedisModule],
  providers: [
    AuctionService,
    CampaignEligibilityService,
    AdMarkupService,
    BidCalculationService,
    AuctionResultService,
    BidRequestConsumerService,
  ],
  exports: [AuctionService],
})
export class AuctionModule {}
