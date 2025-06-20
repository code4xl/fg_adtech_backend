import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import { RedisService } from '../../redis/redis.service';

@Injectable()
export class ImpressionClickLinkingService {
    private readonly logger = new Logger(ImpressionClickLinkingService.name);

    constructor(private readonly redis: RedisService) { }

    // Generate impression slot ID during ad markup generation
    generateImpressionSlot(): string {
        return uuidv4(); // Short but unique
    }

    // Store slot mapping when impression happens
    async storeSlotMapping(slotId: string, impressionId: string): Promise<void> {
        try {
            const slotKey = `slot-impression:${slotId}`;
            const data = {
                impressionId,
                timestamp: Date.now(),
            };
            await this.redis.set(slotKey, JSON.stringify(data), 3600); // 1 hour TTL
        } catch (error) {
            this.logger.error('Failed to store slot mapping', { error: error.message, slotId, impressionId });
        }
    }

    // Store user-based mapping (fallback)
    async storeUserMapping(bidResponseId: string, userFingerprint: string, impressionId: string): Promise<void> {
        try {
            const userKey = `user-impression:${bidResponseId}:${userFingerprint}`;
            const timestamp = Date.now();
            await this.redis.zadd(userKey, timestamp, impressionId);
            await this.redis.expire(userKey, 3600);
        } catch (error) {
            this.logger.error('Failed to store user mapping', { error: error.message, bidResponseId, userFingerprint });
        }
    }

    // Store time-based mapping (emergency fallback)
    async storeTimeBasedMapping(bidResponseId: string, impressionId: string): Promise<void> {
        try {
            const timeKey = `time-impression:${bidResponseId}`;
            const timestamp = Date.now();
            await this.redis.zadd(timeKey, timestamp, impressionId);
            await this.redis.expire(timeKey, 1800); // 30 minutes
        } catch (error) {
            this.logger.error('Failed to store time mapping', { error: error.message, bidResponseId });
        }
    }

    // Find impression using multiple strategies
    async findImpressionId(
        bidResponseId: string,
        userFingerprint: string,
        slotId?: string
    ): Promise<{ impressionId: string; timeFromImpression: number } | null> {

        // Strategy 1: Slot-based lookup (most reliable)
        if (slotId) {
            const result = await this.getImpressionBySlot(slotId);
            if (result) return result;
        }

        // Strategy 2: User-based lookup (fallback)
        const userResult = await this.getImpressionByUser(bidResponseId, userFingerprint);
        if (userResult) return userResult;

        // Strategy 3: Recent time-based lookup (emergency fallback)
        const timeResult = await this.getRecentImpression(bidResponseId);
        return timeResult;
    }

    public async getImpressionBySlot(slotId: string): Promise<{ impressionId: string; timeFromImpression: number } | null> {
        try {
            const slotKey = `slot-impression:${slotId}`;
            const data: string = await this.redis.get(slotKey);

            if (!data) return null;

            const parsed = JSON.parse(data);
            return {
                impressionId: parsed.impressionId,
                timeFromImpression: Date.now() - parsed.timestamp,
            };
        } catch (error) {
            return null;
        }
    }

    public async getImpressionByUser(bidResponseId: string, userFingerprint: string): Promise<{ impressionId: string; timeFromImpression: number } | null> {
        try {
            const userKey = `user-impression:${bidResponseId}:${userFingerprint}`;
            const results = await this.redis.zrevrange(userKey, 0, 0, 'WITHSCORES');

            if (results.length === 0) return null;

            return {
                impressionId: results[0],
                timeFromImpression: Date.now() - parseInt(results[1]),
            };
        } catch (error) {
            return null;
        }
    }

    public async getRecentImpression(bidResponseId: string): Promise<{ impressionId: string; timeFromImpression: number } | null> {
        try {
            const timeKey = `time-impression:${bidResponseId}`;
            const cutoff = Date.now() - 30000; // Within last 30 seconds

            const results = await this.redis.zrevrangebyscore(timeKey, Date.now(), cutoff, 'WITHSCORES', 'LIMIT', 0, 1);

            if (results.length === 0) return null;

            return {
                impressionId: results[0],
                timeFromImpression: Date.now() - parseInt(results[1]),
            };
        } catch (error) {
            return null;
        }
    }

    // Generate user fingerprint for uniqueness
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

    public getClientIP(req: any): string {
        const forwarded = req.headers['x-forwarded-for'];
        const realIp = req.headers['x-real-ip'];
        const remoteAddress = req.connection?.remoteAddress || req.socket?.remoteAddress;

        let ip = forwarded || realIp || remoteAddress || req.ip || 'unknown';
        if (ip.includes(',')) {
            ip = ip.split(',')[0].trim();
        }
        return ip;
    }
}