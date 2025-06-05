// src/campaign/dto/create-campaign.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsNotEmpty,
    IsUUID,
    IsNumber,
    IsEnum,
    IsOptional,
    IsDateString,
    Min,
    ValidateIf,
    ValidateNested,
    IsObject,
    IsUrl,
    IsArray,
    IsDecimal,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
    CampaignObjective,
    BidStrategy,
    CampaignPacing,
    BusinessCategory,
    CampaignInterest,
    CampaignStatus,
} from '@prisma/client';

export class CreateCampaignDto {
    @ApiProperty({
        description: 'Campaign name',
        example: 'Summer Sale 2025',
    })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({
        description: 'Client ID for the campaign',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @IsUUID('4')
    @IsNotEmpty()
    clientId: string;

    @ApiProperty({
        description: 'Campaign start date (ISO format)',
        example: '2025-05-01T00:00:00Z',
    })
    @IsDateString()
    startDate: string;

    @ApiProperty({
        description: 'Campaign end date (ISO format)',
        example: '2025-05-31T23:59:59Z',
    })
    @IsDateString()
    endDate: string;

    @ApiProperty({
        description: 'Campaign objective',
        enum: CampaignObjective,
        example: CampaignObjective.AWARENESS,
    })
    @IsEnum(CampaignObjective)
    objective: CampaignObjective;

    @ApiPropertyOptional({
        description: 'Bid strategy',
        enum: BidStrategy,
        example: BidStrategy.LOWEST_COST,
        default: BidStrategy.LOWEST_COST,
    })
    @IsOptional()
    @IsEnum(BidStrategy)
    bidStrategy?: BidStrategy;

    @ApiPropertyOptional({
        description: 'Bid amount (required for BID_CAP and COST_CAP strategies)',
        example: 2.50,
        type: 'number',
    })
    @ValidateIf(o => ['BID_CAP', 'COST_CAP', 'TARGET_COST'].includes(o.bidStrategy))
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0.01)
    @Type(() => Number)
    bidAmount?: number;

    @ApiPropertyOptional({
        description: 'Campaign pacing',
        enum: CampaignPacing,
        example: CampaignPacing.STANDARD,
        default: CampaignPacing.STANDARD,
    })
    @IsOptional()
    @IsEnum(CampaignPacing)
    pacing?: CampaignPacing;

    @ApiProperty({
        description: 'Business category',
        enum: BusinessCategory,
        example: BusinessCategory.RETAIL,
    })
    @IsNotEmpty()
    @IsEnum(BusinessCategory)
    businessCategory: BusinessCategory;

    @ApiProperty({
        description: 'Campaign website URL',
        example: 'https://example.com/summer-sale',
    })
    @IsNotEmpty()
    @IsUrl()
    websiteUrl: string;

    @ApiProperty({
        description: 'Campaign interest targeting',
        enum: CampaignInterest,
        isArray: true,
        example: [CampaignInterest.TECHNOLOGY, CampaignInterest.FOOD_AND_DRINK],
    })
    @IsNotEmpty()
    @IsArray()
    @IsEnum(CampaignInterest, { each: true })
    interests: CampaignInterest[];
}

export class UpdateCampaignDto {
    @ApiPropertyOptional({
        description: 'Campaign name',
        example: 'Updated Summer Sale 2025',
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    name?: string;

    @ApiPropertyOptional({
        description: 'Client ID for the campaign',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @IsOptional()
    @IsUUID('4')
    clientId?: string;

    @ApiPropertyOptional({
        description: 'Campaign start date (ISO format)',
        example: '2025-05-01T00:00:00Z',
    })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({
        description: 'Campaign end date (ISO format)',
        example: '2025-05-31T23:59:59Z',
    })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiPropertyOptional({
        description: 'Campaign objective',
        enum: CampaignObjective,
        example: CampaignObjective.CONVERSION,
    })
    @IsOptional()
    @IsEnum(CampaignObjective)
    objective?: CampaignObjective;

    @ApiPropertyOptional({
        description: 'Bid strategy',
        enum: BidStrategy,
        example: BidStrategy.BID_CAP,
    })
    @IsOptional()
    @IsEnum(BidStrategy)
    bidStrategy?: BidStrategy;

    @ApiPropertyOptional({
        description: 'Bid amount (required for BID_CAP and COST_CAP strategies)',
        example: 3.00,
        type: 'number',
    })
    @IsOptional()
    @ValidateIf(o => ['BID_CAP', 'COST_CAP', 'TARGET_COST'].includes(o.bidStrategy))
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0.01)
    @Type(() => Number)
    bidAmount?: number;

    @ApiPropertyOptional({
        description: 'Campaign pacing',
        enum: CampaignPacing,
        example: CampaignPacing.ACCELERATED,
    })
    @IsOptional()
    @IsEnum(CampaignPacing)
    pacing?: CampaignPacing;

    @ApiPropertyOptional({
        description: 'Business category',
        enum: BusinessCategory,
        example: BusinessCategory.TECHNOLOGY,
    })
    @IsOptional()
    @IsEnum(BusinessCategory)
    businessCategory?: BusinessCategory;

    @ApiPropertyOptional({
        description: 'Campaign website URL',
        example: 'https://example.com/updated-summer-sale',
    })
    @IsOptional()
    @IsUrl()
    websiteUrl?: string;

    @ApiPropertyOptional({
        description: 'Campaign interest targeting',
        enum: CampaignInterest,
        isArray: true,
        example: [CampaignInterest.TECHNOLOGY, CampaignInterest.SPORTS],
    })
    @IsOptional()
    @IsArray()
    @IsEnum(CampaignInterest, { each: true })
    interests?: CampaignInterest[];
}

export class CampaignResponseDto {
    @ApiProperty({
        description: 'Campaign ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    id: string;

    @ApiProperty({
        description: 'Campaign name',
        example: 'Summer Sale 2025',
    })
    name: string;

    @ApiProperty({
        description: 'Advertiser ID',
        example: '550e8400-e29b-41d4-a716-446655440001',
    })
    advertiserId: string;

    @ApiProperty({
        description: 'Client ID',
        example: '550e8400-e29b-41d4-a716-446655440002',
    })
    clientId: string;

    @ApiProperty({
        description: 'Campaign start date',
        example: '2025-05-01T00:00:00Z',
    })
    startDate: Date;

    @ApiProperty({
        description: 'Campaign end date',
        example: '2025-05-31T23:59:59Z',
    })
    endDate: Date;

    @ApiProperty({
        description: 'Campaign status',
        enum: CampaignStatus,
        example: CampaignStatus.ACTIVE,
    })
    status: CampaignStatus;

    @ApiProperty({
        description: 'Campaign objective',
        enum: CampaignObjective,
        example: CampaignObjective.AWARENESS,
    })
    objective: CampaignObjective;

    @ApiProperty({
        description: 'Bid strategy',
        enum: BidStrategy,
        example: BidStrategy.LOWEST_COST,
    })
    bidStrategy: BidStrategy;

    @ApiPropertyOptional({
        description: 'Bid amount',
        example: 2.50,
        type: 'number',
    })
    bidAmount?: number;

    @ApiProperty({
        description: 'Campaign pacing',
        enum: CampaignPacing,
        example: CampaignPacing.STANDARD,
    })
    pacing: CampaignPacing;

    @ApiProperty({
        description: 'Business category',
        enum: BusinessCategory,
        example: BusinessCategory.RETAIL,
    })
    businessCategory: BusinessCategory;

    @ApiProperty({
        description: 'Website URL',
        example: 'https://example.com/summer-sale',
    })
    websiteUrl: string;

    @ApiProperty({
        description: 'Campaign interests',
        enum: CampaignInterest,
        isArray: true,
        example: [CampaignInterest.TECHNOLOGY, CampaignInterest.FOOD_AND_DRINK],
    })
    interests: CampaignInterest[];

    @ApiProperty({
        description: 'Created at timestamp',
        example: '2025-01-01T00:00:00Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'Updated at timestamp',
        example: '2025-01-01T00:00:00Z',
    })
    updatedAt: Date;

    @ApiPropertyOptional({
        description: 'Client information',
    })
    client?: {
        id: string;
        name: string;
        companyName: string;
    };

    @ApiPropertyOptional({
        description: 'Campaign counts',
    })
    _count?: {
        creatives: number;
    };
}
