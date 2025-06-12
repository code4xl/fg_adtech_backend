// Core RTB (Real-Time Bidding) Operations
export const RTB_KEYS = {
  BID_REQUEST: (requestId: string) => `rtb:bid-request:${requestId}`,
  BID_REQUEST_LOCK: (requestId: string) => `lock:bid-request:${requestId}`,
  AUCTION_RESULT: (requestId: string) => `rtb:auction:${requestId}`,
  AUCTION_STATE: (requestId: string) => `auction:state:${requestId}`,
  AUCTION_QUEUE: (priority: string) => `auction-queue:${priority}`,
  BID_CACHE: (inventoryId: string, deviceType: string) =>
    `bid-cache:${inventoryId}:${deviceType}`,
  AD_MARKUP: (bidResponseId: string) => `markup:${bidResponseId}`,
  BID_HISTORY: (campaignId: string) => `bid-history:${campaignId}`,
  WINNER_BID_REQUEST: (campaignId: string, date: string) =>
    `auction:winner:campaign:${campaignId}:${date}`,
} as const;

// Campaign Management
export const CAMPAIGN_KEYS = {
  // Eligibility & Targeting
  ELIGIBLE_CAMPAIGNS: (inventoryId: string, deviceType: string) =>
    `campaigns:eligible:${inventoryId}:${deviceType}`,
  ELIGIBILITY: (campaignId: string, inventoryId: string) =>
    `eligibility:${campaignId}:${inventoryId}`,
  ELIGIBILITY_CACHE: (inventoryId: string, hour: number) =>
    `eligibility:${inventoryId}:${hour}`,

  // Multi-level eligibility cache
  ELIGIBILITY_L1: (inventoryId: string, deviceType: string, country: string) =>
    `cache:l1:eligible:${inventoryId}:${deviceType}:${country}`,
  ELIGIBILITY_L2: (inventoryId: string, deviceType: string) =>
    `cache:l2:eligible:${inventoryId}:${deviceType}`,
  ELIGIBILITY_METADATA: (cacheKey: string) => `cache:meta:eligible:${cacheKey}`,

  // Targeting
  TARGETING_RULES_CACHE: (campaignId: string) =>
    `targeting:rules:${campaignId}`,
  TARGETING_RULES_COMPILED: (campaignId: string) =>
    `targeting:compiled:${campaignId}`,
  TARGETING_EVALUATION_RESULT: (campaignId: string, contextHash: string) =>
    `targeting:result:${campaignId}:${contextHash}`,
  USER_CAMPAIGN_FREQUENCY: (userId: string, campaignId: string) =>
    `targeting:frequency:${userId}:${campaignId}`,

  // Performance & Metrics
  IMPRESSIONS: (campaignId: string) =>
    `counters:campaign:impressions:${campaignId}`,
  CLICKS: (campaignId: string) => `counters:campaign:clicks:${campaignId}`,
  SPEND: (campaignId: string) => `counters:campaign:spend:${campaignId}`,
  PERFORMANCE: (campaignId: string) => `metrics:campaign:${campaignId}`,

  // Campaign State
  PAUSE_FLAG: (campaignId: string) => `campaign:paused:${campaignId}`,

  // Campaign Budget
  CAMPAIGN_BUDGET: (campaignId: string, date: string) =>
    `budget:campaign:${campaignId}:${date}`,
} as const;

// Creative Management
export const CREATIVE_KEYS = {
  // Performance Counters
  IMPRESSIONS: (creativeId: string) =>
    `counters:creative:impressions:${creativeId}`,
  CLICKS: (creativeId: string) => `counters:creative:clicks:${creativeId}`,
  CTR: (creativeId: string) => `metrics:creative:ctr:${creativeId}`,

  // Performance Analysis
  PERFORMANCE: (creativeId: string, timeWindow: string) =>
    `creative:perf:${creativeId}:${timeWindow}`,
  PERFORMANCE_SCORE: (creativeId: string) => `score:creative:${creativeId}`,
  FATIGUE_SCORE: (creativeId: string) => `creative:fatigue:${creativeId}`,

  // A/B Testing
  A_B_TEST: (testId: string) => `creative:abtest:${testId}`,
} as const;

// Inventory & Publisher Management
export const INVENTORY_KEYS = {
  // Performance Counters
  IMPRESSIONS: (inventoryId: string) =>
    `counters:inventory:impressions:${inventoryId}`,
  REVENUE: (inventoryId: string) => `counters:inventory:revenue:${inventoryId}`,
  PERFORMANCE: (inventoryId: string) => `metrics:inventory:${inventoryId}`,

  // Quality & Analysis
  QUALITY_SCORE: (inventoryId: string) => `inventory:quality:${inventoryId}`,
  PERFORMANCE_TREND: (inventoryId: string) => `inventory:trend:${inventoryId}`,
  FRAUD_SCORE: (inventoryId: string) => `inventory:fraud:${inventoryId}`,
  OPTIMIZATION: (inventoryId: string) =>
    `optimization:inventory:${inventoryId}`,

  // External Integration
  GOOGLE_CACHE: (requestHash: string) => `google:inventory:${requestHash}`,
} as const;

// Pricing & Bidding
export const PRICING_KEYS = {
  // Floor Prices
  FLOOR_INVENTORY: (inventoryId: string) => `floor:inventory:${inventoryId}`,
  FLOOR_PUBLISHER: (publisherId: string) => `floor:publisher:${publisherId}`,
  FLOOR_DEVICE: (deviceType: string) => `floor:device:${deviceType}`,
  FLOOR_GEO: (country: string, region?: string) =>
    `floor:geo:${country}${region ? `:${region}` : ''}`,

  // Bid Adjustments
  ADJUSTMENT_FACTOR: (campaignId: string) => `bid-adj:${campaignId}`,
  ADJUSTMENT_CAMPAIGN: (campaignId: string) => `bid:adj:campaign:${campaignId}`,
  ADJUSTMENT_DEVICE: (deviceType: string) => `bid:adj:device:${deviceType}`,
  ADJUSTMENT_GEO: (country: string) => `bid:adj:geo:${country}`,
  ADJUSTMENT_TIME: (hour: number) => `bid:adj:time:${hour}`,
  ADJUSTMENT_INVENTORY: (inventoryId: string) =>
    `bid:adj:inventory:${inventoryId}`,

  // Bid Calculation Multipliers
  DEVICE_MULTIPLIER: (deviceType: string, campaignId: string) =>
    `bid:adj:multiplier:device:${campaignId}:${deviceType}`,
  GEO_MULTIPLIER: (country: string, campaignId: string) =>
    `bid:adj:multiplier:geo:${campaignId}:${country}`,
  INVENTORY_QUALITY_MULTIPLIER: (inventoryId: string) =>
    `bid:adj:multiplier:inventory:${inventoryId}`,

  // Bid Strategy
  STRATEGY_CONFIG: (campaignId: string) => `bid:strategy:config:${campaignId}`,
  STRATEGY_PERFORMANCE: (campaignId: string, strategy: string) =>
    `bid:strategy:perf:${campaignId}:${strategy}`,
  OPTIMIZATION_FACTORS: (campaignId: string) =>
    `bid:optimization:factors:${campaignId}`,

} as const;

// Metrics & Analytics
export const METRICS_KEYS = {
  // Generic Time-based Metrics
  HOURLY_BID_REQUEST_METRICS: (hour: number) => `metrics:requests:${hour}`,
  HOURLY_BID_REQUEST_LATENCY: (hour: number) => `metrics:latency:${hour}`,
  HOURLY_BID_RESPONSE_ERRORS: (hour: number) => `metrics:errors:${hour}`,
  HOURLY: (entityType: string, entityId: string, hour: number) =>
    `metrics:hourly:${entityType}:${entityId}:${hour}`,
  DAILY: (entityType: string, entityId: string, date: string) =>
    `metrics:daily:${entityType}:${entityId}:${date}`,
  WEEKLY: (entityType: string, entityId: string, week: string) =>
    `metrics:weekly:${entityType}:${entityId}:${week}`,

  // Specific Metrics by Type
  IMPRESSIONS: (entityType: string, entityId: string, timeKey: string) =>
    `metrics:${entityType}:${entityId}:impressions:${timeKey}`,
  CLICKS: (entityType: string, entityId: string, timeKey: string) =>
    `metrics:${entityType}:${entityId}:clicks:${timeKey}`,
  CONVERSIONS: (entityType: string, entityId: string, timeKey: string) =>
    `metrics:${entityType}:${entityId}:conversions:${timeKey}`,
  SPEND: (entityType: string, entityId: string, timeKey: string) =>
    `metrics:${entityType}:${entityId}:spend:${timeKey}`,
  REVENUE: (entityType: string, entityId: string, timeKey: string) =>
    `metrics:${entityType}:${entityId}:revenue:${timeKey}`,
  LAST_UPDATED: (entityType: string, entityId: string, timeKey: string) =>
    `metrics:${entityType}:${entityId}:updated:${timeKey}`,

  // Aggregated System Metrics
  HOURLY_TOTAL_IMPRESSIONS: (hour: string) =>
    `metrics:impressions:total:${hour}`,
  HOURLY_IMPRESSIONS_BY_DEVICE: (deviceType: string, dateHour: string) =>
    `metrics:impressions:${deviceType}:${dateHour}`,
  HOURLY_TOTAL_REVENUE: (hour: string) => `metrics:revenue:total:${hour}`,
  HOURLY_VIEWABLE_IMPRESSIONS: (hour: string, viewable: boolean) =>
    `metrics:impressions:${viewable ? 'viewable' : 'nonviewable'}:${hour}`,

  // Auction Metrics
  AUCTION_LATENCY: (inventoryId: string) =>
    `metrics:auction-latency:${inventoryId}`,
  BID_SUCCESS_RATE: (campaignId: string) => `metrics:bid-success:${campaignId}`,
  AUCTION_COUNT: (hour: string) => `metrics:auctions:${hour}`,
  BID_COUNT: (hour: string) => `metrics:bids:${hour}`,
  WIN_COUNT: (hour: string) => `metrics:wins:${hour}`,

  // Metric
  HOURLY_TOTAL_AUCTION_METRICS: (hour: number) => `metrics:auctions:total:${hour}`,
  HOURLY_AUCTION_WINNER_METRICS: (winner: boolean, hour: number) => `metrics:auctions:${winner ? 'filled' : 'unfilled'}:${hour}`,
  HOURLY_PROCESSING_TIME_METRICS: (hour: number) => `metrics:processing-time:${hour}`,
  HOURLY_INVENTORY_REQUEST_METRICS: (inventoryId: string, hour: number) => `metrics:inventory:${inventoryId}:requests:${hour}`
} as const;

// Pattern Matching Keys (for bulk operations)
export const PATTERN_KEYS = {
  CAMPAIGN_CACHE: (campaignId: string) => `*:${campaignId}:*`,
  INVENTORY_CACHE: (inventoryId: string) => `*:${inventoryId}:*`,
  METRICS_BY_TIME: (timeKey: string) => `metrics:*:*:${timeKey}`,
  BUDGET_BY_DATE: (date: string) => `budget:*:*:${date}`,
} as const;

export const HEALTH_KEYS = {
  REDIS_HEALTH_CHECK: 'redis:health:check',
};


// Backward Compatibility - Legacy REDIS_KEYS export
// @deprecated - Use specific key namespaces instead
export const REDIS_KEYS = {
  ...RTB_KEYS,
  ...CAMPAIGN_KEYS,
  ...CREATIVE_KEYS,
  ...INVENTORY_KEYS,
  ...PRICING_KEYS,
  ...METRICS_KEYS,
  ...HEALTH_KEYS,
  ...PATTERN_KEYS,
} as const;

// TTL Configuration
export const RTB_CACHE_TTL = {
  BID_REQUEST: 3600, // 1 hour
  HOURLY_BID_REQUEST_METRICS: 7200, // 2 hours
  HOURLY_BID_RESPONSE_ERRORS: 7200,
  HOURLY_TOTAL_AUCTION_METRICS: 604800, // 7 days
  HOURLY_PROCESSING_TIME_METRICS: 604800, // 7 days
  BID_REQUEST_LOCK: 30, // 30 seconds
  CAMPAIGN_BUDGET_INFO: 3600, // 1 hour
  CAMPAIGN_ELIGIBILITY_BUDGET: 300, // 5 minutes
  CAMPAIGN_ELIGIBILITY: 300, // 5 minutes
  BID_RESPONSE: 3600, // 1 hour
  AUCTION_RESULT: 3600, // 1 hour
  ELIGIBILITY_CACHE: 86400, // 24 hours
  TARGETING_RULES_CACHE: 86400, // 24 hours
  CREATIVE_PERFORMANCE: 604800, // 7 days
  INVENTORY_PERFORMANCE: 604800, // 7 days
} as const;
