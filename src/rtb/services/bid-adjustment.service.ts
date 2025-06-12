import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { RedisService } from "src/redis/redis.service";
import { PRICING_KEYS } from "../constants/cache-keys";

@Injectable()
export class BidAdjustmentService {
    private readonly logger = new Logger(BidAdjustmentService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
    ) { }

    public async getDeviceMultiplier(
        campaignId: string,
        deviceType: string,
    ): Promise<number> {
        try {
            const cacheKey = PRICING_KEYS.DEVICE_MULTIPLIER(
                deviceType,
                campaignId,
            );
            const cached = await this.redis.get<string>(cacheKey);

            if (cached) {
                return parseFloat(cached);
            }

            // Calculate device performance from historical data
            const devicePerformance = await this.calculateDevicePerformance(
                campaignId,
                deviceType,
            );

            // Cache for 1 hour
            await this.redis.set(cacheKey, devicePerformance.toString(), 3600);

            return devicePerformance;
        } catch (error) {
            this.logger.warn('Device multiplier calculation failed', {
                error: error.message,
                campaignId,
                deviceType,
            });
            return 1.0;
        }
    }

    public async calculateDevicePerformance(
        campaignId: string,
        deviceType: string,
    ): Promise<number> {
        // Get performance data by device type from impressions
        const deviceStats = await this.prisma.impressionEvent.aggregate({
            where: {
                campaignId,
                deviceType,
                timestamp: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
                },
            },
            _count: {
                id: true,
            },
        });

        const allDeviceStats = await this.prisma.impressionEvent.aggregate({
            where: {
                campaignId,
                timestamp: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                },
            },
            _count: {
                id: true,
            },
        });

        if (!allDeviceStats._count.id || allDeviceStats._count.id === 0) {
            return 1.0; // No data, neutral multiplier
        }

        // Calculate relative performance
        const deviceImpressions = deviceStats._count.id || 0;
        const totalImpressions = allDeviceStats._count.id;

        const deviceShare = deviceImpressions / totalImpressions;

        // Apply device-specific adjustments based on typical performance
        const deviceMultipliers = {
            mobile: 1.2, // Mobile typically performs better
            desktop: 1.0, // Baseline
            tablet: 0.9, // Tablet typically lower performance
        };

        const baseMultiplier = deviceMultipliers[deviceType?.toLowerCase()] || 1.0;

        // Adjust based on actual performance
        if (deviceShare > 0.5) {
            return Math.min(1.5, baseMultiplier * 1.1); // High performing device
        } else if (deviceShare < 0.2) {
            return Math.max(0.7, baseMultiplier * 0.9); // Low performing device
        }

        return baseMultiplier;
    }

    public async getGeographicMultiplier(
        campaignId: string,
        country: string,
        region: string,
    ): Promise<number> {
        try {
            const cacheKey = PRICING_KEYS.GEO_MULTIPLIER(
                country,
                campaignId,
            );
            const cached = await this.redis.get<string>(cacheKey);

            if (cached) {
                return parseFloat(cached);
            }

            const geoPerformance = await this.calculateGeographicPerformance(
                campaignId,
                country,
                region,
            );

            // Cache for 2 hours
            await this.redis.set(cacheKey, geoPerformance.toString(), 7200);

            return geoPerformance;
        } catch (error) {
            this.logger.warn('Geographic multiplier calculation failed', {
                error: error.message,
                campaignId,
                country,
            });
            return 1.0;
        }
    }

    public async calculateGeographicPerformance(
        campaignId: string,
        country: string,
        region: string,
    ): Promise<number> {
        // Get conversion data by geography
        const geoStats = await this.prisma.impressionEvent.findMany({
            where: {
                campaignId,
                country,
                timestamp: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                },
            },
            select: {
                id: true,
                ClickEvent: {
                    select: { id: true },
                },
            },
        });

        if (geoStats.length === 0) {
            return 1.0;
        }

        // Calculate CTR for this geography
        const impressions = geoStats.length;
        const clicks = geoStats.filter((imp) => imp.ClickEvent.length > 0).length;
        const geoCTR = impressions > 0 ? (clicks / impressions) * 100 : 0;

        // Get campaign average CTR
        const avgCTR = await this.getCampaignAverageCTR(campaignId);

        if (avgCTR === 0) {
            return 1.0;
        }

        // Return relative performance (capped between 0.5 and 2.0)
        const relativePerformance = geoCTR / avgCTR;
        return Math.max(0.5, Math.min(2.0, relativePerformance));
    }

    public getTimeOfDayMultiplier(hour: number): number {
        // Define time-based multipliers (24-hour format)
        const timeMultipliers = {
            0: 0.7, // Midnight - 1AM
            1: 0.6, // 1AM - 2AM
            2: 0.5, // 2AM - 3AM
            3: 0.5, // 3AM - 4AM
            4: 0.5, // 4AM - 5AM
            5: 0.6, // 5AM - 6AM
            6: 0.8, // 6AM - 7AM
            7: 0.9, // 7AM - 8AM
            8: 1.0, // 8AM - 9AM
            9: 1.1, // 9AM - 10AM
            10: 1.2, // 10AM - 11AM
            11: 1.2, // 11AM - 12PM
            12: 1.1, // 12PM - 1PM
            13: 1.0, // 1PM - 2PM
            14: 1.1, // 2PM - 3PM
            15: 1.2, // 3PM - 4PM
            16: 1.2, // 4PM - 5PM
            17: 1.1, // 5PM - 6PM
            18: 1.0, // 6PM - 7PM
            19: 1.1, // 7PM - 8PM
            20: 1.2, // 8PM - 9PM
            21: 1.1, // 9PM - 10PM
            22: 1.0, // 10PM - 11PM
            23: 0.8, // 11PM - 12AM
        };

        return timeMultipliers[hour] || 1.0;
    }

    public async getInventoryQualityMultiplier(
        inventoryId: string,
    ): Promise<number> {
        try {
            const cacheKey =
                PRICING_KEYS.INVENTORY_QUALITY_MULTIPLIER(
                    inventoryId,
                );
            const cached = await this.redis.get<string>(cacheKey);

            if (cached) {
                return parseFloat(cached);
            }

            const qualityScore = await this.calculateInventoryQuality(inventoryId);

            // Cache for 4 hours
            await this.redis.set(cacheKey, qualityScore.toString(), 14400);

            return qualityScore;
        } catch (error) {
            this.logger.warn('Inventory quality calculation failed', {
                error: error.message,
                inventoryId,
            });
            return 1.0;
        }
    }

    public async calculateInventoryQuality(
        inventoryId: string,
    ): Promise<number> {
        // Get inventory performance metrics
        const inventory = await this.prisma.adInventory.findUnique({
            where: { id: inventoryId },
            select: {
                viewabilityScore: true,
                website: {
                    select: {
                        domain: true,
                    },
                },
            },
        });

        if (!inventory) {
            return 1.0;
        }

        let qualityScore = 1.0;

        // Viewability score adjustment
        if (inventory.viewabilityScore) {
            // Viewability score is 0-1, convert to multiplier
            qualityScore *= 0.5 + inventory.viewabilityScore * 0.5;
        }

        // Domain quality (simplified - could be enhanced with domain reputation data)
        const domain = inventory.website?.domain;
        if (domain) {
            const domainQuality = this.assessDomainQuality(domain);
            qualityScore *= domainQuality;
        }

        return Math.max(0.5, Math.min(1.5, qualityScore));
    }

    public assessDomainQuality(domain: string): number {
        // Simplified domain quality assessment
        // In production, this could integrate with domain reputation services

        if (!domain) return 1.0;

        // Basic quality indicators
        const isHTTPS = domain.startsWith('https://');
        const hasWWW = domain.includes('www.');
        const domainLength = domain.length;

        let score = 1.0;

        if (isHTTPS) score += 0.1;
        if (hasWWW) score += 0.05;
        if (domainLength > 20 && domainLength < 50) score += 0.05;

        return Math.max(0.8, Math.min(1.2, score));
    }

    private async getCampaignAverageCTR(campaignId: string): Promise<number> {
        try {
            const stats = await this.prisma.campaignStatistics.aggregate({
                where: {
                    campaignId,
                    date: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    },
                },
                _sum: {
                    impressions: true,
                    clicks: true,
                },
            });

            const impressions = stats._sum.impressions || 0;
            const clicks = stats._sum.clicks || 0;

            return impressions > 0 ? (clicks / impressions) * 100 : 0;
        } catch (error) {
            this.logger.warn('Failed to get campaign average CTR', {
                error: error.message,
                campaignId,
            });
            return 0;
        }
    }
}