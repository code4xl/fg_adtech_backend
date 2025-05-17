// src/rtb/auction/bid-calculation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BidStrategy } from '@prisma/client';

@Injectable()
export class BidCalculationService {
  private readonly logger = new Logger(BidCalculationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async calculateBids(eligibleCampaigns, bidRequest) {
    const bids: any = [];

    for (const campaign of eligibleCampaigns) {
      try {
        // Find the campaign-inventory relationship to get the max bid
        const campaignInventory = campaign.campaignInventories[0];
        if (!campaignInventory) continue;

        // Get the highest performing creative for this campaign and inventory
        const creative = await this.getOptimalCreative(
          campaign.id,
          bidRequest.inventoryId,
        );
        if (!creative) continue;

        // Calculate the base bid using the campaign's bidding strategy
        const baseBid = await this.calculateBaseBid(
          campaign,
          campaignInventory,
          bidRequest,
        );

        // Apply any real-time adjustments to the bid
        const adjustedBid = await this.applyBidAdjustments(
          baseBid,
          campaign,
          bidRequest,
        );

        bids.push({
          campaignId: campaign.id,
          creativeId: creative.id,
          advertiserId: campaign.advertiserId,
          bidPrice: adjustedBid,
          creative: creative,
        });
      } catch (error) {
        this.logger.error(
          `Error calculating bid for campaign ${campaign.id}: ${error.message}`,
          error.stack,
        );
        // Continue with other campaigns
      }
    }

    return bids;
  }

  private async getOptimalCreative(campaignId, inventoryId) {
    const creatives = await this.prisma.creative.findMany({
      where: {
        campaignId,
        inventoryId,
        status: 'APPROVED',
      },
      orderBy: {
        // If we had CTR data, we could order by that
        createdAt: 'desc', // For now, just use the most recent
      },
      take: 1,
    });

    return creatives[0] || null;
  }

  private async calculateBaseBid(campaign, campaignInventory, bidRequest) {
    // Start with the max bid configured for this campaign-inventory pair
    let baseBid = Number(campaignInventory.maxBid);

    // Adjust based on bidding strategy
    switch (campaign.bidStrategy) {
      case BidStrategy.LOWEST_COST:
        // Use the floor price or a small increment above it
        const floorPrice = bidRequest.floor || 0;
        baseBid = Math.min(baseBid, floorPrice * 1.05); // 5% above floor
        break;

      case BidStrategy.BID_CAP:
        // Never exceed the bid amount
        baseBid = Math.min(baseBid, Number(campaign.bidAmount || baseBid));
        break;

      case BidStrategy.COST_CAP:
      case BidStrategy.TARGET_COST:
        // These strategies need historical performance data
        // For now, just use the configured max bid
        if (campaign.bidAmount) {
          // We could adjust based on historical CPA/CPC here
          baseBid = Number(campaign.bidAmount);
        }
        break;

      default:
        // Default strategy - just use the max bid
        break;
    }

    return baseBid;
  }

  private async applyBidAdjustments(baseBid, campaign, bidRequest) {
    let adjustedBid = baseBid;

    // 1. Time-of-day adjustment
    const hourAdjustment = this.getTimeOfDayAdjustment();
    adjustedBid *= hourAdjustment;

    // 2. Device type adjustment
    const deviceAdjustment = this.getDeviceAdjustment(bidRequest.deviceType);
    adjustedBid *= deviceAdjustment;

    // 3. Geographic adjustment
    const geoAdjustment = this.getGeographicAdjustment(bidRequest.country);
    adjustedBid *= geoAdjustment;

    // 4. Viewability adjustment based on inventory
    const viewabilityAdjustment = this.getViewabilityAdjustment(
      bidRequest.inventoryId,
    );
    adjustedBid *= viewabilityAdjustment;

    // Round to 4 decimal places and ensure minimum bid
    return Math.max(0.0001, Math.round(adjustedBid * 10000) / 10000);
  }

  private getTimeOfDayAdjustment() {
    const hour = new Date().getHours();

    // Example: higher bids during peak hours (9am-8pm)
    if (hour >= 9 && hour <= 20) {
      return 1.1; // 10% boost during peak hours
    }
    return 1.0;
  }

  private getDeviceAdjustment(deviceType) {
    // Example: higher bids for mobile devices
    if (deviceType === 'mobile') {
      return 1.2; // 20% boost for mobile
    }
    return 1.0;
  }

  private getGeographicAdjustment(country) {
    // Example: adjust bids based on valuable markets
    const highValueMarkets = ['US', 'GB', 'DE', 'CA', 'AU'];
    if (highValueMarkets.includes(country)) {
      return 1.15; // 15% boost for high-value markets
    }
    return 1.0;
  }

  private getViewabilityAdjustment(inventoryId) {
    // In a real system, this would look up historical viewability scores
    // For now, return a default value
    return 1.0;
  }
}
