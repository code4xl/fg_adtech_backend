import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class bidStrategyService {
    private readonly logger = new Logger(bidStrategyService.name);

    constructor(
        private readonly prisma: PrismaService,
    ) { }

    public calculateLowestCostBid(baseBid: number, context: any): number {
        const floorPrice = context.floorPrice || 0.01;
        const minBid = Math.max(floorPrice * 1.01, 0.01); // 1% above floor
        return Math.min(baseBid, minBid);
    }

    public async calculateCostCapBid(
        campaign: any,
        baseBid: number,
        context: any,
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

    public calculateBidCapBid(campaign: any, baseBid: number): number {
        const maxBid = Number(campaign.bidAmount || baseBid);
        return Math.min(baseBid, maxBid);
    }

    public async calculateTargetCostBid(
        campaign: any,
        baseBid: number,
        context: any,
    ): Promise<number> {
        const targetCPA = Number(campaign.bidAmount || baseBid);

        // Get estimated conversion rate for this context
        const estimatedCR = await this.getEstimatedConversionRate(
            campaign.id,
            context,
        );

        if (estimatedCR > 0) {
            // Bid = Target CPA × Estimated CR
            return targetCPA * estimatedCR;
        }

        return baseBid;
    }

    public async getAverageCost(campaignId: string): Promise<number | null> {
        try {
            const stats = await this.prisma.campaignStatistics.aggregate({
                where: {
                    campaignId,
                    date: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    },
                },
                _sum: {
                    spend: true,
                    clicks: true,
                },
            });

            const totalSpend = Number(stats._sum.spend || 0);
            const totalClicks = stats._sum.clicks || 0;

            if (totalClicks === 0) return null;

            return totalSpend / totalClicks;
        } catch (error) {
            this.logger.warn('Failed to get average cost', {
                error: error.message,
                campaignId,
            });
            return null;
        }
    }

    public async getEstimatedConversionRate(
        campaignId: string,
        context: any,
    ): Promise<number> {
        try {
            // Get historical conversion rate for similar context
            const stats = await this.prisma.impressionEvent.findMany({
                where: {
                    campaignId,
                    deviceType: context.userContext.deviceType,
                    country: context.userContext.country,
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

            if (stats.length === 0) {
                return 0.01; // Default 1% conversion rate
            }

            const clicks = stats.filter((imp) => imp.ClickEvent.length > 0).length;
            const conversions = clicks * 0.1; // Assume 10% of clicks convert (simplified)

            return clicks > 0 ? conversions / clicks : 0.01;
        } catch (error) {
            this.logger.warn('Failed to estimate conversion rate', {
                error: error.message,
                campaignId,
            });
            return 0.01;
        }
    }
}