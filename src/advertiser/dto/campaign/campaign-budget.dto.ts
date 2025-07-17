import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsNotEmpty,
    IsUUID,
    IsNumber,
    IsOptional,
    Min,
    IsDateString,
    IsDecimal,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateCampaignBudgetDto {
    @ApiProperty({
        description: 'Total budget for the campaign',
        example: 500000.00, // Change from 10000.00 to a realistic INR amount
        minimum: 1,
    })
    @IsNotEmpty()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(1)
    @Type(() => Number)
    totalBudget: number;

    @ApiProperty({
        description: 'Daily budget allocation',
        example: 25000.00, // Change from 500.00 to a realistic INR amount
        minimum: 1,
    })
    @IsNotEmpty()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(1)
    @Type(() => Number)
    dailyBudget: number;
}

export class UpdateCampaignBudgetDto {
    @ApiProperty({
        description: 'Updated total budget (can only increase)',
        example: 750000.00, // Change from 15000.00
        minimum: 1,
    })
    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(1)
    @Type(() => Number)
    totalBudget?: number;

    @ApiProperty({
        description: 'Updated daily budget',
        example: 37500.00, // Change from 750.00
        minimum: 1,
    })
    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(1)
    @Type(() => Number)
    dailyBudget?: number;
}

export class CampaignBudgetResponseDto {
    @ApiProperty({
        description: 'Budget ID',
        example: 'b169383a-2369-4422-9094-bf0752ceed65',
    })
    id: string;

    @ApiProperty({
        description: 'Campaign ID',
        example: 'b169383a-2369-4422-9094-bf0752ceed65',
    })
    campaignId: string;

    @ApiProperty({
        description: 'Total budget allocated',
        example: '500000.00', // Change from '10000.00'
    })
    totalBudget: string;

    @ApiProperty({
        description: 'Daily budget allocation',
        example: '25000.00', // Change from '500.00'
    })
    dailyBudget: string;

    @ApiProperty({
        description: 'Total amount spent',
        example: '125000.00', // Change from '2500.00'
    })
    totalSpent: string;

    @ApiProperty({
        description: 'Remaining budget',
        example: '375000.00', // Change from '7500.00'
    })
    remainingBudget: string;

    @ApiProperty({
        description: 'Is budget exhausted',
        example: false,
    })
    isExhausted: boolean;

    @ApiProperty({
        description: 'Last updated timestamp',
        example: '2025-06-04T10:30:00.000Z',
    })
    lastUpdated: Date;

    @ApiProperty({
        description: 'Campaign information',
    })
    campaign: {
        id: string;
        name: string;
        status: string;
        startDate: Date;
        endDate: Date;
    };
}

export class DailyBudgetSpendingDto {
    @ApiProperty({
        description: 'Date',
        example: '2025-01-15',
    })
    date: string;

    @ApiProperty({
        description: 'Daily budget allocated',
        example: '500.00',
    })
    dailyBudget: string;

    @ApiProperty({
        description: 'Amount spent today',
        example: '325.50',
    })
    spentToday: string;

    @ApiProperty({
        description: 'Remaining budget for today',
        example: '174.50',
    })
    remainingToday: string;

    @ApiProperty({
        description: 'Is daily budget exhausted',
        example: false,
    })
    isExhausted: boolean;

    @ApiProperty({
        description: 'Percentage spent',
        example: 65.1,
    })
    spentPercentage: number;
}

export class CampaignStatisticsDto {
    @ApiProperty({
        description: 'Campaign ID',
        example: 'b169383a-2369-4422-9094-bf0752ceed65',
    })
    campaignId: string;

    @ApiProperty({
        description: 'Date range for statistics',
    })
    dateRange: {
        startDate: string;
        endDate: string;
    };

    @ApiProperty({
        description: 'Total impressions',
        example: 125000,
    })
    totalImpressions: number;

    @ApiProperty({
        description: 'Total clicks',
        example: 2500,
    })
    totalClicks: number;

    @ApiProperty({
        description: 'Total conversions',
        example: 125,
    })
    totalConversions: number;

    @ApiProperty({
        description: 'Total spend',
        example: '2500.00',
    })
    totalSpend: string;

    @ApiProperty({
        description: 'Click-through rate',
        example: 2.0,
    })
    ctr: number;

    @ApiProperty({
        description: 'Cost per click',
        example: '1.00',
    })
    cpc: string;

    @ApiProperty({
        description: 'Cost per mille (CPM)',
        example: '20.00',
    })
    cpm: string;

    @ApiProperty({
        description: 'Conversion rate',
        example: 5.0,
    })
    conversionRate: number;

    @ApiProperty({
        description: 'Daily breakdown',
        type: 'array',
    })
    dailyBreakdown: Array<{
        date: string;
        impressions: number;
        clicks: number;
        conversions: number;
        spend: string;
        ctr: number;
        cpc: string;
    }>;
}

export class CampaignStatisticsQueryDto {
    @ApiPropertyOptional({
        description: 'Start date for statistics (YYYY-MM-DD)',
        example: '2025-01-01',
    })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({
        description: 'End date for statistics (YYYY-MM-DD)',
        example: '2025-01-31',
    })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiPropertyOptional({
        description: 'Include daily breakdown',
        example: true,
        default: false,
    })
    @IsOptional()
    @Type(() => Boolean)
    includeDailyBreakdown?: boolean = false;
}