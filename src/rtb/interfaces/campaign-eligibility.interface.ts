export interface EligibleCampaign {
  id: string;
  advertiserId: string;
  bidAmount: number;
  creatives: {
    id: string;
    performanceScore: number;
    ctr: number;
  }[];
  dailyBudgetRemaining: number;
  totalBudgetRemaining: number;
}
