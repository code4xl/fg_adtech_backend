import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CampaignEligibilityService } from './campaign-eligibility.service';
import { AuctionStatusDto } from '../dto';
import { REDIS_KEYS } from '../../redis/constants/redis-keys';
import { BidEvaluationService } from './bid-evalutation.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuctionService {
  private readonly logger = new Logger(AuctionService.name);
  private readonly trackingBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly campaignEligibility: CampaignEligibilityService,
    private readonly bidEvaluation: BidEvaluationService,
    private readonly config: ConfigService,
  ) {
    this.trackingBaseUrl =
      this.config.get<string>('template.url') ||
      'https://track.oceanadtech.com';
    this.logger.log('Auction Service initialized - Phase 3 Complete');
  }

  // async processAuction(bidRequest: any): Promise<{
  //   auctionId: string;
  //   winner?: any;
  //   totalBids: number;
  //   processingTime: number;
  // }> {
  //   const startTime = Date.now();
  //   const auctionId = this.generateAuctionId(bidRequest.id);

  //   this.logger.debug('Starting auction processing', {
  //     auctionId,
  //     requestId: bidRequest.id,
  //     inventoryId: bidRequest.inventoryId,
  //   });

  //   try {
  //     // 1. Find eligible campaigns (cached for performance)
  //     const eligibleCampaigns = await this.findEligibleCampaigns(bidRequest);

  //     this.logger.debug('Found eligible campaigns', {
  //       auctionId,
  //       count: eligibleCampaigns.length,
  //     });

  //     if (eligibleCampaigns.length === 0) {
  //       return await this.handleNoBidsAuction(bidRequest, auctionId, startTime);
  //     }

  //     // 2. Generate bid responses for eligible campaigns
  //     const bidResponses = await this.generateBidResponses(
  //       bidRequest,
  //       eligibleCampaigns,
  //       auctionId,
  //     );

  //     this.logger.debug('Generated bid responses', {
  //       auctionId,
  //       validBids: bidResponses.length,
  //     });

  //     if (bidResponses.length === 0) {
  //       return await this.handleNoBidsAuction(bidRequest, auctionId, startTime);
  //     }

  //     // 3. Run auction algorithm

  //     const auctionResult = await this.runAuction(bidResponses, bidRequest);

  //     // 4. Store auction log
  //     await this.storeAuctionLog(bidRequest, auctionResult, startTime);

  //     // 5. Update bid response statuses
  //     await this.updateBidResponseStatuses(
  //       bidResponses,
  //       auctionResult.winnerId,
  //     );

  //     // 6. Update campaign spend for winner
  //     if (auctionResult.winner) {
  //       await this.updateCampaignSpend(
  //         auctionResult.winner.campaignId,
  //         auctionResult.finalPrice,
  //       );
  //     }

  //     const processingTime = Date.now() - startTime;

  //     this.logger.log('Auction completed successfully', {
  //       auctionId,
  //       winnerId: auctionResult.winnerId,
  //       finalPrice: auctionResult.finalPrice,
  //       processingTime: `${processingTime}ms`,
  //     });

  //     return {
  //       auctionId,
  //       winner: auctionResult.winner,
  //       totalBids: bidResponses.length,
  //       processingTime,
  //     };
  //   } catch (error) {
  //     const processingTime = Date.now() - startTime;

  //     this.logger.error('Auction processing failed', {
  //       auctionId,
  //       error: error.message,
  //       processingTime: `${processingTime}ms`,
  //     });

  //     // Store failed auction log
  //     await this.storeFailedAuctionLog(
  //       bidRequest,
  //       auctionId,
  //       error.message,
  //       startTime,
  //     );

  //     throw error;
  //   }
  // }

  async findEligibleCampaigns(bidRequest: any): Promise<any[]> {
    // const cacheKey = `eligible:${bidRequest.inventoryId}:${bidRequest.userContext.deviceType}`;
    const cacheKey = REDIS_KEYS.ELIGIBLE_CAMPAIGNS(
      bidRequest.inventoryId,
      bidRequest.userContext.deviceType,
    );

    try {
      // 1. Check Redis cache first
      const cached = await this.redis.get<string>(cacheKey);
      if (cached) {
        this.logger.debug('Campaign eligibility cache hit', {
          inventoryId: bidRequest.inventoryId,
        });
        return JSON.parse(cached);
      }

      this.logger.debug('Campaign eligibility cache miss, querying database', {
        inventoryId: bidRequest.inventoryId,
      });

      // 2. Get eligible campaigns from database with targeting rules
      const eligibleCampaigns =
        await this.campaignEligibility.getEligibleCampaigns(
          bidRequest.inventoryId,
          bidRequest.userContext,
          bidRequest.adSlotContext,
        );

      // 3. Cache results for 5 minutes
      await this.redis.set(cacheKey, JSON.stringify(eligibleCampaigns), 300);

      return eligibleCampaigns;
    } catch (error) {
      this.logger.error('Failed to find eligible campaigns', {
        error: error.message,
        inventoryId: bidRequest.inventoryId,
      });
      return [];
    }
  }

  async generateBidResponses(
    bidRequest: any,
    eligibleCampaigns: any[],
    auctionId: string,
  ): Promise<any[]> {
    const bidPromises = eligibleCampaigns.map(async (campaign) => {
      try {
        // 1. Check budget availability
        // const hasBudget =
        //   await this.campaignEligibility.checkBudgetAvailability(campaign.id);
        // if (!hasBudget) {
        //   this.logger.debug('Campaign excluded due to budget exhaustion', {
        //     campaignId: campaign.id,
        //   });
        //   return null;
        // }

        // 2. Calculate bid price
        const bidPrice = await this.bidEvaluation.calculateBidPrice(
          campaign,
          bidRequest,
        );

        // 3. Apply floor price check
        if (bidRequest.floorPrice && bidPrice < bidRequest.floorPrice) {
          this.logger.debug('Bid below floor price', {
            campaignId: campaign.id,
            bidPrice,
            floorPrice: bidRequest.floorPrice,
          });
          return null;
        }

        // 4. Select appropriate creative
        const creative = await this.selectCreative(
          campaign,
          bidRequest.adSlotContext,
        );
        if (!creative) {
          this.logger.debug('No matching creative found', {
            campaignId: campaign.id,
          });
          return null;
        }

        // 5. Create bid response
        return await this.createBidResponse(
          bidRequest,
          campaign,
          creative,
          bidPrice,
          auctionId,
        );
      } catch (error) {
        this.logger.warn('Failed to generate bid for campaign', {
          campaignId: campaign.id,
          error: error.message,
        });
        return null;
      }
    });

    const bidResults = await Promise.all(bidPromises);
    return bidResults.filter((bid) => bid !== null);
  }

  async runAuction(
    bidResponses: any[],
    bidRequest: any,
  ): Promise<{
    winner: any;
    winnerId: string;
    finalPrice: number;
    auctionType: string;
    auctionId: string;
    auctionStatus: string;
  }> {
    // Sort bids by price (descending)
    const sortedBids = bidResponses.sort(
      (a, b) => Number(b.bidPrice) - Number(a.bidPrice),
    );

    const winningBid = sortedBids[0];
    const auctionType = bidRequest.auctionType || 'SECOND_PRICE';

    let finalPrice: number;

    if (auctionType === 'FIRST_PRICE') {
      // Winner pays their bid
      finalPrice = Number(winningBid.bidPrice);
    } else {
      // Second-price auction: winner pays second highest + $0.01
      if (sortedBids.length > 1) {
        finalPrice = Number(sortedBids[1].bidPrice) + 0.01;
      } else {
        // Only one bid, use floor price or minimum
        finalPrice = bidRequest.floorPrice
          ? Math.max(Number(bidRequest.floorPrice), 0.01)
          : 0.01;
      }
    }

    this.logger.debug('Auction completed', {
      auctionType,
      winningBid: Number(winningBid.bidPrice),
      finalPrice,
      totalBids: bidResponses.length,
    });

    winningBid.finalPrice = finalPrice;
    winningBid.status = 'WON';
    this.logger.debug('Bid Request Timestamp', {
      requestTimestamp: bidRequest.requestTimestamp,
      responseTimestamp: Date.now(),
      requestTimestampType: typeof bidRequest.requestTimestamp,
      converted: new Date(bidRequest.requestTimestamp).getTime(),
    });
    winningBid.responseLatency =
      Date.now() - new Date(bidRequest.requestTimestamp).getTime();
    winningBid.processedAt = Date.now();
    return {
      winner: winningBid,
      winnerId: winningBid.id,
      finalPrice,
      auctionType,
      auctionId: bidRequest.auctionId,
      auctionStatus: 'COMPLETED',
    };
  }

  async getAuctionStatus(requestId: string): Promise<AuctionStatusDto | null> {
    try {
      // Get bid request with auction log
      const bidRequest = await this.prisma.bidRequest.findFirst({
        where: {
          OR: [{ id: requestId }, { externalRequestId: requestId }],
        },
        include: {
          auctionLog: true,
          bidResponses: {
            include: {
              campaign: {
                select: {
                  name: true,
                  advertiser: {
                    select: { name: true },
                  },
                },
              },
              creative: {
                select: { name: true },
              },
            },
          },
        },
      });

      if (!bidRequest) {
        return null;
      }

      // Determine current stage and status
      let stage: string;
      let status: string;

      if (!bidRequest.auctionLog) {
        stage = 'eligibility_check';
        status = 'processing';
      } else {
        stage = 'auction_complete';
        status = bidRequest.auctionLog.status.toLowerCase();
      }

      // Build metrics
      const metrics = {
        processingStarted: bidRequest.requestTimestamp.toISOString(),
        eligibleCampaigns: bidRequest.bidResponses.length,
        totalBids: bidRequest.auctionLog?.totalBids || 0,
        auctionDuration: bidRequest.auctionLog?.auctionDuration
          ? `${bidRequest.auctionLog.auctionDuration}ms`
          : 'unknown',
        cacheHitRate: '85%', // TODO: Implement actual cache hit tracking
      };

      // Find winner information
      let winner = undefined;
      if (status === 'completed') {
        const winningBid = bidRequest.bidResponses.find(
          (bid) => bid.status === 'WON',
        );
        if (winningBid) {
          winner = {
            campaignId: winningBid.campaignId,
            advertiserName: winningBid.campaign.advertiser.name,
            bidPrice: Number(winningBid.bidPrice),
            finalPrice: Number(winningBid.finalPrice || winningBid.bidPrice),
            creativeId: winningBid.creativeId,
          };
        }
      }

      return {
        requestId,
        status,
        stage,
        metrics,
        winner,
      };
    } catch (error) {
      this.logger.error('Failed to get auction status', {
        error: error.message,
        requestId,
      });
      throw error;
    }
  }

  private async selectCreative(
    campaign: any,
    adSlotContext: any,
  ): Promise<any> {
    try {
      // Find creative that matches ad slot requirements
      const creative = await this.prisma.creative.findFirst({
        where: {
          campaignId: campaign.id,
          status: 'APPROVED',
          adSlotTemplate: {
            width: adSlotContext.width,
            height: adSlotContext.height,
            format: adSlotContext.format,
          },
        },
        include: {
          adSlotTemplate: true,
        },
      });

      return creative;
    } catch (error) {
      this.logger.error('Failed to select creative', {
        campaignId: campaign.id,
        error: error.message,
      });
      return null;
    }
  }

  private async createBidResponse(
    bidRequest: any,
    campaign: any,
    creative: any,
    bidPrice: number,
    auctionId: string,
  ): Promise<any> {
    // Generate comprehensive tracking URLs
    const trackingUrls = this.generateTrackingUrls(auctionId);

    // Generate comprehensive ad markup
    const adMarkup = this.generateAdMarkup(creative, trackingUrls, {
      width: bidRequest.adSlotContext.width,
      height: bidRequest.adSlotContext.height,
      format: bidRequest.adSlotContext.format,
    });

    return await this.prisma.bidResponse.create({
      data: {
        bidRequestId: bidRequest.id,
        campaignId: campaign.id,
        creativeId: creative.id,
        advertiserId: campaign.advertiserId,
        bidPrice,
        currency: 'INR',
        status: 'PENDING',
        adMarkup,
        impressionUrls: trackingUrls.impression,
        clickUrls: trackingUrls.click,
      },
    });
  }

  generateTrackingUrls(
    auctionId: string,
    bidResponseId?: string,
  ): {
    impression: string[];
    click: string[];
  } {
    const baseUrl = this.trackingBaseUrl;

    if (bidResponseId) {
      // Detailed tracking with bidResponseId and timestamp
      return {
        impression: [
          `${baseUrl}/track/impression/${bidResponseId}?auction=${auctionId}&t=${Date.now()}`,
        ],
        click: [
          `${baseUrl}/track/click/${bidResponseId}?auction=${auctionId}&t=${Date.now()}`,
        ],
      };
    } else {
      // Simple tracking for backward compatibility
      return {
        impression: [`${baseUrl}/track/impression/${auctionId}`],
        click: [`${baseUrl}/track/click/${auctionId}`],
      };
    }
  }

  generateAdMarkup(
    creative: any,
    trackingUrls: { impression: string[]; click: string[] },
    context: {
      width: number;
      height: number;
      format?: string;
    },
  ): string {
    const { width, height, format } = context;
    const impressionUrl = trackingUrls.impression[0];
    const clickUrl = trackingUrls.click[0];

    // Determine format from creative or context
    const creativeFormat =
      format || creative.adSlotTemplate?.format || 'BANNER';

    // Generate markup based on creative type
    switch (creativeFormat) {
      case 'BANNER':
        return this.generateBannerMarkup(
          creative,
          width,
          height,
          impressionUrl,
          clickUrl,
        );

      case 'NATIVE':
        return this.generateNativeMarkup(creative, impressionUrl, clickUrl);

      case 'VIDEO':
        return this.generateVideoMarkup(
          creative,
          width,
          height,
          impressionUrl,
          clickUrl,
        );

      default:
        return this.generateDefaultMarkup(
          creative,
          width,
          height,
          impressionUrl,
          clickUrl,
        );
    }
  }

  private generateBannerMarkup(
    creative: any,
    width: number,
    height: number,
    impressionUrl: string,
    clickUrl: string,
  ): string {
    return `
        <div class="ocean-ad-container" style="width: ${width}px; height: ${height}px; position: relative; overflow: hidden;">
            <a href="${clickUrl}&url=${encodeURIComponent(creative.landingUrl)}" target="_blank" style="display: block; width: 100%; height: 100%;">
                <img src="${creative.fileUrl}" 
                     alt="${creative.name}"
                     style="width: 100%; height: 100%; object-fit: cover;" />
            </a>
            <img src="${impressionUrl}" style="position: absolute; width: 1px; height: 1px; opacity: 0;" alt="" />
        </div>
        `.trim();
  }

  private generateNativeMarkup(
    creative: any,
    impressionUrl: string,
    clickUrl: string,
  ): string {
    return `
        <div class="ocean-native-ad">
            <div class="ocean-native-content">
                <h3 class="ocean-native-title">${creative.title || creative.name}</h3>
                <p class="ocean-native-description">${creative.description || ''}</p>
                <a href="${clickUrl}&url=${encodeURIComponent(creative.landingUrl)}" target="_blank" class="ocean-native-cta">
                    Learn More
                </a>
            </div>
            <img src="${impressionUrl}" style="display: none;" alt="" />
        </div>
        `.trim();
  }

  private generateVideoMarkup(
    creative: any,
    width: number,
    height: number,
    impressionUrl: string,
    clickUrl: string,
  ): string {
    return `
        <div class="ocean-video-ad" style="width: ${width}px; height: ${height}px; position: relative;">
            <video width="${width}" height="${height}" controls autoplay muted>
                <source src="${creative.fileUrl}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
            <div class="ocean-video-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;">
                <a href="${clickUrl}&url=${encodeURIComponent(creative.landingUrl)}" target="_blank" 
                   style="position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; padding: 5px 10px; text-decoration: none; pointer-events: auto;">
                    Learn More
                </a>
            </div>
            <img src="${impressionUrl}" style="display: none;" alt="" />
        </div>
        `.trim();
  }

  private generateDefaultMarkup(
    creative: any,
    width: number,
    height: number,
    impressionUrl: string,
    clickUrl: string,
  ): string {
    return `
        <div class="ocean-ad" style="width: ${width}px; height: ${height}px;">
            <a href="${clickUrl}&url=${encodeURIComponent(creative.landingUrl)}" target="_blank">
                <img src="${creative.fileUrl}" 
                     alt="${creative.name}"
                     style="width: 100%; height: 100%;" />
            </a>
            <img src="${impressionUrl}" style="display: none;" alt="" />
        </div>
        `.trim();
  }

  private async handleNoBidsAuction(
    bidRequest: any,
    auctionId: string,
    startTime: number,
  ): Promise<any> {
    const processingTime = Date.now() - startTime;

    await this.prisma.auctionLog.create({
      data: {
        bidRequestId: bidRequest.id,
        auctionType: bidRequest.auctionType || 'SECOND_PRICE',
        status: 'NO_BIDS',
        totalBids: 0,
        validBids: 0,
        auctionDuration: processingTime,
        startedAt: new Date(startTime),
        completedAt: new Date(),
      },
    });

    this.logger.log('Auction completed with no bids', {
      auctionId,
      processingTime: `${processingTime}ms`,
    });

    return {
      auctionId,
      winner: null,
      totalBids: 0,
      processingTime,
    };
  }

  private async storeAuctionLog(
    bidRequest: any,
    auctionResult: any,
    startTime: number,
  ): Promise<void> {
    const processingTime = Date.now() - startTime;

    await this.prisma.auctionLog.create({
      data: {
        bidRequestId: bidRequest.id,
        auctionType: auctionResult.auctionType,
        floorPrice: bidRequest.floorPrice,
        winningBidId: auctionResult.winnerId,
        finalPrice: auctionResult.finalPrice,
        totalBids: 1, // Will be updated with actual count
        validBids: 1,
        auctionDuration: processingTime,
        status: 'COMPLETED',
        startedAt: new Date(startTime),
        completedAt: new Date(),
      },
    });
  }

  private async storeFailedAuctionLog(
    bidRequest: any,
    auctionId: string,
    errorMessage: string,
    startTime: number,
  ): Promise<void> {
    try {
      const processingTime = Date.now() - startTime;

      await this.prisma.auctionLog.create({
        data: {
          bidRequestId: bidRequest.id,
          auctionType: bidRequest.auctionType || 'SECOND_PRICE',
          status: 'ERROR',
          totalBids: 0,
          validBids: 0,
          auctionDuration: processingTime,
          startedAt: new Date(startTime),
          errorMessage,
          debugData: { auctionId },
        },
      });
    } catch (logError) {
      this.logger.error('Failed to store failed auction log', {
        error: logError.message,
        originalError: errorMessage,
      });
    }
  }

  private async updateBidResponseStatuses(
    bidResponses: any[],
    winnerId: string,
  ): Promise<void> {
    try {
      // Update winner
      await this.prisma.bidResponse.update({
        where: { id: winnerId },
        data: {
          status: 'WON',
          processedAt: new Date(),
        },
      });

      // Update losers
      const loserIds = bidResponses
        .filter((bid) => bid.id !== winnerId)
        .map((bid) => bid.id);

      if (loserIds.length > 0) {
        await this.prisma.bidResponse.updateMany({
          where: { id: { in: loserIds } },
          data: {
            status: 'LOST',
            processedAt: new Date(),
          },
        });
      }
    } catch (error) {
      this.logger.error('Failed to update bid response statuses', {
        error: error.message,
        winnerId,
      });
    }
  }

  private async updateCampaignSpend(
    campaignId: string,
    amount: number,
  ): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const spentKey = REDIS_KEYS.CAMPAIGN_BUDGET(campaignId, today);

      // Atomically increment campaign spend
      await this.redis.incrby(spentKey, Math.round(amount * 100)); // Store as cents

      // Set expiration for end of day
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      const ttlSeconds = Math.floor((endOfDay.getTime() - Date.now()) / 1000);
      await this.redis.expire(spentKey, ttlSeconds);

      this.logger.debug('Campaign spend updated', {
        campaignId,
        amount,
        date: today,
      });
    } catch (error) {
      this.logger.error('Failed to update campaign spend', {
        error: error.message,
        campaignId,
        amount,
      });
    }
  }
}
