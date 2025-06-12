import {
  IsString,
  IsUUID,
  IsOptional,
  IsObject,
  IsNumber,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuctionMetricsDto {
  @ApiProperty({
    description: 'When auction processing started',
    example: '2025-06-09T12:29:59.905Z',
  })
  @IsString()
  processingStarted: string;

  @ApiProperty({
    description: 'Number of campaigns evaluated for eligibility',
    example: 25,
  })
  @IsNumber()
  eligibleCampaigns: number;

  @ApiProperty({
    description: 'Total bids generated',
    example: 12,
  })
  @IsNumber()
  totalBids: number;

  @ApiProperty({
    description: 'Total auction processing time',
    example: '95ms',
  })
  @IsString()
  auctionDuration: string;

  @ApiProperty({
    description: 'Cache hit rate for this auction',
    example: '85%',
  })
  @IsString()
  cacheHitRate: string;

  @ApiPropertyOptional({
    description: 'Average bid price received',
    example: 1.75,
  })
  @IsOptional()
  @IsNumber()
  averageBidPrice?: number;
}

export class AuctionWinnerDto {
  @ApiProperty({
    description: 'Campaign ID that won',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  @IsUUID()
  campaignId: string;

  @ApiProperty({
    description: 'Advertiser name',
    example: 'Tech Solutions Inc.',
  })
  @IsString()
  advertiserName: string;

  @ApiProperty({
    description: 'Original bid price',
    example: 2.5,
  })
  @IsNumber()
  bidPrice: number;

  @ApiProperty({
    description: 'Final price paid (may differ in second-price auction)',
    example: 2.3,
  })
  @IsNumber()
  finalPrice: number;

  @ApiProperty({
    description: 'Creative used for the winning bid',
    example: '550e8400-e29b-41d4-a716-446655440004',
  })
  @IsUUID()
  creativeId: string;
}

export class AuctionStatusDto {
  @ApiProperty({
    description: 'Request ID',
    example: 'req_12345_abcdef',
  })
  @IsString()
  requestId: string;

  @ApiProperty({
    description: 'Current auction status',
    example: 'completed',
    enum: ['processing', 'completed', 'no_bids', 'timeout', 'error'],
  })
  @IsEnum(['processing', 'completed', 'no_bids', 'timeout', 'error'])
  status: string;

  @ApiProperty({
    description: 'Current processing stage',
    example: 'auction_complete',
    enum: [
      'received',
      'eligibility_check',
      'bid_generation',
      'auction_running',
      'auction_complete',
      'response_generated',
    ],
  })
  @IsEnum([
    'received',
    'eligibility_check',
    'bid_generation',
    'auction_running',
    'auction_complete',
    'response_generated',
  ])
  stage: string;

  @ApiProperty({
    description: 'Auction processing metrics',
    type: AuctionMetricsDto,
  })
  @ValidateNested()
  @Type(() => AuctionMetricsDto)
  metrics: AuctionMetricsDto;

  @ApiPropertyOptional({
    description: 'Winner information if auction completed',
    type: AuctionWinnerDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AuctionWinnerDto)
  winner?: AuctionWinnerDto;

  @ApiPropertyOptional({
    description: 'Error message if auction failed',
    example: 'Timeout waiting for bids',
  })
  @IsOptional()
  @IsString()
  errorMessage?: string;
}
