import { ApiProperty } from '@nestjs/swagger';
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
    IsArray
} from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignObjective, BidStrategy, CampaignPacing, BusinessCategory, CampaignInterest } from '@prisma/client';
import { CampaignTargetingDto } from './targetting-rule.dto';

export class CreateCampaignDto {
    @ApiProperty({
        description: 'Campaign name',
        example: 'Summer Sale 2025'
    })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({
        description: 'Client ID (optional if advertiser is running own campaign)',
        example: '550e8400-e29b-41d4-a716-446655440000',
        required: false
    })
    @IsOptional()
    @IsUUID('4')
    clientId?: string;

    @ApiProperty({
        description: 'Total campaign budget in USD',
        example: 5000
    })
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(1)
    @Type(() => Number)
    budget: number;

    @ApiProperty({
        description: 'Daily campaign budget in USD (optional)',
        example: 500,
        required: false
    })
    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(1)
    @Type(() => Number)
    dailyBudget?: number;

    @ApiProperty({
        description: 'Campaign start date (ISO format)',
        example: '2025-05-01T00:00:00Z'
    })
    @IsDateString()
    startDate: string;

    @ApiProperty({
        description: 'Campaign end date (ISO format)',
        example: '2025-05-31T23:59:59Z'
    })
    @IsDateString()
    endDate: string;

    @ApiProperty({
        description: 'Campaign objective',
        enum: CampaignObjective,
        example: CampaignObjective.AWARENESS
    })
    @IsEnum(CampaignObjective)
    objective: CampaignObjective;

    @ApiProperty({
        description: 'Bid strategy',
        enum: BidStrategy,
        example: BidStrategy.LOWEST_COST,
        default: BidStrategy.LOWEST_COST
    })
    @IsOptional()
    @IsEnum(BidStrategy)
    bidStrategy?: BidStrategy;

    @ApiProperty({
        description: 'Bid amount (required for BID_CAP and COST_CAP strategies)',
        example: 2.5,
        required: false
    })
    @ValidateIf(o => ['BID_CAP', 'COST_CAP', 'TARGET_COST'].includes(o.bidStrategy))
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0.01)
    @Type(() => Number)
    bidAmount?: number;

    @ApiProperty({
        description: 'Campaign pacing',
        enum: CampaignPacing,
        example: CampaignPacing.STANDARD,
        default: CampaignPacing.STANDARD
    })
    @IsOptional()
    @IsEnum(CampaignPacing)
    pacing?: CampaignPacing;

    @ApiProperty({
        description: 'Business category',
        enum: BusinessCategory,
        example: BusinessCategory.RETAIL
    })
    @IsNotEmpty()
    @IsEnum(BusinessCategory)
    businessCategory: BusinessCategory;

    @ApiProperty({
        description: 'Campaign website URL',
        example: 'https://example.com/summer-sale'
    })
    @IsNotEmpty()
    @IsUrl()
    websiteUrl: string;

    @ApiProperty({
        description: 'Campaign interest targeting',
        enum: CampaignInterest,
        isArray: true,
        example: [CampaignInterest.TECHNOLOGY, CampaignInterest.FOOD_AND_DRINK]
    })
    @IsNotEmpty()
    @IsArray()
    @IsEnum(CampaignInterest, { each: true })
    interests: CampaignInterest[];

    @ApiProperty({
        description: 'Path to the uploaded audience CSV file',
        required: false,
        example: '550e8400-e29b-41d4-a716-446655440000.csv'
    })
    file: string;

    @ApiProperty({
        description: 'Campaign targeting rules',
        required: false,
        type: CampaignTargetingDto
    })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => CampaignTargetingDto)
    targeting?: CampaignTargetingDto;
}

export class CampaignResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    name: string;

    @ApiProperty()
    advertiserId: string;

    @ApiProperty({ required: false })
    clientId?: string;

    @ApiProperty()
    budget: number;

    @ApiProperty({ required: false })
    dailyBudget?: number;

    @ApiProperty()
    startDate: Date;

    @ApiProperty({ required: false })
    endDate?: Date;

    @ApiProperty({ enum: ['DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELED', 'REJECTED', 'BUDGET_EXHAUSTED'] })
    status: string;

    @ApiProperty({ enum: CampaignObjective })
    objective: CampaignObjective;

    @ApiProperty({ enum: BidStrategy })
    bidStrategy: BidStrategy;

    @ApiProperty({ required: false })
    bidAmount?: number;

    @ApiProperty({ enum: CampaignPacing })
    pacing: CampaignPacing;

    @ApiProperty({ enum: BusinessCategory })
    businessCategory: BusinessCategory;

    @ApiProperty({ required: true })
    websiteUrl: string;

    @ApiProperty({ required: true })
    interests: string[];

    @ApiProperty({ required: true })
    audienceCSV: string;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;
}