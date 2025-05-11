import { Module } from '@nestjs/common';
import { BidRequestController } from './bid-request.controller';
import { BidRequestService } from './bid-request.service';
import { RtbEnrichmentService } from './rtb-enrichment.service';

@Module({
  controllers: [BidRequestController],
  providers: [BidRequestService, RtbEnrichmentService]
})
export class RtbModule {}
