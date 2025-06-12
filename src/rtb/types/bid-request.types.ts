import { Decimal } from '@prisma/client/runtime/library';
import { CreateBidRequestDto } from '../dto';

export interface ProcessBidRequestResponse {
  requestId: string;
  auctionId: string;
  status: 'processing' | 'failed' | 'completed';
}

export interface ServerContext {
  processedAt: string;
  version: string;
  requestId: string;
}

export interface EnrichedBidRequest extends CreateBidRequestDto {
  id: string;
  requestTimestamp: Date;
  serverContext: ServerContext;
}

export interface StoredBidRequest {
  id: string;
  externalRequestId: string;
  inventoryId: string;
  publisherId: string;
  websiteId: string;
  userContext: any;
  adSlotContext: any;
  floorPrice: number;
  auctionType: 'FIRST_PRICE' | 'SECOND_PRICE';
  timeout: number;
  requestTimestamp: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BidRequestWithAuction extends StoredBidRequest {
  auctionId: string;
}

export interface ProcessingMetrics {
  requestId: string;
  processingTime: number;
  status: 'success' | 'error';
  timestamp: Date;
}
