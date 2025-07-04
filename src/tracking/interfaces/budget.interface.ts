export interface CampaignBudgetStatus {
    dailyLimit: number;
    dailySpend: number;
    remaining: number;
    status: string;
    canSpend: boolean;
}

export interface CampaignBudgetInfo {
    id: string;
    dailyBudget: number;
    totalBudget: number;
    bidPrice: number;
    status: string;
}

export interface BudgetValidationRequest {
    campaignId: string;
    bidAmount: number;
}

export interface BudgetInitializationStats {
    activeCampaigns: number;
    budgetsInRedis: number;
    redisMemoryUsage: string;
}