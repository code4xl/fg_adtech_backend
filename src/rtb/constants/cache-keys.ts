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
  CAMPAIGN_BUDGET_INFO: (campaignId: string, today: string) => `campaign:budget:info:${campaignId}:${today}`
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

// Metrics & Analytics - COMPLETE IMPLEMENTATION
export const METRICS_KEYS = {
  // Legacy/Generic Time-based Metrics (Keep for backward compatibility)
  HOURLY_BID_REQUEST_METRICS: (hour: number) => `metrics:requests:${hour}`,
  HOURLY_BID_REQUEST_LATENCY: (hour: number) => `metrics:latency:${hour}`,
  HOURLY_BID_RESPONSE_ERRORS: (hour: number) => `metrics:errors:${hour}`,
  HOURLY: (entityType: string, entityId: string, hour: number) =>
    `metrics:hourly:${entityType}:${entityId}:${hour}`,
  DAILY: (entityType: string, entityId: string, date: string) =>
    `metrics:daily:${entityType}:${entityId}:${date}`,
  WEEKLY: (entityType: string, entityId: string, week: string) =>
    `metrics:weekly:${entityType}:${entityId}:${week}`,

  // Legacy Specific Metrics by Type
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

  // Legacy Aggregated System Metrics
  HOURLY_TOTAL_IMPRESSIONS: (hour: string) =>
    `metrics:impressions:total:${hour}`,
  HOURLY_IMPRESSIONS_BY_DEVICE: (deviceType: string, dateHour: string) =>
    `metrics:impressions:${deviceType}:${dateHour}`,
  HOURLY_TOTAL_REVENUE: (hour: string) => `metrics:revenue:total:${hour}`,
  HOURLY_VIEWABLE_IMPRESSIONS: (hour: string, viewable: boolean) =>
    `metrics:impressions:${viewable ? 'viewable' : 'nonviewable'}:${hour}`,

  // Legacy Auction Metrics
  AUCTION_LATENCY: (inventoryId: string) =>
    `metrics:auction-latency:${inventoryId}`,
  BID_SUCCESS_RATE: (campaignId: string) => `metrics:bid-success:${campaignId}`,
  AUCTION_COUNT: (hour: string) => `metrics:auctions:${hour}`,
  BID_COUNT: (hour: string) => `metrics:bids:${hour}`,
  WIN_COUNT: (hour: string) => `metrics:wins:${hour}`,

  // Legacy Existing Metrics (Keep for backward compatibility)
  HOURLY_TOTAL_AUCTION_METRICS: (hour: number) => `metrics:auctions:total:${hour}`,
  HOURLY_AUCTION_WINNER_METRICS: (winner: boolean, hour: number) => `metrics:auctions:${winner ? 'filled' : 'unfilled'}:${hour}`,
  HOURLY_PROCESSING_TIME_METRICS: (hour: number) => `metrics:processing-time:${hour}`,
  HOURLY_INVENTORY_REQUEST_METRICS: (inventoryId: string, hour: number) => `metrics:inventory:${inventoryId}:requests:${hour}`,

  // ===== NEW RTB METRICS IMPLEMENTATION =====

  // RTB Hourly Metrics
  RTB_HOURLY_TOTAL_AUCTIONS: (hour: number, date: string) => `rtb:metrics:auctions:total:${date}:${hour}`,
  RTB_HOURLY_AUCTION_STATUS: (status: string, hour: number, date: string) => `rtb:metrics:auctions:${status}:${date}:${hour}`,
  RTB_HOURLY_PROCESSING_TIME: (hour: number, date: string) => `rtb:metrics:processing-time:${date}:${hour}`,
  RTB_HOURLY_BID_COUNT: (hour: number, date: string) => `rtb:metrics:bids:total:${date}:${hour}`,

  // Real-time Throughput Metrics (minute-level)
  RTB_THROUGHPUT_PER_MINUTE: (dateHourMinute: string) => `rtb:metrics:throughput:${dateHourMinute}`,
  RTB_THROUGHPUT_BY_STATUS: (dateHourMinute: string, status: string) => `rtb:metrics:throughput:${status}:${dateHourMinute}`,

  // Processing Time Distribution (performance buckets)
  RTB_PROCESSING_TIME_BUCKET: (bucket: string, hour: number) => `rtb:metrics:processing-time:bucket:${bucket}:${hour}`,

  // Error Tracking
  RTB_ERROR_BY_TYPE: (errorType: string, hour: number, date: string) => `rtb:metrics:errors:${errorType}:${date}:${hour}`,
  RTB_RECENT_ERRORS: () => `rtb:metrics:errors:recent`,

  // Real-time Counters (for live dashboards)
  RTB_REALTIME_COUNTER: (minute: number) => `rtb:metrics:realtime:${minute}`,

  // Campaign Specific Metrics
  CAMPAIGN_HOURLY_IMPRESSIONS: (campaignId: string, hour: number, date: string) => `rtb:metrics:campaign:${campaignId}:impressions:${date}:${hour}`,
  CAMPAIGN_HOURLY_CLICKS: (campaignId: string, hour: number, date: string) => `rtb:metrics:campaign:${campaignId}:clicks:${date}:${hour}`,
  CAMPAIGN_HOURLY_SPEND: (campaignId: string, hour: number, date: string) => `rtb:metrics:campaign:${campaignId}:spend:${date}:${hour}`,
  CAMPAIGN_HOURLY_CONVERSIONS: (campaignId: string, hour: number, date: string) => `rtb:metrics:campaign:${campaignId}:conversions:${date}:${hour}`,

  // Inventory Specific Metrics
  INVENTORY_HOURLY_REQUESTS: (inventoryId: string, hour: number, date: string) => `rtb:metrics:inventory:${inventoryId}:requests:${date}:${hour}`,
  INVENTORY_HOURLY_REVENUE: (inventoryId: string, hour: number, date: string) => `rtb:metrics:inventory:${inventoryId}:revenue:${date}:${hour}`,
  INVENTORY_HOURLY_FILL_RATE: (inventoryId: string, hour: number, date: string) => `rtb:metrics:inventory:${inventoryId}:fill-rate:${date}:${hour}`,

  // Publisher Specific Metrics
  PUBLISHER_HOURLY_REVENUE: (publisherId: string, hour: number, date: string) => `rtb:metrics:publisher:${publisherId}:revenue:${date}:${hour}`,
  PUBLISHER_HOURLY_REQUESTS: (publisherId: string, hour: number, date: string) => `rtb:metrics:publisher:${publisherId}:requests:${date}:${hour}`,

  // Advertiser Specific Metrics
  ADVERTISER_HOURLY_SPEND: (advertiserId: string, hour: number, date: string) => `rtb:metrics:advertiser:${advertiserId}:spend:${date}:${hour}`,
  ADVERTISER_HOURLY_IMPRESSIONS: (advertiserId: string, hour: number, date: string) => `rtb:metrics:advertiser:${advertiserId}:impressions:${date}:${hour}`,

  // Creative Performance Metrics
  CREATIVE_HOURLY_IMPRESSIONS: (creativeId: string, hour: number, date: string) => `rtb:metrics:creative:${creativeId}:impressions:${date}:${hour}`,
  CREATIVE_HOURLY_CLICKS: (creativeId: string, hour: number, date: string) => `rtb:metrics:creative:${creativeId}:clicks:${date}:${hour}`,
  CREATIVE_HOURLY_CTR: (creativeId: string, hour: number, date: string) => `rtb:metrics:creative:${creativeId}:ctr:${date}:${hour}`,

  // Geo Performance Metrics
  GEO_HOURLY_REQUESTS: (country: string, hour: number, date: string) => `rtb:metrics:geo:${country}:requests:${date}:${hour}`,
  GEO_HOURLY_REVENUE: (country: string, hour: number, date: string) => `rtb:metrics:geo:${country}:revenue:${date}:${hour}`,

  // Device Performance Metrics
  DEVICE_HOURLY_REQUESTS: (deviceType: string, hour: number, date: string) => `rtb:metrics:device:${deviceType}:requests:${date}:${hour}`,
  DEVICE_HOURLY_REVENUE: (deviceType: string, hour: number, date: string) => `rtb:metrics:device:${deviceType}:revenue:${date}:${hour}`,

  // System Health Metrics
  SYSTEM_HEALTH_STATUS: () => `rtb:metrics:system:health`,
  SYSTEM_UPTIME: () => `rtb:metrics:system:uptime`,
  SYSTEM_LOAD: () => `rtb:metrics:system:load`,
} as const;

// Pattern Matching Keys (for bulk operations)
export const PATTERN_KEYS = {
  CAMPAIGN_CACHE: (campaignId: string) => `*:${campaignId}:*`,
  INVENTORY_CACHE: (inventoryId: string) => `*:${inventoryId}:*`,
  METRICS_BY_TIME: (timeKey: string) => `metrics:*:*:${timeKey}`,
  BUDGET_BY_DATE: (date: string) => `budget:*:*:${date}`,
  RTB_METRICS_BY_DATE: (date: string) => `rtb:metrics:*:${date}:*`,
  RTB_METRICS_BY_HOUR: (hour: number) => `rtb:metrics:*:*:${hour}`,
} as const;

// Health Check Keys
export const HEALTH_KEYS = {
  REDIS_HEALTH_CHECK: 'redis:health:check',
  RTB_SYSTEM_HEALTH: 'rtb:system:health',
  DATABASE_HEALTH: 'database:health',
  KAFKA_HEALTH: 'kafka:health',
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

// ===== TTL CONFIGURATION =====
export const RTB_CACHE_TTL = {
  // Core RTB Operations
  BID_REQUEST: 3600, // 1 hour
  BID_REQUEST_LOCK: 30, // 30 seconds
  AUCTION_RESULT: 3600, // 1 hour
  AUCTION_STATE: 300, // 5 minutes

  // Campaign & Targeting
  CAMPAIGN_ELIGIBILITY: 300, // 5 minutes
  CAMPAIGN_ELIGIBILITY_BUDGET: 300, // 5 minutes
  CAMPAIGN_BUDGET_INFO: 3600, // 1 hour
  TARGETING_RULES_CACHE: 86400, // 24 hours
  TARGETING_EVALUATION_RESULT: 1800, // 30 minutes

  // Performance Metrics
  CREATIVE_PERFORMANCE: 604800, // 7 days
  INVENTORY_PERFORMANCE: 604800, // 7 days
  ELIGIBILITY_CACHE: 86400, // 24 hours

  // Legacy Metrics (Keep for backward compatibility)
  HOURLY_BID_REQUEST_METRICS: 7200, // 2 hours
  HOURLY_BID_RESPONSE_ERRORS: 7200, // 2 hours
  HOURLY_TOTAL_AUCTION_METRICS: 604800, // 7 days
  HOURLY_PROCESSING_TIME_METRICS: 604800, // 7 days

  // ===== NEW RTB METRICS TTL =====

  // Hourly Metrics (kept for historical analysis)
  HOURLY_METRICS: 604800, // 7 days
  RTB_HOURLY_AUCTIONS: 604800, // 7 days
  RTB_HOURLY_PROCESSING_TIME: 604800, // 7 days
  RTB_HOURLY_ERRORS: 604800, // 7 days

  // Real-time Metrics (short-lived for performance)
  THROUGHPUT_METRICS: 300, // 5 minutes
  REALTIME_COUNTERS: 300, // 5 minutes
  PROCESSING_TIME_BUCKETS: 3600, // 1 hour

  // Error Tracking
  ERROR_METRICS: 86400, // 24 hours
  ERROR_DETAILS: 86400, // 24 hours (for debugging)
  RECENT_ERRORS: 86400, // 24 hours

  // Campaign Metrics
  CAMPAIGN_METRICS: 604800, // 7 days
  CAMPAIGN_HOURLY_METRICS: 604800, // 7 days

  // Inventory Metrics
  INVENTORY_METRICS: 604800, // 7 days
  INVENTORY_HOURLY_METRICS: 604800, // 7 days

  // Publisher/Advertiser Metrics
  PUBLISHER_METRICS: 604800, // 7 days
  ADVERTISER_METRICS: 604800, // 7 days

  // Creative Performance
  CREATIVE_METRICS: 604800, // 7 days
  CREATIVE_HOURLY_METRICS: 604800, // 7 days

  // Geo/Device Metrics
  GEO_METRICS: 604800, // 7 days
  DEVICE_METRICS: 604800, // 7 days

  // System Health
  SYSTEM_HEALTH: 300, // 5 minutes
  SYSTEM_STATUS: 60, // 1 minute
  UPTIME_METRICS: 86400, // 24 hours

  // Bid Adjustments & Pricing
  BID_ADJUSTMENTS: 3600, // 1 hour
  PRICING_MULTIPLIERS: 3600, // 1 hour
  FLOOR_PRICES: 3600, // 1 hour

  // Fraud Detection
  FRAUD_SCORES: 3600, // 1 hour
  FRAUD_PATTERNS: 86400, // 24 hours

  // A/B Testing
  AB_TEST_RESULTS: 86400, // 24 hours
  PERFORMANCE_COMPARISONS: 3600, // 1 hour
} as const;

// TTL Helper Functions
// export const TTL_HELPERS = {
//   /**
//    * Get appropriate TTL for metrics based on granularity
//    */
//   getMetricsTTL: (granularity: 'minute' | 'hour' | 'day' | 'week'): number => {
//     switch (granularity) {
//       case 'minute': return 300; // 5 minutes
//       case 'hour': return 3600; // 1 hour
//       case 'day': return 86400; // 24 hours
//       case 'week': return 604800; // 7 days
//       default: return 3600;
//     }
//   },

//   /**
//    * Get TTL for error tracking based on severity
//    */
//   getErrorTTL: (severity: 'low' | 'medium' | 'high' | 'critical'): number => {
//     switch (severity) {
//       case 'low': return 3600; // 1 hour
//       case 'medium': return 86400; // 24 hours
//       case 'high': return 604800; // 7 days
//       case 'critical': return 2592000; // 30 days
//       default: return 86400;
//     }
//   },

//   /**
//    * Get TTL for real-time vs historical data
//    */
//   getDataTTL: (type: 'realtime' | 'historical' | 'archive'): number => {
//     switch (type) {
//       case 'realtime': return 300; // 5 minutes
//       case 'historical': return 604800; // 7 days
//       case 'archive': return 2592000; // 30 days
//       default: return 3600;
//     }
//   }
// } as const;