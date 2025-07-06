import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class bidStrategyService {
  private readonly logger = new Logger(bidStrategyService.name);
  constructor() {}
  public calculateLowestCostBid(baseBid: number, context: any): number {
    // LOGIC: Lowest cost strategy should bid just above floor price
    const floorPrice = context.floorPrice || 0.001; // Rs.1 CPM minimum

    // Floor prices might be provided as CPM values
    const floorPricePerImpression = floorPrice / 1000;

    // Increase chances of winning while minimizing cost
    const minBid = Math.max(floorPricePerImpression * 1.01, 0.0001);
    const finalBid = Math.max(baseBid / 1000, minBid);

    this.logger.debug('Lowest cost bid calculation', {
      baseBid: baseBid,
      baseBidPerImpression: baseBid / 1000,
      floorPrice: floorPrice,
      floorPricePerImpression: floorPricePerImpression,
      finalBid: finalBid,
    });

    return finalBid;
  }
}
