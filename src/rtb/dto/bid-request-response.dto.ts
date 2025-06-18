import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsUrl, IsNumber } from 'class-validator';

/**
 * Bid Request Response DTO
 * 
 * Response returned immediately after receiving a bid request.
 * Now includes optional SSE URL for real-time updates.
 */
export class BidRequestResponseDto {
  @ApiProperty({
    description: 'Internal request ID for tracking',
    example: 'req_abc123_def456'
  })
  @IsString()
  requestId: string;

  @ApiProperty({
    description: 'Auction ID for internal tracking',
    example: 'b169383a-2369-4422-9094-bf0752ceed65'
  })
  @IsString()
  auctionId: string;

  @ApiProperty({
    description: 'Current processing status',
    example: 'processing',
    enum: ['processing', 'queued']
  })
  @IsEnum(['processing', 'queued'])
  status: string;

  @ApiProperty({
    description: 'Human-readable status message',
    example: 'Bid request accepted for processing'
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Estimated response time',
    example: '100ms'
  })
  @IsString()
  estimatedResponseTime: string;

  @ApiPropertyOptional({
    description: 'SSE stream URL for real-time updates (when SSE is enabled)',
    example: 'https://rtb.oceanads.com/rtb/stream/req_abc123_def456',
    required: false
  })
  @IsOptional()
  @IsUrl()
  sseUrl?: string;

  @ApiPropertyOptional({
    description: 'Whether SSE is available for this request',
    example: true,
    required: false
  })
  @IsOptional()
  sseEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Recommended timeout for SSE connection in milliseconds',
    example: 5000,
    required: false
  })
  @IsOptional()
  @IsNumber()
  sseTimeout?: number;
}