import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsOptional,
    IsEnum,
    IsString,
    IsInt,
    Min,
    IsDate,
    IsUUID,
    IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
    CampaignStatus,
    CampaignObjective,
    BidStrategy,
    BusinessCategory
} from '@prisma/client';

export class CampaignQueryDto {
    @ApiPropertyOptional({
        description: 'Filter by campaign status',
        enum: CampaignStatus,
        example: CampaignStatus.ACTIVE,
    })
    @IsOptional()
    @IsEnum(CampaignStatus)
    status?: CampaignStatus;

    @ApiPropertyOptional({
        description: 'Filter by campaign objective',
        enum: CampaignObjective,
        example: CampaignObjective.AWARENESS,
    })
    @IsOptional()
    @IsEnum(CampaignObjective)
    objective?: CampaignObjective;

    @ApiPropertyOptional({
        description: 'Filter by bid strategy',
        enum: BidStrategy,
        example: BidStrategy.LOWEST_COST,
    })
    @IsOptional()
    @IsEnum(BidStrategy)
    bidStrategy?: BidStrategy;

    @ApiPropertyOptional({
        description: 'Filter by business category',
        enum: BusinessCategory,
        example: BusinessCategory.RETAIL,
    })
    @IsOptional()
    @IsEnum(BusinessCategory)
    businessCategory?: BusinessCategory;

    @ApiPropertyOptional({
        description: 'Filter by client ID',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @IsOptional()
    @IsUUID('4')
    clientId?: string;

    @ApiPropertyOptional({
        description: 'Search campaigns by name',
        example: 'Summer Sale',
    })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({
        description: 'Filter by minimum budget',
        example: 1000,
        type: 'number',
    })
    @IsOptional()
    @Type(() => Number)
    minBudget?: number;

    @ApiPropertyOptional({
        description: 'Filter by maximum budget',
        example: 10000,
        type: 'number',
    })
    @IsOptional()
    @Type(() => Number)
    maxBudget?: number;

    @ApiPropertyOptional({
        description: 'Filter campaigns starting from this date (YYYY-MM-DD)',
        example: '2025-05-01',
    })
    @IsOptional()
    @IsString()
    startDateFrom?: string;

    @ApiPropertyOptional({
        description: 'Filter campaigns starting until this date (YYYY-MM-DD)',
        example: '2025-05-31',
    })
    @IsOptional()
    @IsString()
    startDateTo?: string;

    @ApiPropertyOptional({
        description: 'Filter campaigns ending from this date (YYYY-MM-DD)',
        example: '2025-06-01',
    })
    @IsOptional()
    @IsString()
    endDateFrom?: string;

    @ApiPropertyOptional({
        description: 'Filter campaigns ending until this date (YYYY-MM-DD)',
        example: '2025-06-30',
    })
    @IsOptional()
    @IsString()
    endDateTo?: string;

    @ApiPropertyOptional({
        description: 'Filter campaigns created from this date (YYYY-MM-DD)',
        example: '2025-01-01',
    })
    @IsOptional()
    @IsString()
    createdFrom?: string;

    @ApiPropertyOptional({
        description: 'Filter campaigns created until this date (YYYY-MM-DD)',
        example: '2025-12-31',
    })
    @IsOptional()
    @IsString()
    createdTo?: string;

    @ApiPropertyOptional({
        description: 'Page number for pagination',
        minimum: 1,
        default: 1,
        example: 1,
    })
    @IsOptional()
    @IsInt()
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
    @IsInt()
    @Min(1)
    @Type(() => Number)
    limit?: number = 10;

    @ApiPropertyOptional({
        description: 'Sort by field',
        example: 'createdAt',
        enum: [
            'name',
            'startDate',
            'endDate',
            'status',
            'objective',
            'createdAt',
            'updatedAt',
        ],
        default: 'createdAt',
    })
    @IsOptional()
    @IsString()
    sortBy?: string = 'createdAt';

    @ApiPropertyOptional({
        description: 'Sort order',
        enum: ['asc', 'desc'],
        default: 'desc',
        example: 'desc',
    })
    @IsOptional()
    @IsEnum(['asc', 'desc'])
    sortOrder?: 'asc' | 'desc' = 'desc';

    @ApiPropertyOptional({
        description: 'Include campaign statistics in response',
        example: false,
        default: false,
    })
    @IsOptional()
    @Type(() => Boolean)
    includeStats?: boolean = false;

    @ApiPropertyOptional({
        description: 'Include targeting rules in response',
        example: false,
        default: false,
    })
    @IsOptional()
    @Type(() => Boolean)
    includeTargeting?: boolean = false;
}