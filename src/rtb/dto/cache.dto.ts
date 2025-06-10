// src/rtb/dto/cache.dto.ts

import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Phase 7 DTOs - Caching & Performance Optimization
 *
 * **Why specific DTOs for caching operations:**
 * - Ensures type safety for cache operations
 * - Provides validation for cache parameters
 * - Standardizes cache response formats
 * - Enables proper API documentation
 * - Supports performance monitoring and debugging
 */

// ==========================================
// CAMPAIGN ELIGIBILITY CACHE DTOs
// ==========================================

export class CachedCampaignDto {
  @ApiProperty({ description: 'Campaign ID' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Campaign name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Advertiser ID' })
  @IsString()
  advertiserId: string;

  @ApiProperty({ description: 'Campaign status' })
  @IsEnum(['ACTIVE', 'PAUSED', 'COMPLETED'])
  status: string;

  @ApiProperty({ description: 'Bid strategy type' })
  @IsEnum(['LOWEST_COST', 'COST_CAP', 'BID_CAP', 'TARGET_COST'])
  bidStrategy: string;

  @ApiProperty({ description: 'Base bid amount in USD' })
  @IsNumber()
  @Min(0)
  baseBid: number;

  @ApiProperty({ description: 'Maximum bid amount in USD' })
  @IsNumber()
  @Min(0)
  maxBid: number;

  @ApiProperty({ description: 'Daily budget in USD' })
  @IsNumber()
  @Min(0)
  dailyBudget: number;

  @ApiProperty({ description: 'Total campaign budget in USD' })
  @IsNumber()
  @Min(0)
  totalBudget: number;

  @ApiPropertyOptional({ description: 'Campaign priority score' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  priority?: number;

  @ApiPropertyOptional({ description: 'Available creative IDs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  creativeIds?: string[];
}

export class CampaignEligibilityRequestDto {
  @ApiProperty({ description: 'Inventory ID to check eligibility for' })
  @IsString()
  inventoryId: string;

  @ApiProperty({ description: 'Device type for targeting' })
  @IsEnum(['MOBILE', 'DESKTOP', 'TABLET', 'CONNECTED_TV'])
  deviceType: string;

  @ApiPropertyOptional({ description: 'Country code for geo-targeting' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'User age for demographic targeting' })
  @IsOptional()
  @IsNumber()
  @Min(13)
  @Max(120)
  age?: number;

  @ApiPropertyOptional({ description: 'User gender for demographic targeting' })
  @IsOptional()
  @IsEnum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'])
  gender?: string;

  @ApiPropertyOptional({ description: 'Force cache refresh' })
  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean;
}

export class CampaignEligibilityResponseDto {
  @ApiProperty({
    description: 'List of eligible campaigns',
    type: [CachedCampaignDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CachedCampaignDto)
  eligibleCampaigns: CachedCampaignDto[];

  @ApiProperty({ description: 'Total number of eligible campaigns' })
  @IsNumber()
  totalCount: number;

  @ApiProperty({ description: 'Whether result came from cache' })
  @IsBoolean()
  fromCache: boolean;

  @ApiProperty({ description: 'Cache creation timestamp' })
  @IsString()
  cacheTimestamp: string;

  @ApiProperty({ description: 'Cache expiration timestamp' })
  @IsString()
  cacheExpiresAt: string;

  @ApiProperty({ description: 'Processing time in milliseconds' })
  @IsNumber()
  processingTimeMs: number;
}

// ==========================================
// BUDGET TRACKING DTOs
// ==========================================

export class CampaignBudgetStatusDto {
  @ApiProperty({ description: 'Campaign ID' })
  @IsString()
  campaignId: string;

  @ApiProperty({ description: 'Total campaign budget in USD' })
  @IsNumber()
  @Min(0)
  totalBudget: number;

  @ApiProperty({ description: 'Daily budget limit in USD' })
  @IsNumber()
  @Min(0)
  dailyBudget: number;

  @ApiProperty({ description: 'Amount spent today in USD' })
  @IsNumber()
  @Min(0)
  spentToday: number;

  @ApiProperty({ description: 'Total amount spent in USD' })
  @IsNumber()
  @Min(0)
  spentTotal: number;

  @ApiProperty({ description: 'Remaining daily budget in USD' })
  @IsNumber()
  @Min(0)
  remainingDaily: number;

  @ApiProperty({ description: 'Remaining total budget in USD' })
  @IsNumber()
  @Min(0)
  remainingTotal: number;

  @ApiProperty({ description: 'Whether campaign budget is exhausted' })
  @IsBoolean()
  isExhausted: boolean;

  @ApiProperty({ description: 'Total spend percentage (0-100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  spendPercentage: number;

  @ApiProperty({ description: 'Daily spend percentage (0-100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  dailySpendPercentage: number;

  @ApiProperty({ description: 'Status check timestamp' })
  @IsString()
  timestamp: string;
}

export class UpdateCampaignSpendDto {
  @ApiProperty({ description: 'Campaign ID to update spend for' })
  @IsString()
  campaignId: string;

  @ApiProperty({ description: 'Spend amount to add in USD' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ description: 'Associated auction ID for tracking' })
  @IsOptional()
  @IsString()
  auctionId?: string;

  @ApiPropertyOptional({ description: 'Bid response ID for tracking' })
  @IsOptional()
  @IsString()
  bidResponseId?: string;

  @ApiPropertyOptional({ description: 'Timestamp of the spend event' })
  @IsOptional()
  @IsString()
  timestamp?: string;
}

export class CampaignSpendUpdateResponseDto {
  @ApiProperty({ description: 'Whether spend update was successful' })
  @IsBoolean()
  success: boolean;

  @ApiProperty({ description: 'Updated remaining daily budget' })
  @IsNumber()
  remainingDaily: number;

  @ApiProperty({ description: 'Updated remaining total budget' })
  @IsNumber()
  remainingTotal: number;

  @ApiProperty({ description: 'Whether budget is now exhausted' })
  @IsBoolean()
  isExhausted: boolean;

  @ApiProperty({ description: 'Whether campaign should be paused' })
  @IsBoolean()
  shouldPauseCampaign: boolean;

  @ApiProperty({ description: 'Update timestamp' })
  @IsString()
  timestamp: string;

  @ApiPropertyOptional({ description: 'Warning message if budget is low' })
  @IsOptional()
  @IsString()
  warning?: string;
}

// ==========================================
// PERFORMANCE METRICS DTOs
// ==========================================

export enum EntityType {
  CAMPAIGN = 'campaign',
  CREATIVE = 'creative',
  INVENTORY = 'inventory',
  PUBLISHER = 'publisher',
}

export enum TimeRange {
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
}

export enum MetricType {
  IMPRESSIONS = 'impressions',
  CLICKS = 'clicks',
  CONVERSIONS = 'conversions',
  SPEND = 'spend',
  REVENUE = 'revenue',
}

export class PerformanceMetricsRequestDto {
  @ApiProperty({ description: 'Entity ID to get metrics for' })
  @IsString()
  entityId: string;

  @ApiProperty({ description: 'Type of entity', enum: EntityType })
  @IsEnum(EntityType)
  entityType: EntityType;

  @ApiProperty({ description: 'Time range for metrics', enum: TimeRange })
  @IsEnum(TimeRange)
  timeRange: TimeRange;

  @ApiPropertyOptional({ description: 'Force cache refresh' })
  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean;
}

export class PerformanceMetricsDto {
  @ApiProperty({ description: 'Entity ID' })
  @IsString()
  entityId: string;

  @ApiProperty({ description: 'Entity type', enum: EntityType })
  @IsEnum(EntityType)
  entityType: EntityType;

  @ApiProperty({ description: 'Time range', enum: TimeRange })
  @IsEnum(TimeRange)
  timeRange: TimeRange;

  @ApiProperty({ description: 'Total impressions served' })
  @IsNumber()
  @Min(0)
  impressions: number;

  @ApiProperty({ description: 'Total clicks received' })
  @IsNumber()
  @Min(0)
  clicks: number;

  @ApiProperty({ description: 'Total conversions tracked' })
  @IsNumber()
  @Min(0)
  conversions: number;

  @ApiProperty({ description: 'Total spend in USD' })
  @IsNumber()
  @Min(0)
  spend: number;

  @ApiProperty({ description: 'Total revenue in USD' })
  @IsNumber()
  @Min(0)
  revenue: number;

  @ApiProperty({ description: 'Click-through rate (percentage)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  ctr: number;

  @ApiProperty({ description: 'Cost per mille (CPM) in USD' })
  @IsNumber()
  @Min(0)
  cpm: number;

  @ApiProperty({ description: 'Cost per click (CPC) in USD' })
  @IsNumber()
  @Min(0)
  cpc: number;

  @ApiProperty({ description: 'Return on ad spend (percentage)' })
  @IsNumber()
  @Min(0)
  roas: number;

  @ApiProperty({ description: 'Last update timestamp' })
  @IsString()
  lastUpdated: string;
}

export class UpdatePerformanceMetricDto {
  @ApiProperty({ description: 'Entity ID to update metrics for' })
  @IsString()
  entityId: string;

  @ApiProperty({ description: 'Type of entity', enum: EntityType })
  @IsEnum(EntityType)
  entityType: EntityType;

  @ApiProperty({ description: 'Type of metric to update', enum: MetricType })
  @IsEnum(MetricType)
  metricType: MetricType;

  @ApiProperty({ description: 'Amount to increment (default: 1)' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({
    description: 'Time ranges to update',
    enum: TimeRange,
    isArray: true,
    default: ['hour', 'day', 'week'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(TimeRange, { each: true })
  timeRanges?: TimeRange[];

  @ApiPropertyOptional({ description: 'Associated auction ID' })
  @IsOptional()
  @IsString()
  auctionId?: string;

  @ApiPropertyOptional({ description: 'Event timestamp' })
  @IsOptional()
  @IsString()
  timestamp?: string;
}

// ==========================================
// CACHE MANAGEMENT DTOs
// ==========================================

export class CacheKeyDto {
  @ApiProperty({ description: 'Cache key pattern or specific key' })
  @IsString()
  key: string;

  @ApiPropertyOptional({ description: 'Cache namespace/prefix' })
  @IsOptional()
  @IsString()
  namespace?: string;
}

export class CacheStatsDto {
  @ApiProperty({ description: 'Total cache keys' })
  @IsNumber()
  totalKeys: number;

  @ApiProperty({ description: 'Cache hit rate (percentage)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  hitRate: number;

  @ApiProperty({ description: 'Cache miss rate (percentage)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  missRate: number;

  @ApiProperty({ description: 'Total memory usage in bytes' })
  @IsNumber()
  memoryUsage: number;

  @ApiProperty({ description: 'Average TTL in seconds' })
  @IsNumber()
  averageTtl: number;

  @ApiProperty({ description: 'Most accessed cache keys', type: [String] })
  @IsArray()
  @IsString({ each: true })
  topKeys: string[];

  @ApiProperty({ description: 'Cache statistics timestamp' })
  @IsString()
  timestamp: string;
}

export class CacheWarmupRequestDto {
  @ApiPropertyOptional({ description: 'Specific inventory IDs to warm up' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  inventoryIds?: string[];

  @ApiPropertyOptional({ description: 'Specific campaign IDs to warm up' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  campaignIds?: string[];

  @ApiPropertyOptional({ description: 'Device types to warm up' })
  @IsOptional()
  @IsArray()
  @IsEnum(['MOBILE', 'DESKTOP', 'TABLET', 'CONNECTED_TV'], { each: true })
  deviceTypes?: string[];

  @ApiPropertyOptional({ description: 'Countries to warm up' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countries?: string[];

  @ApiPropertyOptional({
    description: 'Whether to force refresh existing cache',
  })
  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean;
}

export class CacheWarmupResponseDto {
  @ApiProperty({ description: 'Whether warmup was successful' })
  @IsBoolean()
  success: boolean;

  @ApiProperty({ description: 'Number of cache entries created' })
  @IsNumber()
  entriesCreated: number;

  @ApiProperty({ description: 'Number of cache entries updated' })
  @IsNumber()
  entriesUpdated: number;

  @ApiProperty({ description: 'Number of failed operations' })
  @IsNumber()
  failures: number;

  @ApiProperty({ description: 'Warmup processing time in milliseconds' })
  @IsNumber()
  processingTimeMs: number;

  @ApiProperty({ description: 'Warmup completion timestamp' })
  @IsString()
  timestamp: string;

  @ApiPropertyOptional({ description: 'Warning messages' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  warnings?: string[];
}

// ==========================================
// TIMESCALE DB CACHE DTOs (Phase 7 Specific)
// ==========================================

/**
 * **Why TimescaleDB-specific DTOs:**
 * - Requires different data structures for optimal performance
 * - Supports real-time and batch synchronization patterns
 * - Enables advanced time-series queries and aggregations
 */

export class TimescaleCacheMetricsDto {
  @ApiProperty({ description: 'Entity ID (campaign, creative, etc.)' })
  @IsString()
  entityId: string;

  @ApiProperty({ description: 'Entity type', enum: EntityType })
  @IsEnum(EntityType)
  entityType: EntityType;

  @ApiProperty({ description: 'Metrics time bucket (e.g., 1 hour, 1 day)' })
  @IsString()
  timeBucket: string;

  @ApiProperty({ description: 'Bucket start timestamp' })
  @IsString()
  bucketStart: string;

  @ApiProperty({ description: 'Bucket end timestamp' })
  @IsString()
  bucketEnd: string;

  @ApiProperty({ description: 'Aggregated impressions count' })
  @IsNumber()
  @Min(0)
  impressions: number;

  @ApiProperty({ description: 'Aggregated clicks count' })
  @IsNumber()
  @Min(0)
  clicks: number;

  @ApiProperty({ description: 'Aggregated conversions count' })
  @IsNumber()
  @Min(0)
  conversions: number;

  @ApiProperty({ description: 'Total spend amount' })
  @IsNumber()
  @Min(0)
  totalSpend: number;

  @ApiProperty({ description: 'Total revenue amount' })
  @IsNumber()
  @Min(0)
  totalRevenue: number;

  @ApiProperty({ description: 'Average bid price' })
  @IsNumber()
  @Min(0)
  avgBidPrice: number;

  @ApiProperty({ description: 'Average win rate percentage' })
  @IsNumber()
  @Min(0)
  @Max(100)
  avgWinRate: number;

  @ApiProperty({ description: 'Unique user count' })
  @IsNumber()
  @Min(0)
  uniqueUsers: number;

  @ApiProperty({ description: 'Cache creation timestamp' })
  @IsString()
  cachedAt: string;

  @ApiProperty({ description: 'Data freshness indicator' })
  @IsBoolean()
  isRealtime: boolean;
}

export class TimescaleAnalyticsRequestDto {
  @ApiProperty({ description: 'Entity IDs to analyze' })
  @IsArray()
  @IsString({ each: true })
  entityIds: string[];

  @ApiProperty({ description: 'Entity type', enum: EntityType })
  @IsEnum(EntityType)
  entityType: EntityType;

  @ApiProperty({ description: 'Analysis start time (ISO string)' })
  @IsString()
  startTime: string;

  @ApiProperty({ description: 'Analysis end time (ISO string)' })
  @IsString()
  endTime: string;

  @ApiProperty({
    description: 'Time bucket interval (e.g., "1 hour", "1 day")',
  })
  @IsString()
  timeBucket: string;

  @ApiPropertyOptional({ description: 'Specific metrics to retrieve' })
  @IsOptional()
  @IsArray()
  @IsEnum(MetricType, { each: true })
  metrics?: MetricType[];

  @ApiPropertyOptional({ description: 'Use cached results if available' })
  @IsOptional()
  @IsBoolean()
  useCache?: boolean;

  @ApiPropertyOptional({ description: 'Maximum cache age in seconds' })
  @IsOptional()
  @IsNumber()
  @Min(60)
  maxCacheAge?: number;
}

export class TimescaleAnalyticsResponseDto {
  @ApiProperty({ description: 'Requested entity IDs' })
  @IsArray()
  @IsString({ each: true })
  entityIds: string[];

  @ApiProperty({ description: 'Entity type analyzed' })
  @IsEnum(EntityType)
  entityType: EntityType;

  @ApiProperty({ description: 'Analysis time range start' })
  @IsString()
  startTime: string;

  @ApiProperty({ description: 'Analysis time range end' })
  @IsString()
  endTime: string;

  @ApiProperty({
    description: 'Time series data points',
    type: [TimescaleCacheMetricsDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimescaleCacheMetricsDto)
  dataPoints: TimescaleCacheMetricsDto[];

  @ApiProperty({ description: 'Whether results came from cache' })
  @IsBoolean()
  fromCache: boolean;

  @ApiProperty({ description: 'Query processing time in milliseconds' })
  @IsNumber()
  processingTimeMs: number;

  @ApiProperty({ description: 'Total data points returned' })
  @IsNumber()
  totalPoints: number;

  @ApiProperty({ description: 'Response generation timestamp' })
  @IsString()
  timestamp: string;
}

// ==========================================
// HEALTH CHECK & MONITORING DTOs
// ==========================================

export class CacheHealthCheckDto {
  @ApiProperty({ description: 'Overall cache system health' })
  @IsEnum(['HEALTHY', 'DEGRADED', 'UNHEALTHY'])
  status: string;

  @ApiProperty({ description: 'Redis connection status' })
  @IsBoolean()
  redisConnected: boolean;

  @ApiProperty({ description: 'Memory cache status' })
  @IsBoolean()
  memoryCacheHealthy: boolean;

  @ApiProperty({ description: 'TimescaleDB connection status' })
  @IsBoolean()
  timescaleConnected: boolean;

  @ApiProperty({ description: 'Average response time in milliseconds' })
  @IsNumber()
  avgResponseTimeMs: number;

  @ApiProperty({ description: 'Cache hit rate percentage' })
  @IsNumber()
  @Min(0)
  @Max(100)
  hitRate: number;

  @ApiProperty({ description: 'Error rate percentage' })
  @IsNumber()
  @Min(0)
  @Max(100)
  errorRate: number;

  @ApiProperty({ description: 'Active connections count' })
  @IsNumber()
  activeConnections: number;

  @ApiProperty({ description: 'Last health check timestamp' })
  @IsString()
  lastCheck: string;

  @ApiPropertyOptional({ description: 'Health check warnings' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  warnings?: string[];

  @ApiPropertyOptional({ description: 'Health check errors' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  errors?: string[];
}
