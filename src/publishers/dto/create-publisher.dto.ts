// src/publishers/dto/create-publisher.dto.ts - Updated with tier support

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsArray,
  IsUUID,
  MinLength,
  MaxLength,
  IsDecimal,
  IsNumber,
  Min,
} from 'class-validator';
import { PublisherStatus, Language } from '@prisma/client';
import { Type } from 'class-transformer';
import { PublisherTierResponseDto } from 'src/admin/dto/create-publisher-tier.dto';

export class CreatePublisherDto {
  @ApiProperty({
    description: 'Publisher first name',
    example: 'John',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @ApiProperty({
    description: 'Publisher last name',
    example: 'Doe',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;

  @ApiProperty({
    description: 'Email address',
    example: 'publisher@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Password',
    example: 'StrongPassword123!',
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({
    description: 'Publisher domain (website)',
    example: 'example.com',
    required: false,
  })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional({
    description: 'Publisher status',
    enum: PublisherStatus,
    default: PublisherStatus.ACTIVE,
    required: false,
  })
  @IsOptional()
  @IsEnum(PublisherStatus)
  status?: PublisherStatus;

  @ApiPropertyOptional({
    description: 'Publisher tier ID - will use default tier if not provided',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID(4)
  tierId?: string;

  @ApiPropertyOptional({
    description: 'Payment threshold amount - minimum amount before payout',
    example: 100.0,
    default: 100.0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  paymentThreshold?: number;

  @ApiPropertyOptional({
    description: 'List of category IDs to assign to the publisher',
    type: [String],
    required: false,
    example: ['123e4567-e89b-12d3-a456-426614174000'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({
    description: 'List of languages supported by the publisher',
    enum: Language,
    isArray: true,
    required: false,
    example: [Language.ENGLISH, Language.SPANISH],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(Language, { each: true })
  languages?: string[];
}

// Updated publisher response DTO
export class PublisherResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  emailVerifiedAt: Date;

  @ApiProperty({ enum: PublisherStatus })
  status: PublisherStatus;

  @ApiProperty()
  paymentThreshold: number;

  @ApiPropertyOptional()
  tierId?: string;

  @ApiPropertyOptional({ type: PublisherTierResponseDto })
  tier?: PublisherTierResponseDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
