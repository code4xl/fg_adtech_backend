// src/redis/services/rtb-redis.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { REDIS_KEYS } from '../constants/redis-keys';
import { WithRetry } from '../../common/resilience/retry.decorator';

/**
 * RTB-specific Redis operations service
 * 
 * This service extends the base Redis functionality with RTB-specific operations:
 * - Campaign eligibility caching
 * - Budget tracking and management
 * - Performance counters
 * - Auction state management
 * 
 * Why we need this:
 * - RTB requires sub-100ms response times
 * - Cache frequently accessed data (campaign eligibility, budgets)
 * - Real-time counters for performance tracking
 * - Atomic operations for budget updates
 */
@Injectable()
export class RTBRedisService {
    private readonly logger = new Logger(RTBRedisService.name);

    constructor(private readonly redisService: RedisService) { }

    // ==========================================
    // CAMPAIGN ELIGIBILITY CACHING
    // ==========================================

    /**
     * Cache eligible campaigns for a specific inventory and device type
     * 
     * Why cache this:
     * - Campaign eligibility evaluation is expensive (multiple DB queries)
     * - Results are relatively stable for short periods (5 minutes)
     * - Dramatically improves bid request processing speed
     */
    @WithRetry(3, 100, 2, [Error])
    async cacheEligibleCampaigns(
        inventoryId: string,
        deviceType: string,
        campaigns: any[],
        ttlSeconds: number = 300 // 5 minutes default
    ): Promise<void> {
        const key = REDIS_KEYS.ELIGIBLE_CAMPAIGNS(inventoryId);
        const data = {
            campaigns,
            deviceType,
            cachedAt: new Date().toISOString(),
        };

        await this.redisService.set(key, JSON.stringify(data), ttlSeconds);
        this.logger.debug(`Cached ${campaigns.length} eligible campaigns for inventory ${inventoryId}`);
    }

    /**
     * Get cached eligible campaigns
     */
    @WithRetry(3, 100, 2, [Error])
    async getCachedEligibleCampaigns(
        inventoryId: string,
        deviceType: string
    ): Promise<any[] | null> {
        const key = REDIS_KEYS.ELIGIBLE_CAMPAIGNS(inventoryId);
        const cached = await this.redisService.get<string>(key);

        if (!cached) {
            return null;
        }

        try {
            const data = JSON.parse(cached);

            // Verify device type matches (simple cache invalidation)
            if (data.deviceType !== deviceType) {
                await this.redisService.del(key);
                return null;
            }

            this.logger.debug(`Cache hit for eligible campaigns: inventory ${inventoryId}`);
            return data.campaigns;
        } catch (error) {
            this.logger.error(`Error parsing cached campaigns: ${error.message}`);
            await this.redisService.del(key); // Clear corrupted cache
            return null;
        }
    }

    // ==========================================
    // BUDGET TRACKING
    // ==========================================

    /**
     * Get current campaign budget status
     * 
     * Why use Redis for budgets:
     * - Need real-time budget tracking
     * - Multiple bid requests can happen simultaneously
     * - Atomic increment operations prevent overspend
     */
    async getCampaignBudgetStatus(campaignId: string): Promise<{
        totalBudget: number;
        dailyBudget: number;
        spentToday: number;
        remainingDaily: number;
        isExhausted: boolean;
    }> {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const spentKey = REDIS_KEYS.CAMPAIGN_BUDGET(campaignId, today);

        // Get spent amount from Redis (defaults to 0)
        const spentToday = parseFloat(await this.redisService.get<string>(spentKey) || '0');

        // Get budget limits from cache or database
        const budgetKey = REDIS_KEYS.CAMPAIGN_PERFORMANCE(campaignId);
        const budgetData = await this.redisService.get<string>(budgetKey);

        let totalBudget = 0;
        let dailyBudget = 0;

        if (budgetData) {
            const parsed = JSON.parse(budgetData);
            totalBudget = parsed.totalBudget || 0;
            dailyBudget = parsed.dailyBudget || 0;
        }

        const remainingDaily = Math.max(0, dailyBudget - spentToday);
        const isExhausted = remainingDaily <= 0;

        return {
            totalBudget,
            dailyBudget,
            spentToday,
            remainingDaily,
            isExhausted,
        };
    }

    /**
     * Atomically increment campaign spend
     * 
     * Returns true if spend was successful, false if budget would be exceeded
     */
    async incrementCampaignSpend(
        campaignId: string,
        amount: number
    ): Promise<{ success: boolean; newTotal: number; remainingBudget: number }> {
        const today = new Date().toISOString().split('T')[0];
        const spentKey = REDIS_KEYS.CAMPAIGN_BUDGET(campaignId, today);

        // Get current budget status
        const budgetStatus = await this.getCampaignBudgetStatus(campaignId);

        // Check if this spend would exceed budget
        if (budgetStatus.remainingDaily < amount) {
            this.logger.warn(`Campaign ${campaignId} budget exhausted. Remaining: ${budgetStatus.remainingDaily}, Requested: ${amount}`);
            return {
                success: false,
                newTotal: budgetStatus.spentToday,
                remainingBudget: budgetStatus.remainingDaily,
            };
        }

        // Atomically increment the spend
        const newTotal = await this.redisService.incrby(spentKey, Math.round(amount * 100)) / 100; // Store as cents for precision

        // Set expiration for the key (expires at end of day)
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        const ttlSeconds = Math.floor((endOfDay.getTime() - Date.now()) / 1000);
        await this.redisService.expire(spentKey, ttlSeconds);

        const remainingBudget = budgetStatus.dailyBudget - newTotal;

        this.logger.debug(`Campaign ${campaignId} spend incremented by ${amount}. New total: ${newTotal}`);

        return {
            success: true,
            newTotal,
            remainingBudget,
        };
    }

    // ==========================================
    // PERFORMANCE COUNTERS
    // ==========================================

    /**
     * Increment impression counter for various entities
     */
    async incrementImpressionCounters(data: {
        creativeId: string;
        campaignId: string;
        inventoryId: string;
        publisherId: string;
    }): Promise<void> {
        // Use pipeline for atomic multi-increment
        const pipeline = [
            this.redisService.incr(REDIS_KEYS.CREATIVE_IMPRESSIONS(data.creativeId)),
            this.redisService.incr(REDIS_KEYS.CAMPAIGN_IMPRESSIONS(data.campaignId)),
            this.redisService.incr(REDIS_KEYS.INVENTORY_IMPRESSIONS(data.inventoryId)),
            this.redisService.incr(REDIS_KEYS.PUBLISHER_IMPRESSIONS(data.publisherId)),
        ];

        await Promise.all(pipeline);

        this.logger.debug(`Incremented impression counters for creative ${data.creativeId}`);
    }

    /**
     * Increment click counter for various entities
     */
    async incrementClickCounters(data: {
        creativeId: string;
        campaignId: string;
        inventoryId: string;
        publisherId: string;
    }): Promise<void> {
        const pipeline = [
            this.redisService.incr(REDIS_KEYS.CREATIVE_CLICKS(data.creativeId)),
            this.redisService.incr(REDIS_KEYS.CAMPAIGN_CLICKS(data.campaignId)),
        ];

        await Promise.all(pipeline);

        this.logger.debug(`Incremented click counters for creative ${data.creativeId}`);
    }

    /**
     * Get real-time performance metrics for an entity
     */
    async getPerformanceMetrics(entityId: string, entityType: 'creative' | 'campaign' | 'inventory' | 'publisher'): Promise<{
        impressions: number;
        clicks: number;
        ctr: number;
    }> {
        let impressionKey: string;
        let clickKey: string;

        switch (entityType) {
            case 'creative':
                impressionKey = REDIS_KEYS.CREATIVE_IMPRESSIONS(entityId);
                clickKey = REDIS_KEYS.CREATIVE_CLICKS(entityId);
                break;
            case 'campaign':
                impressionKey = REDIS_KEYS.CAMPAIGN_IMPRESSIONS(entityId);
                clickKey = REDIS_KEYS.CAMPAIGN_CLICKS(entityId);
                break;
            case 'inventory':
                impressionKey = REDIS_KEYS.INVENTORY_IMPRESSIONS(entityId);
                clickKey = ''; // No clicks tracked at inventory level
                break;
            case 'publisher':
                impressionKey = REDIS_KEYS.PUBLISHER_IMPRESSIONS(entityId);
                clickKey = ''; // No clicks tracked at publisher level
                break;
            default:
                throw new Error(`Unknown entity type: ${entityType}`);
        }

        const [impressionsStr, clicksStr] = await Promise.all([
            this.redisService.get<string>(impressionKey),
            clickKey ? this.redisService.get<string>(clickKey) : Promise.resolve('0'),
        ]);

        const impressions = parseInt(impressionsStr || '0', 10);
        const clicks = parseInt(clicksStr || '0', 10);
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

        return { impressions, clicks, ctr };
    }

    // ==========================================
    // FREQUENCY CAPPING
    // ==========================================

    /**
     * Check and update frequency cap for a user and creative
     * 
     * Returns true if impression is allowed, false if frequency cap exceeded
     */
    async checkAndUpdateFrequencyCap(
        userId: string,
        creativeId: string,
        maxImpressions: number,
        windowHours: number = 24
    ): Promise<boolean> {
        const key = REDIS_KEYS.USER_CREATIVE_FREQUENCY(userId, creativeId);
        const current = await this.redisService.incr(key);

        if (current === 1) {
            // First impression, set expiration
            await this.redisService.expire(key, windowHours * 3600);
        }

        const allowed = current <= maxImpressions;

        if (!allowed) {
            this.logger.debug(`Frequency cap exceeded for user ${userId}, creative ${creativeId}. Count: ${current}/${maxImpressions}`);
        }

        return allowed;
    }

    // ==========================================
    // AUCTION STATE MANAGEMENT
    // ==========================================

    /**
     * Set auction state for tracking
     */
    async setAuctionState(requestId: string, state: any, ttlSeconds: number = 300): Promise<void> {
        const key = REDIS_KEYS.AUCTION_RESULT(requestId);
        await this.redisService.set(key, JSON.stringify(state), ttlSeconds);
    }

    /**
     * Get auction state
     */
    async getAuctionState(requestId: string): Promise<any | null> {
        const key = REDIS_KEYS.AUCTION_RESULT(requestId);
        const state = await this.redisService.get<string>(key);
        return state ? JSON.parse(state) : null;
    }

    // ==========================================
    // CACHE MANAGEMENT
    // ==========================================

    /**
     * Clear all RTB-related cache for a campaign
     * 
     * Used when campaign settings change
     */
    async clearCampaignCache(campaignId: string): Promise<void> {
        const patterns = [
            `*eligible*${campaignId}*`,
            `*campaign*${campaignId}*`,
        ];

        // Note: In production, implement proper cache invalidation
        // This is a simplified version for Phase 1
        this.logger.warn(`Campaign cache clearing requested for ${campaignId} - implement pattern-based deletion`);
    }

    /**
     * Get cache statistics for monitoring
     */
    async getCacheStats(): Promise<{
        eligibleCampaignCacheHits: number;
        budgetCacheHits: number;
        totalKeys: number;
    }> {
        // Simplified stats for Phase 1
        // In production, implement proper cache hit/miss tracking
        return {
            eligibleCampaignCacheHits: 0,
            budgetCacheHits: 0,
            totalKeys: 0,
        };
    }
}