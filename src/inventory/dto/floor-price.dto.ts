import { ApiProperty } from '@nestjs/swagger';
import { 
  IsNotEmpty, 
  IsNumber, 
  IsOptional, 
  IsString, 
  IsDate, 
  IsObject,
  Min,
  IsDateString 
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFloorPriceDto {
  @ApiProperty({ 
    description: 'Base price in USD',
    example: 1.50 
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  basePrice: number;

  @ApiProperty({ 
    description: 'Currency code (e.g., USD, EUR)',
    default: 'USD',
    required: false 
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ 
    description: 'Start date when this floor price becomes active',
    example: '2025-05-01T00:00:00Z' 
  })
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiProperty({ 
    description: 'End date when this floor price expires',
    example: '2025-12-31T23:59:59Z',
    required: false 
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ 
    description: 'Time-based pricing rules (JSON)',
    example: { peak_hours: { start: '09:00', end: '17:00', multiplier: 1.2 } },
    required: false 
  })
  @IsOptional()
  @IsObject()
  timeTargeting?: any;

  @ApiProperty({ 
    description: 'Buyer-specific pricing rules (JSON)',
    example: { advertiser_id: 'uuid', multiplier: 1.1 },
    required: false 
  })
  @IsOptional()
  @IsObject()
  buyerTargeting?: any;
}

export class FloorPriceResponseDto {
  @ApiProperty({ description: 'Unique identifier of the floor price' })
  id: string;

  @ApiProperty({ description: 'Inventory ID' })
  inventoryId: string;

  @ApiProperty({ description: 'Base price' })
  basePrice: number;

  @ApiProperty({ description: 'Currency code' })
  currency: string;

  @ApiProperty({ description: 'Start date' })
  startDate: Date;

  @ApiProperty({ description: 'End date' })
  endDate: Date | null;

  @ApiProperty({ description: 'Time targeting rules' })
  timeTargeting: any;

  @ApiProperty({ description: 'Buyer targeting rules' })
  buyerTargeting: any;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;
}