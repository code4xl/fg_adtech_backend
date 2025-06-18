import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl, IsUUID } from 'class-validator';

/**
 * SSE Connection Response DTO
 * 
 * Response returned when establishing an SSE connection
 */
export class SSEConnectionResponseDto {
  @ApiProperty({
    description: 'Unique request identifier',
    example: 'b169383a-2369-4422-9094-bf0752ceed65'
  })
  @IsUUID()
  requestId: string;

  @ApiProperty({
    description: 'SSE stream URL for real-time updates',
    example: 'https://rtb.oceanads.com/rtb/stream/b169383a-2369-4422-9094-bf0752ceed65'
  })
  @IsUrl()
  sseUrl: string;

  @ApiProperty({
    description: 'Current status of the request',
    example: 'pending',
    enum: ['pending', 'processing', 'complete', 'error']
  })
  @IsString()
  status: string;

  @ApiProperty({
    description: 'Timestamp when request was created',
    example: '2024-01-15T10:30:00.000Z'
  })
  createdAt: string;

  @ApiProperty({
    description: 'Expected processing time in milliseconds',
    example: 250,
    required: false
  })
  expectedProcessingTime?: number;
}