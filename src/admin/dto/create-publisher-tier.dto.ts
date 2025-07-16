// src/admin/dto/update-publisher-tier.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min, Max, Length, IsNotEmpty, IsUUID } from 'class-validator';


export class CreatePublisherTierDto {
  @ApiProperty({ 
    description: 'Publisher tier name', 
    example: 'Premium',
    minLength: 2,
    maxLength: 50
  })
  @IsNotEmpty({ message: 'Tier name is required' })
  @IsString()
  @Length(2, 50, { message: 'Tier name must be between 2 and 50 characters' })
  name: string;

  @ApiProperty({ 
    description: 'Commission rate for publishers in this tier (between 0 and 1)', 
    example: 0.5,
    minimum: 0,
    maximum: 1
  })
  @IsNotEmpty({ message: 'Commission rate is required' })
  @IsNumber({}, { message: 'Commission rate must be a number' })
  @Min(0, { message: 'Commission rate must be at least 0' })
  @Max(1, { message: 'Commission rate must not exceed 1' })
  commissionRate: number;
}


export class UpdatePublisherTierDto {
  @ApiPropertyOptional({ 
    description: 'Publisher tier name', 
    example: 'Premium Plus',
    minLength: 2,
    maxLength: 50
  })
  @IsOptional()
  @IsString()
  @Length(2, 50, { message: 'Tier name must be between 2 and 50 characters' })
  name?: string;

  @ApiPropertyOptional({ 
    description: 'Commission rate for publishers in this tier (between 0 and 1)', 
    example: 0.6,
    minimum: 0,
    maximum: 1
  })
  @IsOptional()
  @IsNumber({}, { message: 'Commission rate must be a number' })
  @Min(0, { message: 'Commission rate must be at least 0' })
  @Max(1, { message: 'Commission rate must not exceed 1' })
  commissionRate?: number;
}

export class AssignPublisherTierDto {
  @ApiProperty({ 
    description: 'Publisher ID to assign tier to', 
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsNotEmpty({ message: 'Publisher ID is required' })
  @IsUUID('4', { message: 'Publisher ID must be a valid UUID' })
  publisherId: string;

  @ApiProperty({ 
    description: 'Publisher tier ID to assign', 
    example: '123e4567-e89b-12d3-a456-426614174001'
  })
  @IsNotEmpty({ message: 'Tier ID is required' })
  @IsUUID('4', { message: 'Tier ID must be a valid UUID' })
  tierId: string;
}

export class PublisherInTierDto {
  @ApiProperty({ description: 'Publisher ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ description: 'Publisher first name', example: 'John' })
  firstName: string;

  @ApiProperty({ description: 'Publisher last name', example: 'Doe' })
  lastName: string;

  @ApiProperty({ description: 'Publisher email', example: 'john.doe@example.com' })
  email: string;

  @ApiProperty({ description: 'Publisher status', example: 'ACTIVE' })
  status: string;

  @ApiPropertyOptional({ description: 'Publisher creation date', example: '2024-01-15T10:30:00Z' })
  createdAt?: Date;

  @ApiPropertyOptional({ description: 'Publisher payment threshold', example: 100.0000 })
  paymentThreshold?: number;
}

export class PublisherTierResponseDto {
  @ApiProperty({ description: 'Publisher tier ID', example: '123e4567-e89b-12d3-a456-426614174001' })
  id: string;

  @ApiProperty({ description: 'Publisher tier name', example: 'Premium' })
  name: string;

  @ApiProperty({ description: 'Commission rate', example: 0.5 })
  commissionRate: number;

  @ApiProperty({ description: 'Tier creation date', example: '2024-01-15T10:30:00Z' })
  createdAt: Date;

  @ApiProperty({ description: 'Number of publishers in this tier', example: 15 })
  publishersCount: number;

  @ApiProperty({ 
    description: 'Publishers assigned to this tier', 
    type: [PublisherInTierDto],
    isArray: true 
  })
  publishers: PublisherInTierDto[];
}