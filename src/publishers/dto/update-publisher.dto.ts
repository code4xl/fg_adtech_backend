import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CreatePublisherDto } from './create-publisher.dto';
import { Language } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsString, MinLength, MaxLength, IsOptional, IsNumber, Min, IsArray, IsUUID, IsEnum } from 'class-validator';

export class UpdatePublisherDto {
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

    @ApiPropertyOptional({
        description: 'Publisher domain (website)',
        example: 'example.com',
        required: false,
    })
    @IsOptional()
    @IsString()
    domain?: string;

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
