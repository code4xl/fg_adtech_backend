import { ApiProperty } from '@nestjs/swagger';
import { CampaignStatus, CampaignObjective } from '@prisma/client';

export class CampaignSummaryDto {
    @ApiProperty({ description: 'Campaign ID' })
    id: string;

    @ApiProperty({ description: 'Campaign name' })
    name: string;

    @ApiProperty({ description: 'Campaign budget' })
    budget: number;

    @ApiProperty({ description: 'Campaign daily budget' })
    dailyBudget: number;

    @ApiProperty({ description: 'Campaign start date' })
    startDate: Date;

    @ApiProperty({ description: 'Campaign end date' })
    endDate: Date;

    @ApiProperty({ description: 'Campaign status', enum: CampaignStatus })
    status: CampaignStatus;

    @ApiProperty({ description: 'Campaign objective', enum: CampaignObjective })
    objective: CampaignObjective;

    @ApiProperty({ description: 'Campaign website URL' })
    websiteUrl: string;

    @ApiProperty({ description: 'Date when campaign was assigned to client' })
    assignedAt: Date;
}