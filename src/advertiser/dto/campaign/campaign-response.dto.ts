import { ApiProperty } from '@nestjs/swagger';
import { CampaignStatus, CampaignObjective, BidStrategy, BusinessCategory } from '@prisma/client';

export class ClientCampaignResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: CampaignStatus })
  status: CampaignStatus;

  @ApiProperty({ enum: CampaignObjective })
  objective: CampaignObjective;

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;

  @ApiProperty()
  websiteUrl: string;

  @ApiProperty({ enum: BidStrategy })
  bidStrategy: BidStrategy;

  @ApiProperty()
  bidAmount: number;

  @ApiProperty({ enum: BusinessCategory })
  businessCategory: BusinessCategory;

  @ApiProperty()
  interests: string[];

  @ApiProperty()
  advertiser: {
    id: string;
    name: string;
    companyName: string;
    email: string;
  };

  @ApiProperty()
  assignedAt: Date;

  @ApiProperty()
  budget: {
    totalBudget: number;
    dailyBudget: number;
    spentAmount: number;
    remainingAmount: number;
    lastUpdated: Date;
  };

  @ApiProperty()
  stats: {
    creativesCount: number;
    audienceTargetsCount: number;
  };

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}