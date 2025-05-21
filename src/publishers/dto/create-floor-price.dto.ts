import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsDateString, IsArray } from 'class-validator';

export class CreateFloorPriceDto {
  @ApiProperty({ description: 'The price value' })
  @IsNotEmpty()
  @IsNumber()
  price: number;

  @ApiProperty({ description: 'Specific buyer ID this floor price applies to (optional)' })
  @IsOptional()
  @IsString()
  buyerId?: string;

  @ApiProperty({ description: 'Start date when this floor price becomes active' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ description: 'End date when this floor price expires' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ description: 'Priority of this floor price (higher number means higher priority)' })
  @IsOptional()
  @IsNumber()
  priority?: number;

  @ApiProperty({ description: 'Array of specific ad formats this floor price applies to' })
  @IsOptional()
  @IsArray()
  formats?: string[];
} 