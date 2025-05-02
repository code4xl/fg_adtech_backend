import { ApiProperty } from '@nestjs/swagger';
import {
    IsString,
    IsNotEmpty,
    IsEnum,
    IsUrl,
    IsInt,
    Min,
    Max,
    IsUUID,
    IsOptional
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreativeType } from '@prisma/client';

export class CreateCreativeDto {
    @ApiProperty({
        description: 'Creative name',
        example: 'Summer Sale Banner'
    })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({
        description: 'Creative type',
        enum: CreativeType,
        example: CreativeType.IMAGE
    })
    @IsEnum(CreativeType)
    type: CreativeType;

    @ApiProperty({
        description: 'Width in pixels',
        example: 300
    })
    @IsInt()
    @Min(1)
    @Max(2000)
    @Type(() => Number)
    width: number;

    @ApiProperty({
        description: 'Height in pixels',
        example: 250
    })
    @IsInt()
    @Min(1)
    @Max(2000)
    @Type(() => Number)
    height: number;

    @ApiProperty({
        description: 'URL to the creative file',
        example: 'https://example.com/assets/banner.jpg'
    })
    @IsUrl()
    fileUrl: string;

    @ApiProperty({
        description: 'Landing page URL',
        example: 'https://example.com/summer-sale'
    })
    @IsUrl()
    landingUrl: string;

    @ApiProperty({
        description: 'Inventory ID this creative is targeting',
        example: '550e8400-e29b-41d4-a716-446655440000'
    })
    @IsUUID('4')
    @IsNotEmpty()
    inventoryId: string;
}

export class GetAvailableInventoriesForCreativeDto {
    @ApiProperty({
        description: 'Filter by width in pixels',
        example: 300,
        required: false
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Type(() => Number)
    width?: number;

    @ApiProperty({
        description: 'Filter by height in pixels',
        example: 250,
        required: false
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Type(() => Number)
    height?: number;
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
    width: number;

    @ApiProperty()
    height: number;

    @ApiProperty()
    fileUrl: string;

    @ApiProperty()
    landingUrl: string;

    @ApiProperty({ enum: ['PENDING_REVIEW', 'APPROVED', 'REJECTED'] })
    status: string;

    @ApiProperty({ required: false })
    reviewNotes?: string;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;

    @ApiProperty()
    inventoryId: string;
}