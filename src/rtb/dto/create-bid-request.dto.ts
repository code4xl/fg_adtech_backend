import {
  IsString,
  IsOptional,
  IsObject,
  IsNumber,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBidRequestDto {
  @ApiProperty({ description: 'Unique request ID from SDK' })
  @IsString()
  externalRequestId: string;

  @ApiProperty({ description: 'Inventory ID for the ad slot' })
  @IsString()
  inventoryId: string;

  @ApiProperty({ description: 'Publisher ID' })
  @IsString()
  publisherId: string;

  @ApiProperty({ description: 'Website ID' })
  @IsString()
  websiteId: string;

  @ApiProperty({ description: 'User context data', required: false })
  @IsOptional()
  @IsObject()
  userContext?: {
    userId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    deviceType?: string;
    browserType?: string;
    osType?: string;
    country?: string;
    region?: string;
    city?: string;
  };

  @ApiProperty({ description: 'Ad slot context', required: false })
  @IsOptional()
  @IsObject()
  adSlotContext?: {
    width?: number;
    height?: number;
    position?: string;
    format?: string;
  };

  @ApiProperty({ description: 'Floor price for the auction', required: false })
  @IsOptional()
  @IsNumber()
  floorPrice?: number;

  @ApiProperty({
    description: 'Auction timeout in milliseconds',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  timeout?: number;
}
