// src/creative/dto/update-creative.dto.ts
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsUrl, IsUUID, IsEnum } from 'class-validator';
import { CreativeType } from '@prisma/client';

export class UpdateCreativeDto {
    @ApiPropertyOptional({
        description: 'Creative name',
        example: 'Updated Summer Sale Banner',
    })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({
        description: 'Creative type',
        enum: CreativeType,
        example: CreativeType.IMAGE,
    })
    @IsOptional()
    @IsEnum(CreativeType)
    type?: CreativeType;

    @ApiPropertyOptional({
        description: 'Landing URL for the creative',
        example: 'https://example.com/summer-sale',
    })
    @IsOptional()
    @IsUrl()
    landingUrl?: string;

    @ApiPropertyOptional({
        description: 'Ad slot template ID',
        example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    })
    @IsOptional()
    @IsUUID()
    templateId?: string;

    @ApiPropertyOptional({
        description: 'Content safety threshold (0-1)',
        example: 0.8,
    })
    @IsOptional()
    contentSafetyThreshold?: number;
}

// Response DTO for update operations
export class UpdateCreativeResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    name: string;

    @ApiProperty({ enum: CreativeType })
    type: CreativeType;

    @ApiProperty()
    campaignId: string;

    @ApiProperty()
    templateId: string;

    @ApiProperty()
    fileUrl: string;

    @ApiProperty({ required: false })
    s3Key?: string;

    @ApiProperty()
    landingUrl: string;

    @ApiProperty({ enum: ['PENDING_REVIEW', 'APPROVED', 'REJECTED'] })
    status: string;

    @ApiProperty({ required: false })
    contentSafetyThreshold?: number;

    @ApiProperty({ required: false })
    reviewNotes?: string;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;

    @ApiProperty({
        description: 'Ad slot template information',
        type: 'object',
        properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            width: { type: 'number' },
            height: { type: 'number' },
            format: { type: 'string' },
            position: { type: 'string' },
        },
    })
    adSlotTemplate: {
        id: string;
        name: string;
        width: number;
        height: number;
        format: string;
        position: string;
    };
}