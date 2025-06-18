import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateAdInventoryDto {
  @ApiProperty({
    description: 'Name of the ad inventory slot',
    example: 'Header Banner',
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'UUID of the ad slot template to use',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @IsUUID()
  adSlotTemplateId: string;

  @ApiPropertyOptional({
    description: 'Viewability score between 0.0 and 1.0',
    example: 0.8,
    minimum: 0,
    maximum: 1,
    default: 0.8,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  viewabilityScore?: number;

  @ApiPropertyOptional({
    description: 'Custom position override for the template position',
    example: 'custom-header-position',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  customPosition?: string;

  @ApiPropertyOptional({
    description: 'Floor price override for this specific ad slot',
    example: 1.5,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  floorPriceOverride?: number;
}