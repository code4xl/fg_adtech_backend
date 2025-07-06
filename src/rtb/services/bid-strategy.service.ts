import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class bidStrategyService {
  private readonly logger = new Logger(bidStrategyService.name);

  constructor() {}

  public calculateBidAmount(
    bidStrategy: string,
    baseBid: number,
    context: any,
  ): number {
    const floorPrice = context.floorPrice || 0.001;
    const floorPricePerImpression = floorPrice / 1000;

    switch (bidStrategy) {
      case 'LOWEST_COST':
        return this.calculateLowestCostBid(baseBid, context);

      case 'TARGET_CPM':
        return this.calculateTargetCpmBid(baseBid, context);

      case 'SMART_BID':
        return this.calculateSmartBid(baseBid, context);

      case 'COMPETITIVE':
        return this.calculateCompetitiveBid(baseBid, context);

      default:
        return this.calculateLowestCostBid(baseBid, context);
    }
  }

  // EXISTING: Bid just above floor price (your current logic)
  public calculateLowestCostBid(baseBid: number, context: any): number {
    const floorPrice = context.floorPrice || 0.001;
    const floorPricePerImpression = floorPrice / 1000;

    // Bid slightly above floor price for maximum efficiency
    const minBid = Math.max(floorPricePerImpression * 1.01, 0.0001);
    const finalBid = Math.max(baseBid / 1000, minBid);

    this.logger.debug('Lowest cost bid calculation', {
      baseBid,
      floorPrice,
      finalBid,
      strategy: 'LOWEST_COST',
    });

    return finalBid;
  }

  // NEW: Bid the campaign's actual target CPM amount
  public calculateTargetCpmBid(baseBid: number, context: any): number {
    const floorPrice = context.floorPrice || 0.001;
    const floorPricePerImpression = floorPrice / 1000;

    // Use the campaign's actual bid amount (converted from CPM)
    const targetBidPerImpression = baseBid / 1000;

    // Ensure we meet floor price minimum
    const finalBid = Math.max(targetBidPerImpression, floorPricePerImpression);

    this.logger.debug('Target CPM bid calculation', {
      baseBid,
      targetBidPerImpression,
      floorPricePerImpression,
      finalBid,
      strategy: 'TARGET_CPM',
    });

    return finalBid;
  }

  // NEW: Smart bidding between floor and target based on simple performance
  public calculateSmartBid(baseBid: number, context: any): number {
    const floorPrice = context.floorPrice || 0.001;
    const floorPricePerImpression = floorPrice / 1000;
    const targetBidPerImpression = baseBid / 1000;

    // Simple performance factor (you can enhance this later)
    // For now, use a random factor between 0.7-1.0 to simulate performance
    const performanceFactor = 0.7 + Math.random() * 0.3;

    // Calculate bid between floor and target
    const smartBid =
      floorPricePerImpression +
      (targetBidPerImpression - floorPricePerImpression) * performanceFactor;

    const finalBid = Math.max(smartBid, floorPricePerImpression);

    this.logger.debug('Smart bid calculation', {
      baseBid,
      performanceFactor,
      smartBid,
      finalBid,
      strategy: 'SMART_BID',
    });

    return finalBid;
  }

  // NEW: Competitive bidding with slight randomization
  public calculateCompetitiveBid(baseBid: number, context: any): number {
    const floorPrice = context.floorPrice || 0.001;
    const floorPricePerImpression = floorPrice / 1000;
    const targetBidPerImpression = baseBid / 1000;

    // Add 5-15% randomization to create bid diversity
    const randomFactor = 1.05 + Math.random() * 0.1; // 1.05 to 1.15
    const competitiveBid = targetBidPerImpression * randomFactor;

    const finalBid = Math.max(competitiveBid, floorPricePerImpression);

    this.logger.debug('Competitive bid calculation', {
      baseBid,
      randomFactor,
      competitiveBid,
      finalBid,
      strategy: 'COMPETITIVE',
    });

    return finalBid;
  }
}
