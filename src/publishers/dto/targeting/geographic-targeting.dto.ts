import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateGeographicTargetingDto {
  @ApiProperty({ description: 'Inventory ID for targeting rules' })
  @IsUUID()
  inventoryId: string;

  @ApiPropertyOptional({
    description: 'Country codes (ISO 3166-1 alpha-2)',
    isArray: true,
    example: ['IN', 'US', 'UK'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countries?: string[];

  @ApiPropertyOptional({
    description: 'State/region codes',
    isArray: true,
    example: ['MAHARASHTRA', 'KARNATAKA'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  states?: string[];

  @ApiPropertyOptional({
    description: 'City names',
    isArray: true,
    example: ['Mumbai', 'Bangalore', 'Delhi'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cities?: string[];

  @ApiPropertyOptional({
    description: 'Postal codes',
    isArray: true,
    example: ['400001', '560001'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  postalCodes?: string[];

  @ApiPropertyOptional({
    description: 'Radius in kilometers for location targeting',
  })
  @IsOptional()
  @IsNumber()
  radius?: number;

  @ApiPropertyOptional({ description: 'Latitude for location targeting' })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude for location targeting' })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({
    description: 'Include or exclude these locations',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isInclude?: boolean = true;
}

export class UpdateGeographicTargetingDto extends CreateGeographicTargetingDto {}
