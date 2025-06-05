import { ApiProperty } from '@nestjs/swagger';
import {
    IsString,
    IsNotEmpty,
    IsEnum,
    IsUUID,
    IsUrl,
    MaxLength,
    MinLength,
} from 'class-validator';
import { CreativeType } from '@prisma/client';

export class CreateCreativeDto {
    @ApiProperty({
        description: 'Creative name',
        example: 'Summer Sale Banner',
        minLength: 2,
        maxLength: 100,
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(2)
    @MaxLength(100)
    name: string;

    @ApiProperty({
        description: 'Creative type',
        enum: CreativeType,
        example: CreativeType.IMAGE,
    })
    @IsEnum(CreativeType)
    @IsNotEmpty()
    type: string;

    @ApiProperty({
        description: 'Ad slot template ID',
        example: '550e8400-e29b-12d3-a456-426614174000',
    })
    @IsUUID('4')
    @IsNotEmpty()
    templateId: string;

    @ApiProperty({
        description: 'Landing page URL',
        example: 'https://example.com/summer-sale',
    })
    @IsUrl()
    @IsNotEmpty()
    landingUrl: string;
}

export class CreativeResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    campaignId: string;

    @ApiProperty()
    name: string;

    @ApiProperty({ enum: CreativeType })
    type: CreativeType;

    @ApiProperty()
    templateId: string;

    @ApiProperty()
    fileUrl: string;

    @ApiProperty()
    s3Key: string;

    @ApiProperty()
    landingUrl: string;

    @ApiProperty()
    status: string;

    @ApiProperty({ required: false })
    contentSafetyThreshold?: number;

    @ApiProperty({ required: false })
    reviewNotes?: string;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;

    @ApiProperty()
    adSlotTemplate: {
        id: string;
        name: string;
        width: number;
        height: number;
        format: string;
        position: string;
    };
}