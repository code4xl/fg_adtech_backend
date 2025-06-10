// src/publishers/dto/floor-price.dto.ts

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsUUID,
  IsDecimal,
  IsString,
  IsDateString,
  IsOptional,
  IsObject,
  ValidateNested,
  IsNotEmpty,
  Min,
  IsEnum,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { Decimal } from '@prisma/client/runtime/library';
import { Currency } from '@prisma/client';

export class CreateFloorPriceDto {
  @ApiProperty({
    description: 'Base price for the floor price rule',
    example: '2.50',
    type: 'string',
  })
  @IsNotEmpty()
  @Transform(({ value }) => new Decimal(value))
  basePrice: Decimal;

  @ApiPropertyOptional({
    description: 'Currency code',
    example: 'USD',
    default: 'USD',
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: string = Currency.INR;
  @ApiProperty({
    description: 'Inventory ID/Slot Id to which the floor price rule applies',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsNotEmpty()
  @IsString()
  @IsUUID('4')
  inventoryId: string;
  @ApiProperty({
    description: 'Publisher ID for the website',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsNotEmpty()
  @IsString()
  @IsUUID('4')
  publisherId: string;
  @ApiProperty({
    description: 'Website ID for the ad slot',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsNotEmpty()
  @IsString()
  @IsUUID('4')
  websiteId: string;
  @ApiProperty({
    description: 'Start date for the floor price rule',
    example: '2025-06-01T00:00:00Z',
  })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({
    description: 'End date for the floor price rule',
    example: '2025-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class FloorPriceResponseDto {
  @ApiProperty({
    description: 'Floor price ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  id: string;

  @ApiProperty({
    description: 'Inventory ID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  inventoryId: string;

  @ApiProperty({
    description: 'Base price for the floor price rule',
    example: '2.50',
    type: 'string',
  })
  basePrice: string;

  @ApiProperty({
    description: 'Currency code',
    example: 'USD',
  })
  currency: string;

  @ApiProperty({
    description: 'Start date for the floor price rule',
    example: '2025-06-01T00:00:00Z',
  })
  startDate: Date;

  @ApiPropertyOptional({
    description: 'End date for the floor price rule',
    example: '2025-12-31T23:59:59Z',
  })
  endDate?: Date;

  @ApiPropertyOptional({
    description: 'Time-based targeting rules',
    example: {
      days: ['monday', 'tuesday'],
      hours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
      timezone: 'UTC',
    },
  })
  timeTargeting?: any;

  @ApiPropertyOptional({
    description: 'Buyer-specific targeting rules',
    example: {
      includeAdvertisers: ['uuid1', 'uuid2'],
      excludeAdvertisers: ['uuid3'],
      minCampaignBudget: 1000,
    },
  })
  buyerTargeting?: any;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2025-06-01T10:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-06-01T15:30:00Z',
  })
  updatedAt: Date;
}

export class FloorPriceListResponseDto {
  @ApiProperty({
    description: 'List of floor prices',
    type: [FloorPriceResponseDto],
  })
  data: FloorPriceResponseDto[];

  @ApiProperty({
    description: 'Total number of floor prices',
    example: 25,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 3,
  })
  totalPages: number;
}

export class FloorPriceQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter by currency',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Filter by active status (based on date range)',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  active?: boolean;
}
