// src/rtb/services/bid-calculation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { CreativePerformance } from '../interfaces/creative-performance.interface';

interface BidAdjustmentFactors {
  performanceMultiplier: number;
  inventoryMultiplier: number;
  timeOfDayMultiplier: number;
  fraudRiskMultiplier: number;
  competitionMultiplier: number;
}

@Injectable()
export class BidCalculationService {
  private readonly logger = new Logger(BidCalculationService.name);

  /**
   * Calculate adjusted bid based on creative performance and context
   */
  async calculateAdjustedBid(
    originalBid: number,
    performanceData: CreativePerformance,
    bidRequest: any,
  ): Promise<number> {
    try {
      // Calculate all adjustment factors
      const factors = await this.calculateAdjustmentFactors(
        performanceData,
        bidRequest,
      );

      // Apply adjustments with safety bounds
      let adjustedBid = originalBid;
      adjustedBid *= factors.performanceMultiplier;
      adjustedBid *= factors.inventoryMultiplier;
      adjustedBid *= factors.timeOfDayMultiplier;
      adjustedBid *= factors.fraudRiskMultiplier;
      adjustedBid *= factors.competitionMultiplier;

      // Apply safety bounds (don't go below 10% or above 300% of original)
      const minBid = originalBid * 0.1;
      const maxBid = originalBid * 3.0;
      adjustedBid = Math.max(minBid, Math.min(maxBid, adjustedBid));

      this.logger.debug(
        `Bid adjusted from ${originalBid} to ${adjustedBid} ` +
          `(performance: ${factors.performanceMultiplier.toFixed(2)}, ` +
          `inventory: ${factors.inventoryMultiplier.toFixed(2)}, ` +
          `time: ${factors.timeOfDayMultiplier.toFixed(2)}, ` +
          `fraud: ${factors.fraudRiskMultiplier.toFixed(2)}, ` +
          `competition: ${factors.competitionMultiplier.toFixed(2)})`,
      );

      return Number(adjustedBid.toFixed(4));
    } catch (error) {
      this.logger.error(`Error calculating adjusted bid: ${error.message}`);
      return originalBid; // Return original bid on error
    }
  }

  /**
   * Calculate all bid adjustment factors
   */
  private async calculateAdjustmentFactors(
    performanceData: CreativePerformance,
    bidRequest: any,
  ): Promise<BidAdjustmentFactors> {
    return {
      performanceMultiplier:
        this.calculatePerformanceMultiplier(performanceData),
      inventoryMultiplier: this.calculateInventoryMultiplier(bidRequest),
      timeOfDayMultiplier: this.calculateTimeOfDayMultiplier(),
      fraudRiskMultiplier: this.calculateFraudRiskMultiplier(bidRequest),
      competitionMultiplier:
        await this.calculateCompetitionMultiplier(bidRequest),
    };
  }

  /**
   * Calculate performance-based bid multiplier
   * High-performing creatives get bid increases, poor performers get decreases
   */
  private calculatePerformanceMultiplier(
    performanceData: CreativePerformance,
  ): number {
    const { ctr, performanceScore, impressions } = performanceData;

    // Base multiplier from performance score
    let multiplier = 0.5 + performanceScore * 1.0; // Range: 0.5 - 1.5

    // CTR bonus/penalty
    if (ctr > 0.02) {
      multiplier *= 1.2; // High CTR bonus
    } else if (ctr > 0.01) {
      multiplier *= 1.1; // Good CTR bonus
    } else if (ctr < 0.005) {
      multiplier *= 0.8; // Low CTR penalty
    }

    // Volume confidence adjustment
    if (impressions < 100) {
      multiplier *= 0.95; // Slight penalty for low data confidence
    } else if (impressions > 1000) {
      multiplier *= 1.05; // Slight bonus for high confidence
    }

    return Math.max(0.3, Math.min(2.0, multiplier));
  }

  /**
   * Calculate inventory-specific multiplier
   * Premium inventory positions get higher bids
   */
  private calculateInventoryMultiplier(bidRequest: any): number {
    try {
      const inventory = bidRequest.inventory;
      const adSlotTemplate = inventory?.adSlotTemplate;

      let multiplier = 1.0;

      // Position-based adjustments
      switch (adSlotTemplate?.position) {
        case 'ABOVE_FOLD':
          multiplier *= 1.3;
          break;
        case 'HEADER':
          multiplier *= 1.2;
          break;
        case 'IN_CONTENT':
          multiplier *= 1.1;
          break;
        case 'SIDEBAR':
          multiplier *= 0.9;
          break;
        case 'FOOTER':
          multiplier *= 0.7;
          break;
        default:
          multiplier *= 1.0;
      }

      // Format-based adjustments
      switch (adSlotTemplate?.format) {
        case 'VIDEO':
          multiplier *= 1.4; // Video typically has higher value
          break;
        case 'INTERSTITIAL':
          multiplier *= 1.3;
          break;
        case 'NATIVE':
          multiplier *= 1.1;
          break;
        case 'BANNER':
          multiplier *= 1.0;
          break;
        default:
          multiplier *= 1.0;
      }

      // Size-based adjustments (larger sizes typically perform better)
      const width = adSlotTemplate?.width || 0;
      const height = adSlotTemplate?.height || 0;
      const area = width * height;

      if (area > 200000) {
        // Large formats
        multiplier *= 1.2;
      } else if (area < 50000) {
        // Small formats
        multiplier *= 0.9;
      }

      return Math.max(0.5, Math.min(2.0, multiplier));
    } catch (error) {
      this.logger.warn(
        `Error calculating inventory multiplier: ${error.message}`,
      );
      return 1.0;
    }
  }

  /**
   * Calculate time-of-day multiplier
   * Adjust bids based on historical performance patterns
   */
  private calculateTimeOfDayMultiplier(): number {
    const hour = new Date().getHours();

    // Peak hours (typically higher engagement)
    if (hour >= 9 && hour <= 11) return 1.2; // Morning peak
    if (hour >= 14 && hour <= 16) return 1.1; // Afternoon peak
    if (hour >= 19 && hour <= 21) return 1.3; // Evening peak

    // Off-peak hours
    if (hour >= 0 && hour <= 5) return 0.7; // Late night/early morning
    if (hour >= 22 && hour <= 23) return 0.8; // Late evening

    return 1.0; // Normal hours
  }

  /**
   * Calculate fraud risk multiplier
   * Reduce bids for high-risk traffic
   */
  private calculateFraudRiskMultiplier(bidRequest: any): number {
    try {
      const userContext = bidRequest.userContext || {};
      let riskScore = 0;

      // User agent analysis
      if (!userContext.userAgent || userContext.userAgent.length < 50) {
        riskScore += 0.3; // Suspicious user agent
      }

      // IP analysis (placeholder - you'd implement real fraud detection)
      if (this.isHighRiskIP(userContext.ipAddress)) {
        riskScore += 0.5;
      }

      // Device fingerprint analysis
      if (this.isSuspiciousDevice(userContext)) {
        riskScore += 0.2;
      }

      // Convert risk score to multiplier (higher risk = lower multiplier)
      const multiplier = Math.max(0.3, 1.0 - riskScore);

      return multiplier;
    } catch (error) {
      this.logger.warn(`Error calculating fraud risk: ${error.message}`);
      return 1.0;
    }
  }

  /**
   * Calculate competition-based multiplier
   * Adjust bids based on inventory competition level
   */
  private async calculateCompetitionMultiplier(
    bidRequest: any,
  ): Promise<number> {
    try {
      // This is a simplified version - in production you'd analyze:
      // - Historical bid density for this inventory
      // - Current QPS for this inventory type
      // - Market demand patterns

      const inventoryId = bidRequest.inventoryId;

      // For now, use a simple heuristic based on inventory type
      const inventory = bidRequest.inventory;
      const format = inventory?.adSlotTemplate?.format;

      switch (format) {
        case 'VIDEO':
          return 1.3; // High competition for video
        case 'INTERSTITIAL':
          return 1.2; // High competition for interstitials
        case 'NATIVE':
          return 1.1; // Medium competition for native
        default:
          return 1.0; // Standard competition
      }
    } catch (error) {
      this.logger.warn(
        `Error calculating competition multiplier: ${error.message}`,
      );
      return 1.0;
    }
  }

  /**
   * Calculate bid recommendations for campaign optimization
   */
  async calculateBidRecommendations(
    campaignId: string,
    performanceData: CreativePerformance[],
  ): Promise<any> {
    try {
      const recommendations = {
        campaignId,
        recommendations: [],
        summary: {
          avgPerformanceScore: 0,
          topPerformingCreatives: [],
          underperformingCreatives: [],
          suggestedBidAdjustment: 0,
        },
      };

      // Calculate average performance
      const avgScore =
        performanceData.reduce((sum, p) => sum + p.performanceScore, 0) /
        performanceData.length;
      recommendations.summary.avgPerformanceScore = avgScore;

      // Identify top and underperforming creatives
      const sorted = [...performanceData].sort(
        (a, b) => b.performanceScore - a.performanceScore,
      );
      recommendations.summary.topPerformingCreatives = sorted
        .slice(0, 3)
        .map((p) => p.creativeId);
      recommendations.summary.underperformingCreatives = sorted
        .slice(-3)
        .map((p) => p.creativeId);

      // Suggest overall bid adjustment
      if (avgScore > 0.7) {
        recommendations.summary.suggestedBidAdjustment = 1.2;
        recommendations.recommendations.push(
          'Increase bids for this high-performing campaign',
        );
      } else if (avgScore < 0.3) {
        recommendations.summary.suggestedBidAdjustment = 0.8;
        recommendations.recommendations.push(
          'Consider reducing bids or optimizing creatives',
        );
      }

      return recommendations;
    } catch (error) {
      this.logger.error(
        `Error calculating bid recommendations: ${error.message}`,
      );
      return null;
    }
  }

  // Helper methods for fraud detection
  private isHighRiskIP(ipAddress: string): boolean {
    // Placeholder for IP reputation check
    // In production, you'd check against fraud databases
    return false;
  }

  private isSuspiciousDevice(userContext: any): boolean {
    // Placeholder for device fingerprint analysis
    // Check for suspicious patterns in device characteristics
    return false;
  }

  /**
   * Calculate floor price adjustments based on inventory performance
   */
  calculateDynamicFloorPrice(
    baseFloorPrice: number,
    inventoryPerformance: any,
  ): number {
    try {
      let adjustedFloor = baseFloorPrice;

      // Adjust based on inventory fill rate
      if (inventoryPerformance?.fillRate > 0.8) {
        adjustedFloor *= 1.1; // High demand = higher floor
      } else if (inventoryPerformance?.fillRate < 0.3) {
        adjustedFloor *= 0.9; // Low demand = lower floor
      }

      // Adjust based on average winning bid
      if (inventoryPerformance?.avgWinningBid) {
        const ratio = inventoryPerformance.avgWinningBid / baseFloorPrice;
        if (ratio > 2.0) {
          adjustedFloor *= 1.2; // Consistently high winning bids
        }
      }

      return Math.max(baseFloorPrice * 0.5, adjustedFloor);
    } catch (error) {
      this.logger.warn(
        `Error calculating dynamic floor price: ${error.message}`,
      );
      return baseFloorPrice;
    }
  }
}
