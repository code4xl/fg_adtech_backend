export const RTB_REDIS_KEYS = {
    // ==========================================
    // EXISTING KEYS (Phase 1-6) - Keep as is
    // ==========================================

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

    // ==========================================
    // PHASE 7: NEW CACHE OPTIMIZATION KEYS
    // ==========================================

    // Multi-Level Campaign Eligibility Cache
    CAMPAIGN_ELIGIBILITY_L1: (inventoryId: string, deviceType: string, country: string) =>
        `cache:l1:eligible:${inventoryId}:${deviceType}:${country}`,
    CAMPAIGN_ELIGIBILITY_L2: (inventoryId: string, deviceType: string) =>
        `cache:l2:eligible:${inventoryId}:${deviceType}`,
    CAMPAIGN_ELIGIBILITY_METADATA: (cacheKey: string) =>
        `cache:meta:eligible:${cacheKey}`,

    // Advanced Budget Management
    CAMPAIGN_BUDGET_CONFIG: (campaignId: string) =>
        `budget:config:${campaignId}`,
    CAMPAIGN_BUDGET_HOURLY: (campaignId: string, hour: string) =>
        `budget:hourly:${campaignId}:${hour}`,
    CAMPAIGN_BUDGET_DAILY: (campaignId: string, date: string) =>
        `budget:daily:${campaignId}:${date}`,
    CAMPAIGN_BUDGET_TOTAL: (campaignId: string) =>
        `budget:total:${campaignId}`,
    CAMPAIGN_BUDGET_PACE: (campaignId: string) =>
        `budget:pace:${campaignId}`,
    CAMPAIGN_PAUSE_FLAG: (campaignId: string) =>
        `campaign:paused:${campaignId}`,
    CAMPAIGN_BUDGET_ALERT: (campaignId: string, threshold: number) =>
        `budget:alert:${campaignId}:${threshold}`,

    // Performance Metrics Cache (Multi-Timeframe)
    METRICS_HOURLY: (entityType: string, entityId: string, hour: string) =>
        `metrics:hourly:${entityType}:${entityId}:${hour}`,
    METRICS_DAILY: (entityType: string, entityId: string, date: string) =>
        `metrics:daily:${entityType}:${entityId}:${date}`,
    METRICS_WEEKLY: (entityType: string, entityId: string, week: string) =>
        `metrics:weekly:${entityType}:${entityId}:${week}`,

    // Specific Metric Types
    METRIC_IMPRESSIONS: (entityType: string, entityId: string, timeKey: string) =>
        `metrics:${entityType}:${entityId}:impressions:${timeKey}`,
    METRIC_CLICKS: (entityType: string, entityId: string, timeKey: string) =>
        `metrics:${entityType}:${entityId}:clicks:${timeKey}`,
    METRIC_CONVERSIONS: (entityType: string, entityId: string, timeKey: string) =>
        `metrics:${entityType}:${entityId}:conversions:${timeKey}`,
    METRIC_SPEND: (entityType: string, entityId: string, timeKey: string) =>
        `metrics:${entityType}:${entityId}:spend:${timeKey}`,
    METRIC_REVENUE: (entityType: string, entityId: string, timeKey: string) =>
        `metrics:${entityType}:${entityId}:revenue:${timeKey}`,
    METRIC_LAST_UPDATED: (entityType: string, entityId: string, timeKey: string) =>
        `metrics:${entityType}:${entityId}:updated:${timeKey}`,

    // Targeting Rules Cache
    TARGETING_RULES_CACHE: (campaignId: string) =>
        `targeting:rules:${campaignId}`,
    TARGETING_RULES_COMPILED: (campaignId: string) =>
        `targeting:compiled:${campaignId}`,
    TARGETING_EVALUATION_RESULT: (campaignId: string, contextHash: string) =>
        `targeting:result:${campaignId}:${contextHash}`,

    // Floor Price Cache
    FLOOR_PRICE_INVENTORY: (inventoryId: string) =>
        `floor:inventory:${inventoryId}`,
    FLOOR_PRICE_PUBLISHER: (publisherId: string) =>
        `floor:publisher:${publisherId}`,
    FLOOR_PRICE_DEVICE: (deviceType: string) =>
        `floor:device:${deviceType}`,
    FLOOR_PRICE_GEO: (country: string, region?: string) =>
        `floor:geo:${country}${region ? `:${region}` : ''}`,

    // Bid Adjustment Factors
    BID_ADJUSTMENT_CAMPAIGN: (campaignId: string) =>
        `bid:adj:campaign:${campaignId}`,
    BID_ADJUSTMENT_DEVICE: (deviceType: string) =>
        `bid:adj:device:${deviceType}`,
    BID_ADJUSTMENT_GEO: (country: string) =>
        `bid:adj:geo:${country}`,
    BID_ADJUSTMENT_TIME: (hour: number) =>
        `bid:adj:time:${hour}`,
    BID_ADJUSTMENT_INVENTORY: (inventoryId: string) =>
        `bid:adj:inventory:${inventoryId}`,

    // Real-time Auction Statistics
    AUCTION_STATS_HOURLY: (hour: string) =>
        `stats:auction:hourly:${hour}`,
    AUCTION_STATS_DAILY: (date: string) =>
        `stats:auction:daily:${date}`,
    AUCTION_LATENCY_BUCKET: (latencyMs: number) =>
        `stats:latency:${Math.floor(latencyMs / 10) * 10}`, // 10ms buckets
    AUCTION_WIN_RATE: (hour: string) =>
        `stats:winrate:${hour}`,
    AUCTION_FILL_RATE: (hour: string) =>
        `stats:fillrate:${hour}`,

    // ==========================================
    // PHASE 7: TIMESCALE DB CACHE KEYS
    // ==========================================

    // TimescaleDB Sync Status (Replaces Timestream)
    TIMESCALE_SYNC_STATUS: (tableName: string) =>
        `timescale:sync:status:${tableName}`,
    TIMESCALE_SYNC_LOCK: (tableName: string) =>
        `timescale:sync:lock:${tableName}`,
    TIMESCALE_LAST_SYNC: (tableName: string) =>
        `timescale:sync:last:${tableName}`,
    TIMESCALE_SYNC_ERRORS: (tableName: string) =>
        `timescale:sync:errors:${tableName}`,
    TIMESCALE_BATCH_QUEUE: (tableName: string) =>
        `timescale:batch:queue:${tableName}`,
    TIMESCALE_BATCH_PROCESSING: (batchId: string) =>
        `timescale:batch:processing:${batchId}`,

    // TimescaleDB Analytics Cache
    TIMESCALE_ANALYTICS_CACHE: (entityType: string, entityId: string, timeRange: string) =>
        `timescale:analytics:${entityType}:${entityId}:${timeRange}`,
    TIMESCALE_AGGREGATED_METRICS: (entityType: string, timeBucket: string) =>
        `timescale:agg:${entityType}:${timeBucket}`,
    TIMESCALE_REALTIME_METRICS: (entityId: string, window: string) =>
        `timescale:realtime:${entityId}:${window}`,
    TIMESCALE_DASHBOARD_CACHE: (dashboardId: string, timeRange: string) =>
        `timescale:dashboard:${dashboardId}:${timeRange}`,

    // TimescaleDB Query Cache
    TIMESCALE_QUERY_CACHE: (queryHash: string) =>
        `timescale:query:${queryHash}`,
    TIMESCALE_QUERY_STATS: (queryType: string) =>
        `timescale:query:stats:${queryType}`,

    // ==========================================
    // PHASE 7: ADVANCED CACHING FEATURES
    // ==========================================

    // Cache Warming and Preloading
    CACHE_WARMUP_STATUS: (warmupId: string) =>
        `cache:warmup:status:${warmupId}`,
    CACHE_WARMUP_PROGRESS: (warmupId: string) =>
        `cache:warmup:progress:${warmupId}`,
    CACHE_PRELOAD_QUEUE: (priority: 'high' | 'medium' | 'low') =>
        `cache:preload:queue:${priority}`,
    CACHE_PRELOAD_STATUS: (entityType: string, entityId: string) =>
        `cache:preload:${entityType}:${entityId}`,

    // Cache Health Monitoring
    CACHE_HEALTH_STATUS: () => `cache:health:status`,
    CACHE_HEALTH_METRICS: () => `cache:health:metrics`,
    CACHE_HIT_RATE: (timeWindow: string) =>
        `cache:hitrate:${timeWindow}`,
    CACHE_MISS_RATE: (timeWindow: string) =>
        `cache:missrate:${timeWindow}`,
    CACHE_ERROR_COUNT: (timeWindow: string) =>
        `cache:errors:${timeWindow}`,
    CACHE_LATENCY_STATS: (operation: string) =>
        `cache:latency:${operation}`,

    // Circuit Breaker for Cache Operations
    CACHE_CIRCUIT_BREAKER: (operation: string) =>
        `cache:circuit:${operation}`,
    CACHE_CIRCUIT_FAILURES: (operation: string) =>
        `cache:circuit:failures:${operation}`,
    CACHE_CIRCUIT_LAST_FAILURE: (operation: string) =>
        `cache:circuit:lastfail:${operation}`,

    // Cache Invalidation Patterns
    CACHE_INVALIDATION_QUEUE: () => `cache:invalidation:queue`,
    CACHE_INVALIDATION_PATTERN: (pattern: string) =>
        `cache:invalidation:pattern:${pattern}`,
    CACHE_DEPENDENCY_MAP: (cacheKey: string) =>
        `cache:deps:${cacheKey}`,
    CACHE_INVALIDATION_LOG: (timestamp: string) =>
        `cache:invalidation:log:${timestamp}`,

    // Performance Optimization Keys
    PERFORMANCE_BASELINE: (metric: string) =>
        `perf:baseline:${metric}`,
    PERFORMANCE_ALERT_THRESHOLD: (metric: string, level: string) =>
        `perf:alert:${metric}:${level}`,
    PERFORMANCE_DEGRADATION: (component: string) =>
        `perf:degradation:${component}`,

    // ==========================================
    // PHASE 7: CAMPAIGN OPTIMIZATION CACHE
    // ==========================================

    // Bid Strategy Cache
    BID_STRATEGY_CONFIG: (campaignId: string) =>
        `bid:strategy:config:${campaignId}`,
    BID_STRATEGY_PERFORMANCE: (campaignId: string, strategy: string) =>
        `bid:strategy:perf:${campaignId}:${strategy}`,
    BID_OPTIMIZATION_FACTORS: (campaignId: string) =>
        `bid:optimization:factors:${campaignId}`,

    // Creative Performance Cache
    CREATIVE_PERFORMANCE: (creativeId: string, timeWindow: string) =>
        `creative:perf:${creativeId}:${timeWindow}`,
    CREATIVE_A_B_TEST: (testId: string) =>
        `creative:abtest:${testId}`,
    CREATIVE_FATIGUE_SCORE: (creativeId: string) =>
        `creative:fatigue:${creativeId}`,

    // Inventory Quality Scores
    INVENTORY_QUALITY_SCORE: (inventoryId: string) =>
        `inventory:quality:${inventoryId}`,
    INVENTORY_PERFORMANCE_TREND: (inventoryId: string) =>
        `inventory:trend:${inventoryId}`,
    INVENTORY_FRAUD_SCORE: (inventoryId: string) =>
        `inventory:fraud:${inventoryId}`,

    // User Behavior Patterns
    USER_BEHAVIOR_PATTERN: (userSegment: string) =>
        `user:behavior:${userSegment}`,
    USER_CONVERSION_PROBABILITY: (userHash: string) =>
        `user:conversion:prob:${userHash}`,
    USER_FREQUENCY_CAP: (userId: string, campaignId: string) =>
        `user:freqcap:${userId}:${campaignId}`,

    // ==========================================
    // PHASE 7: REAL-TIME ANALYTICS CACHE
    // ==========================================

    // Real-time Dashboards
    DASHBOARD_REALTIME_DATA: (dashboardId: string) =>
        `dashboard:realtime:${dashboardId}`,
    DASHBOARD_KPI_CACHE: (kpiType: string, timeRange: string) =>
        `dashboard:kpi:${kpiType}:${timeRange}`,
    DASHBOARD_ALERT_STATUS: (alertId: string) =>
        `dashboard:alert:${alertId}`,

    // Competitive Intelligence
    COMPETITIVE_BID_DATA: (inventoryId: string, timeWindow: string) =>
        `competitive:bids:${inventoryId}:${timeWindow}`,
    MARKET_PRICE_TRENDS: (category: string, geo: string) =>
        `market:price:${category}:${geo}`,
    COMPETITIVE_ANALYSIS: (advertiserId: string) =>
        `competitive:analysis:${advertiserId}`,

    // Machine Learning Model Cache
    ML_MODEL_PREDICTIONS: (modelId: string, inputHash: string) =>
        `ml:predictions:${modelId}:${inputHash}`,
    ML_MODEL_FEATURES: (modelId: string) =>
        `ml:features:${modelId}`,
    ML_MODEL_PERFORMANCE: (modelId: string) =>
        `ml:performance:${modelId}`,

    // ==========================================
    // PHASE 7: SYSTEM MONITORING KEYS
    // ==========================================

    // System Performance Metrics
    SYSTEM_CPU_USAGE: (timeWindow: string) =>
        `system:cpu:${timeWindow}`,
    SYSTEM_MEMORY_USAGE: (timeWindow: string) =>
        `system:memory:${timeWindow}`,
    SYSTEM_CONNECTION_POOL: (poolName: string) =>
        `system:pool:${poolName}`,
    SYSTEM_QUEUE_DEPTH: (queueName: string) =>
        `system:queue:depth:${queueName}`,

    // Error Tracking and Alerting
    ERROR_RATE_BY_COMPONENT: (component: string, timeWindow: string) =>
        `errors:rate:${component}:${timeWindow}`,
    ERROR_PATTERN_DETECTION: (pattern: string) =>
        `errors:pattern:${pattern}`,
    ALERT_ESCALATION_STATUS: (alertId: string) =>
        `alert:escalation:${alertId}`,

    // Performance SLA Tracking
    SLA_RESPONSE_TIME: (endpoint: string, timeWindow: string) =>
        `sla:response:${endpoint}:${timeWindow}`,
    SLA_AVAILABILITY: (service: string, timeWindow: string) =>
        `sla:availability:${service}:${timeWindow}`,
    SLA_BREACH_COUNTER: (slaType: string) =>
        `sla:breach:${slaType}`,

    // ==========================================
    // UTILITY FUNCTIONS FOR KEY MANAGEMENT
    // ==========================================

    // Helper functions for pattern-based operations
    PATTERN_CAMPAIGN_CACHE: (campaignId: string) =>
        `*:${campaignId}:*`,
    PATTERN_INVENTORY_CACHE: (inventoryId: string) =>
        `*:${inventoryId}:*`,
    PATTERN_METRICS_BY_TIME: (timeKey: string) =>
        `metrics:*:*:${timeKey}`,
    PATTERN_BUDGET_BY_DATE: (date: string) =>
        `budget:*:*:${date}`,

    // Cache namespace organization
    NAMESPACE_SEPARATOR: ':',
    VERSION_SUFFIX: (version: string) => `:v${version}`,
    TEMP_PREFIX: 'temp:',
    BACKUP_PREFIX: 'backup:',

} as const;

export const RTB_CACHE_TTL = {
    // Campaign and Targeting
    CAMPAIGN_ELIGIBILITY: 300,        // 5 minutes - balances accuracy with performance
    TARGETING_RULES: 900,             // 15 minutes - rules change infrequently
    FLOOR_PRICES: 600,                // 10 minutes - pricing updates are moderate
    BID_ADJUSTMENTS: 300,             // 5 minutes - can affect bid calculations significantly

    // Budget Management
    BUDGET_CONFIG: 3600,              // 1 hour - campaign budgets are relatively stable
    BUDGET_STATUS: 60,                // 1 minute - spend tracking needs high accuracy
    BUDGET_ALERTS: 1800,              // 30 minutes - alerts don't need immediate refresh

    // Performance Metrics
    METRICS_REALTIME: 60,             // 1 minute - real-time dashboards need fresh data
    METRICS_HOURLY: 3600,             // 1 hour - hourly aggregations are stable
    METRICS_DAILY: 86400,             // 24 hours - daily metrics change once per day

    // TimescaleDB Cache
    TIMESCALE_ANALYTICS: 300,         // 5 minutes - balance between freshness and performance
    TIMESCALE_AGGREGATIONS: 1800,     // 30 minutes - aggregated data changes slowly
    TIMESCALE_DASHBOARDS: 600,        // 10 minutes - dashboard data for regular refresh

    // System and Health
    HEALTH_STATUS: 30,                // 30 seconds - health checks need frequent updates
    PERFORMANCE_STATS: 300,           // 5 minutes - performance monitoring
    ERROR_TRACKING: 3600,             // 1 hour - error patterns analysis

    // Cache Management
    CACHE_WARMUP: 7200,               // 2 hours - warmup results are useful for extended periods
    INVALIDATION_LOG: 86400,          // 24 hours - keep invalidation history for debugging

    // Machine Learning
    ML_PREDICTIONS: 1800,             // 30 minutes - ML predictions have reasonable shelf life
    ML_FEATURES: 3600,                // 1 hour - feature data is relatively stable

} as const;

/**
 * Cache Priority Levels for Phase 7
 * 
 * **Why priority-based caching:**
 * - Critical data (budgets, eligibility) gets highest priority
 * - Analytics and reporting data can have lower priority
 * - System can gracefully degrade under memory pressure
 */
export const RTB_CACHE_PRIORITY = {
    CRITICAL: 'critical',             // Budget status, campaign eligibility
    HIGH: 'high',                     // Performance metrics, bid adjustments
    MEDIUM: 'medium',                 // Analytics data, dashboard cache
    LOW: 'low',                       // Historical data, logs
    BACKGROUND: 'background'          // Warmup data, precomputed results
} as const;

/**
 * Cache Tag System for Phase 7
 * 
 * **Why cache tagging:**
 * - Enables efficient bulk invalidation
 * - Supports dependency-based cache management
 * - Facilitates cache organization and monitoring
 */
export const RTB_CACHE_TAGS = {
    CAMPAIGN: (campaignId: string) => `campaign:${campaignId}`,
    INVENTORY: (inventoryId: string) => `inventory:${inventoryId}`,
    ADVERTISER: (advertiserId: string) => `advertiser:${advertiserId}`,
    PUBLISHER: (publisherId: string) => `publisher:${publisherId}`,

    // Functional tags
    BUDGET_RELATED: 'budget',
    METRICS_RELATED: 'metrics',
    TARGETING_RELATED: 'targeting',
    REALTIME_DATA: 'realtime',
    TIMESCALE_DATA: 'timescale',

    // Time-based tags
    HOURLY_DATA: 'hourly',
    DAILY_DATA: 'daily',
    WEEKLY_DATA: 'weekly',

    // System tags
    HEALTH_DATA: 'health',
    PERFORMANCE_DATA: 'performance',
    CACHE_MANAGEMENT: 'cache-mgmt'
} as const;