export const kafkaTopics = {
  BID_REQUESTS: 'rtb.bid-requests.v2',
  BID_RESPONSES: 'rtb.bid-responses.v2',
  AUCTION_RESULTS: 'rtb.auction-results.v2',
  AUCTION_PROCESSING: 'rtb.auction-processing.v2',
  AUCTION_COMPLETION: 'auction.completion',

  IMPRESSIONS: 'tracking.impressions.v2',
  CLICKS: 'tracking.clicks.v2',

  CAMPAIGN_METRICS: 'analytics.campaign-metrics.v2',
  TIMESCALE_SYNC: 'analytics.timescale-sync.v2',

  DLQ_BID_REQUESTS: 'dlq.bid-requests',

  DLQ_TRACKING: 'dlq.tracking-events',

  RTB_OPTIMIZATION: 'rtb.optimization.v1',
  CAMPAIGN_BUDGET_ALERTS: 'alerts.campaign-budget.v1',
  PERFORMANCE_UPDATES: 'analytics.performance-updates.v1',

  FRAUD_ALERTS: 'alerts.fraud-detection.v1',
  PERFORMANCE_ALERTS: 'alerts.performance.v1',

  GOOGLE_BID_REQUESTS: 'external.google.bid-requests.v1',
  GOOGLE_BID_RESPONSES: 'external.google.bid-responses.v1',

  BID_ELIGIBILITY_CHECK: 'rtb.bid-eligibility.v1',
  AUCTION_PREPROCESSING: 'rtb.auction-preprocessing.v1',
  CREATIVE_PERFORMANCE_UPDATE: 'analytics.creative-performance.v1',
  BUDGET_EXHAUSTION_ALERT: 'alerts.budget-exhaustion.v1',
  FRAUD_DETECTION: 'security.fraud-detection.v1',

  TIMESCALE_BATCH_IMPRESSIONS: 'timescale.batch.impressions.v1',
  TIMESCALE_BATCH_CLICKS: 'timescale.batch.clicks.v1',

  HOURLY_AGGREGATION: 'analytics.hourly.v2',
  DLQ_AUCTIONS: 'dlq.auctions',

  TIMESCALE_HEALTH_CHECK: 'timescale.health-check.v1',
  TIMESCALE_ANALYTICS_REQUEST: 'timescale.analytics-request.v1',
  TIMESCALE_BULK_SYNC: 'timescale.bulk-sync.v1',
};
