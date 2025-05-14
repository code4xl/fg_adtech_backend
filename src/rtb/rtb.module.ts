import { Module } from '@nestjs/common';
import { BidRequestController } from './bid-request.controller';
import { BidRequestService } from './bid-request.service';
import { RtbEnrichmentService } from './rtb-enrichment.service';
import { PrismaModule } from 'src/prisma/prisma.module';

import { KafkaModule } from 'src/kafka/kafka.module';

@Module({
  imports: [PrismaModule, KafkaModule],
  controllers: [BidRequestController],
  providers: [BidRequestService, RtbEnrichmentService],
})
export class RtbModule {}
