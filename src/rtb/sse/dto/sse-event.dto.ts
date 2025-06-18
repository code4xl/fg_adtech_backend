import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { 
  IsString, 
  IsNumber, 
  IsOptional, 
  IsArray, 
  ValidateNested,
  IsUUID,
  Min,
  Max,
  IsEnum
} from 'class-validator';
import { SSEEventType, SSEStatusType, SSE_EVENTS, SSE_STATUS } from '../constants/sse.constants';

/**
 * Bid Update Event Data
 */
export class BidUpdateDataDto {
  @ApiProperty({
    description: 'Current status of bid processing',
    example: 'processing',
    enum: Object.values(SSE_STATUS)
  })
  @IsEnum(SSE_STATUS)
  status: SSEStatusType;

  @ApiProperty({
    description: 'Processing progress (0-1)',
    example: 0.5,
    minimum: 0,
    maximum: 1
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  progress: number;

  @ApiPropertyOptional({
    description: 'Additional status message',
    example: 'Evaluating 5 eligible campaigns'
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({
    description: 'Number of campaigns being evaluated',
    example: 5
  })
  @IsOptional()
  @IsNumber()
  campaignsEvaluated?: number;

  @ApiPropertyOptional({
    description: 'Current processing step',
    example: 'campaign_eligibility'
  })
  @IsOptional()
  @IsString()
  currentStep?: string;
}

/**
 * Slot Result for Bid Complete Event
 */
export class SlotResultDto {
  @ApiProperty({
    description: 'Inventory ID for the slot',
    example: 'b169383a-2369-4422-9094-bf0752ceed65'
  })
  @IsUUID()
  inventoryId: string;

  @ApiProperty({
    description: 'Slot fill status',
    example: 'filled',
    enum: ['filled', 'unfilled', 'error']
  })
  @IsString()
  status: string;

  @ApiPropertyOptional({
    description: 'Winning bid information'
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BidInfoDto)
  bid?: BidInfoDto;

  @ApiPropertyOptional({
    description: 'Creative information'
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreativeInfoDto)
  creative?: CreativeInfoDto;

  @ApiPropertyOptional({
    description: 'Error message if slot failed',
    example: 'No eligible campaigns found'
  })
  @IsOptional()
  @IsString()
  error?: string;
}

/**
 * Bid Information
 */
export class BidInfoDto {
  @ApiProperty({
    description: 'Campaign ID',
    example: '550e8400-e29b-41d4-a716-446655440001'
  })
  @IsUUID()
  campaignId: string;

  @ApiProperty({
    description: 'Bid price',
    example: 2.50
  })
  @IsNumber()
  price: number;

  @ApiProperty({
    description: 'Currency',
    example: 'USD'
  })
  @IsString()
  currency: string;

  @ApiPropertyOptional({
    description: 'CPM value',
    example: 2.50
  })
  @IsOptional()
  @IsNumber()
  cpm?: number;
}

/**
 * Creative Information
 */
export class CreativeInfoDto {
  @ApiProperty({
    description: 'Creative ID',
    example: '550e8400-e29b-41d4-a716-446655440002'
  })
  @IsUUID()
  creativeId: string;

  @ApiProperty({
    description: 'Ad markup HTML',
    example: '<div>Ad content</div>'
  })
  @IsString()
  adMarkup: string;

  @ApiPropertyOptional({
    description: 'Creative dimensions',
    example: { width: 300, height: 250 }
  })
  @IsOptional()
  dimensions?: {
    width: number;
    height: number;
  };

  @ApiPropertyOptional({
    description: 'Impression tracking URLs',
    example: ['https://track.oceanads.com/i/123']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  impressionUrls?: string[];

  @ApiPropertyOptional({
    description: 'Click tracking URLs',
    example: ['https://track.oceanads.com/c/123']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  clickUrls?: string[];
}

/**
 * Bid Complete Event Data
 */
export class BidCompleteDataDto {
  @ApiProperty({
    description: 'Final status',
    example: 'complete',
    enum: ['complete', 'partial', 'timeout', 'error']
  })
  @IsString()
  status: string;

  @ApiProperty({
    description: 'Slot results',
    type: [SlotResultDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SlotResultDto)
  slots: SlotResultDto[];

  @ApiPropertyOptional({
    description: 'Total processing time in milliseconds',
    example: 245
  })
  @IsOptional()
  @IsNumber()
  processingTime?: number;

  @ApiPropertyOptional({
    description: 'Auction statistics'
  })
  @IsOptional()
  auctionStats?: {
    totalBids: number;
    validBids: number;
    auctionType: string;
    timestamp: string;
  };
}

/**
 * Error Event Data
 */
export class ErrorEventDataDto {
  @ApiProperty({
    description: 'Error code',
    example: 'TIMEOUT_ERROR'
  })
  @IsString()
  code: string;

  @ApiProperty({
    description: 'Error message',
    example: 'Request processing exceeded timeout'
  })
  @IsString()
  message: string;

  @ApiPropertyOptional({
    description: 'Additional error details'
  })
  @IsOptional()
  details?: any;
}

/**
 * SSE Event DTO
 * 
 * Main event structure sent through SSE stream
 */
export class SSEEventDto {
  @ApiProperty({
    description: 'Event type',
    example: 'bid_update',
    enum: Object.values(SSE_EVENTS)
  })
  @IsEnum(SSE_EVENTS)
  type: SSEEventType;

  @ApiProperty({
    description: 'Request ID',
    example: 'b169383a-2369-4422-9094-bf0752ceed65'
  })
  @IsUUID()
  requestId: string;

  @ApiProperty({
    description: 'Event timestamp',
    example: '2024-01-15T10:30:00.123Z'
  })
  @IsString()
  timestamp: string;

  @ApiProperty({
    description: 'Event data (varies by event type)'
  })
  data: BidUpdateDataDto | BidCompleteDataDto | ErrorEventDataDto | any;

  @ApiPropertyOptional({
    description: 'Event sequence number',
    example: 1
  })
  @IsOptional()
  @IsNumber()
  sequence?: number;
}