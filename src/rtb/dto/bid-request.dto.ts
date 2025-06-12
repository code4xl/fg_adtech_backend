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
import {
  AuctionType,
  DeviceType,
  InventoryFormat,
  InventoryPosition,
} from '@prisma/client';

export class UserContextDto {
  @ApiPropertyOptional({
    description: 'User ID from cookie or device ID',
    example: 'user_12345_device_abc',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Session ID for user session tracking',
    example: 'session_789xyz',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;

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

  @ApiPropertyOptional({
    description: 'Additional user data for targeting',
    example: { interests: ['tech', 'sports'], ageGroup: '25-34' },
  })
  @IsOptional()
  @IsObject()
  additionalData?: Record<string, any>;
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

  @ApiPropertyOptional({
    description: 'Page category for contextual targeting',
    example: 'technology',
  })
  @IsOptional()
  @IsString()
  pageCategory?: string;

  @ApiPropertyOptional({
    description: 'Referrer URL',
    example: 'https://google.com/search',
  })
  @IsOptional()
  @IsString()
  referrerUrl?: string;

  @ApiPropertyOptional({
    description: 'Page keywords for contextual targeting',
    example: ['technology', 'innovation', 'AI'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pageKeywords?: string[];
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
    example: '550e8400-e29b-41d4-a716-446655440000',
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

  @ApiPropertyOptional({
    description: 'Floor price for the auction (minimum bid)',
    example: 0.5,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  floorPrice?: number;

  @ApiPropertyOptional({
    description: 'Auction type preference',
    example: AuctionType.SECOND_PRICE,
    enum: AuctionType,
    default: AuctionType.SECOND_PRICE,
  })
  @IsOptional()
  @IsEnum(AuctionType)
  auctionType?: AuctionType;

  @ApiPropertyOptional({
    description: 'Timeout for auction in milliseconds',
    example: 200,
    minimum: 50,
    maximum: 1000,
  })
  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(1000)
  timeout?: number;
}
