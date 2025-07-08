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
import {
  AuctionType,
  DeviceType,
  InventoryFormat,
  InventoryPosition,
} from '@prisma/client';

export class UserContextDto {
  @ApiProperty({
    description: 'User ID from cookie or device ID',
    example: 'user_12345_device_abc',
  })
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'Session ID for user session tracking',
    example: 'session_789xyz',
  })
  @IsString()
  sessionId: string;

  @ApiProperty({
    description: 'User agent string from browser',
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  })
  @IsString()
  userAgent: string;

  @ApiProperty({
    description: 'IP address of the user',
    example: '192.168.1.100',
  })
  @IsString()
  ipAddress: string;

  @ApiPropertyOptional({
    description: 'Device type',
    example: DeviceType.MOBILE,
    enum: DeviceType,
  })
  @IsOptional()
  @IsEnum(DeviceType)
  deviceType?: string;

  @ApiPropertyOptional({
    description: 'Browser type',
    example: 'chrome',
  })
  @IsOptional()
  @IsString()
  browserType?: string;

  @ApiPropertyOptional({
    description: 'Operating system',
    example: 'windows',
  })
  @IsOptional()
  @IsString()
  osType?: string;

  @ApiPropertyOptional({
    description: 'Country code (ISO 3166-1 alpha-2)',
    example: 'IN',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'State or region',
    example: 'Maharashtra',
  })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({
    description: 'City',
    example: 'Mumbai',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({
    description: 'Additional user data for targeting',
    example: { interests: ['tech', 'sports'], ageGroup: '25-34' },
  })
  @IsObject()
  additionalData: Record<string, any>;
}

export class AdSlotContextDto {
  @ApiProperty({
    description: 'Ad slot width in pixels',
    example: 300,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  width: number;

  @ApiProperty({
    description: 'Ad slot height in pixels',
    example: 250,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  height: number;

  @ApiProperty({
    description: 'Ad format type',
    example: InventoryFormat.BANNER,
    enum: InventoryFormat,
  })
  @IsEnum(InventoryFormat)
  format: string;

  @ApiProperty({
    description: 'Ad position on page',
    example: InventoryPosition.ABOVE_FOLD,
    enum: InventoryPosition,
  })
  @IsEnum(InventoryPosition)
  position: string;

  @ApiPropertyOptional({
    description: 'Page URL where ad will be displayed',
    example: 'https://example.com/article/tech-news',
  })
  @IsOptional()
  @IsString()
  pageUrl?: string;

  @ApiProperty({
    description: 'Page category for contextual targeting',
    example: 'technology',
  })
  @IsString()
  pageCategory: string;

  @ApiPropertyOptional({
    description: 'Referrer URL',
    example: 'https://google.com/search',
  })
  @IsOptional()
  @IsString()
  referrerUrl?: string;

  @ApiProperty({
    description: 'Page keywords for contextual targeting',
    example: ['technology', 'innovation', 'AI'],
  })
  @IsArray()
  @IsString({ each: true })
  pageKeywords: string[];
}

/**
 * Create Bid Request DTO
 *
 * Main DTO for incoming bid requests from the SDK.
 * This is the primary input for RTB processing.
 */
export class CreateBidRequestDto {
  @ApiProperty({
    description: 'External request ID from SDK',
    example: 'req_12345_abcdef',
  })
  @IsString()
  externalRequestId: string;

  @ApiProperty({
    description: 'Inventory ID where ad will be displayed',
    example: 'b169383a-2369-4422-9094-bf0752ceed65',
  })
  @IsUUID()
  inventoryId: string;

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
    description: 'User context data',
    type: UserContextDto,
  })
  @ValidateNested()
  @Type(() => UserContextDto)
  userContext: UserContextDto;

  @ApiProperty({
    description: 'Ad slot context data',
    type: AdSlotContextDto,
  })
  @ValidateNested()
  @Type(() => AdSlotContextDto)
  adSlotContext: AdSlotContextDto;

  @ApiProperty({
    description: 'Floor price for the auction (minimum bid)',
    example: 0.5,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  floorPrice: number;

  @ApiProperty({
    description: 'Auction type preference',
    example: AuctionType.SECOND_PRICE,
    enum: AuctionType,
    default: AuctionType.SECOND_PRICE,
  })
  @IsEnum(AuctionType)
  auctionType: AuctionType;

  @ApiProperty({
    description: 'Timeout for auction in milliseconds',
    example: 200,
    minimum: 50,
    maximum: 1000,
  })
  @IsNumber()
  @Min(50)
  @Max(1000)
  timeout: number;

  @ApiPropertyOptional({
    description: 'Enable Server-Sent Events (SSE) for real-time updates',
    example: true,
    default: false
  })
  @IsOptional()
  @IsBoolean()
  enableSSE?: boolean;

  @ApiPropertyOptional({
    description: 'SSE timeout override in milliseconds (max 10000)',
    example: 5000,
    minimum: 250,
    maximum: 10000
  })
  @IsOptional()
  @IsNumber()
  @Min(250)
  @Max(10000)
  sseTimeout?: number;

  @ApiPropertyOptional({
    description: 'Response mode preference',
    example: 'sse',
    enum: ['polling', 'sse'],
    default: 'polling'
  })
  @IsOptional()
  @IsEnum(['polling', 'sse'])
  responseMode?: 'polling' | 'sse';
}
