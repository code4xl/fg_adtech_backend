// src/rtb/dto/create-bid-request.dto.ts

import {
  IsString,
  IsNumber,
  IsOptional,
  IsObject,
  IsArray,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class AdSlotDto {
  @ApiProperty({ example: '728x90' })
  @IsString()
  size: string;

  @ApiProperty({ example: 'homepage-banner' })
  @IsString()
  slotId: string;

  @ApiProperty({ example: 'above_fold' })
  @IsString()
  position: string;

  @ApiProperty({ example: 'banner' })
  @IsString()
  format: string;
}

export class UserContextDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  deviceType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  browserType?: string;
}

export class TargetingDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  custom?: Record<string, any>;
}

export class CreateBidRequestDto {
  @ApiProperty({ example: 'pub-123-uuid' })
  @IsString()
  publisherId: string;

  @ApiProperty({ example: 'inv-456-uuid' })
  @IsString()
  inventoryId: string;

  @ApiProperty({ example: 'req_123456789' })
  @IsString()
  requestId: string;

  @ApiProperty({ type: AdSlotDto })
  @ValidateNested()
  @Type(() => AdSlotDto)
  adSlot: AdSlotDto;

  @ApiProperty({ type: UserContextDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => UserContextDto)
  userContext?: UserContextDto;

  @ApiProperty({ type: TargetingDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => TargetingDto)
  targeting?: TargetingDto;

  @ApiProperty({ required: false, example: 1.5 })
  @IsOptional()
  @IsNumber()
  floor?: number;

  @ApiProperty({ required: false, example: 200 })
  @IsOptional()
  @IsNumber()
  timeout?: number;

  @ApiProperty({ required: false, example: 'https://publisher.com/page' })
  @IsOptional()
  @IsString()
  pageUrl?: string;

  @ApiProperty({ required: false, example: 'https://referrer.com' })
  @IsOptional()
  @IsString()
  referrer?: string;
}
