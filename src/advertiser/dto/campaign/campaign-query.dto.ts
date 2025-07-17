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
        description: 'Filter by client ID',
        example: 'b169383a-2369-4422-9094-bf0752ceed65',
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
}