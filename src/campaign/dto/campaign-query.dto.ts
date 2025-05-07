import { ApiProperty } from '@nestjs/swagger';
import {
    IsOptional,
    IsEnum,
    IsString,
    IsInt,
    Min,
    IsDate,
    IsUUID
} from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignStatus, CampaignObjective } from '@prisma/client';

export class CampaignQueryDto {
    @ApiProperty({
        description: 'Filter by campaign status',
        enum: CampaignStatus,
        required: false
    })
    @IsOptional()
    @IsEnum(CampaignStatus)
    status?: CampaignStatus;

    @ApiProperty({
        description: 'Filter by campaign objective',
        enum: CampaignObjective,
        required: false
    })
    @IsOptional()
    @IsEnum(CampaignObjective)
    objective?: CampaignObjective;

    @ApiProperty({
        description: 'Filter by client ID',
        required: false
    })
    @IsOptional()
    @IsUUID('4')
    clientId?: string;

    @ApiProperty({
        description: 'Search by name',
        required: false
    })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiProperty({
        description: 'Page number for pagination',
        minimum: 1,
        default: 1,
        required: false
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Type(() => Number)
    page?: number = 1;

    @ApiProperty({
        description: 'Number of items per page',
        minimum: 1,
        maximum: 100,
        default: 10,
        required: false
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Type(() => Number)
    limit?: number = 10;

    @ApiProperty({
        description: 'Sort by field',
        required: false,
        example: 'createdAt'
    })
    @IsOptional()
    @IsString()
    sortBy?: string = 'createdAt';

    @ApiProperty({
        description: 'Sort order',
        enum: ['asc', 'desc'],
        default: 'desc',
        required: false
    })
    @IsOptional()
    @IsEnum(['asc', 'desc'])
    sortOrder?: 'asc' | 'desc' = 'desc';
}