// src/rtb/auction/auction.service.ts
import { Injectable, Logger } from '@nestjs/common';

import { BidCalculationService } from './bid-calculation.service';
import { AuctionResultService } from './auction-result.service';
import { v4 as uuidv4 } from 'uuid';
import { CampaignEligibilityService } from './campaign-eligibility.service';
import { AuctionLogStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuctionService {
  private readonly logger = new Logger(AuctionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly campaignEligibility: CampaignEligibilityService,
    private readonly bidCalculation: BidCalculationService,
    private readonly auctionResult: AuctionResultService,
  ) {}

  async processAuction(bidRequest) {
    const auctionStart = Date.now();

    // Generate a unique ID for this auction
    const auctionId = uuidv4();

    try {
      this.logger.debug(
        `Starting auction ${auctionId} for bid request ${bidRequest.id}`,
      );

      // Create auction log entry
      await this.createAuctionLog(auctionId, bidRequest.id, bidRequest.floor);

      // 1. Find eligible campaigns
      const eligibleCampaigns =
        await this.campaignEligibility.getEligibleCampaigns(bidRequest);

      if (eligibleCampaigns.length === 0) {
        this.logger.debug(`No eligible campaigns for auction ${auctionId}`);
        return this.auctionResult.processAuctionResult(
          auctionId,
          bidRequest.id,
          [],
          bidRequest.auctionType || 'FIRST_PRICE',
        );
      }

      // 2. Calculate bids for eligible campaigns
      const bids = await this.bidCalculation.calculateBids(
        eligibleCampaigns,
        bidRequest,
      );

      // Filter bids that meet floor price
      const floorPrice = bidRequest.floor || 0;
      const validBids = bids.filter((bid) => bid.bidPrice >= floorPrice);

      if (validBids.length === 0) {
        this.logger.debug(
          `No bids meet floor price ${floorPrice} for auction ${auctionId}`,
        );
        return this.auctionResult.processAuctionResult(
          auctionId,
          bidRequest.id,
          [],
          bidRequest.auctionType || 'FIRST_PRICE',
        );
      }

      // 3. Process auction result
      const result = await this.auctionResult.processAuctionResult(
        auctionId,
        bidRequest.id,
        validBids,
        bidRequest.auctionType || 'FIRST_PRICE',
      );

      const elapsed = Date.now() - auctionStart;
      this.logger.debug(`Auction ${auctionId} completed in ${elapsed}ms`);

      return result;
    } catch (error) {
      this.logger.error(
        `Error processing auction ${auctionId}: ${error.message}`,
        error.stack,
      );

      // Update auction log to mark as failed
      await this.prisma.auctionLog.update({
        where: { id: auctionId },
        data: {
          status: AuctionLogStatus.FAILED,
          errorMessage: error.message,
          auctionEndTime: new Date(),
        },
      });

      return null;
    }
  }

  private async createAuctionLog(
    auctionId: string,
    bidRequestId: string,
    floorPrice?: number,
  ) {
    return this.prisma.auctionLog.create({
      data: {
        id: auctionId,
        bidRequestId,
        floorPrice: floorPrice || null,
        auctionStartTime: new Date(),
        status: AuctionLogStatus.STARTED,
        totalBids: 0,
      },
    });
  }
}
