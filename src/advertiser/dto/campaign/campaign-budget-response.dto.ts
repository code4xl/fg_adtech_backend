import { ApiProperty } from "@nestjs/swagger";

export class ClientCampaignBudgetResponseDto {
  @ApiProperty()
  budget: {
    id: string;
    totalBudget: number;
    dailyBudget: number;
    spentAmount: number;
    remainingAmount: number;
    budgetType: string;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
    lastUpdated: Date;
    createdAt: Date;
    utilizationPercentage: number;
    remainingPercentage: number;
    avgDailySpend: number;
    campaignDuration: number;
    campaign: {
      id: string;
      name: string;
      status: string;
      startDate: Date;
      endDate: Date;
    };
  };
}