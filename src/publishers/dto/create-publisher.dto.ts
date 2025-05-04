import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsArray,
  IsUUID,
  MinLength,
  MaxLength
} from 'class-validator';
import { PublisherStatus, Language } from '@prisma/client';

export class CreatePublisherDto {
  @ApiProperty({
    description: 'Publisher first name',
    example: 'John'
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @ApiProperty({
    description: 'Publisher last name',
    example: 'Doe'
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;

  @ApiProperty({
    description: 'Email address',
    example: 'publisher@example.com'
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Password',
    example: 'StrongPassword123!'
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    description: 'Publisher domain (website)',
    example: 'example.com',
    required: false
  })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiProperty({
    description: 'Publisher status',
    enum: PublisherStatus,
    default: PublisherStatus.ACTIVE,
    required: false
  })
  @IsOptional()
  @IsEnum(PublisherStatus)
  status?: PublisherStatus;

  @ApiProperty({
    description: 'List of category IDs to assign to the publisher',
    type: [String],
    required: false,
    example: ['123e4567-e89b-12d3-a456-426614174000']
  })
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  categoryIds?: string[];

  @ApiProperty({
    description: 'List of languages supported by the publisher',
    enum: Language,
    isArray: true,
    required: false,
    example: [Language.ENGLISH, Language.SPANISH]
  })
  @IsOptional()
  @IsArray()
  @IsEnum(Language, { each: true })
  languages?: string[];
}
