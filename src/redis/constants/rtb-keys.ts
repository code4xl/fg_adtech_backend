export const RTB_REDIS_KEYS = {
    // RTB Processing
    BID_REQUEST_LOCK: (requestId: string) => `lock:bid-request:${requestId}`,
    AUCTION_STATE: (requestId: string) => `auction:state:${requestId}`,

    // Campaign Eligibility (5 min cache)
    ELIGIBLE_CAMPAIGNS: (inventoryId: string, deviceType: string) =>
        `eligible:${inventoryId}:${deviceType}`,

    // Budget Tracking (real-time)
    CAMPAIGN_BUDGET_SPENT: (campaignId: string, date: string) =>
        `budget:spent:${campaignId}:${date}`,
    CAMPAIGN_BUDGET_REMAINING: (campaignId: string) =>
        `budget:remaining:${campaignId}`,

    // Performance Counters
    AUCTION_COUNT: (hour: string) => `metrics:auctions:${hour}`,
    BID_COUNT: (hour: string) => `metrics:bids:${hour}`,
    WIN_COUNT: (hour: string) => `metrics:wins:${hour}`,
} as const;