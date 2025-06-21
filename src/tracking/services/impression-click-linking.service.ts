import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { randomUUID } from 'crypto';

@Injectable()
export class ImpressionClickLinkingService {
    private readonly logger = new Logger(ImpressionClickLinkingService.name);

    constructor(private readonly redis: RedisService) { }

    // ✅ FIXED: Generate stable slot ID based on bidResponseId
    generateImpressionSlot(bidResponseId: string): string {
        // Create deterministic but unique slot ID
        const timestamp = Date.now();
        const randomSuffix = randomUUID().substring(0, 8);
        return `${bidResponseId}-${timestamp}-${randomSuffix}`;
    }

    // ✅ FIXED: Store impression with support for multiple clicks
    async storeImpressionMappings(
        slotId: string,
        bidResponseId: string,
        userFingerprint: string,
        impressionId: string
    ): Promise<void> {
        try {
            const timestamp = Date.now();
            const pipeline = this.redis.pipeline();

            // Strategy 1: Slot-based mapping (most reliable)
            const slotKey = `slot-impression:${slotId}`;
            const slotData = {
                impressionId,
                bidResponseId,
                userFingerprint,
                timestamp,
                clickCount: 0, // ✅ Track clicks per impression
            };
            pipeline.set(slotKey, JSON.stringify(slotData), 'EX', 3600);

            // Strategy 2: User-based mapping (allows multiple impressions per user)
            const userKey = `user-impression:${bidResponseId}:${userFingerprint}`;
            pipeline.zadd(userKey, timestamp, impressionId);
            pipeline.expire(userKey, 3600);

            // Strategy 3: Time-based mapping (emergency fallback)
            const timeKey = `time-impression:${bidResponseId}`;
            pipeline.zadd(timeKey, timestamp, impressionId);
            pipeline.expire(timeKey, 1800);

            // ✅ NEW: Impression metadata for analytics
            const impressionMetaKey = `impression-meta:${impressionId}`;
            const metaData = {
                slotId,
                bidResponseId,
                userFingerprint,
                createdAt: timestamp,
                clickIds: [], // ✅ Track all clicks for this impression
            };
            pipeline.set(impressionMetaKey, JSON.stringify(metaData), 'EX', 3600);

            await pipeline.exec();

            this.logger.debug('Impression mappings stored', {
                slotId,
                impressionId,
                bidResponseId,
                userFingerprint,
            });
        } catch (error) {
            this.logger.error('Failed to store impression mappings', {
                error: error.message,
                slotId,
                impressionId,
            });
        }
    }

    // ✅ FIXED: Find impression and handle multiple clicks properly
    async findImpressionAndRegisterClick(
        bidResponseId: string,
        userFingerprint: string,
        clickId: string,
        slotId?: string
    ): Promise<{
        impressionId: string;
        timeFromImpression: number;
        clickNumber: number; // Which click this is (1st, 2nd, etc.)
        isFirstClick: boolean;
    } | null> {

        let impressionResult = null;

        // Strategy 1: Slot-based lookup (most reliable)
        if (slotId) {
            impressionResult = await this.getImpressionBySlot(slotId);
        }

        // Strategy 2: User-based lookup (fallback)
        if (!impressionResult) {
            impressionResult = await this.getImpressionByUser(bidResponseId, userFingerprint);
        }

        // Strategy 3: Recent time-based lookup (emergency fallback)
        if (!impressionResult) {
            impressionResult = await this.getRecentImpression(bidResponseId);
        }

        if (!impressionResult) {
            this.logger.warn('No impression found for click', {
                bidResponseId,
                userFingerprint,
                slotId,
                clickId,
            });
            return null;
        }

        // ✅ REGISTER THIS CLICK and get click number
        const clickInfo = await this.registerClickForImpression(
            impressionResult.impressionId,
            clickId,
            slotId
        );

        return {
            impressionId: impressionResult.impressionId,
            timeFromImpression: impressionResult.timeFromImpression,
            clickNumber: clickInfo.clickNumber,
            isFirstClick: clickInfo.isFirstClick,
        };
    }

    // ✅ NEW: Register click and track multiple clicks per impression
    private async registerClickForImpression(
        impressionId: string,
        clickId: string,
        slotId?: string
    ): Promise<{ clickNumber: number; isFirstClick: boolean }> {
        try {
            const impressionMetaKey = `impression-meta:${impressionId}`;

            // Get current impression metadata
            const metaDataStr: string = await this.redis.get(impressionMetaKey);
            if (!metaDataStr) {
                // No metadata found - create basic one
                const basicMeta = {
                    clickIds: [clickId],
                    createdAt: Date.now(),
                };
                await this.redis.set(impressionMetaKey, JSON.stringify(basicMeta), 3600);
                return { clickNumber: 1, isFirstClick: true };
            }

            const metaData = JSON.parse(metaDataStr);

            // ✅ Add this click to the impression's click list
            if (!metaData.clickIds) {
                metaData.clickIds = [];
            }

            // Check if this click already exists (prevent duplicates)
            if (metaData.clickIds.includes(clickId)) {
                this.logger.warn('Duplicate click detected', { impressionId, clickId });
                return {
                    clickNumber: metaData.clickIds.indexOf(clickId) + 1,
                    isFirstClick: metaData.clickIds.indexOf(clickId) === 0
                };
            }

            // Add new click
            metaData.clickIds.push(clickId);
            const clickNumber = metaData.clickIds.length;
            const isFirstClick = clickNumber === 1;

            // Update impression metadata
            await this.redis.set(impressionMetaKey, JSON.stringify(metaData), 3600);

            // ✅ Update slot data if available (increment click count)
            if (slotId) {
                await this.incrementSlotClickCount(slotId);
            }

            this.logger.debug('Click registered for impression', {
                impressionId,
                clickId,
                clickNumber,
                isFirstClick,
                totalClicks: metaData.clickIds.length,
            });

            return { clickNumber, isFirstClick };
        } catch (error) {
            this.logger.error('Failed to register click for impression', {
                error: error.message,
                impressionId,
                clickId,
            });
            return { clickNumber: 1, isFirstClick: true }; // Safe fallback
        }
    }

    // ✅ NEW: Increment click count for slot
    private async incrementSlotClickCount(slotId: string): Promise<void> {
        try {
            const slotKey = `slot-impression:${slotId}`;
            const slotDataStr: string = await this.redis.get(slotKey);

            if (slotDataStr) {
                const slotData = JSON.parse(slotDataStr);
                slotData.clickCount = (slotData.clickCount || 0) + 1;
                slotData.lastClickAt = Date.now();

                await this.redis.set(slotKey, JSON.stringify(slotData), 3600);
            }
        } catch (error) {
            this.logger.error('Failed to increment slot click count', {
                error: error.message,
                slotId,
            });
        }
    }

    // ✅ ENHANCED: Get impression by slot with click tracking
    private async getImpressionBySlot(slotId: string): Promise<{
        impressionId: string;
        timeFromImpression: number;
        clickCount: number;
    } | null> {
        try {
            const slotKey = `slot-impression:${slotId}`;
            const data: string = await this.redis.get(slotKey);

            if (!data) return null;

            const parsed = JSON.parse(data);
            return {
                impressionId: parsed.impressionId,
                timeFromImpression: Date.now() - parsed.timestamp,
                clickCount: parsed.clickCount || 0,
            };
        } catch (error) {
            this.logger.error('Failed to get impression by slot', {
                error: error.message,
                slotId,
            });
            return null;
        }
    }

    // ✅ Get impression by user (handles multiple impressions)
    private async getImpressionByUser(
        bidResponseId: string,
        userFingerprint: string
    ): Promise<{ impressionId: string; timeFromImpression: number } | null> {
        try {
            const userKey = `user-impression:${bidResponseId}:${userFingerprint}`;

            // Get the most recent impression (highest score)
            const results = await this.redis.zrevrange(userKey, 0, 0, 'WITHSCORES');

            if (results.length === 0) return null;

            return {
                impressionId: results[0],
                timeFromImpression: Date.now() - parseInt(results[1]),
            };
        } catch (error) {
            this.logger.error('Failed to get impression by user', {
                error: error.message,
                bidResponseId,
                userFingerprint,
            });
            return null;
        }
    }

    // ✅ Get recent impression (emergency fallback)
    private async getRecentImpression(bidResponseId: string): Promise<{
        impressionId: string;
        timeFromImpression: number;
    } | null> {
        try {
            const timeKey = `time-impression:${bidResponseId}`;
            const cutoff = Date.now() - 30000; // Within last 30 seconds

            const results = await this.redis.zrevrangebyscore(
                timeKey,
                Date.now(),
                cutoff,
                'WITHSCORES',
                'LIMIT',
                0,
                1
            );

            if (results.length === 0) return null;

            return {
                impressionId: results[0],
                timeFromImpression: Date.now() - parseInt(results[1]),
            };
        } catch (error) {
            this.logger.error('Failed to get recent impression', {
                error: error.message,
                bidResponseId,
            });
            return null;
        }
    }

    // ✅ NEW: Get analytics for impression-click relationships
    async getImpressionClickAnalytics(impressionId: string): Promise<{
        totalClicks: number;
        clickIds: string[];
        firstClickTime?: number;
        lastClickTime?: number;
        averageClickDelay?: number;
    } | null> {
        try {
            const impressionMetaKey = `impression-meta:${impressionId}`;
            const metaDataStr: string = await this.redis.get(impressionMetaKey);

            if (!metaDataStr) return null;

            const metaData = JSON.parse(metaDataStr);
            const clickIds = metaData.clickIds || [];

            if (clickIds.length === 0) {
                return {
                    totalClicks: 0,
                    clickIds: [],
                };
            }

            // Get click timing data (if available)
            const firstClickTime = metaData.firstClickAt;
            const lastClickTime = metaData.lastClickAt;
            const averageClickDelay = firstClickTime && metaData.createdAt
                ? firstClickTime - metaData.createdAt
                : undefined;

            return {
                totalClicks: clickIds.length,
                clickIds,
                firstClickTime,
                lastClickTime,
                averageClickDelay,
            };
        } catch (error) {
            this.logger.error('Failed to get impression click analytics', {
                error: error.message,
                impressionId,
            });
            return null;
        }
    }

    // ✅ Utility methods remain the same
    generateUserFingerprint(req: any): string {
        const ip = this.getClientIP(req);
        const userAgent = req.headers['user-agent'] || '';
        const accept = req.headers['accept'] || '';

        const crypto = require('crypto');
        return crypto.createHash('md5')
            .update(`${ip}:${userAgent}:${accept}`)
            .digest('hex')
            .substring(0, 12);
    }

    private getClientIP(req: any): string {
        const forwarded = req.headers['x-forwarded-for'];
        const realIp = req.headers['x-real-ip'];
        const remoteAddress = req.connection?.remoteAddress || req.socket?.remoteAddress;

        let ip = forwarded || realIp || remoteAddress || req.ip || 'unknown';
        if (ip.includes(',')) {
            ip = ip.split(',')[0].trim();
        }
        return ip;
    }

    // ✅ NEW: Cleanup expired mappings (run periodically)
    async cleanupExpiredMappings(): Promise<{ cleaned: number; errors: number }> {
        let cleaned = 0;
        let errors = 0;

        try {
            // Clean up expired slot mappings
            const slotPattern = 'slot-impression:*';
            const slotKeys = await this.redis.keys(slotPattern);

            for (const key of slotKeys) {
                try {
                    const ttl = await this.redis.ttl(key);
                    if (ttl <= 0) {
                        await this.redis.del(key);
                        cleaned++;
                    }
                } catch (error) {
                    errors++;
                }
            }

            this.logger.debug('Cleanup completed', { cleaned, errors });
        } catch (error) {
            this.logger.error('Cleanup failed', { error: error.message });
        }

        return { cleaned, errors };
    }
}
