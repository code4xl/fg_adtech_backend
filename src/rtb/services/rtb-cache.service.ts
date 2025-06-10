import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_KEYS } from '../../redis/constants/redis-keys';
import { RTB_REDIS_KEYS } from '../../redis/constants/rtb-keys';
import { WithRetry } from '../../common/resilience/retry.decorator';

@Injectable()
export class RTBCacheService {
  private readonly logger = new Logger(RTBCacheService.name);

  // In-memory L1 cache for ultra-fast access (small, frequently accessed data)
  private readonly memoryCache = new Map<
    string,
    { data: any; expires: number }
  >();
  private readonly MEMORY_CACHE_TTL = 60000; // 1 minute
  private readonly MEMORY_CACHE_MAX_SIZE = 1000;

  // Cache configuration constants
  private readonly CACHE_TTL = {
    ELIGIBLE_CAMPAIGNS: 300, // 5 minutes - balances freshness vs performance
    CAMPAIGN_BUDGET: 3600, // 1 hour - budget data is relatively stable
    PERFORMANCE_METRICS: 60, // 1 minute - real-time metrics need frequent updates
    FLOOR_PRICES: 600, // 10 minutes - pricing data updates moderately
    TARGETING_RULES: 900, // 15 minutes - targeting rules change infrequently
    AUCTION_STATS: 300, // 5 minutes - auction statistics for monitoring
  };

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {
    this.logger.log('RTB Cache Service initialized - Phase 7 Complete');
    this.initializeMemoryCacheCleaner();
  }

  @WithRetry(3, 100, 2, [Error])
  async getCachedEligibleCampaigns(
    inventoryId: string,
    deviceType: string,
    country?: string,
  ): Promise<any[] | null> {
    try {
      // 1. Check L1 memory cache first (fastest access)
      const memoryCacheKey = `eligible:${inventoryId}:${deviceType}:${country || 'global'}`;
      const memoryResult = this.getFromMemoryCache(memoryCacheKey);
      if (memoryResult) {
        this.logger.debug('Campaign eligibility L1 cache hit', {
          inventoryId,
          deviceType,
        });
        return memoryResult;
      }

      // 2. Check L2 Redis cache
      const redisKey = REDIS_KEYS.ELIGIBLE_CAMPAIGNS(inventoryId, deviceType);
      const cached = await this.redis.get<string>(redisKey);

      if (!cached) {
        this.logger.debug('Campaign eligibility cache miss', {
          inventoryId,
          deviceType,
        });
        return null;
      }

      const data = JSON.parse(cached);

      // 3. Validate cache data matches current context
      if (
        data.deviceType !== deviceType ||
        (country && data.country !== country)
      ) {
        this.logger.debug(
          'Campaign eligibility cache invalidated - context mismatch',
          {
            inventoryId,
            cachedDeviceType: data.deviceType,
            currentDeviceType: deviceType,
            cachedCountry: data.country,
            currentCountry: country,
          },
        );
        await this.redis.del(redisKey);
        return null;
      }

      // 4. Store in L1 cache for next access
      this.setInMemoryCache(memoryCacheKey, data.campaigns);

      this.logger.debug('Campaign eligibility L2 cache hit', {
        inventoryId,
        deviceType,
        campaignCount: data.campaigns.length,
      });

      return data.campaigns;
    } catch (error) {
      this.logger.error('Error retrieving cached eligible campaigns', {
        error: error.message,
        inventoryId,
        deviceType,
      });
      return null;
    }
  }

  @WithRetry(3, 100, 2, [Error])
  async setCachedEligibleCampaigns(
    inventoryId: string,
    deviceType: string,
    campaigns: any[],
    country?: string,
    ttlSeconds: number = this.CACHE_TTL.ELIGIBLE_CAMPAIGNS,
  ): Promise<void> {
    try {
      const data = {
        campaigns,
        deviceType,
        country: country || 'global',
        createdAt: new Date().toISOString(),
        campaignCount: campaigns.length,
        cacheVersion: '1.0',
      };

      // 1. Store in Redis (L2 cache)
      const redisKey = REDIS_KEYS.ELIGIBLE_CAMPAIGNS(inventoryId, deviceType);
      await this.redis.set(redisKey, JSON.stringify(data), ttlSeconds);

      // 2. Store in memory cache (L1 cache)
      const memoryCacheKey = `eligible:${inventoryId}:${deviceType}:${country || 'global'}`;
      this.setInMemoryCache(memoryCacheKey, campaigns);

      this.logger.debug('Cached eligible campaigns', {
        inventoryId,
        deviceType,
        country,
        campaignCount: campaigns.length,
        ttlSeconds,
      });
    } catch (error) {
      this.logger.error('Error caching eligible campaigns', {
        error: error.message,
        inventoryId,
        deviceType,
        campaignCount: campaigns.length,
      });
      // Don't throw - caching failures shouldn't break the auction
    }
  }

  async getCampaignBudgetStatus(campaignId: string): Promise<{
    totalBudget: number;
    dailyBudget: number;
    spentToday: number;
    spentTotal: number;
    remainingDaily: number;
    remainingTotal: number;
    isExhausted: boolean;
    spendPercentage: number;
    dailySpendPercentage: number;
  }> {
    try {
      // 1. Get spend data from Redis (real-time counters)
      const today = new Date().toISOString().split('T')[0];
      const spentTodayKey = RTB_REDIS_KEYS.CAMPAIGN_BUDGET_SPENT(
        campaignId,
        today,
      );
      const spentTotalKey = RTB_REDIS_KEYS.CAMPAIGN_BUDGET_SPENT(
        campaignId,
        'total',
      );

      const [spentTodayStr, spentTotalStr] = await Promise.all([
        this.redis.get<string>(spentTodayKey),
        this.redis.get<string>(spentTotalKey),
      ]);

      const spentToday = parseFloat(spentTodayStr || '0');
      const spentTotal = parseFloat(spentTotalStr || '0');

      // 2. Get budget configuration from database (with caching)
      const budgetConfig = await this.getCachedCampaignBudgetConfig(campaignId);

      if (!budgetConfig) {
        throw new Error(
          `Campaign budget configuration not found for campaign ${campaignId}`,
        );
      }

      // 3. Calculate remaining amounts and status
      const remainingDaily = Math.max(0, budgetConfig.dailyBudget - spentToday);
      const remainingTotal = Math.max(0, budgetConfig.totalBudget - spentTotal);

      const isExhausted = remainingDaily <= 0 || remainingTotal <= 0;
      const spendPercentage = (spentTotal / budgetConfig.totalBudget) * 100;
      const dailySpendPercentage =
        (spentToday / budgetConfig.dailyBudget) * 100;

      const status = {
        totalBudget: budgetConfig.totalBudget,
        dailyBudget: budgetConfig.dailyBudget,
        spentToday,
        spentTotal,
        remainingDaily,
        remainingTotal,
        isExhausted,
        spendPercentage: Math.min(100, spendPercentage),
        dailySpendPercentage: Math.min(100, dailySpendPercentage),
      };

      this.logger.debug('Retrieved campaign budget status', {
        campaignId,
        ...status,
      });

      return status;
    } catch (error) {
      this.logger.error('Error getting campaign budget status', {
        error: error.message,
        campaignId,
      });

      // Return safe default that blocks spending
      return {
        totalBudget: 0,
        dailyBudget: 0,
        spentToday: 0,
        spentTotal: 0,
        remainingDaily: 0,
        remainingTotal: 0,
        isExhausted: true,
        spendPercentage: 100,
        dailySpendPercentage: 100,
      };
    }
  }

  @WithRetry(3, 50, 2, [Error])
  async updateCampaignSpend(
    campaignId: string,
    amount: number,
    auctionId?: string,
  ): Promise<{
    success: boolean;
    remainingDaily: number;
    remainingTotal: number;
    isExhausted: boolean;
    shouldPauseCampaign: boolean;
  }> {
    try {
      if (amount <= 0) {
        throw new Error(`Invalid spend amount: ${amount}`);
      }

      const today = new Date().toISOString().split('T')[0];
      const spentTodayKey = RTB_REDIS_KEYS.CAMPAIGN_BUDGET_SPENT(
        campaignId,
        today,
      );
      const spentTotalKey = RTB_REDIS_KEYS.CAMPAIGN_BUDGET_SPENT(
        campaignId,
        'total',
      );

      // 1. Get current budget configuration
      const budgetConfig = await this.getCachedCampaignBudgetConfig(campaignId);
      if (!budgetConfig) {
        return {
          success: false,
          remainingDaily: 0,
          remainingTotal: 0,
          isExhausted: true,
          shouldPauseCampaign: true,
        };
      }

      // 2. Execute atomic spend update
      const pipeline = await this.redis.pipeline();

      // Increment spend counters
      pipeline.incrbyfloat(spentTodayKey, amount);
      pipeline.incrbyfloat(spentTotalKey, amount);

      // Set expiration for daily counter (expires at midnight)
      const tomorrowMidnight = new Date();
      tomorrowMidnight.setDate(tomorrowMidnight.getDate() + 1);
      tomorrowMidnight.setHours(0, 0, 0, 0);
      const ttlSeconds = Math.floor(
        (tomorrowMidnight.getTime() - Date.now()) / 1000,
      );
      pipeline.expire(spentTodayKey, ttlSeconds);

      const results = await pipeline.exec();

      if (!results || results.some(([error]) => error)) {
        throw new Error('Failed to update spend counters atomically');
      }

      // 3. Get updated spend amounts
      const newSpentToday = parseFloat(results[0][1] as string);
      const newSpentTotal = parseFloat(results[1][1] as string);

      // 4. Calculate remaining amounts and status
      const remainingDaily = Math.max(
        0,
        budgetConfig.dailyBudget - newSpentToday,
      );
      const remainingTotal = Math.max(
        0,
        budgetConfig.totalBudget - newSpentTotal,
      );
      const isExhausted = remainingDaily <= 0 || remainingTotal <= 0;

      // 5. Check if campaign should be paused (budget exhausted)
      const shouldPauseCampaign = isExhausted;

      if (shouldPauseCampaign) {
        // Trigger campaign pause notification
        await this.triggerCampaignPause(campaignId, 'Budget exhausted', {
          spentToday: newSpentToday,
          spentTotal: newSpentTotal,
          dailyBudget: budgetConfig.dailyBudget,
          totalBudget: budgetConfig.totalBudget,
        });
      }

      this.logger.debug('Updated campaign spend', {
        campaignId,
        amount,
        auctionId,
        newSpentToday,
        newSpentTotal,
        remainingDaily,
        remainingTotal,
        isExhausted,
        shouldPauseCampaign,
      });

      return {
        success: true,
        remainingDaily,
        remainingTotal,
        isExhausted,
        shouldPauseCampaign,
      };
    } catch (error) {
      this.logger.error('Error updating campaign spend', {
        error: error.message,
        campaignId,
        amount,
        auctionId,
      });

      return {
        success: false,
        remainingDaily: 0,
        remainingTotal: 0,
        isExhausted: true,
        shouldPauseCampaign: true,
      };
    }
  }

  async getPerformanceMetrics(
    entityId: string,
    entityType: 'campaign' | 'creative' | 'inventory' | 'publisher',
    timeRange: 'hour' | 'day' | 'week' = 'hour',
  ): Promise<{
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
    revenue: number;
    ctr: number;
    cpm: number;
    cpc: number;
    roas: number;
    lastUpdated: string;
  }> {
    try {
      // 1. Build cache keys for different metrics
      const baseKey = `metrics:${entityType}:${entityId}`;
      const timeKey = this.getTimeKey(timeRange);

      const keys = {
        impressions: `${baseKey}:impressions:${timeKey}`,
        clicks: `${baseKey}:clicks:${timeKey}`,
        conversions: `${baseKey}:conversions:${timeKey}`,
        spend: `${baseKey}:spend:${timeKey}`,
        revenue: `${baseKey}:revenue:${timeKey}`,
        lastUpdated: `${baseKey}:updated:${timeKey}`,
      };

      // 2. Get all metrics in a single Redis operation
      const pipeline = await this.redis.pipeline();
      Object.values(keys).forEach((key) => pipeline.get(key));
      const results = await pipeline.exec();

      if (!results) {
        throw new Error('Failed to retrieve performance metrics from Redis');
      }

      // 3. Parse results and calculate derived metrics
      const [impressions, clicks, conversions, spend, revenue, lastUpdated] =
        results.map(([, value]) => parseFloat((value as string) || '0'));

      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
      const cpc = clicks > 0 ? spend / clicks : 0;
      const roas = spend > 0 ? (revenue / spend) * 100 : 0;

      const metrics = {
        impressions,
        clicks,
        conversions,
        spend,
        revenue,
        ctr: parseFloat(ctr.toFixed(2)),
        cpm: parseFloat(cpm.toFixed(2)),
        cpc: parseFloat(cpc.toFixed(2)),
        roas: parseFloat(roas.toFixed(2)),
        lastUpdated: lastUpdated
          ? new Date(lastUpdated).toISOString()
          : new Date().toISOString(),
      };

      this.logger.debug('Retrieved performance metrics', {
        entityId,
        entityType,
        timeRange,
        ...metrics,
      });

      return metrics;
    } catch (error) {
      this.logger.error('Error getting performance metrics', {
        error: error.message,
        entityId,
        entityType,
        timeRange,
      });

      // Return zero metrics on error
      return {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        spend: 0,
        revenue: 0,
        ctr: 0,
        cpm: 0,
        cpc: 0,
        roas: 0,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  @WithRetry(3, 50, 2, [Error])
  async incrementPerformanceMetric(
    entityId: string,
    entityType: 'campaign' | 'creative' | 'inventory' | 'publisher',
    metricType: 'impressions' | 'clicks' | 'conversions' | 'spend' | 'revenue',
    amount: number = 1,
    timeRanges: ('hour' | 'day' | 'week')[] = ['hour', 'day', 'week'],
  ): Promise<void> {
    try {
      if (
        amount <= 0 &&
        metricType !== 'impressions' &&
        metricType !== 'clicks'
      ) {
        return; // Skip invalid increments
      }

      const baseKey = `metrics:${entityType}:${entityId}`;
      const pipeline = await this.redis.pipeline();

      // Update metrics for all requested time ranges
      for (const timeRange of timeRanges) {
        const timeKey = this.getTimeKey(timeRange);
        const metricKey = `${baseKey}:${metricType}:${timeKey}`;
        const updateKey = `${baseKey}:updated:${timeKey}`;

        // Increment the metric
        if (metricType === 'impressions' || metricType === 'clicks') {
          pipeline.incr(metricKey);
        } else {
          pipeline.incrbyfloat(metricKey, amount);
        }

        // Update last modified timestamp
        pipeline.set(updateKey, Date.now());

        // Set appropriate TTL based on time range
        const ttl = this.getTTLForTimeRange(timeRange);
        pipeline.expire(metricKey, ttl);
        pipeline.expire(updateKey, ttl);
      }

      await pipeline.exec();

      this.logger.debug('Updated performance metric', {
        entityId,
        entityType,
        metricType,
        amount,
        timeRanges,
      });
    } catch (error) {
      this.logger.error('Error updating performance metric', {
        error: error.message,
        entityId,
        entityType,
        metricType,
        amount,
      });
      // Don't throw - metric update failures shouldn't break business logic
    }
  }

  private async getCachedCampaignBudgetConfig(campaignId: string): Promise<{
    dailyBudget: number;
    totalBudget: number;
  } | null> {
    const cacheKey = `campaign:budget:config:${campaignId}`;

    try {
      // Check cache first
      const cached = await this.redis.get<string>(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get from database
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        select: {
          campaignBudgetTracker: {
            select: {
              dailyBudget: true,
              totalBudget: true,
            },
          },
        },
      });

      if (!campaign) {
        return null;
      }

      const dailyBudget = campaign?.campaignBudgetTracker?.[0]?.dailyBudget;
      const totalBudget = campaign?.campaignBudgetTracker?.[0]?.totalBudget;

      const config = {
        dailyBudget: dailyBudget ? parseFloat(dailyBudget.toString()) : 0,
        totalBudget: totalBudget ? parseFloat(totalBudget.toString()) : 0,
      };

      // Cache for 1 hour
      await this.redis.set(
        cacheKey,
        JSON.stringify(config),
        this.CACHE_TTL.CAMPAIGN_BUDGET,
      );

      return config;
    } catch (error) {
      this.logger.error('Error getting campaign budget config', {
        error: error.message,
        campaignId,
      });
      return null;
    }
  }

  /**
   * Trigger campaign pause notification
   */
  private async triggerCampaignPause(
    campaignId: string,
    reason: string,
    details: any,
  ): Promise<void> {
    try {
      // Set pause flag in Redis
      const pauseKey = `campaign:paused:${campaignId}`;
      await this.redis.set(
        pauseKey,
        JSON.stringify({
          reason,
          details,
          pausedAt: new Date().toISOString(),
        }),
        3600,
      ); // 1 hour TTL

      this.logger.warn('Campaign pause triggered', {
        campaignId,
        reason,
        details,
      });

      // TODO: Send notification to campaign management system
      // Could integrate with Kafka for async notification processing
    } catch (error) {
      this.logger.error('Error triggering campaign pause', {
        error: error.message,
        campaignId,
        reason,
      });
    }
  }

  /**
   * L1 Memory cache operations
   */
  private getFromMemoryCache(key: string): any | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setInMemoryCache(key: string, data: any): void {
    // Implement LRU eviction if cache is too large
    if (this.memoryCache.size >= this.MEMORY_CACHE_MAX_SIZE) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }

    this.memoryCache.set(key, {
      data,
      expires: Date.now() + this.MEMORY_CACHE_TTL,
    });
  }

  /**
   * Initialize memory cache cleaner
   */
  private initializeMemoryCacheCleaner(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.memoryCache.entries()) {
        if (now > entry.expires) {
          this.memoryCache.delete(key);
        }
      }
    }, 60000); // Clean every minute
  }

  /**
   * Get time-based cache key
   */
  private getTimeKey(timeRange: 'hour' | 'day' | 'week'): string {
    const now = new Date();

    switch (timeRange) {
      case 'hour':
        return now.toISOString().substring(0, 13); // YYYY-MM-DDTHH
      case 'day':
        return now.toISOString().substring(0, 10); // YYYY-MM-DD
      case 'week':
        const year = now.getFullYear();
        const week = this.getWeekNumber(now);
        return `${year}-W${week.toString().padStart(2, '0')}`;
      default:
        return now.toISOString().substring(0, 13);
    }
  }

  /**
   * Get TTL for time range
   */
  private getTTLForTimeRange(timeRange: 'hour' | 'day' | 'week'): number {
    switch (timeRange) {
      case 'hour':
        return 3600 * 25; // 25 hours
      case 'day':
        return 3600 * 24 * 8; // 8 days
      case 'week':
        return 3600 * 24 * 7 * 5; // 5 weeks
      default:
        return 3600;
    }
  }

  /**
   * Get week number
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    return (
      1 +
      Math.round(
        ((d.getTime() - week1.getTime()) / 86400000 -
          3 +
          ((week1.getDay() + 6) % 7)) /
          7,
      )
    );
  }
}
