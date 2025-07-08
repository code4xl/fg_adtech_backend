// src/rtb/services/bid-strategy.service.ts
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class bidStrategyService {
  private readonly logger = new Logger(bidStrategyService.name);

  constructor() {}

  /**
   * 🎯 FIXED: All calculations now work in CPM consistently
   * @param bidStrategy - Strategy type
   * @param baseBidCPM - Base bid in CPM format
   * @param context - Context with CPM values
   * @returns Final bid in CPM format
   */
  public calculateBidAmountCPM(
    bidStrategy: string,
    baseBidCPM: number,
    context: any,
  ): number {
    switch (bidStrategy) {
      case 'LOWEST_COST':
        return this.calculateLowestCostBidCPM(baseBidCPM, context);

      case 'TARGET_CPM':
        return this.calculateTargetCpmBid(baseBidCPM, context);

      case 'SMART_BID':
        return this.calculateSmartBidCPM(baseBidCPM, context);

      case 'COMPETITIVE':
        return this.calculateCompetitiveBidCPM(baseBidCPM, context);

      default:
        return this.calculateLowestCostBidCPM(baseBidCPM, context);
    }
  }

  /**
   * 🎯 FIXED: Lowest cost bid calculation - works in CPM
   * Bids just above floor price for maximum efficiency
   */
  public calculateLowestCostBidCPM(baseBidCPM: number, context: any): number {
    const floorPriceCPM = context.floorPriceCPM || 0.1; // Minimum Rs. 0.10 CPM

    // Bid slightly above floor price for maximum efficiency (1% margin)
    const minBidCPM = floorPriceCPM * 1.01;
    const finalBidCPM = Math.max(baseBidCPM, minBidCPM);

    // this.logger.debug('Lowest cost bid calculation (CPM)', {
    //   baseBidCPM,
    //   floorPriceCPM,
    //   minBidCPM,
    //   finalBidCPM,
    //   strategy: 'LOWEST_COST',
    // });

    return finalBidCPM;
  }

  /**
   * 🎯 FIXED: Target CPM bid calculation - works in CPM
   * Uses the campaign's actual target CPM amount
   */
  public calculateTargetCpmBid(baseBidCPM: number, context: any): number {
    const floorPriceCPM = context.floorPriceCPM || 0.1;

    // Use the campaign's actual bid amount (already in CPM)
    const targetBidCPM = baseBidCPM;

    // Ensure we meet floor price minimum
    const finalBidCPM = Math.max(targetBidCPM, floorPriceCPM);

    // this.logger.debug('Target CPM bid calculation', {
    //   baseBidCPM,
    //   targetBidCPM,
    //   floorPriceCPM,
    //   finalBidCPM,
    //   strategy: 'TARGET_CPM',
    // });

    return finalBidCPM;
  }

  /**
   * 🎯 FIXED: Smart bid calculation - works in CPM
   * Intelligent bidding between floor and target based on performance
   */
  public calculateSmartBidCPM(baseBidCPM: number, context: any): number {
    const floorPriceCPM = context.floorPriceCPM || 0.1;
    const targetBidCPM = baseBidCPM;

    // Simple performance factor (enhance this with actual performance data later)
    // For now, use a factor between 0.4-1.0 to simulate performance
    const performanceFactor = 0.4 + Math.random() * 0.3;

    // Calculate bid between floor and target (CPM level)
    const smartBidCPM =
      floorPriceCPM + (targetBidCPM - floorPriceCPM) * performanceFactor;

    const finalBidCPM = Math.max(smartBidCPM, floorPriceCPM);

    // this.logger.debug('Smart bid calculation (CPM)', {
    //   baseBidCPM,
    //   targetBidCPM,
    //   floorPriceCPM,
    //   performanceFactor,
    //   smartBidCPM,
    //   finalBidCPM,
    //   strategy: 'SMART_BID',
    // });

    return finalBidCPM;
  }

  /**
   * 🎯 FIXED: Competitive bid calculation - works in CPM
   * Competitive bidding with slight randomization
   */
  public calculateCompetitiveBidCPM(baseBidCPM: number, context: any): number {
    const floorPriceCPM = context.floorPriceCPM || 0.1;
    const targetBidCPM = baseBidCPM;

    // Add 5-15% randomization to create bid diversity
    const randomFactor = 1.05 + Math.random() * 0.1; // 1.05 to 1.15
    const competitiveBidCPM = targetBidCPM * randomFactor;

    const finalBidCPM = Math.max(competitiveBidCPM, floorPriceCPM);

    // this.logger.debug('Competitive bid calculation (CPM)', {
    //   baseBidCPM,
    //   targetBidCPM,
    //   floorPriceCPM,
    //   randomFactor,
    //   competitiveBidCPM,
    //   finalBidCPM,
    //   strategy: 'COMPETITIVE',
    // });

    return finalBidCPM;
  }
}
