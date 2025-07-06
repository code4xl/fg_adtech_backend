import {
  IsString,
  IsUUID,
  IsOptional,
  IsObject,
  IsNumber,
  IsEnum,
  IsArray,
  IsBoolean,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MetaDto {
  @ApiProperty({
    description: 'SDK version',
    example: '2.1',
  })
  @IsString()
  version: string;

  @ApiProperty({
    description: 'External request ID from SDK',
    example: 'req_12345_abcdef',
  })
  @IsString()
  requestId: string;

  @ApiProperty({
    description: 'Publisher ID who owns the inventory',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  publisherId: string;

  @ApiProperty({
    description: 'Website ID where ad will be displayed',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsUUID()
  websiteId: string;

  @ApiProperty({
    description: 'Request timestamp',
    example: 1751827114945,
  })
  @IsNumber()
  timestamp: number;
}

export class SlotDto {
  @ApiProperty({
    description: 'Inventory ID where ad will be displayed',
    example: 'b169383a-2369-4422-9094-bf0752ceed65',
  })
  @IsUUID()
  inventoryId: string;

  @ApiProperty({
    description: 'Element ID for the ad slot',
    example: 'ocean_stwzw98m',
  })
  @IsString()
  elementId: string;

  @ApiProperty({
    description: 'Website ID where ad will be displayed',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsUUID()
  websiteId: string;

  @ApiProperty({
    description: 'Refresh configuration',
    type: 'object',
    additionalProperties: false,
  })
  @IsObject()
  refresh: {
    enabled: boolean;
    count: number;
  };
}

export class DeviceContextDto {
  @ApiProperty({
    description: 'User agent string from browser',
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  })
  @IsString()
  userAgent: string;

  @ApiProperty({
    description: 'Device type',
    example: 'desktop',
  })
  @IsString()
  type: string;

  @ApiPropertyOptional({
    description: 'Operating system',
    example: 'windows',
  })
  @IsOptional()
  @IsString()
  os?: string;

  @ApiPropertyOptional({
    description: 'OS version',
    example: '10',
  })
  @IsOptional()
  @IsString()
  osVersion?: string;

  @ApiPropertyOptional({
    description: 'Browser type',
    example: 'chrome',
  })
  @IsOptional()
  @IsString()
  browser?: string;

  @ApiPropertyOptional({
    description: 'Browser version',
    example: '138',
  })
  @IsOptional()
  @IsString()
  browserVersion?: string;

  @ApiPropertyOptional({
    description: 'Screen information',
    type: 'object',
    additionalProperties: false,
  })
  @IsOptional()
  @IsObject()
  screen?: {
    width: number;
    height: number;
    pixelRatio: number;
  };

  @ApiPropertyOptional({
    description: 'Viewport information',
    type: 'object',
    additionalProperties: false,
  })
  @IsOptional()
  @IsObject()
  viewport?: {
    width: number;
    height: number;
  };

  @ApiPropertyOptional({
    description: 'Connection type',
    example: '4g',
  })
  @IsOptional()
  @IsString()
  connection?: string;
}

export class GeoContextDto {
  @ApiPropertyOptional({
    description: 'Timezone',
    example: 'Asia/Calcutta',
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Timezone offset in minutes',
    example: -330,
  })
  @IsOptional()
  @IsNumber()
  timezoneOffset?: number;
}

export class PageContextDto {
  @ApiProperty({
    description: 'Page URL',
    example: 'http://127.0.0.1:5501/ocean-ads-test-fixed.html',
  })
  @IsString()
  url: string;

  @ApiPropertyOptional({
    description: 'Page title',
    example: 'Ocean Ads RTB Test',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Referrer URL',
    example: 'http://127.0.0.1:5501/ocean-ads-test-fixed.html',
  })
  @IsOptional()
  @IsString()
  referrer?: string;

  @ApiPropertyOptional({
    description: 'Page depth',
    example: 2,
  })
  @IsOptional()
  @IsNumber()
  depth?: number;
}

export class SdkUserContextDto {
  @ApiProperty({
    description: 'Session ID',
    example: 'sess_d5m3yr3wg235',
  })
  @IsString()
  sessionId: string;

  @ApiProperty({
    description: 'Is new session',
    example: false,
  })
  @IsBoolean()
  isNewSession: boolean;

  @ApiProperty({
    description: 'Time on site in seconds',
    example: 103,
  })
  @IsNumber()
  timeOnSite: number;

  @ApiProperty({
    description: 'Time on page in seconds',
    example: 0,
  })
  @IsNumber()
  timeOnPage: number;

  @ApiProperty({
    description: 'Scroll depth (0-1)',
    example: 1,
  })
  @IsNumber()
  scrollDepth: number;

  @ApiProperty({
    description: 'Total scroll distance',
    example: 1734,
  })
  @IsNumber()
  totalScrollDistance: number;

  @ApiProperty({
    description: 'Engagement time in seconds',
    example: 0,
  })
  @IsNumber()
  engagementTime: number;

  @ApiProperty({
    description: 'Last interaction timestamp',
    example: 0,
  })
  @IsNumber()
  lastInteraction: number;
}

export class PerformanceContextDto {
  @ApiProperty({
    description: 'Page load time in milliseconds',
    example: 652,
  })
  @IsNumber()
  pageLoadTime: number;

  @ApiProperty({
    description: 'DOM ready time in milliseconds',
    example: 633,
  })
  @IsNumber()
  domReady: number;

  @ApiProperty({
    description: 'Connection speed',
    example: 'fast',
  })
  @IsString()
  connectionSpeed: string;
}

export class ContextDto {
  @ApiProperty({
    description: 'Device context',
    type: DeviceContextDto,
  })
  @ValidateNested()
  @Type(() => DeviceContextDto)
  device: DeviceContextDto;

  @ApiProperty({
    description: 'Geographic context',
    type: GeoContextDto,
  })
  @ValidateNested()
  @Type(() => GeoContextDto)
  geo: GeoContextDto;

  @ApiProperty({
    description: 'Page context',
    type: PageContextDto,
  })
  @ValidateNested()
  @Type(() => PageContextDto)
  page: PageContextDto;

  @ApiProperty({
    description: 'User context',
    type: SdkUserContextDto,
  })
  @ValidateNested()
  @Type(() => SdkUserContextDto)
  user: SdkUserContextDto;

  @ApiProperty({
    description: 'Performance context',
    type: PerformanceContextDto,
  })
  @ValidateNested()
  @Type(() => PerformanceContextDto)
  performance: PerformanceContextDto;
}

export class CapabilitiesDto {
  @ApiProperty({
    description: 'Cookies enabled',
    example: true,
  })
  @IsBoolean()
  cookiesEnabled: boolean;

  @ApiProperty({
    description: 'Do not track setting',
    example: false,
  })
  @IsBoolean()
  doNotTrack: boolean;

  @ApiProperty({
    description: 'Ad blocker detected',
    example: false,
  })
  @IsBoolean()
  adBlocker: boolean;
}

/**
 * SDK Bid Request DTO
 *
 * DTO for incoming bid requests from the SDK in the new format.
 * This matches the SDK's payload structure with meta, slots, context, and capabilities.
 */
export class SdkBidRequestDto {
  @ApiProperty({
    description: 'Request metadata',
    type: MetaDto,
  })
  @ValidateNested()
  @Type(() => MetaDto)
  meta: MetaDto;

  @ApiProperty({
    description: 'Ad slots to request bids for',
    type: [SlotDto],
  })
  @ValidateNested({ each: true })
  @Type(() => SlotDto)
  @IsArray()
  slots: SlotDto[];

  @ApiProperty({
    description: 'Request context data',
    type: ContextDto,
  })
  @ValidateNested()
  @Type(() => ContextDto)
  context: ContextDto;

  @ApiProperty({
    description: 'Browser capabilities',
    type: CapabilitiesDto,
  })
  @ValidateNested()
  @Type(() => CapabilitiesDto)
  capabilities: CapabilitiesDto;
} 