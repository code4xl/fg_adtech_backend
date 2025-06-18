// src/campaign/dto/campaign-budget-tracker.dto.ts

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
    IsNotEmpty,
    IsUUID,
    IsDecimal,
    IsDateString,
    IsBoolean,
    IsOptional,
    Min,
    IsNumber,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateCampaignBudgetTrackerDto {
    @ApiProperty({
        description: 'Campaign ID',
        example: 'b169383a-2369-4422-9094-bf0752ceed65',
    })
    @IsNotEmpty()
    @IsUUID('4')
    campaignId: string;

    @ApiProperty({
        description: 'Date for the budget tracking (YYYY-MM-DD)',
        example: '2025-06-04',
    })
    @IsNotEmpty()
    @IsDateString()
    date: string;

    @ApiProperty({
        description: 'Total budget for the campaign',
        example: 1000.00,
    })
    @IsNotEmpty()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0.01)
    @Type(() => Number)
    totalBudget: number;

    @ApiProperty({
        description: 'Daily budget allocation',
        example: 50.00,
    })
    @IsNotEmpty()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0.01)
    @Type(() => Number)
    dailyBudget: number;

    @ApiPropertyOptional({
        description: 'Amount spent today',
        example: 25.50,
        default: 0,
    })
    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    @Type(() => Number)
    spentToday?: number = 0;

    @ApiProperty({
        description: 'Remaining budget',
        example: 975.50,
    })
    @IsNotEmpty()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    @Type(() => Number)
    remainingBudget: number;

    @ApiPropertyOptional({
        description: 'Whether the budget is exhausted',
        example: false,
        default: false,
    })
    @IsOptional()
    @IsBoolean()
    isExhausted?: boolean = false;
}

export class UpdateCampaignBudgetTrackerDto extends PartialType(CreateCampaignBudgetTrackerDto) {
    @ApiPropertyOptional({
        description: 'Campaign ID (cannot be updated)',
    })
    campaignId?: never; // Prevent campaignId from being updated

    @ApiPropertyOptional({
        description: 'Date (cannot be updated)',
    })
    date?: never; // Prevent date from being updated
}

export class CampaignBudgetTrackerResponseDto {
    @ApiProperty({
        description: 'Budget tracker ID',
        example: 'b169383a-2369-4422-9094-bf0752ceed65',
    })
    id: string;

    @ApiProperty({
        description: 'Campaign ID',
        example: 'b169383a-2369-4422-9094-bf0752ceed65',
    })
    campaignId: string;

    @ApiProperty({
        description: 'Date for the budget tracking',
        example: '2025-06-04T00:00:00.000Z',
    })
    date: Date;

    @ApiProperty({
        description: 'Total budget for the campaign',
        example: '1000.00',
    })
    totalBudget: string;

    @ApiProperty({
        description: 'Daily budget allocation',
        example: '50.00',
    })
    dailyBudget: string;

    @ApiProperty({
        description: 'Amount spent today',
        example: '25.50',
    })
    spentToday: string;

    @ApiProperty({
        description: 'Remaining budget',
        example: '975.50',
    })
    remainingBudget: string;

    @ApiProperty({
        description: 'Whether the budget is exhausted',
        example: false,
    })
    isExhausted: boolean;

    @ApiProperty({
        description: 'Last updated timestamp',
        example: '2025-06-04T10:30:00.000Z',
    })
    lastUpdated: Date;

    @ApiProperty({
        description: 'Creation timestamp',
        example: '2025-06-04T08:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'Update timestamp',
        example: '2025-06-04T10:30:00.000Z',
    })
    updatedAt: Date;

    @ApiPropertyOptional({
        description: 'Campaign details',
    })
    campaign?: {
        id: string;
        name: string;
        status: string;
    };
}

export class UpdateSpentAmountDto {
    @ApiProperty({
        description: 'Amount to add to the spent today total',
        example: 25.50,
        minimum: 0.01,
    })
    @IsNotEmpty()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0.01)
    @Type(() => Number)
    spentAmount: number;
}

export class CampaignBudgetTrackerQueryDto {
    @ApiPropertyOptional({
        description: 'Filter by campaign ID',
        example: 'b169383a-2369-4422-9094-bf0752ceed65',
    })
    @IsOptional()
    @IsUUID('4')
    campaignId?: string;

    @ApiPropertyOptional({
        description: 'Filter by date (YYYY-MM-DD)',
        example: '2025-06-04',
    })
    @IsOptional()
    @IsDateString()
    date?: string;

    @ApiPropertyOptional({
        description: 'Filter by date range - start date (YYYY-MM-DD)',
        example: '2025-06-01',
    })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({
        description: 'Filter by date range - end date (YYYY-MM-DD)',
        example: '2025-06-30',
    })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiPropertyOptional({
        description: 'Filter by exhausted status',
        example: false,
    })
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        if (value === 'true') return true;
        if (value === 'false') return false;
        return value;
    })
    isExhausted?: boolean;

    @ApiPropertyOptional({
        description: 'Page number for pagination',
        minimum: 1,
        default: 1,
        example: 1,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Type(() => Number)
    page?: number = 1;

    @ApiPropertyOptional({
        description: 'Number of items per page',
        minimum: 1,
        maximum: 100,
        default: 10,
        example: 10,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Type(() => Number)
    limit?: number = 10;

    @ApiPropertyOptional({
        description: 'Sort by field',
        example: 'date',
        default: 'date',
    })
    @IsOptional()
    sortBy?: string = 'date';

    @ApiPropertyOptional({
        description: 'Sort order',
        enum: ['asc', 'desc'],
        default: 'desc',
        example: 'desc',
    })
    @IsOptional()
    @Transform(({ value }) => (value === 'asc' || value === 'desc' ? value : 'desc'))
    sortOrder?: 'asc' | 'desc' = 'desc';
}