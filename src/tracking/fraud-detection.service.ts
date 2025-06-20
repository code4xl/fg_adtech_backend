import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { CLICK_AND_IMPRESSION_KEYS, RTB_CACHE_TTL, RTB_KEYS } from 'src/rtb/constants/cache-keys';


@Injectable()
export class FraudDetectionService {
    private readonly logger = new Logger(FraudDetectionService.name);

    // Known bot user agents patterns
    private readonly BOT_PATTERNS = [
        /bot/i,
        /crawler/i,
        /spider/i,
        /scraper/i,
        /curl/i,
        /wget/i,
        /python/i,
        /java/i,
        /node/i,
        /phantomjs/i,
        /headless/i,
    ];

    constructor(private readonly redis: RedisService) { }

    /**
     * Check impression for fraud indicators
     */
    async checkImpression(data: ImpressionFraudCheck): Promise<FraudCheckResult> {
        const fraudReasons: string[] = [];
        let fraudScore = 0;
        let isBot = false;

        try {
            const today = this.getDateString();
            const ipAddress = data.ipAddress || 'unknown';
            const userAgent = data.userAgent || '';

            // 1. Check if IP is blocked
            if (await this.isIpBlocked(ipAddress)) {
                fraudReasons.push('blocked_ip');
                fraudScore += 1.0;
                isBot = true;
            }

            // 2. Check user agent for bot patterns
            if (this.isBotUserAgent(userAgent)) {
                fraudReasons.push('bot_user_agent');
                fraudScore += 0.9;
                isBot = true;
            }

            // 3. Check IP impression frequency
            const ipImpressionCount = await this.getIpImpressionCount(ipAddress, today);
            if (ipImpressionCount > RTB_CACHE_TTL.MAX_IMPRESSIONS_PER_IP_PER_DAY) {
                fraudReasons.push('high_ip_frequency');
                fraudScore += 0.7;
            }

            // 4. Check campaign-specific IP frequency
            const campaignIpCount = await this.getCampaignIpCount(data.campaignId, ipAddress, today);
            if (campaignIpCount > RTB_CACHE_TTL.MAX_IMPRESSIONS_PER_CAMPAIGN_IP_PER_DAY) {
                fraudReasons.push('high_campaign_ip_frequency');
                fraudScore += 0.6;
            }

            // 5. Check user agent frequency
            const uaHash = this.hashUserAgent(userAgent);
            const uaCount = await this.getUserAgentCount(uaHash, today);
            if (uaCount > 500) { // High threshold for common browsers
                fraudReasons.push('high_user_agent_frequency');
                fraudScore += 0.4;
            }

            // 6. Update counters for this impression
            await this.updateImpressionCounters(data, today);

            // Cap fraud score at 1.0
            fraudScore = Math.min(fraudScore, 1.0);

            this.logger.debug(`Impression fraud check: ${data.bidResponseId}, score: ${fraudScore}`);

            return {
                isBot,
                fraudScore,
                reasons: fraudReasons,
            };
        } catch (error) {
            this.logger.error(`Fraud check failed for impression: ${error.message}`);
            return {
                isBot: false,
                fraudScore: 0,
                reasons: ['check_failed'],
            };
        }
    }

    /**
     * Check click for fraud indicators
     */
    async checkClick(data: ClickFraudCheck): Promise<FraudCheckResult> {
        const fraudReasons: string[] = [];
        let fraudScore = 0;
        let isBot = false;
        let timeFromImpression: number | undefined;

        try {
            const today = this.getDateString();
            const ipAddress = data.ipAddress || 'unknown';
            const userAgent = data.userAgent || '';

            // 1. Check if IP is blocked
            if (await this.isIpBlocked(ipAddress)) {
                fraudReasons.push('blocked_ip');
                fraudScore += 1.0;
                isBot = true;
            }

            // 2. Check user agent for bot patterns
            if (this.isBotUserAgent(userAgent)) {
                fraudReasons.push('bot_user_agent');
                fraudScore += 0.9;
                isBot = true;
            }

            // 3. Check IP click frequency
            const ipClickCount = await this.getIpClickCount(ipAddress, today);
            if (ipClickCount > RTB_CACHE_TTL.MAX_CLICKS_PER_IP_PER_DAY) {
                fraudReasons.push('high_click_frequency');
                fraudScore += 0.8;
            }

            // 4. Check time between impression and click
            if (data.impressionId) {
                timeFromImpression = await this.getTimeFromImpression(data.impressionId);
                if (timeFromImpression !== undefined) {
                    if (timeFromImpression < RTB_CACHE_TTL.MIN_TIME_BETWEEN_IMPRESSION_CLICK) {
                        fraudReasons.push('too_fast_click');
                        fraudScore += 0.9;
                    } else if (timeFromImpression > RTB_CACHE_TTL.MAX_TIME_BETWEEN_IMPRESSION_CLICK) {
                        fraudReasons.push('too_slow_click');
                        fraudScore += 0.3;
                    }
                }
            }

            // 5. Check click coordinates (if provided)
            if (this.isSuspiciousClickCoordinates(data.clickX, data.clickY)) {
                fraudReasons.push('suspicious_click_coordinates');
                fraudScore += 0.4;
            }

            // 6. Update counters for this click
            await this.updateClickCounters(data, today);

            // Cap fraud score at 1.0
            fraudScore = Math.min(fraudScore, 1.0);

            this.logger.debug(`Click fraud check: ${data.bidResponseId}, score: ${fraudScore}`);

            return {
                isBot,
                fraudScore,
                reasons: fraudReasons,
                timeFromImpression,
            };
        } catch (error) {
            this.logger.error(`Fraud check failed for click: ${error.message}`);
            return {
                isBot: false,
                fraudScore: 0,
                reasons: ['check_failed'],
            };
        }
    }

    /**
     * Block an IP address
     */
    async blockIp(ipAddress: string, reason: string): Promise<void> {
        try {
            await this.redis.sadd(CLICK_AND_IMPRESSION_KEYS.BLOCKED_IPS, ipAddress);
            this.logger.warn(`Blocked IP: ${ipAddress}, reason: ${reason}`);
        } catch (error) {
            this.logger.error(`Failed to block IP: ${error.message}`);
        }
    }

    /**
     * Check if IP is blocked
     */
    private async isIpBlocked(ipAddress: string): Promise<boolean> {
        try {
            return await this.redis.sismember(CLICK_AND_IMPRESSION_KEYS.BLOCKED_IPS, ipAddress) == 1 ? true : false;
        } catch (error) {
            return false;
        }
    }

    /**
     * Check if user agent matches bot patterns
     */
    private isBotUserAgent(userAgent: string): boolean {
        if (!userAgent || userAgent.length < 10) {
            return true; // Suspicious short or missing user agent
        }

        return this.BOT_PATTERNS.some(pattern => pattern.test(userAgent));
    }

    /**
     * Get impression count for IP address today
     */
    private async getIpImpressionCount(ipAddress: string, date: string): Promise<number> {
        try {
            const count: string = await this.redis.get(CLICK_AND_IMPRESSION_KEYS.IP_IMPRESSION_COUNT(ipAddress, date));
            return parseInt(count) || 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Get click count for IP address today
     */
    private async getIpClickCount(ipAddress: string, date: string): Promise<number> {
        try {
            const count: string = await this.redis.get(CLICK_AND_IMPRESSION_KEYS.IP_CLICK_COUNT(ipAddress, date));
            return parseInt(count) || 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Get impression count for specific campaign and IP
     */
    private async getCampaignIpCount(campaignId: string, ipAddress: string, date: string): Promise<number> {
        try {
            const count: string = await this.redis.get(CLICK_AND_IMPRESSION_KEYS.CAMPAIGN_IP_COUNT(campaignId, ipAddress, date));
            return parseInt(count) || 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Get user agent count
     */
    private async getUserAgentCount(uaHash: string, date: string): Promise<number> {
        try {
            const count: string = await this.redis.get(CLICK_AND_IMPRESSION_KEYS.USER_AGENT_COUNT(uaHash, date));
            return parseInt(count) || 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Get time elapsed since impression
     */
    private async getTimeFromImpression(impressionId: string): Promise<number | undefined> {
        try {
            const timestamp: string = await this.redis.get(CLICK_AND_IMPRESSION_KEYS.IMPRESSION_TIMESTAMP(impressionId));
            if (timestamp) {
                return Date.now() - parseInt(timestamp);
            }
            return undefined;
        } catch (error) {
            return undefined;
        }
    }

    /**
     * Check if click coordinates are suspicious
     */
    private isSuspiciousClickCoordinates(x?: number, y?: number): boolean {
        if (x === undefined || y === undefined) {
            return false;
        }

        // Check for exact corner clicks (0,0) or other suspicious patterns
        if ((x === 0 && y === 0) || (x === 1 && y === 1)) {
            return true;
        }

        return false;
    }

    /**
     * Update impression counters
     */
    private async updateImpressionCounters(data: ImpressionFraudCheck, date: string): Promise<void> {
        const pipeline = this.redis.pipeline();
        const ipAddress = data.ipAddress || 'unknown';
        const userAgent = data.userAgent || '';
        const uaHash = this.hashUserAgent(userAgent);

        // Increment counters
        pipeline.incr(CLICK_AND_IMPRESSION_KEYS.IP_IMPRESSION_COUNT(ipAddress, date));
        pipeline.incr(CLICK_AND_IMPRESSION_KEYS.CAMPAIGN_IP_COUNT(data.campaignId, ipAddress, date));
        pipeline.incr(CLICK_AND_IMPRESSION_KEYS.USER_AGENT_COUNT(uaHash, date));

        // Set expiration (30 days)
        pipeline.expire(CLICK_AND_IMPRESSION_KEYS.IP_IMPRESSION_COUNT(ipAddress, date), 2592000);
        pipeline.expire(CLICK_AND_IMPRESSION_KEYS.CAMPAIGN_IP_COUNT(data.campaignId, ipAddress, date), 2592000);
        pipeline.expire(CLICK_AND_IMPRESSION_KEYS.USER_AGENT_COUNT(uaHash, date), 2592000);

        // Store impression timestamp for click fraud detection
        if (data.bidResponseId) {
            pipeline.set(
                CLICK_AND_IMPRESSION_KEYS.IMPRESSION_TIMESTAMP(data.bidResponseId),
                Date.now().toString(),
                'EX',
                3600 // Expire after 1 hour
            );
        }

        await pipeline.exec();
    }

    /**
     * Update click counters
     */
    private async updateClickCounters(data: ClickFraudCheck, date: string): Promise<void> {
        const pipeline = this.redis.pipeline();
        const ipAddress = data.ipAddress || 'unknown';

        // Increment click counter
        pipeline.incr(CLICK_AND_IMPRESSION_KEYS.IP_CLICK_COUNT(ipAddress, date));

        // Set expiration (30 days)
        pipeline.expire(CLICK_AND_IMPRESSION_KEYS.IP_CLICK_COUNT(ipAddress, date), 2592000);

        await pipeline.exec();
    }

    /**
     * Hash user agent for privacy
     */
    private hashUserAgent(userAgent: string): string {
        // Simple hash function - in production, use crypto.createHash
        let hash = 0;
        for (let i = 0; i < userAgent.length; i++) {
            const char = userAgent.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Get current date string (YYYY-MM-DD)
     */
    private getDateString(date?: Date): string {
        const d = date || new Date();
        return d.toISOString().split('T')[0];
    }

    /**
     * Get fraud statistics
     */
    async getFraudStats(date?: string): Promise<any> {
        try {
            const dateStr = date || this.getDateString();

            const [blockedIps, blockedUAs] = await Promise.all([
                this.redis.scard(CLICK_AND_IMPRESSION_KEYS.BLOCKED_IPS),
                this.redis.scard(CLICK_AND_IMPRESSION_KEYS.BLOCKED_USER_AGENTS),
            ]);

            return {
                date: dateStr,
                blockedIps,
                blockedUserAgents: blockedUAs,
            };
        } catch (error) {
            this.logger.error(`Failed to get fraud stats: ${error.message}`);
            return null;
        }
    }
}