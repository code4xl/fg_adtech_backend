import { ApiProperty } from "@nestjs/swagger";

export class ClientDashboardSummaryResponseDto {
  @ApiProperty()
  stats: {
    totalCampaigns: number;
    activeCampaigns: number;
    pausedCampaigns: number;
    completedCampaigns: number;
    draftCampaigns: number;
    totalBudget: number;
    totalSpent: number;
    totalRemaining: number;
  };

  @ApiProperty()
  recentCampaigns: Array<{
    id: string;
    name: string;
    status: string;
    startDate: Date;
    endDate: Date;
    budget: {
      totalBudget: number;
      spentAmount: number;
      remainingAmount: number;
    };
    updatedAt: Date;
  }>;
}