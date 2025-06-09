export const REDIS_KEYS = {
  // RTB Caching
  BID_REQUEST: (requestId: string) => `rtb:bid-request:${requestId}`,
  AUCTION_RESULT: (requestId: string) => `rtb:auction:${requestId}`,
  BID_CACHE: (inventoryId, deviceType) =>
    `bid-cache:${inventoryId}:${deviceType}`,
  // Campaign Eligibility Cache
  ELIGIBLE_CAMPAIGNS: (inventoryId: string) =>
    `campaigns:eligible:${inventoryId}`,
  CAMPAIGN_BUDGET: (campaignId: string, date: string) =>
    `budget:${campaignId}:${date}`,

  // PRIMARY: Creative-Level Performance Counters
  CREATIVE_IMPRESSIONS: (creativeId: string) =>
    `counters:creative:impressions:${creativeId}`,
  CREATIVE_CLICKS: (creativeId: string) =>
    `counters:creative:clicks:${creativeId}`,
  CREATIVE_CTR: (creativeId: string) => `metrics:creative:ctr:${creativeId}`,

  // ROLLUP: Campaign-Level Counters
  CAMPAIGN_IMPRESSIONS: (campaignId: string) =>
    `counters:campaign:impressions:${campaignId}`,
  CAMPAIGN_CLICKS: (campaignId: string) =>
    `counters:campaign:clicks:${campaignId}`,
  CAMPAIGN_SPEND: (campaignId: string) =>
    `counters:campaign:spend:${campaignId}`,

  // ROLLUP: Inventory-Level Counters
  INVENTORY_IMPRESSIONS: (inventoryId: string) =>
    `counters:inventory:impressions:${inventoryId}`,
  INVENTORY_REVENUE: (inventoryId: string) =>
    `counters:inventory:revenue:${inventoryId}`,

  // ROLLUP: Publisher-Level Counters
  PUBLISHER_IMPRESSIONS: (publisherId: string) =>
    `counters:publisher:impressions:${publisherId}`,
  PUBLISHER_REVENUE: (publisherId: string) =>
    `counters:publisher:revenue:${publisherId}`,

  // Real-time Performance Metrics
  CREATIVE_PERFORMANCE: (creativeId: string) =>
    `metrics:creative:${creativeId}`,
  CAMPAIGN_PERFORMANCE: (campaignId: string) =>
    `metrics:campaign:${campaignId}`,
  INVENTORY_PERFORMANCE: (inventoryId: string) =>
    `metrics:inventory:${inventoryId}`,

  // Frequency Capping (Creative-based)
  USER_CREATIVE_FREQUENCY: (userId: string, creativeId: string) =>
    `freq:user:${userId}:creative:${creativeId}`,
  USER_CAMPAIGN_FREQUENCY: (userId: string, campaignId: string) =>
    `freq:user:${userId}:campaign:${campaignId}`,

  // Bid Response Cache
  AD_MARKUP: (bidResponseId: string) => `markup:${bidResponseId}`,

  // Creative Performance Cache (for bid optimization)
  CREATIVE_PERFORMANCE_SCORE: (creativeId: string) =>
    `score:creative:${creativeId}`,

  // Fraud Detection
  IP_CLICK_RATE: (ipAddress: string) => `fraud:ip:${ipAddress}`,
  USER_CLICK_PATTERN: (userId: string) => `fraud:user:${userId}`,


  // Auction optimization
  INVENTORY_OPTIMIZATION: (inventoryId: string) =>
    `optimization:inventory:${inventoryId}`,
  CAMPAIGN_ELIGIBILITY_CACHE: (inventoryId: string, hour: number) =>
    `eligibility:${inventoryId}:${hour}`,

  // Real-time bidding cache
  BID_HISTORY: (campaignId: string) => `bid-history:${campaignId}`,
  AUCTION_QUEUE: (priority: string) => `auction-queue:${priority}`,

  // Google Inventory fallback
  GOOGLE_INVENTORY_CACHE: (requestHash: string) =>
    `google:inventory:${requestHash}`,


  // NEW: Enhanced performance tracking
  AUCTION_LATENCY: (inventoryId: string) => `metrics:auction-latency:${inventoryId}`,
  BID_SUCCESS_RATE: (campaignId: string) => `metrics:bid-success:${campaignId}`,
  FRAUD_SCORE: (userId: string) => `fraud:score:${userId}`,

  // NEW: Real-time bidding cache
  CAMPAIGN_ELIGIBILITY: (campaignId: string, inventoryId: string) =>
    `eligibility:${campaignId}:${inventoryId}`,
  BID_ADJUSTMENT_FACTOR: (campaignId: string) => `bid-adj:${campaignId}`,

} as const;
