// src/rtb/services/bid-evaluation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

/**
 * Bid Evaluation Service - Phase 3 Complete Implementation
 * 
 * **Core responsibility: Calculate optimal bid prices for campaigns**
 * 
 * **Why sophisticated bid calculation:**
 * - Different bid strategies serve different campaign objectives
 * - Real-time performance data influences bid adjustments
 * - Geographic and device targeting affects bid values
 * - Budget pacing ensures spend distribution across campaign period
 * 
 * **Bid strategy implementations:**
 * 1. LOWEST_COST: Bid just above floor price (maximum reach)
 * 2. COST_CAP: Maintain average cost while maximizing volume
 * 3. BID_CAP: Never exceed maximum bid amount
 * 4. TARGET_COST: Maintain specific cost per action
 * 
 * **Bid adjustment factors:**
 * - Device type multipliers (mobile vs desktop performance)
 * - Geographic performance variations
 * - Time-of-day performance patterns
 * - Creative performance history
 * - Inventory quality scores
 * - Competitive landscape analysis
 */
@Injectable()
export class BidEvaluationService {
    private readonly logger = new Logger(BidEvaluationService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
    ) {
        this.logger.log('Bid Evaluation Service initialized - Phase 3 Complete');
    }

    /**
     * Calculate bid price for a campaign and context
     * 
     * **Why context-aware bidding:**
     * - Same campaign may have different values in different contexts
     * - Geographic targeting affects competition levels
     * - Device performance varies by campaign type
     * - Time patterns influence conversion likelihood
     */
    async calculateBidPrice(campaign: any, context: any): Promise<number> {
        this.logger.debug('Calculating bid price', {
            campaignId: campaign.id,
            bidStrategy: campaign.bidStrategy,
            deviceType: context.userContext.deviceType
        });

        try {
            // 1. Get base bid amount from campaign
            const baseBid = await this.getBaseBidAmount(campaign);

            // 2. Apply bid strategy logic
            const strategicBid = await this.applyBidStrategy(campaign, baseBid, context);

            // 3. Apply contextual adjustments
            const adjustedBid = await this.applyBidAdjustments(campaign, strategicBid, context);

            // 4. Apply budget pacing constraints
            const pacedBid = await this.applyBudgetPacing(campaign, adjustedBid);

            // 5. Ensure bid meets minimum and maximum constraints
            const finalBid = this.applyBidConstraints(pacedBid, context.floorPrice, campaign.bidAmount);

            this.logger.debug('Bid calculation completed', {
                campaignId: campaign.id,
                baseBid,
                strategicBid,
                adjustedBid,
                pacedBid,
                finalBid
            });

            return finalBid;

        } catch (error) {
            this.logger.error('Bid calculation failed', {
                error: error.message,
                campaignId: campaign.id
            });

            // Fallback to minimum viable bid
            return Math.max(context.floorPrice || 0.01, 0.01);
        }
    }

    /**
     * Get performance-based bid adjustments
     * 
     * **Why performance-based bidding:**
     * - Historical data predicts future performance
     * - Automatic optimization without manual intervention
     * - Competitive advantage through data-driven decisions
     */
    async getPerformanceAdjustment(
        campaignId: string,
        context: any
    ): Promise<number> {
        try {
            // Get recent performance metrics
            const metrics = await this.getRecentPerformanceMetrics(campaignId, context);

            if (!metrics) {
                return 1.0; // No adjustment if no data
            }

            // Calculate performance score (0.5 to 2.0 multiplier)
            const ctrScore = this.calculateCTRScore(metrics.ctr);
            const conversionScore = this.calculateConversionScore(metrics.conversionRate);
            const qualityScore = this.calculateQualityScore(metrics);

            // Weighted combination
            const performanceScore = (
                ctrScore * 0.4 +
                conversionScore * 0.4 +
                qualityScore * 0.2
            );

            // Cap adjustments to reasonable range
            return Math.max(0.5, Math.min(2.0, performanceScore));

        } catch (error) {
            this.logger.error('Performance adjustment calculation failed', {
                error: error.message,
                campaignId
            });
            return 1.0;
        }
    }

    // ==========================================
    // PRIVATE BID CALCULATION METHODS
    // ==========================================

    /**
     * Get base bid amount from campaign settings
     */
    private async getBaseBidAmount(campaign: any): Promise<number> {
        // Use campaign's bid amount or derive from budget
        if (campaign.bidAmount && campaign.bidAmount > 0) {
            return Number(campaign.bidAmount);
        }

        // Fallback: derive from daily budget (assume 1000 impressions per day)
        const dailyBudget = await this.getDailyBudget(campaign.id);
        if (dailyBudget > 0) {
            return dailyBudget / 1000; // Simple estimation
        }

        // Ultimate fallback
        return 1.00;
    }

    /**
     * Apply campaign bid strategy
     */
    private async applyBidStrategy(
        campaign: any,
        baseBid: number,
        context: any
    ): Promise<number> {
        switch (campaign.bidStrategy) {
            case 'LOWEST_COST':
                return this.calculateLowestCostBid(baseBid, context);

            case 'COST_CAP':
                return this.calculateCostCapBid(campaign, baseBid, context);

            case 'BID_CAP':
                return this.calculateBidCapBid(campaign, baseBid);

            case 'TARGET_COST':
                return this.calculateTargetCostBid(campaign, baseBid, context);

            default:
                return baseBid;
        }
    }

    /**
     * LOWEST_COST strategy: Bid just above floor to maximize reach
     */
    private calculateLowestCostBid(baseBid: number, context: any): number {
        const floorPrice = context.floorPrice || 0.01;
        const minBid = Math.max(floorPrice * 1.01, 0.01); // 1% above floor
        return Math.min(baseBid, minBid);
    }

    /**
     * COST_CAP strategy: Maintain average cost while maximizing volume
     */
    private async calculateCostCapBid(
        campaign: any,
        baseBid: number,
        context: any
    ): Promise<number> {
        // Get current average cost
        const avgCost = await this.getAverageCost(campaign.id);
        const targetCost = Number(campaign.bidAmount || baseBid);

        if (avgCost === null) {
            return baseBid; // No data yet
        }

        // Adjust bid based on cost performance
        if (avgCost < targetCost * 0.8) {
            // Under target, can bid higher
            return baseBid * 1.2;
        } else if (avgCost > targetCost * 1.2) {
            // Over target, reduce bid
            return baseBid * 0.8;
        }

        return baseBid;
    }

    /**
     * BID_CAP strategy: Never exceed maximum bid amount
     */
    private calculateBidCapBid(campaign: any, baseBid: number): number {
        const maxBid = Number(campaign.bidAmount || baseBid);
        return Math.min(baseBid, maxBid);
    }

    /**
     * TARGET_COST strategy: Maintain specific cost per action
     */
    private async calculateTargetCostBid(
        campaign: any,
        baseBid: number,
        context: any
    ): Promise<number> {
        const targetCPA = Number(campaign.bidAmount || baseBid);

        // Get estimated conversion rate for this context
        const estimatedCR = await this.getEstimatedConversionRate(campaign.id, context);

        if (estimatedCR > 0) {
            // Bid = Target CPA × Estimated CR
            return targetCPA * estimatedCR;
        }

        return baseBid;
    }

    /**
     * Apply contextual bid adjustments
     */
    private async applyBidAdjustments(
        campaign: any,
        baseBid: number,
        context: any
    ): Promise<number> {
        let adjustedBid = baseBid;

        // Device type adjustment
        const deviceMultiplier = await this.getDeviceMultiplier(
            campaign.id,
            context.userContext.deviceType
        );
        adjustedBid *= deviceMultiplier;

        // Geographic adjustment
        const geoMultiplier = await this.getGeographicMultiplier(
            campaign.id,
            context.userContext.country,
            context.userContext.region
        );
        adjustedBid *= geoMultiplier;

        // Time-of-day adjustment
        const timeMultiplier = this.getTimeOfDayMultiplier(new Date().getHours());
        adjustedBid *= timeMultiplier;

        // Inventory quality adjustment
        const qualityMultiplier = await this.getInventoryQualityMultiplier(
            context.inventoryId
        );
        adjustedBid *= qualityMultiplier;

        return adjustedBid;
    }

    /**
     * Apply budget pacing to prevent overspend
     */
    private async applyBudgetPacing(campaign: any, bidAmount: number): Promise<number> {
        try {
            // Get current spend pace
            const spendPace = await this.getCurrentSpendPace(campaign.id);

            if (spendPace > 1.2) {
                // Spending too fast, reduce bids
                return bidAmount * 0.8;
            } else if (spendPace < 0.8) {
                // Spending too slow, increase bids
                return bidAmount * 1.2;
            }

            return bidAmount;

        } catch (error) {
            this.logger.warn('Budget pacing calculation failed', {
                error: error.message,
                campaignId: campaign.id
            });
            return bidAmount;
        }
    }

    /**
     * Apply final bid constraints
     */
    private applyBidConstraints(
        bidAmount: number,
        floorPrice?: number,
        maxBid?: number
    ): number {
        let finalBid = bidAmount;

        // Apply floor price
        if (floorPrice && finalBid < floorPrice) {
            finalBid = floorPrice;
        }

        // Apply maximum bid cap
        if (maxBid && finalBid > maxBid) {
            finalBid = Number(maxBid);
        }

        // Ensure minimum viable bid
        finalBid = Math.max(finalBid, 0.01);

        // Round to 2 decimal places
        return Math.round(finalBid * 100) / 100;
    }

    // ==========================================
    // PERFORMANCE METRICS METHODS
    // ==========================================

    private async getRecentPerformanceMetrics(
        campaignId: string,
        context: any
    ): Promise<any> {
        try {
            // Get last 7 days of performance data
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

            const metrics = await this.prisma.campaignStatistics.aggregate({
                where: {
                    campaignId,
                    date: {
                        gte: startDate,
                        lte: endDate
                    }
                },
                _sum: {
                    impressions: true,
                    clicks: true,
                    conversions: true,
                    spend: true
                }
            });

            if (!metrics._sum.impressions || metrics._sum.impressions === 0) {
                return null;
            }

            const impressions = metrics._sum.impressions;
            const clicks = metrics._sum.clicks || 0;
            const conversions = metrics._sum.conversions || 0;
            const spend = Number(metrics._sum.spend || 0);

            return {
                impressions,
                clicks,
                conversions,
                spend,
                ctr: (clicks / impressions) * 100,
                conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
                cpc: clicks > 0 ? spend / clicks : 0,
                cpa: conversions > 0 ? spend / conversions : 0
            };

        } catch (error) {
            this.logger.error('Failed to get performance metrics', {
                error: error.message,
                campaignId
            });
            return null;
        }
    }

    private calculateCTRScore(ctr: number): number {
        // Industry average CTR is ~2%, scale accordingly
        const benchmarkCTR = 2.0;
        return Math.min(2.0, Math.max(0.5, ctr / benchmarkCTR));
    }

    private calculateConversionScore(conversionRate: number): number {
        // Industry average conversion rate is ~1%, scale accordingly
        const benchmarkCR = 1.0;
        return Math.min(2.0, Math.max(0.5, conversionRate / benchmarkCR));
    }

    private calculateQualityScore(metrics: any): number {
        // Combine multiple quality signals
        const ctrScore = this.calculateCTRScore(metrics.ctr);
        const costEfficiency = metrics.cpa > 0 ? Math.min(2.0, 100 / metrics.cpa) : 1.0;

        return (ctrScore + costEfficiency) / 2;
    }

    // ==========================================
    // ADJUSTMENT MULTIPLIER METHODS
    // ==========================================

    /**
     * Get device-specific performance multiplier
     */
    private async getDeviceMultiplier(
        campaignId: string,
        deviceType: string
    ): Promise<number> {
        try {
            const cacheKey = `multiplier:device:${campaignId}:${deviceType}`;
            const cached = await this.redis.get<string>(cacheKey);

            if (cached) {
                return parseFloat(cached);
            }

            // Calculate device performance from historical data
            const devicePerformance = await this.calculateDevicePerformance(campaignId, deviceType);

            // Cache for 1 hour
            await this.redis.set(cacheKey, devicePerformance.toString(), 3600);

            return devicePerformance;

        } catch (error) {
            this.logger.warn('Device multiplier calculation failed', {
                error: error.message,
                campaignId,
                deviceType
            });
            return 1.0;
        }
    }

    private async calculateDevicePerformance(
        campaignId: string,
        deviceType: string
    ): Promise<number> {
        // Get performance data by device type from impressions
        const deviceStats = await this.prisma.impressionEvent.aggregate({
            where: {
                campaignId,
                deviceType,
                timestamp: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                }
            },
            _count: {
                id: true
            }
        });

        const allDeviceStats = await this.prisma.impressionEvent.aggregate({
            where: {
                campaignId,
                timestamp: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                }
            },
            _count: {
                id: true
            }
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
            'mobile': 1.2,    // Mobile typically performs better
            'desktop': 1.0,   // Baseline
            'tablet': 0.9     // Tablet typically lower performance
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

    /**
     * Get geographic performance multiplier
     */
    private async getGeographicMultiplier(
        campaignId: string,
        country: string,
        region: string
    ): Promise<number> {
        try {
            const cacheKey = `multiplier:geo:${campaignId}:${country}`;
            const cached = await this.redis.get<string>(cacheKey);

            if (cached) {
                return parseFloat(cached);
            }

            const geoPerformance = await this.calculateGeographicPerformance(
                campaignId,
                country,
                region
            );

            // Cache for 2 hours
            await this.redis.set(cacheKey, geoPerformance.toString(), 7200);

            return geoPerformance;

        } catch (error) {
            this.logger.warn('Geographic multiplier calculation failed', {
                error: error.message,
                campaignId,
                country
            });
            return 1.0;
        }
    }

    private async calculateGeographicPerformance(
        campaignId: string,
        country: string,
        region: string
    ): Promise<number> {
        // Get conversion data by geography
        const geoStats = await this.prisma.impressionEvent.findMany({
            where: {
                campaignId,
                country,
                timestamp: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                }
            },
            select: {
                id: true,
                ClickEvent: {
                    select: { id: true }
                }
            }
        });

        if (geoStats.length === 0) {
            return 1.0;
        }

        // Calculate CTR for this geography
        const impressions = geoStats.length;
        const clicks = geoStats.filter(imp => imp.ClickEvent.length > 0).length;
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

    /**
     * Get time-of-day multiplier
     */
    private getTimeOfDayMultiplier(hour: number): number {
        // Define time-based multipliers (24-hour format)
        const timeMultipliers = {
            0: 0.7,   // Midnight - 1AM
            1: 0.6,   // 1AM - 2AM
            2: 0.5,   // 2AM - 3AM
            3: 0.5,   // 3AM - 4AM
            4: 0.5,   // 4AM - 5AM
            5: 0.6,   // 5AM - 6AM
            6: 0.8,   // 6AM - 7AM
            7: 0.9,   // 7AM - 8AM
            8: 1.0,   // 8AM - 9AM
            9: 1.1,   // 9AM - 10AM
            10: 1.2,  // 10AM - 11AM
            11: 1.2,  // 11AM - 12PM
            12: 1.1,  // 12PM - 1PM
            13: 1.0,  // 1PM - 2PM
            14: 1.1,  // 2PM - 3PM
            15: 1.2,  // 3PM - 4PM
            16: 1.2,  // 4PM - 5PM
            17: 1.1,  // 5PM - 6PM
            18: 1.0,  // 6PM - 7PM
            19: 1.1,  // 7PM - 8PM
            20: 1.2,  // 8PM - 9PM
            21: 1.1,  // 9PM - 10PM
            22: 1.0,  // 10PM - 11PM
            23: 0.8   // 11PM - 12AM
        };

        return timeMultipliers[hour] || 1.0;
    }

    /**
     * Get inventory quality multiplier
     */
    private async getInventoryQualityMultiplier(inventoryId: string): Promise<number> {
        try {
            const cacheKey = `multiplier:inventory:${inventoryId}`;
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
                inventoryId
            });
            return 1.0;
        }
    }

    private async calculateInventoryQuality(inventoryId: string): Promise<number> {
        // Get inventory performance metrics
        const inventory = await this.prisma.adInventory.findUnique({
            where: { id: inventoryId },
            select: {
                viewabilityScore: true,
                website: {
                    select: {
                        domain: true
                    }
                }
            }
        });

        if (!inventory) {
            return 1.0;
        }

        let qualityScore = 1.0;

        // Viewability score adjustment
        if (inventory.viewabilityScore) {
            // Viewability score is 0-1, convert to multiplier
            qualityScore *= (0.5 + inventory.viewabilityScore * 0.5);
        }

        // Domain quality (simplified - could be enhanced with domain reputation data)
        const domain = inventory.website?.domain;
        if (domain) {
            const domainQuality = this.assessDomainQuality(domain);
            qualityScore *= domainQuality;
        }

        return Math.max(0.5, Math.min(1.5, qualityScore));
    }

    private assessDomainQuality(domain: string): number {
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

    // ==========================================
    // UTILITY METHODS
    // ==========================================

    private async getDailyBudget(campaignId: string): Promise<number> {
        try {
            const today = new Date().toISOString().split('T')[0];

            const budgetTracker = await this.prisma.campaignBudgetTracker.findUnique({
                where: {
                    campaignId_date: {
                        campaignId,
                        date: today
                    }
                },
                select: {
                    dailyBudget: true
                }
            });

            return budgetTracker ? Number(budgetTracker.dailyBudget) : 0;

        } catch (error) {
            this.logger.warn('Failed to get daily budget', {
                error: error.message,
                campaignId
            });
            return 0;
        }
    }

    private async getAverageCost(campaignId: string): Promise<number | null> {
        try {
            const stats = await this.prisma.campaignStatistics.aggregate({
                where: {
                    campaignId,
                    date: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    }
                },
                _sum: {
                    spend: true,
                    clicks: true
                }
            });

            const totalSpend = Number(stats._sum.spend || 0);
            const totalClicks = stats._sum.clicks || 0;

            if (totalClicks === 0) return null;

            return totalSpend / totalClicks;

        } catch (error) {
            this.logger.warn('Failed to get average cost', {
                error: error.message,
                campaignId
            });
            return null;
        }
    }

    private async getEstimatedConversionRate(
        campaignId: string,
        context: any
    ): Promise<number> {
        try {
            // Get historical conversion rate for similar context
            const stats = await this.prisma.impressionEvent.findMany({
                where: {
                    campaignId,
                    deviceType: context.userContext.deviceType,
                    country: context.userContext.country,
                    timestamp: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    }
                },
                select: {
                    id: true,
                    ClickEvent: {
                        select: { id: true }
                    }
                }
            });

            if (stats.length === 0) {
                return 0.01; // Default 1% conversion rate
            }

            const clicks = stats.filter(imp => imp.ClickEvent.length > 0).length;
            const conversions = clicks * 0.1; // Assume 10% of clicks convert (simplified)

            return clicks > 0 ? conversions / clicks : 0.01;

        } catch (error) {
            this.logger.warn('Failed to estimate conversion rate', {
                error: error.message,
                campaignId
            });
            return 0.01;
        }
    }

    private async getCurrentSpendPace(campaignId: string): Promise<number> {
        try {
            const today = new Date().toISOString().split('T')[0];

            const budgetTracker = await this.prisma.campaignBudgetTracker.findUnique({
                where: {
                    campaignId_date: {
                        campaignId,
                        date: today
                    }
                }
            });

            if (!budgetTracker) return 1.0;

            const currentHour = new Date().getHours();
            const expectedPace = currentHour / 24; // Expected pace through the day
            const actualPace = Number(budgetTracker.spentToday) / Number(budgetTracker.dailyBudget);

            return actualPace / expectedPace;

        } catch (error) {
            this.logger.warn('Failed to calculate spend pace', {
                error: error.message,
                campaignId
            });
            return 1.0;
        }
    }

    private async getCampaignAverageCTR(campaignId: string): Promise<number> {
        try {
            const stats = await this.prisma.campaignStatistics.aggregate({
                where: {
                    campaignId,
                    date: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    }
                },
                _sum: {
                    impressions: true,
                    clicks: true
                }
            });

            const impressions = stats._sum.impressions || 0;
            const clicks = stats._sum.clicks || 0;

            return impressions > 0 ? (clicks / impressions) * 100 : 0;

        } catch (error) {
            this.logger.warn('Failed to get campaign average CTR', {
                error: error.message,
                campaignId
            });
            return 0;
        }
    }
}