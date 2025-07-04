import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class bidStrategyService {
  private readonly logger = new Logger(bidStrategyService.name);

  constructor(private readonly prisma: PrismaService) {}

  public calculateLowestCostBid(baseBid: number, context: any): number {
    // REASON: Ensure bid meets floor price requirements
    // LOGIC: Lowest cost strategy should bid just above floor price
    const floorPrice = context.floorPrice || 0.001; // $1 CPM minimum

    // REASON: Convert floor price to per-impression if it's CPM
    // LOGIC: Floor prices might be provided as CPM values
    const floorPricePerImpression =
      floorPrice > 1 ? floorPrice / 1000 : floorPrice;
    const baseBidPerImpression = baseBid > 1 ? baseBid / 1000 : baseBid;

    // REASON: Bid slightly above floor price (1% margin)
    // LOGIC: Increase chances of winning while minimizing cost
    const minBid = Math.max(floorPricePerImpression * 1.01, 0.0001);
    const finalBid = Math.min(baseBidPerImpression, minBid);

    this.logger.debug('Lowest cost bid calculation', {
      baseBid: baseBid,
      baseBidPerImpression: baseBidPerImpression,
      floorPrice: floorPrice,
      floorPricePerImpression: floorPricePerImpression,
      finalBid: finalBid,
    });

    return finalBid;
  }

  public async calculateCostCapBid(
    campaign: any,
    baseBid: number,
    context: any,
  ): Promise<number> {
    // REASON: Get current average cost performance for campaign
    // LOGIC: Adjust bids based on actual cost performance vs target
    const avgCost = await this.getAverageCost(campaign.id);

    // REASON: Convert campaign bid amount to per-impression target
    // LOGIC: Campaign bidAmount is CPM, need per-impression target cost
    const targetCostCPM = Number(campaign.bidAmount || baseBid);
    const targetCostPerImpression =
      targetCostCPM > 1 ? targetCostCPM / 1000 : targetCostCPM;
    const baseBidPerImpression = baseBid > 1 ? baseBid / 1000 : baseBid;

    if (avgCost === null) {
      this.logger.debug('No cost data available, using base bid', {
        campaignId: campaign.id,
        baseBidPerImpression: baseBidPerImpression,
      });
      return baseBidPerImpression; // No data yet
    }

    // REASON: Adjust bid based on cost performance relative to target
    // LOGIC: If average cost is below target, can bid higher. If above, reduce bid.
    let adjustedBid = baseBidPerImpression;

    if (avgCost < targetCostPerImpression * 0.8) {
      // REASON: Under target cost, increase bids to capture more volume
      // LOGIC: 20% under target = 20% bid increase
      adjustedBid = baseBidPerImpression * 1.2;
    } else if (avgCost > targetCostPerImpression * 1.2) {
      // REASON: Over target cost, reduce bids to control costs
      // LOGIC: 20% over target = 20% bid reduction
      adjustedBid = baseBidPerImpression * 0.8;
    }

    this.logger.debug('Cost cap bid calculation', {
      campaignId: campaign.id,
      avgCost: avgCost,
      targetCostPerImpression: targetCostPerImpression,
      baseBidPerImpression: baseBidPerImpression,
      adjustedBid: adjustedBid,
    });

    return adjustedBid;
  }

  public calculateBidCapBid(campaign: any, baseBid: number): number {
    // REASON: Respect campaign's maximum bid limit
    // LOGIC: Never bid more than specified cap, convert CPM to per-impression
    const maxBidCPM = Number(campaign.bidAmount || baseBid);
    const maxBidPerImpression = maxBidCPM > 1 ? maxBidCPM / 1000 : maxBidCPM;
    const baseBidPerImpression = baseBid > 1 ? baseBid / 1000 : baseBid;

    const finalBid = Math.min(baseBidPerImpression, maxBidPerImpression);

    this.logger.debug('Bid cap calculation', {
      campaignId: campaign.id,
      maxBidCPM: maxBidCPM,
      maxBidPerImpression: maxBidPerImpression,
      baseBidPerImpression: baseBidPerImpression,
      finalBid: finalBid,
    });

    return finalBid;
  }

  public async calculateTargetCostBid(
    campaign: any,
    baseBid: number,
    context: any,
  ): Promise<number> {
    // REASON: Calculate bid based on target cost per acquisition
    // LOGIC: Bid = Target CPA × Estimated Conversion Rate
    const targetCPACPM = Number(campaign.bidAmount || baseBid);
    const targetCPAPerImpression =
      targetCPACPM > 1 ? targetCPACPM / 1000 : targetCPACPM;
    const baseBidPerImpression = baseBid > 1 ? baseBid / 1000 : baseBid;

    // REASON: Get estimated conversion rate for this context
    // LOGIC: Higher conversion rate contexts justify higher bids
    const estimatedCR = await this.getEstimatedConversionRate(
      campaign.id,
      context,
    );

    if (estimatedCR > 0) {
      // REASON: Bid = Target CPA × Estimated Conversion Rate
      // LOGIC: If target CPA is $10 and CR is 1%, bid $0.10 per impression
      const calculatedBid = targetCPAPerImpression * estimatedCR;

      this.logger.debug('Target cost bid calculation', {
        campaignId: campaign.id,
        targetCPACPM: targetCPACPM,
        targetCPAPerImpression: targetCPAPerImpression,
        estimatedCR: estimatedCR,
        calculatedBid: calculatedBid,
        baseBidPerImpression: baseBidPerImpression,
      });

      return calculatedBid;
    }

    this.logger.debug('No conversion data, using base bid', {
      campaignId: campaign.id,
      baseBidPerImpression: baseBidPerImpression,
    });

    return baseBidPerImpression;
  }

  public async getAverageCost(campaignId: string): Promise<number | null> {
    try {
      // REASON: Calculate average cost from recent campaign statistics
      // LOGIC: Use last 7 days of data to get current performance trends
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
          impressions: true,
        },
      });

      const totalSpend = Number(stats._sum.spend || 0);
      const totalClicks = stats._sum.clicks || 0;
      const totalImpressions = stats._sum.impressions || 0;

      // REASON: Calculate cost per click if clicks are available
      // LOGIC: CPC is primary metric for cost performance
      if (totalClicks > 0) {
        const cpc = totalSpend / totalClicks;
        this.logger.debug('Average cost calculated (CPC)', {
          campaignId,
          totalSpend: totalSpend,
          totalClicks: totalClicks,
          cpc: cpc,
        });
        return cpc;
      }

      // REASON: Fallback to CPM if no clicks available
      // LOGIC: Use cost per thousand impressions as secondary metric
      if (totalImpressions > 0) {
        const cpm = (totalSpend / totalImpressions) * 1000;
        const cpmPerImpression = cpm / 1000;
        this.logger.debug('Average cost calculated (CPM)', {
          campaignId,
          totalSpend: totalSpend,
          totalImpressions: totalImpressions,
          cpm: cpm,
          cpmPerImpression: cpmPerImpression,
        });
        return cpmPerImpression;
      }

      return null;
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
      // REASON: Get historical conversion rate for similar context
      // LOGIC: Device and geo context affects conversion rates significantly
      const deviceType = context.userContext?.deviceType;
      const country = context.userContext?.country;

      // REASON: Query impression events with click data for conversion calculation
      // LOGIC: Use impression->click as proxy for conversion rate
      const stats = await this.prisma.impressionEvent.findMany({
        where: {
          campaignId,
          deviceType: deviceType,
          country: country,
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
        take: 1000, // Limit for performance
      });

      if (stats.length === 0) {
        this.logger.debug('No impression data for conversion rate estimation', {
          campaignId,
          deviceType: deviceType,
          country: country,
        });
        return 0.01; // Default 1% conversion rate
      }

      // REASON: Calculate click-through rate as proxy for conversion rate
      // LOGIC: CTR strongly correlates with conversion potential
      const totalImpressions = stats.length;
      const clickedImpressions = stats.filter(
        (imp) => imp.ClickEvent.length > 0,
      ).length;
      const ctr = clickedImpressions / totalImpressions;

      // REASON: Assume 10% of clicks convert (industry average)
      // LOGIC: Conservative estimate for conversion rate calculation
      const estimatedConversionRate = ctr * 0.1;

      this.logger.debug('Estimated conversion rate calculated', {
        campaignId,
        deviceType: deviceType,
        country: country,
        totalImpressions: totalImpressions,
        clickedImpressions: clickedImpressions,
        ctr: ctr,
        estimatedConversionRate: estimatedConversionRate,
      });

      return Math.max(estimatedConversionRate, 0.001); // Minimum 0.1% conversion rate
    } catch (error) {
      this.logger.warn('Failed to estimate conversion rate', {
        error: error.message,
        campaignId,
      });
      return 0.01; // Fallback 1% conversion rate
    }
  }

  // REASON: Helper method to validate bid strategy parameters
  // LOGIC: Ensure bid strategy calculations use valid inputs
  public validateBidStrategyInputs(
    campaign: any,
    baseBid: number,
    context: any,
  ): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!campaign || !campaign.id) {
      errors.push('Campaign is required');
    }

    if (!baseBid || baseBid <= 0) {
      errors.push('Base bid must be greater than 0');
    }

    if (!context) {
      errors.push('Context is required');
    }

    if (campaign.bidAmount && Number(campaign.bidAmount) <= 0) {
      errors.push('Campaign bid amount must be greater than 0');
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
    };
  }

  // REASON: Helper method to convert between CPM and per-impression costs
  // LOGIC: Consistent conversion logic across all bid strategy methods
  public convertCPMToPerImpression(cpmValue: number): number {
    return cpmValue > 1 ? cpmValue / 1000 : cpmValue;
  }

  public convertPerImpressionToCPM(perImpressionValue: number): number {
    return perImpressionValue < 1
      ? perImpressionValue * 1000
      : perImpressionValue;
  }
}
