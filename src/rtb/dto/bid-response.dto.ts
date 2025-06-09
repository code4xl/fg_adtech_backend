import { ApiProperty } from '@nestjs/swagger';

export class BidResponseDto {
  @ApiProperty({ description: 'Bid request ID' })
  bidRequestId: string;

  @ApiProperty({ description: 'Campaign ID that won' })
  campaignId?: string;

  @ApiProperty({ description: 'Creative ID to display' })
  creativeId?: string;

  @ApiProperty({ description: 'Winning bid price' })
  bidPrice?: number;

  @ApiProperty({ description: 'Ad markup HTML' })
  adMarkup?: string;

  @ApiProperty({ description: 'Impression tracking URLs' })
  impressionUrls?: string[];

  @ApiProperty({ description: 'Click tracking URLs' })
  clickUrls?: string[];

  @ApiProperty({ description: 'Whether there are bids' })
  hasBids: boolean;

  @ApiProperty({ description: 'Processing time in milliseconds' })
  processingTime: number;
}
