import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';

export class UpdateAdInventoryDto {
  @ApiPropertyOptional({
    description: 'Name of the ad inventory slot',
    example: 'Header Banner Updated',
    minLength: 3,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'UUID of the ad slot template to use',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  adSlotTemplateId?: string;

  @ApiPropertyOptional({
    description: 'Viewability score between 0.0 and 1.0',
    example: 0.9,
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  viewabilityScore?: number;

  @ApiPropertyOptional({
    description: 'Whether the ad inventory is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Custom position override for the template position',
    example: 'custom-sidebar-position',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  customPosition?: string;

  @ApiPropertyOptional({
    description: 'Floor price override for this specific ad slot',
    example: 2.0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  floorPriceOverride?: number;
}