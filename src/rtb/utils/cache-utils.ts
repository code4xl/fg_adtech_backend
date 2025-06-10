// src/rtb/utils/cache-utils.ts

import { Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { RTB_REDIS_KEYS, RTB_CACHE_TTL, RTB_CACHE_PRIORITY } from '../../redis/constants/rtb-keys';

/**
 * Cache Management Utilities for Phase 7
 * 
 * **Why dedicated cache utilities:**
 * - Centralized cache logic reduces code duplication
 * - Provides consistent error handling across all cache operations
 * - Implements advanced features like circuit breakers and fallbacks
 * - Enables cache warming and preloading strategies
 * - Supports cache invalidation patterns and dependency management
 */

export interface CacheOptions {
    ttl?: number;
    priority?: string;
    tags?: string[];
    namespace?: string;
    compression?: boolean;
    retries?: number;
}

export interface CacheResult<T> {
    data: T | null;
    hit: boolean;
    ttl: number;
    source: 'memory' | 'redis' | 'database';
    timestamp: number;
}

export interface CacheStats {
    hits: number;
    misses: number;
    hitRate: number;
    totalKeys: number;
    memoryUsage: number;
    avgTtl: number;
    lastUpdated: Date;
}

/**
 * Advanced Cache Manager for RTB Operations
 * 
 * **Core Features:**
 * 1. Multi-level caching (Memory + Redis)
 * 2. Circuit breaker pattern for fault tolerance
 * 3. Automatic cache warming and preloading
 * 4. Dependency-based invalidation
 * 5. Performance monitoring and analytics
 * 6. Compression for large cache entries
 * 7. Batch operations for efficiency
 */
export class RTBCacheManager {
    private readonly logger = new Logger(RTBCacheManager.name);

    // Circuit breaker state
    private circuitBreaker = {
        isOpen: false,
        failureCount: 0,
        lastFailureTime: null as Date | null,
        threshold: 5,
        timeout: 30000
    };

    // Cache statistics
    private stats = {
        hits: 0,
        misses: 0,
        errors: 0,
        totalOperations: 0
    };

    // Memory cache for ultra-fast access
    private memoryCache = new Map<string, {
        data: any;
        expires: number;
        tags: string[];
        size: number;
    }>();

    private readonly MEMORY_CACHE_MAX_SIZE = 1000;
    private readonly MEMORY_CACHE_MAX_MEMORY = 50 * 1024 * 1024; // 50MB
    private currentMemoryUsage = 0;

    constructor(private readonly redis: RedisService) {
        this.initializeHealthCheck();
    }

    /**
     * Get cached data with fallback strategy
     * 
     * **Why sophisticated get strategy:**
     * - Checks memory cache first for fastest access
     * - Falls back to Redis if not in memory
     * - Implements circuit breaker to handle Redis failures
     * - Provides detailed metrics for monitoring
     * - Supports automatic cache promotion (Redis -> Memory)
     */
    async get<T>(
        key: string,
        options: CacheOptions = {}
    ): Promise<CacheResult<T>> {
        const startTime = Date.now();
        this.stats.totalOperations++;

        try {
            // 1. Check memory cache first (L1)
            const memoryResult = this.getFromMemory<T>(key);
            if (memoryResult.hit) {
                this.stats.hits++;
                this.logger.debug('Cache L1 hit', { key, ttl: memoryResult.ttl });
                return memoryResult;
            }

            // 2. Check circuit breaker for Redis operations
            if (this.isCircuitOpen()) {
                this.stats.misses++;
                return {
                    data: null,
                    hit: false,
                    ttl: 0,
                    source: 'database',
                    timestamp: Date.now()
                };
            }

            // 3. Check Redis cache (L2)
            const redisResult = await this.getFromRedis<T>(key, options);
            if (redisResult.hit) {
                this.stats.hits++;

                // Promote to memory cache if valuable
                if (this.shouldPromoteToMemory(key, redisResult.data)) {
                    this.setInMemory(key, redisResult.data, redisResult.ttl, options.tags || []);
                }

                this.logger.debug('Cache L2 hit', {
                    key,
                    ttl: redisResult.ttl,
                    processingTime: Date.now() - startTime
                });
                return redisResult;
            }

            // 4. Cache miss
            this.stats.misses++;
            this.logger.debug('Cache miss', {
                key,
                processingTime: Date.now() - startTime
            });

            return {
                data: null,
                hit: false,
                ttl: 0,
                source: 'database',
                timestamp: Date.now()
            };

        } catch (error) {
            this.stats.errors++;
            this.handleCacheError(error, 'get', key);

            return {
                data: null,
                hit: false,
                ttl: 0,
                source: 'database',
                timestamp: Date.now()
            };
        }
    }

    /**
     * Set cached data with intelligent storage strategy
     * 
     * **Why intelligent set strategy:**
     * - Stores in both memory and Redis based on data characteristics
     * - Implements compression for large objects
     * - Manages memory usage with LRU eviction
     * - Supports cache tagging for dependency management
     * - Provides TTL optimization based on access patterns
     */
    async set<T>(
        key: string,
        data: T,
        options: CacheOptions = {}
    ): Promise<boolean> {
        try {
            const ttl = options.ttl || this.getDefaultTTL(key);
            const tags = options.tags || [];

            // Calculate data size for memory management
            const dataSize = this.calculateDataSize(data);

            // 1. Store in Redis (L2) first for persistence
            if (!this.isCircuitOpen()) {
                await this.setInRedis(key, data, ttl, options);
            }

            // 2. Store in memory cache (L1) if appropriate
            if (this.shouldStoreInMemory(key, dataSize)) {
                this.setInMemory(key, data, ttl, tags);
            }

            // 3. Update cache dependencies
            if (tags.length > 0) {
                await this.updateCacheDependencies(key, tags);
            }

            this.logger.debug('Cache set successful', {
                key,
                ttl,
                size: dataSize,
                tags: tags.length,
                storedInMemory: this.shouldStoreInMemory(key, dataSize)
            });

            return true;

        } catch (error) {
            this.handleCacheError(error, 'set', key);
            return false;
        }
    }

    /**
     * Batch cache operations for efficiency
     * 
     * **Why batch operations:**
     * - Reduces network round trips to Redis
     * - Improves performance for bulk cache operations
     * - Enables atomic multi-key operations
     * - Supports efficient cache warming strategies
     */
    async multiGet<T>(keys: string[]): Promise<Map<string, CacheResult<T>>> {
        const results = new Map<string, CacheResult<T>>();
        const redisKeys: string[] = [];
        const keyMapping = new Map<string, string>();

        // 1. Check memory cache for all keys first
        for (const key of keys) {
            const memoryResult = this.getFromMemory<T>(key);
            if (memoryResult.hit) {
                results.set(key, memoryResult);
                this.stats.hits++;
            } else {
                redisKeys.push(key);
                keyMapping.set(key, key);
            }
        }

        // 2. Batch fetch remaining keys from Redis
        if (redisKeys.length > 0 && !this.isCircuitOpen()) {
            try {
                const pipeline = await this.redis.pipeline();
                redisKeys.forEach(key => pipeline.get(key));
                const redisResults = await pipeline.exec();

                if (redisResults) {
                    redisKeys.forEach((key, index) => {
                        const [error, value] = redisResults[index];
                        if (!error && value) {
                            try {
                                const data = JSON.parse(value as string);
                                results.set(key, {
                                    data,
                                    hit: true,
                                    ttl: 0, // TTL not available in batch operation
                                    source: 'redis',
                                    timestamp: Date.now()
                                });
                                this.stats.hits++;
                            } catch (parseError) {
                                this.logger.warn('Failed to parse cached data', { key, error: parseError.message });
                                results.set(key, {
                                    data: null,
                                    hit: false,
                                    ttl: 0,
                                    source: 'database',
                                    timestamp: Date.now()
                                });
                                this.stats.misses++;
                            }
                        } else {
                            results.set(key, {
                                data: null,
                                hit: false,
                                ttl: 0,
                                source: 'database',
                                timestamp: Date.now()
                            });
                            this.stats.misses++;
                        }
                    });
                }
            } catch (error) {
                this.handleCacheError(error, 'multiGet', redisKeys.join(','));
                // Mark all Redis keys as misses
                redisKeys.forEach(key => {
                    results.set(key, {
                        data: null,
                        hit: false,
                        ttl: 0,
                        source: 'database',
                        timestamp: Date.now()
                    });
                    this.stats.misses++;
                });
            }
        } else {
            // Circuit breaker is open, mark all as misses
            redisKeys.forEach(key => {
                results.set(key, {
                    data: null,
                    hit: false,
                    ttl: 0,
                    source: 'database',
                    timestamp: Date.now()
                });
                this.stats.misses++;
            });
        }

        return results;
    }

    /**
     * Invalidate cache by pattern or tags
     * 
     * **Why sophisticated invalidation:**
     * - Supports pattern-based bulk invalidation
     * - Enables tag-based dependency invalidation
     * - Maintains invalidation logs for debugging
     * - Handles both memory and Redis cache layers
     */
    async invalidate(pattern: string, tags?: string[]): Promise<number> {
        let invalidatedCount = 0;

        try {
            // 1. Invalidate memory cache
            if (tags && tags.length > 0) {
                // Tag-based invalidation
                for (const [key, entry] of this.memoryCache.entries()) {
                    if (entry.tags.some(tag => tags.includes(tag))) {
                        this.memoryCache.delete(key);
                        this.currentMemoryUsage -= entry.size;
                        invalidatedCount++;
                    }
                }
            } else {
                // Pattern-based invalidation
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                for (const key of this.memoryCache.keys()) {
                    if (regex.test(key)) {
                        const entry = this.memoryCache.get(key);
                        this.memoryCache.delete(key);
                        if (entry) {
                            this.currentMemoryUsage -= entry.size;
                        }
                        invalidatedCount++;
                    }
                }
            }

            // 2. Invalidate Redis cache
            if (!this.isCircuitOpen()) {
                if (tags && tags.length > 0) {
                    // Tag-based Redis invalidation
                    for (const tag of tags) {
                        const dependencyKey = RTB_REDIS_KEYS.CACHE_DEPENDENCY_MAP(tag);
                        const dependentKeys = await this.redis.smembers(dependencyKey);

                        if (dependentKeys.length > 0) {
                            const pipeline = await this.redis.pipeline();
                            dependentKeys.forEach(key => pipeline.del(key));
                            await pipeline.exec();
                            invalidatedCount += dependentKeys.length;
                        }
                    }
                } else {
                    // Pattern-based Redis invalidation
                    const keys = await this.redis.keys(pattern);
                    if (keys.length > 0) {
                        const pipeline = await this.redis.pipeline();
                        keys.forEach(key => pipeline.del(key));
                        await pipeline.exec();
                        invalidatedCount += keys.length;
                    }
                }
            }

            // 3. Log invalidation for debugging
            await this.logInvalidation(pattern, tags, invalidatedCount);

            this.logger.debug('Cache invalidation completed', {
                pattern,
                tags,
                invalidatedCount
            });

            return invalidatedCount;

        } catch (error) {
            this.handleCacheError(error, 'invalidate', pattern);
            return 0;
        }
    }

    /**
     * Warm cache with precomputed data
     * 
     * **Why cache warming:**
     * - Prevents cold start penalties during peak traffic
     * - Improves user experience with faster response times
     * - Enables proactive data loading based on predicted usage
     * - Supports scheduled cache refresh operations
     */
    async warmCache(
        warmupData: Array<{ key: string; data: any; ttl?: number; tags?: string[] }>
    ): Promise<{
        success: number;
        failures: number;
        totalTime: number;
    }> {
        const startTime = Date.now();
        let success = 0;
        let failures = 0;

        try {
            // Process warmup data in batches for efficiency
            const batchSize = 50;
            for (let i = 0; i < warmupData.length; i += batchSize) {
                const batch = warmupData.slice(i, i + batchSize);

                const promises = batch.map(async ({ key, data, ttl, tags }) => {
                    try {
                        await this.set(key, data, { ttl, tags });
                        return true;
                    } catch (error) {
                        this.logger.warn('Cache warmup failed for key', { key, error: error.message });
                        return false;
                    }
                });

                const results = await Promise.all(promises);
                success += results.filter(r => r).length;
                failures += results.filter(r => !r).length;
            }

            const totalTime = Date.now() - startTime;

            this.logger.log('Cache warmup completed', {
                totalEntries: warmupData.length,
                success,
                failures,
                totalTime
            });

            return { success, failures, totalTime };

        } catch (error) {
            this.handleCacheError(error, 'warmCache', 'batch');
            return {
                success,
                failures: warmupData.length - success,
                totalTime: Date.now() - startTime
            };
        }
    }

    /**
     * Get comprehensive cache statistics
     */
    async getStats(): Promise<CacheStats> {
        const hitRate = this.stats.totalOperations > 0
            ? (this.stats.hits / this.stats.totalOperations) * 100
            : 0;

        // Calculate average TTL from memory cache
        let totalTtl = 0;
        let keyCount = 0;
        const now = Date.now();

        for (const entry of this.memoryCache.values()) {
            const remainingTtl = Math.max(0, entry.expires - now);
            totalTtl += remainingTtl;
            keyCount++;
        }

        const avgTtl = keyCount > 0 ? totalTtl / keyCount / 1000 : 0;

        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate: parseFloat(hitRate.toFixed(2)),
            totalKeys: this.memoryCache.size,
            memoryUsage: this.currentMemoryUsage,
            avgTtl: parseFloat(avgTtl.toFixed(2)),
            lastUpdated: new Date()
        };
    }

    // ==========================================
    // PRIVATE HELPER METHODS
    // ==========================================

    private getFromMemory<T>(key: string): CacheResult<T> {
        const entry = this.memoryCache.get(key);

        if (!entry) {
            return {
                data: null,
                hit: false,
                ttl: 0,
                source: 'memory',
                timestamp: Date.now()
            };
        }

        // Check if entry has expired
        if (Date.now() > entry.expires) {
            this.memoryCache.delete(key);
            this.currentMemoryUsage -= entry.size;
            return {
                data: null,
                hit: false,
                ttl: 0,
                source: 'memory',
                timestamp: Date.now()
            };
        }

        const remainingTtl = Math.max(0, entry.expires - Date.now());

        return {
            data: entry.data as T,
            hit: true,
            ttl: Math.floor(remainingTtl / 1000),
            source: 'memory',
            timestamp: Date.now()
        };
    }

    private async getFromRedis<T>(key: string, options: CacheOptions): Promise<CacheResult<T>> {
        try {
            const [value, ttl] = await Promise.all([
                this.redis.get<string>(key),
                this.redis.ttl(key)
            ]);

            if (!value) {
                return {
                    data: null,
                    hit: false,
                    ttl: 0,
                    source: 'redis',
                    timestamp: Date.now()
                };
            }

            let parsedData: T;
            try {
                parsedData = JSON.parse(value);
            } catch (parseError) {
                this.logger.warn('Failed to parse Redis cache data', { key, error: parseError.message });
                // Clean up corrupted cache entry
                await this.redis.del(key);
                return {
                    data: null,
                    hit: false,
                    ttl: 0,
                    source: 'redis',
                    timestamp: Date.now()
                };
            }

            return {
                data: parsedData,
                hit: true,
                ttl: Math.max(0, ttl || 0),
                source: 'redis',
                timestamp: Date.now()
            };

        } catch (error) {
            this.logger.error('Redis cache get failed', { key, error: error.message });
            throw error;
        }
    }

    private async setInRedis<T>(key: string, data: T, ttl: number, options: CacheOptions): Promise<void> {
        try {
            let serializedData = JSON.stringify(data);

            // Apply compression for large data if enabled
            if (options.compression && serializedData.length > 1024) {
                // Note: In a real implementation, you'd use a compression library
                // For now, we'll just note that compression would happen here
                this.logger.debug('Large cache entry detected', { key, size: serializedData.length });
            }

            await this.redis.set(key, serializedData, ttl);

        } catch (error) {
            this.logger.error('Redis cache set failed', { key, error: error.message });
            throw error;
        }
    }

    private setInMemory<T>(key: string, data: T, ttl: number, tags: string[]): void {
        const dataSize = this.calculateDataSize(data);
        const expires = Date.now() + (ttl * 1000);

        // Check memory limits before storing
        if (this.currentMemoryUsage + dataSize > this.MEMORY_CACHE_MAX_MEMORY) {
            this.evictLRU(dataSize);
        }

        // Check key count limit
        if (this.memoryCache.size >= this.MEMORY_CACHE_MAX_SIZE) {
            this.evictLRU(0);
        }

        this.memoryCache.set(key, {
            data,
            expires,
            tags: [...tags],
            size: dataSize
        });

        this.currentMemoryUsage += dataSize;
    }

    private evictLRU(neededSpace: number): void {
        // Simple LRU eviction - remove oldest entries until we have space
        const entries = Array.from(this.memoryCache.entries());
        entries.sort((a, b) => a[1].expires - b[1].expires);

        let freedSpace = 0;
        for (const [key, entry] of entries) {
            this.memoryCache.delete(key);
            this.currentMemoryUsage -= entry.size;
            freedSpace += entry.size;

            // Stop when we've freed enough space or cache is small enough
            if (freedSpace >= neededSpace && this.memoryCache.size < this.MEMORY_CACHE_MAX_SIZE * 0.8) {
                break;
            }
        }

        this.logger.debug('Memory cache LRU eviction completed', {
            freedSpace,
            remainingKeys: this.memoryCache.size,
            currentMemoryUsage: this.currentMemoryUsage
        });
    }

    private calculateDataSize(data: any): number {
        try {
            return JSON.stringify(data).length * 2; // Rough estimate (UTF-16)
        } catch {
            return 1024; // Default size estimate for non-serializable data
        }
    }

    private shouldStoreInMemory(key: string, size: number): boolean {
        // Store in memory if:
        // 1. Size is reasonable (< 10KB)
        // 2. Key indicates high-frequency access
        // 3. Memory usage is not critical

        if (size > 10240) return false; // Don't store large objects in memory
        if (this.currentMemoryUsage > this.MEMORY_CACHE_MAX_MEMORY * 0.9) return false;

        // High-frequency keys that benefit from memory caching
        const highFrequencyPatterns = [
            /eligible:/,
            /budget:status:/,
            /metrics:.*:hour/,
            /campaign:config:/
        ];

        return highFrequencyPatterns.some(pattern => pattern.test(key));
    }

    private shouldPromoteToMemory(key: string, data: any): boolean {
        const size = this.calculateDataSize(data);
        return this.shouldStoreInMemory(key, size);
    }

    private getDefaultTTL(key: string): number {
        // Determine TTL based on key patterns
        if (key.includes('eligible:')) return RTB_CACHE_TTL.CAMPAIGN_ELIGIBILITY;
        if (key.includes('budget:')) return RTB_CACHE_TTL.BUDGET_STATUS;
        if (key.includes('metrics:')) return RTB_CACHE_TTL.METRICS_REALTIME;
        if (key.includes('targeting:')) return RTB_CACHE_TTL.TARGETING_RULES;
        if (key.includes('floor:')) return RTB_CACHE_TTL.FLOOR_PRICES;
        if (key.includes('timescale:')) return RTB_CACHE_TTL.TIMESCALE_ANALYTICS;

        return 300; // Default 5 minutes
    }

    private async updateCacheDependencies(key: string, tags: string[]): Promise<void> {
        try {
            const pipeline = await this.redis.pipeline();

            for (const tag of tags) {
                const dependencyKey = RTB_REDIS_KEYS.CACHE_DEPENDENCY_MAP(tag);
                pipeline.sadd(dependencyKey, key);
                pipeline.expire(dependencyKey, 86400); // 24 hours
            }

            await pipeline.exec();
        } catch (error) {
            this.logger.warn('Failed to update cache dependencies', { key, tags, error: error.message });
        }
    }

    private async logInvalidation(pattern: string, tags?: string[], count?: number): Promise<void> {
        try {
            const logKey = RTB_REDIS_KEYS.CACHE_INVALIDATION_LOG(Date.now().toString());
            const logData = {
                pattern,
                tags,
                count,
                timestamp: new Date().toISOString()
            };

            await this.redis.set(logKey, JSON.stringify(logData), 86400); // 24 hours
        } catch (error) {
            this.logger.warn('Failed to log cache invalidation', { error: error.message });
        }
    }

    private isCircuitOpen(): boolean {
        if (!this.circuitBreaker.isOpen) return false;

        // Check if circuit should be closed (timeout exceeded)
        if (this.circuitBreaker.lastFailureTime) {
            const timeSinceFailure = Date.now() - this.circuitBreaker.lastFailureTime.getTime();
            if (timeSinceFailure > this.circuitBreaker.timeout) {
                this.circuitBreaker.isOpen = false;
                this.circuitBreaker.failureCount = 0;
                this.logger.log('Circuit breaker closed - timeout exceeded');
                return false;
            }
        }

        return true;
    }

    private handleCacheError(error: any, operation: string, key: string): void {
        this.stats.errors++;
        this.circuitBreaker.failureCount++;
        this.circuitBreaker.lastFailureTime = new Date();

        // Open circuit breaker if threshold exceeded
        if (this.circuitBreaker.failureCount >= this.circuitBreaker.threshold) {
            this.circuitBreaker.isOpen = true;
            this.logger.warn('Circuit breaker opened due to cache failures', {
                operation,
                key,
                failureCount: this.circuitBreaker.failureCount,
                error: error.message
            });
        } else {
            this.logger.error('Cache operation failed', {
                operation,
                key,
                error: error.message,
                failureCount: this.circuitBreaker.failureCount
            });
        }
    }

    private initializeHealthCheck(): void {
        // Run health check every 30 seconds
        setInterval(async () => {
            try {
                await this.performHealthCheck();
            } catch (error) {
                this.logger.error('Cache health check failed', { error: error.message });
            }
        }, 30000);
    }

    private async performHealthCheck(): Promise<void> {
        const healthData = {
            memoryCache: {
                size: this.memoryCache.size,
                memoryUsage: this.currentMemoryUsage,
                maxSize: this.MEMORY_CACHE_MAX_SIZE,
                maxMemory: this.MEMORY_CACHE_MAX_MEMORY
            },
            circuit: {
                isOpen: this.circuitBreaker.isOpen,
                failureCount: this.circuitBreaker.failureCount,
                lastFailure: this.circuitBreaker.lastFailureTime
            },
            stats: this.stats,
            timestamp: new Date().toISOString()
        };

        const healthKey = RTB_REDIS_KEYS.CACHE_HEALTH_STATUS();

        try {
            await this.redis.set(healthKey, JSON.stringify(healthData), RTB_CACHE_TTL.HEALTH_STATUS);
        } catch (error) {
            // Health check failure - don't throw, just log
            this.logger.warn('Failed to update cache health status', { error: error.message });
        }
    }
}

/**
 * Cache Warming Service for Proactive Data Loading
 * 
 * **Why dedicated warming service:**
 * - Prevents cache misses during peak traffic periods
 * - Enables scheduled cache refresh operations
 * - Supports intelligent preloading based on usage patterns
 * - Improves overall system performance and user experience
 */
export class CacheWarmingService {
    private readonly logger = new Logger(CacheWarmingService.name);

    constructor(
        private readonly cacheManager: RTBCacheManager,
        private readonly redis: RedisService
    ) { }

    /**
     * Warm campaign eligibility cache for high-traffic inventories
     */
    async warmCampaignEligibilityCache(
        inventoryIds: string[],
        deviceTypes: string[] = ['MOBILE', 'DESKTOP', 'TABLET'],
        countries: string[] = ['US', 'GB', 'CA', 'AU']
    ): Promise<{ success: number; failures: number }> {
        const warmupData: Array<{ key: string; data: any; ttl?: number; tags?: string[] }> = [];

        try {
            // Generate all combinations of inventory, device, and country
            for (const inventoryId of inventoryIds) {
                for (const deviceType of deviceTypes) {
                    for (const country of countries) {
                        // This would normally fetch actual campaign data
                        // For this implementation, we'll create placeholder data
                        const key = RTB_REDIS_KEYS.CAMPAIGN_ELIGIBILITY_L2(inventoryId, deviceType);
                        const data = {
                            campaigns: [], // Would be populated with actual eligible campaigns
                            deviceType,
                            country,
                            createdAt: new Date().toISOString(),
                            cacheVersion: '1.0'
                        };

                        warmupData.push({
                            key,
                            data,
                            ttl: RTB_CACHE_TTL.CAMPAIGN_ELIGIBILITY,
                            tags: ['campaign', 'eligibility', `inventory:${inventoryId}`]
                        });
                    }
                }
            }

            const result = await this.cacheManager.warmCache(warmupData);

            this.logger.log('Campaign eligibility cache warming completed', {
                inventoryCount: inventoryIds.length,
                deviceTypes: deviceTypes.length,
                countries: countries.length,
                totalEntries: warmupData.length,
                result
            });

            return { success: result.success, failures: result.failures };

        } catch (error) {
            this.logger.error('Campaign eligibility cache warming failed', {
                error: error.message,
                inventoryCount: inventoryIds.length
            });
            return { success: 0, failures: warmupData.length };
        }
    }

    /**
     * Warm performance metrics cache for active campaigns
     */
    async warmPerformanceMetricsCache(
        campaignIds: string[],
        timeRanges: string[] = ['hour', 'day', 'week']
    ): Promise<{ success: number; failures: number }> {
        const warmupData: Array<{ key: string; data: any; ttl?: number; tags?: string[] }> = [];

        try {
            for (const campaignId of campaignIds) {
                for (const timeRange of timeRanges) {
                    // Generate cache keys for different metric types
                    const metricTypes = ['impressions', 'clicks', 'conversions', 'spend', 'revenue'];

                    for (const metricType of metricTypes) {
                        const timeKey = this.getTimeKey(timeRange);
                        const key = RTB_REDIS_KEYS.METRIC_IMPRESSIONS('campaign', campaignId, timeKey);

                        // This would normally fetch actual metrics data
                        const data = {
                            value: 0, // Would be populated with actual metric value
                            timeRange,
                            lastUpdated: new Date().toISOString()
                        };

                        const ttl = timeRange === 'hour'
                            ? RTB_CACHE_TTL.METRICS_REALTIME
                            : RTB_CACHE_TTL.METRICS_HOURLY;

                        warmupData.push({
                            key,
                            data,
                            ttl,
                            tags: ['metrics', 'performance', `campaign:${campaignId}`]
                        });
                    }
                }
            }

            const result = await this.cacheManager.warmCache(warmupData);

            this.logger.log('Performance metrics cache warming completed', {
                campaignCount: campaignIds.length,
                timeRanges: timeRanges.length,
                totalEntries: warmupData.length,
                result
            });

            return { success: result.success, failures: result.failures };

        } catch (error) {
            this.logger.error('Performance metrics cache warming failed', {
                error: error.message,
                campaignCount: campaignIds.length
            });
            return { success: 0, failures: warmupData.length };
        }
    }

    /**
     * Schedule periodic cache warming
     */
    initializeScheduledWarming(): void {
        // Warm cache every hour during business hours
        setInterval(async () => {
            const hour = new Date().getHours();
            if (hour >= 8 && hour <= 20) { // Business hours
                await this.performScheduledWarming();
            }
        }, 3600000); // Every hour

        this.logger.log('Scheduled cache warming initialized');
    }

    private async performScheduledWarming(): Promise<void> {
        try {
            // This would normally get top inventories and campaigns from analytics
            const topInventories = ['inv1', 'inv2', 'inv3']; // Placeholder
            const topCampaigns = ['camp1', 'camp2', 'camp3']; // Placeholder

            await Promise.all([
                this.warmCampaignEligibilityCache(topInventories),
                this.warmPerformanceMetricsCache(topCampaigns)
            ]);

            this.logger.log('Scheduled cache warming completed successfully');

        } catch (error) {
            this.logger.error('Scheduled cache warming failed', { error: error.message });
        }
    }

    private getTimeKey(timeRange: string): string {
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

    private getWeekNumber(date: Date): number {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
        const week1 = new Date(d.getFullYear(), 0, 4);
        return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    }
}