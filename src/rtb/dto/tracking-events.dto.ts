// src/rtb/dto/tracking-events.dto.ts
import {
    IsString,
    IsUUID,
    IsOptional,
    IsBoolean,
    IsNumber,
    IsArray,
    ValidateNested,
    IsUrl,
    IsIP,
    Min,
    Max,
    IsDateString
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Impression Event DTO
 * 
 * **Why this structure:**
 * - Captures all data needed for billing and performance analysis
 * - Includes viewability metrics for quality measurement
 * - Contains user context for fraud detection
 * - Supports real-time processing and batch operations
 */
export class ImpressionEventDto {
    @ApiProperty({
        description: 'Bid response ID for tracking the specific ad served',
        example: '550e8400-e29b-41d4-a716-446655440005'
    })
    @IsUUID()
    bidResponseId: string;

    @ApiPropertyOptional({
        description: 'User ID if available (cookie/device ID)',
        example: 'user_12345_device_abc'
    })
    @IsOptional()
    @IsString()
    userId?: string;

    @ApiPropertyOptional({
        description: 'Session ID for user session tracking',
        example: 'session_789xyz'
    })
    @IsOptional()
    @IsString()
    sessionId?: string;

    @ApiProperty({
        description: 'User agent string from browser',
        example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })
    @IsString()
    userAgent: string;

    @ApiProperty({
        description: 'IP address of the user',
        example: '192.168.1.100'
    })
    @IsIP()
    ipAddress: string;

    @ApiPropertyOptional({
        description: 'Device type detected',
        example: 'mobile'
    })
    @IsOptional()
    @IsString()
    deviceType?: string;

    @ApiPropertyOptional({
        description: 'Browser type detected',
        example: 'chrome'
    })
    @IsOptional()
    @IsString()
    browserType?: string;

    @ApiPropertyOptional({
        description: 'Operating system detected',
        example: 'windows'
    })
    @IsOptional()
    @IsString()
    osType?: string;

    @ApiPropertyOptional({
        description: 'Country code (ISO 3166-1 alpha-2)',
        example: 'IN'
    })
    @IsOptional()
    @IsString()
    country?: string;

    @ApiPropertyOptional({
        description: 'State or region',
        example: 'Maharashtra'
    })
    @IsOptional()
    @IsString()
    region?: string;

    @ApiPropertyOptional({
        description: 'City',
        example: 'Mumbai'
    })
    @IsOptional()
    @IsString()
    city?: string;

    @ApiPropertyOptional({
        description: 'Whether impression was viewable per IAB standards',
        example: true
    })
    @IsOptional()
    @IsBoolean()
    viewable?: boolean;

    @ApiPropertyOptional({
        description: 'Time ad was in view (milliseconds)',
        example: 2500
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    viewTime?: number;

    @ApiPropertyOptional({
        description: 'Number of pixels visible',
        example: 75000
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    viewablePixels?: number;

    @ApiPropertyOptional({
        description: 'Page URL where impression occurred',
        example: 'https://example.com/article/tech-news'
    })
    @IsOptional()
    @IsUrl()
    pageUrl?: string;

    @ApiPropertyOptional({
        description: 'Referrer URL',
        example: 'https://google.com/search'
    })
    @IsOptional()
    @IsUrl()
    referrerUrl?: string;

    @ApiPropertyOptional({
        description: 'Page category for contextual analysis',
        example: 'technology'
    })
    @IsOptional()
    @IsString()
    pageCategory?: string;

    @ApiPropertyOptional({
        description: 'Timestamp when impression occurred (ISO string)',
        example: '2025-06-09T12:30:00.000Z'
    })
    @IsOptional()
    @IsDateString()
    timestamp?: string;
}

/**
 * Click Event DTO
 * 
 * **Why this structure:**
 * - Links clicks to impressions for conversion tracking
 * - Captures click coordinates for heatmap analysis
 * - Includes landing page data for quality measurement
 * - Supports fraud detection through timing analysis
 */
export class ClickEventDto {
    @ApiProperty({
        description: 'Bid response ID for tracking',
        example: '550e8400-e29b-41d4-a716-446655440005'
    })
    @IsUUID()
    bidResponseId: string;

    @ApiProperty({
        description: 'Landing URL to redirect to',
        example: 'https://example.com/landing'
    })
    @IsUrl()
    landingUrl: string;

    @ApiPropertyOptional({
        description: 'Impression ID this click is associated with',
        example: '550e8400-e29b-41d4-a716-446655440006'
    })
    @IsOptional()
    @IsUUID()
    impressionId?: string;

    @ApiPropertyOptional({
        description: 'User ID if available',
        example: 'user_12345'
    })
    @IsOptional()
    @IsString()
    userId?: string;

    @ApiPropertyOptional({
        description: 'Session ID',
        example: 'session_789xyz'
    })
    @IsOptional()
    @IsString()
    sessionId?: string;

    @ApiProperty({
        description: 'User agent string',
        example: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)'
    })
    @IsString()
    userAgent: string;

    @ApiProperty({
        description: 'IP address',
        example: '192.168.1.100'
    })
    @IsIP()
    ipAddress: string;

    @ApiPropertyOptional({
        description: 'Device type',
        example: 'mobile'
    })
    @IsOptional()
    @IsString()
    deviceType?: string;

    @ApiPropertyOptional({
        description: 'Country',
        example: 'IN'
    })
    @IsOptional()
    @IsString()
    country?: string;

    @ApiPropertyOptional({
        description: 'X coordinate of click on ad',
        example: 150
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    clickX?: number;

    @ApiPropertyOptional({
        description: 'Y coordinate of click on ad',
        example: 75
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    clickY?: number;

    @ApiPropertyOptional({
        description: 'Area of ad that was clicked',
        example: 'center'
    })
    @IsOptional()
    @IsString()
    clickArea?: string;

    @ApiPropertyOptional({
        description: 'Page URL where click occurred',
        example: 'https://example.com/article'
    })
    @IsOptional()
    @IsUrl()
    pageUrl?: string;

    @ApiPropertyOptional({
        description: 'Referrer URL',
        example: 'https://google.com/search'
    })
    @IsOptional()
    @IsUrl()
    referrerUrl?: string;

    @ApiPropertyOptional({
        description: 'Timestamp when click occurred (ISO string)',
        example: '2025-06-09T12:31:00.000Z'
    })
    @IsOptional()
    @IsDateString()
    timestamp?: string;
}

/**
 * Batch Impression Events DTO
 * 
 * **Why batch processing:**
 * - Reduces API overhead for high-volume tracking
 * - Enables efficient database writes
 * - Supports SDK batching for performance
 */
export class BatchImpressionEventsDto {
    @ApiProperty({
        description: 'Array of impression events',
        type: [ImpressionEventDto],
        maxItems: 100
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ImpressionEventDto)
    events: ImpressionEventDto[];

    @ApiPropertyOptional({
        description: 'Batch metadata for processing',
        example: { source: 'sdk', version: '1.0.0' }
    })
    @IsOptional()
    metadata?: Record<string, any>;
}

/**
 * Batch Click Events DTO
 */
export class BatchClickEventsDto {
    @ApiProperty({
        description: 'Array of click events',
        type: [ClickEventDto],
        maxItems: 100
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ClickEventDto)
    events: ClickEventDto[];

    @ApiPropertyOptional({
        description: 'Batch metadata for processing',
        example: { source: 'sdk', version: '1.0.0' }
    })
    @IsOptional()
    metadata?: Record<string, any>;
}

/**
 * Tracking Response DTO
 * 
 * **Why structured response:**
 * - Provides confirmation of successful tracking
 * - Returns data needed by SDK for optimization
 * - Includes debugging information for development
 */
export class TrackingResponseDto {
    @ApiProperty({
        description: 'Tracking status',
        example: 'success',
        enum: ['success', 'error', 'duplicate', 'fraud_detected']
    })
    status: 'success' | 'error' | 'duplicate' | 'fraud_detected';

    @ApiProperty({
        description: 'Event ID for tracking',
        example: '550e8400-e29b-41d4-a716-446655440007'
    })
    eventId: string;

    @ApiPropertyOptional({
        description: 'Message for debugging',
        example: 'Impression tracked successfully'
    })
    @IsOptional()
    message?: string;

    @ApiPropertyOptional({
        description: 'Additional data for SDK',
        example: { nextAdRequest: 'allowed', cooldown: 0 }
    })
    @IsOptional()
    data?: Record<string, any>;

    @ApiProperty({
        description: 'Processing timestamp',
        example: '2025-06-09T12:30:00.000Z'
    })
    timestamp: string;
}

/**
 * Batch Tracking Response DTO
 */
export class BatchTrackingResponseDto {
    @ApiProperty({
        description: 'Overall batch status',
        example: 'partial_success'
    })
    status: 'success' | 'partial_success' | 'error';

    @ApiProperty({
        description: 'Number of successfully processed events',
        example: 95
    })
    processedCount: number;

    @ApiProperty({
        description: 'Number of failed events',
        example: 5
    })
    failedCount: number;

    @ApiProperty({
        description: 'Individual event results',
        type: [TrackingResponseDto]
    })
    results: TrackingResponseDto[];

    @ApiPropertyOptional({
        description: 'Batch processing summary',
        example: { totalTime: '150ms', avgProcessingTime: '1.5ms' }
    })
    @IsOptional()
    summary?: Record<string, any>;

    @ApiProperty({
        description: 'Batch processing timestamp',
        example: '2025-06-09T12:30:00.000Z'
    })
    timestamp: string;
}