// ===============================
// Core RTB (Real-Time Bidding)
// ===============================

export const RTB_KEYS = {
  BID_REQUEST: (requestId: string) => `rtb:bid-request:${requestId}`,
  BID_RESPONSE: (bidResponseId: string) => `bid_response:${bidResponseId}`,
  IMP_DEDUPLICATION: (bidResponseId: string, slotId: string, userFingerprint: string) => `imp:${bidResponseId}:${slotId}:${userFingerprint}`,
  BID_REQUEST_LOCK: (requestId: string) => `lock:bid-request:${requestId}`,
  AUCTION_RESULT: (requestId: string) => `rtb:auction:${requestId}`,
  HOURLY_BID_REQUEST_METRICS: (hour: number) => `metrics:requests:${hour}`,
  HOURLY_BID_RESPONSE_ERRORS: (hour: number) => `metrics:errors:${hour}`,
  HOURLY_BID_REQUEST_LATENCY: (hour: number) => `metrics:latency:${hour}`,
} as const;

// ==========================
// Campaign Management
// ==========================

export const CAMPAIGN_KEYS = {
  // Eligibility & Targeting
  ELIGIBLE_CAMPAIGNS: (inventoryId: string, deviceType: string) =>
    `campaign:eligible:${inventoryId}:${deviceType}`,

  // Budget
  CAMPAIGN_BUDGET: (campaignId: string, date: string) =>
    `budget:campaign:${campaignId}:${date}`,

  CAMPAIGN_BUDGET_INFO: (campaignId: string, today: string) =>
    `campaign:budget:info:${campaignId}:${today}`,

  // Status
  CAMPAIGN_STATUS: (campaignId: string) => `campaign:status:${campaignId}`,

  // Daily budget spend tracking
  DAILY_BUDGET_SPEND: (campaignId: string, date: string) =>
    `campaign:budget:daily:${campaignId}:${date}`,

  DAILY_BUDGET_LIMIT: (campaignId: string) =>
    `campaign:budget:limit:${campaignId}`,
  USER_CAMPAIGN_FREQUENCY: (userId: string, campaignId: string) =>
    `user:campaign:frequency:${userId}:${campaignId}`,
} as const;

// ==========================
// Creative Management
// ==========================

export const CREATIVE_KEYS = {
  CREATIVE_ROUND_ROBIN: (campaignId: string) =>
    `campaign:${campaignId}:creative_counter`,
} as const;

// ==========================
// Pricing & Bidding
// ==========================

export const PRICING_KEYS = {
  DEVICE_MULTIPLIER: (deviceType: string, campaignId: string) =>
    `bid:adj:multiplier:device:${campaignId}:${deviceType}`,

  GEO_MULTIPLIER: (country: string, campaignId: string) =>
    `bid:adj:multiplier:geo:${campaignId}:${country}`,

  INVENTORY_QUALITY_MULTIPLIER: (inventoryId: string) =>
    `bid:adj:multiplier:inventory:${inventoryId}`,
} as const;

// ==========================
// Metrics: Impressions & Clicks
// ==========================

export const METRICS_KEYS = {
  CAMPAIGN_IMPRESSIONS: (campaignId: string, date: string) =>
    `metrics:campaign:${campaignId}:impressions:${date}`,

  CAMPAIGN_CLICKS: (campaignId: string, date: string) =>
    `metrics:campaign:${campaignId}:clicks:${date}`,

  CREATIVE_IMPRESSIONS: (creativeId: string, date: string) =>
    `metrics:creative:${creativeId}:impressions:${date}`,

  CREATIVE_CLICKS: (creativeId: string, date: string) =>
    `metrics:creative:${creativeId}:clicks:${date}`,
  HOURLY_TOTAL_AUCTION_METRICS: (hour: number) =>
    `metrics:total-auctions:${hour}`,
  HOURLY_AUCTION_WINNER_METRICS: (hasWinner: boolean, hour: number) =>
    `metrics:auction-winner:${hasWinner}:${hour}`,
  HOURLY_PROCESSING_TIME_METRICS: (hour: number) =>
    `metrics:processing-time:${hour}`,
  HOURLY_INVENTORY_REQUEST_METRICS: (inventoryId: string, hour: number) =>
    `metrics:inventory-requests:${inventoryId}:${hour}`,
} as const;

// ==========================
// Events (Pending)
// ==========================

export const EVENT_KEYS = {
  PENDING_IMPRESSIONS: 'events:impressions:pending',
  PENDING_CLICKS: 'events:clicks:pending',
} as const;

// ==========================
// Revenue Tracking
// ==========================

export const REVENUE_KEYS = {
  PUBLISHER_REVENUE: (publisherId: string, date: string) =>
    `revenue:publisher:amt:${publisherId}:${date}`,

  SYSTEM_REVENUE: (date: string) => `revenue:system:amt:${date}`,

  ADVERTISER_SPENDING: (advertiserId: string, date: string) =>
    `spending:advertiser:amt:${advertiserId}:${date}`,

  CREATIVE_SPENDING: (creativeId: string, date: string) =>
    `spending:creative:amt:${creativeId}:${date}`,

  CAMPAIGN_SPENDING: (campaignId: string, date: string) =>
    `spending:campaign:amt:${campaignId}:${date}`,

  PUBLISHER_REVENUE_DAILY: (publisherId: string, today: string) =>
    `publisher:daily:${publisherId}:${today}`,

  ADVERTISER_SPENDING_DAILY: (
    advertiserId: string,
    campaignId: string,
    today: string,
  ) => `advertiser:daily:${advertiserId}:${campaignId}:${today}`,

  SYSTEM_REVENUE_DAILY: (today: string) => `system:daily:${today}`,

  PUBLISHER_REVENUE_PENDING: 'publisher:revenue:pending',
  ADVERTISER_SPENDING_PENDING: 'advertiser:spending:pending',
  SYSTEM_REVENUE_PENDING: 'system:revenue:pending',

  PUBLISHER_REVENUE_TIERS: (publisherId: string) =>
    `revenue:publisher:tiers:${publisherId}`,

  BUDGET_TRANSACTION_PENDING: `budget:transactions:pending`,
  BUDGET_RESERVATION: (reservationId: string) =>
    `budget:reservation:${reservationId}`,
  RESERVATION_TRACKING: (today: string, campaignId: string) =>
    `budget:reservations:${today}:${campaignId}`,
  REVENUE_METADATA: (reservationId: string) =>
    `revenue:metadata:${reservationId}`,
} as const;

// ==========================
// Bid Response
// ==========================

export const BID_RESPONSE_KEYS = {
  BID_RESPONSE: (bidResponseId: string) => `bid:response:${bidResponseId}`,
} as const;

// ==========================
// Fraud Detection
// ==========================

export const FRAUD_KEYS = {
  IP_IMPRESSION_COUNT: (ip: string, date: string) =>
    `fraud:ip:impressions:${ip}:${date}`,

  IP_CLICK_COUNT: (ip: string, date: string) => `fraud:ip:clicks:${ip}:${date}`,

  CAMPAIGN_IP_COUNT: (campaignId: string, ip: string, date: string) =>
    `fraud:campaign:${campaignId}:ip:${ip}:${date}`,

  USER_AGENT_COUNT: (uaHash: string, date: string) =>
    `fraud:ua:${uaHash}:${date}`,

  IMPRESSION_TIMESTAMP: (impressionId: string) =>
    `fraud:impression:${impressionId}:timestamp`,

  BLOCKED_IPS: 'fraud:blocked:ips',

  BLOCKED_USER_AGENTS: 'fraud:blocked:uas',
} as const;

// ==========================
// Health Check
// ==========================

export const HEALTH_KEYS = {
  REDIS_HEALTH_CHECK: 'redis:health:check',
  RTB_SYSTEM_HEALTH: 'rtb:system:health',
  DATABASE_HEALTH: 'database:health',
  KAFKA_HEALTH: 'kafka:health',
};

// ==========================
// Combined Keys
// ==========================

export const REDIS_KEYS = {
  ...RTB_KEYS,
  ...CAMPAIGN_KEYS,
  ...CREATIVE_KEYS,
  ...PRICING_KEYS,
  ...METRICS_KEYS,
  ...EVENT_KEYS,
  ...REVENUE_KEYS,
  ...BID_RESPONSE_KEYS,
  ...FRAUD_KEYS,
  ...HEALTH_KEYS,
} as const;

// ==========================
// TTL CONFIGURATION
// ==========================

export const RTB_CACHE_TTL = {
  // Core RTB
  BID_REQUEST: 3600, // 1 hr
  BID_RESPONSE: 300, // 5 min
  BID_REQUEST_LOCK: 30, // 30 sec
  AUCTION_RESULT: 3600, // 1 hr
  AUCTION_STATE: 300, // 5 min
  IMP_DEDUPLICATION: 600, // 10 min

  // Campaign
  CAMPAIGN_ELIGIBILITY: 1800, // 30 min
  CAMPAIGN_BUDGET_INFO: 7200, // 2 hr

  // Creative
  CREATIVE_ROUND_ROBIN: 86400, // 24 hr

  // Metrics
  HOURLY_BID_REQUEST_METRICS: 7200, // 2 hr
  HOURLY_BID_RESPONSE_ERRORS: 7200, // 2 hr
  HOURLY_TOTAL_AUCTION_METRICS: 604800, // 7 days
  HOURLY_PROCESSING_TIME_METRICS: 604800, // 7 days

  // Fraud
  MAX_IMPRESSIONS_PER_IP_PER_DAY: 1000,
  MAX_CLICKS_PER_IP_PER_DAY: 50,
  MAX_IMPRESSIONS_PER_CAMPAIGN_IP_PER_DAY: 100,
  MIN_TIME_BETWEEN_IMPRESSION_CLICK: 100, // ms
  MAX_TIME_BETWEEN_IMPRESSION_CLICK: 300000, // 5 min

  // Revenue pipelines
  PUBLISHER_REVENUE_TIERS: 2592000, // 30 days
  PUBLISHER_REVENUE_PIPELINE: 604800, // 7 days
  ADVERTISER_SPENDING_PIPELINE: 604800, // 7 days
  SYSTEM_REVENUE_PIPELINE: 604800, // 7 days
  BUDGET_RESERVATION: 300, // 5 min
  RESERVATION_TRACKING: 86400, // 24 hr
  REVENUE_METADATA: 600, // 5 min longer than reservation
} as const;
