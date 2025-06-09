// src/rtb/services/auction.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EligibleCampaign } from '../interfaces/campaign-eligibility.interface';
import { AuctionResult } from '../interfaces/auction-result.interface';
import { BidCalculationService } from './bid-calculation.service';
import { CreativePerformanceService } from './creative-performance.service';

interface BidEntry {
  campaignId: string;
  creativeId: string;
  advertiserId: string;
  originalBid: number;
  adjustedBid: number;
  qualityScore: number;
  finalScore: number; // adjustedBid * qualityScore
  performanceData: {
    ctr: number;
    performanceScore: number;
    impressions: number;
  };
}

@Injectable()
export class AuctionService {
  private readonly logger = new Logger(AuctionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly creativePerformanceService: CreativePerformanceService,
    private readonly bidCalculationService: BidCalculationService,
  ) {}

  /**
   * ENHANCED AUCTION: Run creative-optimized auction with performance scoring
   * Target: Sub-50ms auction completion with quality score integration
   */
  async runAuction(
    bidRequest: any,
    eligibleCampaigns: EligibleCampaign[],
  ): Promise<AuctionResult> {
    const auctionStartTime = Date.now();

    try {
      this.logger.debug(
        `Starting auction for ${eligibleCampaigns.length} campaigns`,
      );

      // 1. PARALLEL: Calculate bids for all eligible campaigns
      const bidEntries = await this.calculateParallelBids(
        bidRequest,
        eligibleCampaigns,
      );

      if (bidEntries.length === 0) {
        return {
          totalBids: 0,
          validBids: 0,
          auctionDuration: Date.now() - auctionStartTime,
          status: 'NO_BIDS',
        };
      }

      // 2. QUALITY: Apply creative quality scores
      const qualityAdjustedBids = await this.applyQualityScores(bidEntries);

      // 3. AUCTION: Run second-price auction with quality factors
      const auctionResult = this.runSecondPriceAuction(
        qualityAdjustedBids,
        bidRequest.floorPrice || 0,
      );

      // 4. LOG: Store auction log for analytics
      await this.logAuctionResult(bidRequest, auctionResult, auctionStartTime);

      const auctionDuration = Date.now() - auctionStartTime;

      this.logger.debug(
        `Auction completed in ${auctionDuration}ms with ${auctionResult.validBids} valid bids`,
      );

      return {
        winningBid: auctionResult.winningBid,
        totalBids: auctionResult.totalBids ?? 0,
        validBids: auctionResult.validBids ?? 0,
        auctionDuration,
        status: 'COMPLETED',
      };
    } catch (error) {
      this.logger.error(`Auction error: ${error.message}`, error);

      return {
        totalBids: eligibleCampaigns.length,
        validBids: 0,
        auctionDuration: Date.now() - auctionStartTime,
        status: 'ERROR',
      };
    }
  }

  /**
   * Calculate bids for all campaigns in parallel for performance
   */
  private async calculateParallelBids(
    bidRequest: any,
    eligibleCampaigns: EligibleCampaign[],
  ): Promise<BidEntry[]> {
    const bidPromises = eligibleCampaigns.map(async (campaign) => {
      try {
        // Select best performing creative for this campaign
        const bestCreative = this.selectBestCreative(campaign);
        if (!bestCreative) return null;

        // Get real-time performance data
        const performanceData =
          await this.creativePerformanceService.getCreativePerformance(
            bestCreative.id,
          );

        if (!performanceData) {
          // Use default performance for new creatives
          const defaultPerformance = {
            ctr: 0.01,
            performanceScore: 0.5,
            impressions: 0,
          };

          return {
            campaignId: campaign.id,
            creativeId: bestCreative.id,
            advertiserId: campaign.advertiserId,
            originalBid: campaign.bidAmount,
            adjustedBid: campaign.bidAmount,
            qualityScore: 0.5,
            finalScore: campaign.bidAmount * 0.5,
            performanceData: defaultPerformance,
          };
        }

        // Calculate bid adjustments based on creative performance
        const adjustedBid =
          await this.bidCalculationService.calculateAdjustedBid(
            campaign.bidAmount,
            performanceData,
            bidRequest,
          );

        return {
          campaignId: campaign.id,
          creativeId: bestCreative.id,
          advertiserId: campaign.advertiserId,
          originalBid: campaign.bidAmount,
          adjustedBid,
          qualityScore: 0, // Will be calculated in next step
          finalScore: 0, // Will be calculated in next step
          performanceData: {
            ctr: performanceData.ctr,
            performanceScore: performanceData.performanceScore,
            impressions: performanceData.impressions,
          },
        };
      } catch (error) {
        this.logger.warn(
          `Error calculating bid for campaign ${campaign.id}: ${error.message}`,
        );
        return null;
      }
    });

    const bidResults = await Promise.all(bidPromises);
    return bidResults.filter((bid): bid is BidEntry => bid !== null);
  }

  /**
   * Apply quality scores based on creative performance and historical data
   */
  private async applyQualityScores(
    bidEntries: BidEntry[],
  ): Promise<BidEntry[]> {
    return bidEntries.map((bid) => {
      // Calculate quality score based on multiple factors
      const qualityScore = this.calculateQualityScore(bid.performanceData);

      // Final score = adjusted bid * quality score
      const finalScore = bid.adjustedBid * qualityScore;

      return {
        ...bid,
        qualityScore,
        finalScore,
      };
    });
  }

  /**
   * Run second-price auction with creative quality factors
   */
  private runSecondPriceAuction(
    bidEntries: BidEntry[],
    floorPrice: number,
  ): Partial<AuctionResult> {
    // Filter bids that meet floor price
    const validBids = bidEntries.filter((bid) => bid.finalScore >= floorPrice);

    if (validBids.length === 0) {
      return {
        totalBids: bidEntries.length,
        validBids: 0,
      };
    }

    // Sort by final score (adjusted bid * quality score) in descending order
    validBids.sort((a, b) => b.finalScore - a.finalScore);

    const winningBid = validBids[0];

    // Second-price auction: winner pays second-highest price + $0.01
    const secondPrice =
      validBids.length > 1 ? validBids[1].finalScore : floorPrice;
    const finalPrice = Math.max(secondPrice + 0.01, floorPrice);

    return {
      winningBid: {
        campaignId: winningBid.campaignId,
        creativeId: winningBid.creativeId,
        advertiserId: winningBid.advertiserId,
        bidPrice: winningBid.originalBid,
        finalPrice,
      },
      totalBids: bidEntries.length,
      validBids: validBids.length,
    };
  }

  /**
   * Select best performing creative for campaign
   */
  private selectBestCreative(campaign: EligibleCampaign) {
    if (!campaign.creatives || campaign.creatives.length === 0) {
      return null;
    }

    // Sort creatives by performance score (descending)
    const sortedCreatives = [...campaign.creatives].sort(
      (a, b) => b.performanceScore - a.performanceScore,
    );

    return sortedCreatives[0];
  }

  /**
   * Calculate quality score based on creative performance
   * Quality score ranges from 0.1 to 2.0
   */
  private calculateQualityScore(performanceData: {
    ctr: number;
    performanceScore: number;
    impressions: number;
  }): number {
    try {
      // Base quality score components
      const ctrComponent = Math.min(performanceData.ctr * 50, 1); // CTR contribution
      const performanceComponent = performanceData.performanceScore; // Performance score
      const volumeComponent = Math.min(performanceData.impressions / 1000, 0.5); // Volume bonus

      // Weighted quality score
      let qualityScore =
        ctrComponent * 0.5 + performanceComponent * 0.4 + volumeComponent * 0.1;

      // Scale to 0.1 - 2.0 range (0.1 minimum to avoid zero bids, 2.0 max for top performers)
      qualityScore = 0.1 + qualityScore * 1.9;

      return Math.min(Math.max(qualityScore, 0.1), 2.0);
    } catch (error) {
      this.logger.warn(`Error calculating quality score: ${error.message}`);
      return 1.0; // Neutral quality score
    }
  }

  /**
   * Log auction result for analytics and debugging
   */
  private async logAuctionResult(
    bidRequest: any,
    auctionResult: Partial<AuctionResult>,
    startTime: number,
  ): Promise<void> {
    try {
      const auctionLog = await this.prisma.auctionLog.create({
        data: {
          bidRequestId: bidRequest.id,
          auctionType: 'SECOND_PRICE',
          floorPrice: bidRequest.floorPrice,
          winningBidId: auctionResult.winningBid ? 'placeholder' : null, // You might want to store bid response ID
          finalPrice: auctionResult.winningBid?.finalPrice,
          totalBids: auctionResult.totalBids || 0,
          validBids: auctionResult.validBids || 0,
          auctionDuration: Date.now() - startTime,
          status: auctionResult.winningBid ? 'COMPLETED' : 'NO_BIDS',
          startedAt: new Date(startTime),
          completedAt: new Date(),
        },
      });

      this.logger.debug(`Auction log created: ${auctionLog.id}`);
    } catch (error) {
      this.logger.error(`Error logging auction result: ${error.message}`);
      // Don't throw - logging failure shouldn't break the auction
    }
  }

  /**
   * Get auction performance metrics for optimization
   */
  async getAuctionMetrics(timeRange: { start: Date; end: Date }) {
    try {
      const metrics = await this.prisma.auctionLog.aggregate({
        where: {
          startedAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        },
        _avg: {
          auctionDuration: true,
          totalBids: true,
          validBids: true,
        },
        _count: {
          id: true,
        },
      });

      const fillRate = await this.prisma.auctionLog.count({
        where: {
          startedAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
          status: 'COMPLETED',
        },
      });

      return {
        ...metrics,
        fillRate: fillRate / metrics._count.id,
        timeRange,
      };
    } catch (error) {
      this.logger.error(`Error getting auction metrics: ${error.message}`);
      return null;
    }
  }
}
