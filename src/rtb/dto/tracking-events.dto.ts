// src/rtb/dto/tracking-events.dto.ts - UPDATE for TimescaleDB
import { IsUUID, IsOptional, IsString, IsNumber, IsBoolean, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Phase 6: NEW - TimescaleDB-specific DTOs
export class TimescaleImpressionDto {
    @ApiProperty({ description: 'Event timestamp' })
    @IsDateString()
    timestamp: string;

    @ApiProperty({ description: 'Impression event ID' })
    @IsUUID()
    impression_id: string;

    @ApiProperty({ description: 'Creative ID' })
    @IsUUID()
    creative_id: string;

    @ApiProperty({ description: 'Campaign ID' })
    @IsUUID()
    campaign_id: string;

    @ApiProperty({ description: 'Advertiser ID' })
    @IsUUID()
    advertiser_id: string;

    @ApiProperty({ description: 'Inventory ID' })
    @IsUUID()
    inventory_id: string;

    @ApiProperty({ description: 'Publisher ID' })
    @IsUUID()
    publisher_id: string;

    @ApiProperty({ description: 'Website ID' })
    @IsUUID()
    website_id: string;

    @ApiPropertyOptional({ description: 'Bid price' })
    @IsOptional()
    @IsNumber()
    price?: number;

    @ApiPropertyOptional({ description: 'Publisher revenue' })
    @IsOptional()
    @IsNumber()
    publisher_revenue?: number;

    @ApiPropertyOptional({ description: 'User ID' })
    @IsOptional()
    @IsString()
    user_id?: string;

    @ApiPropertyOptional({ description: 'Session ID' })
    @IsOptional()
    @IsString()
    session_id?: string;

    @ApiPropertyOptional({ description: 'User agent' })
    @IsOptional()
    @IsString()
    user_agent?: string;

    @ApiPropertyOptional({ description: 'IP address' })
    @IsOptional()
    @IsString()
    ip_address?: string;

    @ApiPropertyOptional({ description: 'Device type' })
    @IsOptional()
    @IsString()
    device_type?: string;

    @ApiPropertyOptional({ description: 'Browser type' })
    @IsOptional()
    @IsString()
    browser_type?: string;

    @ApiPropertyOptional({ description: 'OS type' })
    @IsOptional()
    @IsString()
    os_type?: string;

    @ApiPropertyOptional({ description: 'Country' })
    @IsOptional()
    @IsString()
    country?: string;

    @ApiPropertyOptional({ description: 'Region' })
    @IsOptional()
    @IsString()
    region?: string;

    @ApiPropertyOptional({ description: 'City' })
    @IsOptional()
    @IsString()
    city?: string;

    @ApiPropertyOptional({ description: 'Is viewable' })
    @IsOptional()
    @IsBoolean()
    viewable?: boolean;

    @ApiPropertyOptional({ description: 'View time in milliseconds' })
    @IsOptional()
    @IsNumber()
    view_time?: number;

    @ApiPropertyOptional({ description: 'Viewable pixels' })
    @IsOptional()
    @IsNumber()
    viewable_pixels?: number;

    @ApiPropertyOptional({ description: 'Ad size in pixels' })
    @IsOptional()
    @IsString()
    ad_size_pixels?: string;

    @ApiPropertyOptional({ description: 'Is bot traffic' })
    @IsOptional()
    @IsBoolean()
    is_bot?: boolean;

    @ApiPropertyOptional({ description: 'Fraud score' })
    @IsOptional()
    @IsNumber()
    fraud_score?: number;

    @ApiPropertyOptional({ description: 'Referrer URL' })
    @IsOptional()
    @IsString()
    referrer_url?: string;

    @ApiPropertyOptional({ description: 'Page URL' })
    @IsOptional()
    @IsString()
    page_url?: string;

    @ApiPropertyOptional({ description: 'Page category' })
    @IsOptional()
    @IsString()
    page_category?: string;
}

export class TimescaleClickDto {
    @ApiProperty({ description: 'Event timestamp' })
    @IsDateString()
    timestamp: string;

    @ApiProperty({ description: 'Click event ID' })
    @IsUUID()
    click_id: string;

    @ApiPropertyOptional({ description: 'Related impression ID' })
    @IsOptional()
    @IsUUID()
    impression_id?: string;

    @ApiProperty({ description: 'Creative ID' })
    @IsUUID()
    creative_id: string;

    @ApiProperty({ description: 'Campaign ID' })
    @IsUUID()
    campaign_id: string;

    @ApiProperty({ description: 'Advertiser ID' })
    @IsUUID()
    advertiser_id: string;

    @ApiProperty({ description: 'Inventory ID' })
    @IsUUID()
    inventory_id: string;

    @ApiProperty({ description: 'Publisher ID' })
    @IsUUID()
    publisher_id: string;

    @ApiPropertyOptional({ description: 'Click X coordinate' })
    @IsOptional()
    @IsNumber()
    click_x?: number;

    @ApiPropertyOptional({ description: 'Click Y coordinate' })
    @IsOptional()
    @IsNumber()
    click_y?: number;

    @ApiPropertyOptional({ description: 'Time from impression in milliseconds' })
    @IsOptional()
    @IsNumber()
    time_from_impression?: number;

    @ApiPropertyOptional({ description: 'User ID' })
    @IsOptional()
    @IsString()
    user_id?: string;

    @ApiPropertyOptional({ description: 'Session ID' })
    @IsOptional()
    @IsString()
    session_id?: string;

    @ApiPropertyOptional({ description: 'User agent' })
    @IsOptional()
    @IsString()
    user_agent?: string;

    @ApiPropertyOptional({ description: 'IP address' })
    @IsOptional()
    @IsString()
    ip_address?: string;

    @ApiPropertyOptional({ description: 'Device type' })
    @IsOptional()
    @IsString()
    device_type?: string;

    @ApiPropertyOptional({ description: 'Country' })
    @IsOptional()
    @IsString()
    country?: string;

    @ApiPropertyOptional({ description: 'Region' })
    @IsOptional()
    @IsString()
    region?: string;

    @ApiPropertyOptional({ description: 'City' })
    @IsOptional()
    @IsString()
    city?: string;

    @ApiPropertyOptional({ description: 'Is bot traffic' })
    @IsOptional()
    @IsBoolean()
    is_bot?: boolean;

    @ApiPropertyOptional({ description: 'Fraud score' })
    @IsOptional()
    @IsNumber()
    fraud_score?: number;
}

export class TimescaleBidMetricDto {
    @ApiProperty({ description: 'Event timestamp' })
    @IsDateString()
    timestamp: string;

    @ApiProperty({ description: 'Bid response ID' })
    @IsUUID()
    bid_response_id: string;

    @ApiProperty({ description: 'Campaign ID' })
    @IsUUID()
    campaign_id: string;

    @ApiProperty({ description: 'Inventory ID' })
    @IsUUID()
    inventory_id: string;

    @ApiPropertyOptional({ description: 'Bid price' })
    @IsOptional()
    @IsNumber()
    bid_price?: number;

    @ApiPropertyOptional({ description: 'Final price' })
    @IsOptional()
    @IsNumber()
    final_price?: number;

    @ApiPropertyOptional({ description: 'Bid won' })
    @IsOptional()
    @IsBoolean()
    won?: boolean;

    @ApiPropertyOptional({ description: 'Response time in milliseconds' })
    @IsOptional()
    @IsNumber()
    response_time_ms?: number;

    @ApiPropertyOptional({ description: 'Auction duration in milliseconds' })
    @IsOptional()
    @IsNumber()
    auction_duration_ms?: number;

    @ApiPropertyOptional({ description: 'Total bids' })
    @IsOptional()
    @IsNumber()
    total_bids?: number;

    @ApiPropertyOptional({ description: 'Valid bids' })
    @IsOptional()
    @IsNumber()
    valid_bids?: number;

    @ApiPropertyOptional({ description: 'Targeting score' })
    @IsOptional()
    @IsNumber()
    targeting_score?: number;

    @ApiPropertyOptional({ description: 'Quality score' })
    @IsOptional()
    @IsNumber()
    quality_score?: number;
}

// Batch DTOs for efficient bulk operations
export class BatchTimescaleImpressionDto {
    @ApiProperty({ type: [TimescaleImpressionDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TimescaleImpressionDto)
    impressions: TimescaleImpressionDto[];
}

export class BatchTimescaleClickDto {
    @ApiProperty({ type: [TimescaleClickDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TimescaleClickDto)
    clicks: TimescaleClickDto[];
}

export class BatchTimescaleBidMetricDto {
    @ApiProperty({ type: [TimescaleBidMetricDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TimescaleBidMetricDto)
    metrics: TimescaleBidMetricDto[];
}

// Keep existing DTOs for PostgreSQL operations
export * from './tracking-events.dto';