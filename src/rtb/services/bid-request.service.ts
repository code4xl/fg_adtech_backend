// src/rtb/services/bid-request.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { KafkaService } from '../../kafka/kafka.service';
import { RedisService } from '../../redis/redis.service';
import { CreateBidRequestDto } from '../dto/create-bid-request.dto';
import { CampaignEligibilityService } from './campaign-eligibility.service';
import { AuctionService } from './auction.service';
import { CreativePerformanceService } from './creative-performance.service';
import { kafkaTopics } from '../../kafka/constants/kafka.config';
import { REDIS_KEYS } from '../../redis/constants/redis-keys';
import { AuctionResult } from '../interfaces/auction-result.interface';
import { BidResponseDto } from '../dto/bid-response.dto';

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
  requestTimestamp: Date;
}

@Injectable()
export class BidRequestService {
  private readonly logger = new Logger(BidRequestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaService,
    private readonly redis: RedisService,
    private readonly campaignEligibilityService: CampaignEligibilityService,
    private readonly auctionService: AuctionService,
    private readonly creativePerformanceService: CreativePerformanceService,
  ) {}

  /**
   * ENHANCED: Process bid request with creative performance history
   * Preserves existing API while adding creative-level optimization
   */
  async processBidRequest(
    dto: CreateBidRequestDto,
    context: RequestContext,
  ): Promise<BidResponseDto> {
    const startTime = Date.now();

    try {
      // 1. STORE: Enhanced bid request with rich context
      const bidRequest = await this.createEnhancedBidRequest(dto, context);

      // 2. ENRICH: Get creative performance data for optimization -- COMMENT BC
      const performanceContext = await this.enrichWithPerformanceData(dto);

      // 3. FAST PATH: Try to get cached response for similar requests
      const cachedResponse = await this.getCachedBidResponse(dto);
      if (cachedResponse) {
        this.logger.debug(`Using cached response for ${dto.externalRequestId}`);
        return cachedResponse;
      }

      // 4. ELIGIBILITY: Find eligible campaigns with creative performance
      const eligibleCampaigns =
        await this.campaignEligibilityService.findEligibleCampaigns(
          bidRequest,
          performanceContext,
        );

      if (eligibleCampaigns.length === 0) {
        // Publish no-bid event for analytics
        await this.publishNoBidEvent(bidRequest);

        return {
          bidRequestId: dto.externalRequestId,
          hasBids: false,
          processingTime: Date.now() - startTime,
        };
      }

      // 5. AUCTION: Run creative-optimized auction
      const auctionResult = await this.auctionService.runAuction(
        bidRequest,
        eligibleCampaigns,
      );

      // 6. RESPONSE: Generate enhanced bid response
      const bidResponse = await this.generateBidResponse(
        dto.externalRequestId,
        auctionResult,
        startTime,
      );

      // 7. ASYNC: Publish for async processing and analytics
      await this.publishBidEvent(bidRequest, auctionResult);

      // 8. CACHE: Cache successful response for similar future requests
      if (bidResponse.hasBids) {
        await this.cacheBidResponse(dto, bidResponse);
      }

      return bidResponse;
    } catch (error) {
      this.logger.error(
        `Error in bid request processing: ${error.message}`,
        error,
      );

      return {
        bidRequestId: dto.externalRequestId,
        hasBids: false,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Create enhanced bid request with full context
   */
  private async createEnhancedBidRequest(
    dto: CreateBidRequestDto,
    context: RequestContext,
  ) {
    // Enhanced user context with device fingerprinting
    const enhancedUserContext = {
      ...dto.userContext,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      deviceFingerprint: this.generateDeviceFingerprint(context),
    };

    // Store in PostgreSQL for audit and analysis
    return await this.prisma.bidRequest.create({
      data: {
        externalRequestId: dto.externalRequestId,
        inventoryId: dto.inventoryId,
        publisherId: dto.publisherId,
        websiteId: dto.websiteId,
        userContext: enhancedUserContext,
        adSlotContext: dto.adSlotContext || {},
        floorPrice: dto.floorPrice,
        auctionType: 'SECOND_PRICE', // Default from your enum
        timeout: dto.timeout || 200,
        requestTimestamp: context.requestTimestamp,
      },
      include: {
        inventory: {
          include: {
            adSlotTemplate: true,
          },
        },
        publisher: true,
        website: true,
      },
    });
  }

  /**
   * Enrich request with creative performance data
   */
  private async enrichWithPerformanceData(dto: CreateBidRequestDto) {
    // Get recent performance data for this inventory type
    const inventoryPerformance =
      await this.creativePerformanceService.getInventoryPerformanceHistory(
        dto.inventoryId,
      );

    // Get user behavior patterns if available -- BC
    const userHistory = dto.userContext?.userId
      ? await this.getUserBehaviorHistory(dto.userContext.userId)
      : null;

    return {
      inventoryPerformance,
      userHistory,
      timestamp: new Date(),
    };
  }

  /**
   * Try to get cached bid response for similar requests
   */
  private async getCachedBidResponse(
    dto: CreateBidRequestDto,
  ): Promise<BidResponseDto | null> {
    try {
      // Create cache key based on inventory + user context
      const cacheKey = this.generateCacheKey(dto);
      const cached = await this.redis.get(cacheKey);

      if (cached && this.isCacheValid(cached)) {
        return cached as BidResponseDto;
      }

      return null;
    } catch (error) {
      this.logger.warn(`Cache lookup failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate bid response with tracking URLs
   */
  private async generateBidResponse(
    requestId: string,
    auctionResult: AuctionResult,
    startTime: number,
  ): Promise<BidResponseDto> {
    if (!auctionResult.winningBid) {
      return {
        bidRequestId: requestId,
        hasBids: false,
        processingTime: Date.now() - startTime,
      };
    }

    const { winningBid } = auctionResult;

    // Get creative details for ad markup generation
    const creative = await this.prisma.creative.findUnique({
      where: { id: winningBid.creativeId },
      include: { campaign: true },
    });

    if (!creative) {
      throw new Error(`Creative not found: ${winningBid.creativeId}`);
    }

    // Generate tracking URLs
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const impressionUrls = [`${baseUrl}/track/impression/${requestId}`];
    const clickUrls = [
      `${baseUrl}/track/click/${requestId}?redirect=${encodeURIComponent(creative.landingUrl)}`,
    ];

    // Generate ad markup
    const adMarkup = await this.generateAdMarkup(
      creative,
      impressionUrls,
      clickUrls,
    );

    return {
      bidRequestId: requestId,
      campaignId: winningBid.campaignId,
      creativeId: winningBid.creativeId,
      bidPrice: winningBid.finalPrice,
      adMarkup,
      impressionUrls,
      clickUrls,
      hasBids: true,
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Publish bid event to Kafka for async processing
   */
  private async publishBidEvent(bidRequest: any, auctionResult: AuctionResult) {
    try {
      await this.kafka.publish(kafkaTopics.BID_REQUESTS, {
        key: `bid-request:${bidRequest.id}`,
        value: {
          bidRequest,
          auctionResult,
          timestamp: new Date().toISOString(),
        },
      });

      if (auctionResult.winningBid) {
        await this.kafka.publish(kafkaTopics.AUCTION_RESULTS, {
          key: `auction:${bidRequest.id}`,
          value: {
            bidRequestId: bidRequest.id,
            ...auctionResult,
            timestamp: new Date().toISOString(),
          },
        });
      }
    } catch (error) {
      this.logger.error(`Failed to publish bid event: ${error.message}`);
      // Don't throw - this shouldn't break the main flow
    }
  }

  /**
   * Publish no-bid event for analytics
   */
  private async publishNoBidEvent(bidRequest: any) {
    try {
      await this.kafka.publish(kafkaTopics.AUCTION_RESULTS, {
        key: `no-bid:${bidRequest.id}`,
        value: {
          bidRequestId: bidRequest.id,
          status: 'NO_BIDS',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to publish no-bid event: ${error.message}`);
    }
  }

  /**
   * Cache successful bid response
   */
  private async cacheBidResponse(
    dto: CreateBidRequestDto,
    response: BidResponseDto,
  ) {
    try {
      const cacheKey = this.generateCacheKey(dto);
      // Cache for 5 minutes with creative performance data
      await this.redis.set(cacheKey, response, 300);
    } catch (error) {
      this.logger.warn(`Failed to cache bid response: ${error.message}`);
    }
  }

  // Helper methods
  private generateDeviceFingerprint(context: RequestContext): string {
    return Buffer.from(`${context.userAgent}:${context.ipAddress}`).toString(
      'base64',
    );
  }

  private generateCacheKey(dto: CreateBidRequestDto): string {
    return `bid-cache:${dto.inventoryId}:${dto.userContext?.deviceType || 'unknown'}`;
  }

  private isCacheValid(cached: any): boolean {
    // Add cache validity logic based on creative performance freshness
    return (
      cached &&
      cached.processingTime &&
      Date.now() - cached.processingTime < 300000
    ); // 5 minutes
  }

  private async getUserBehaviorHistory(userId: string) {
    // Implement user behavior history lookup
    return null; // Placeholder
  }

  private async generateAdMarkup(
    creative: any,
    impressionUrls: string[],
    clickUrls: string[],
  ): Promise<string> {
    // Generate HTML markup for the creative
    return `
      <div class="ocean-ad" data-creative-id="${creative.id}">
        <a href="${clickUrls[0]}" target="_blank">
          <img src="${creative.fileUrl}" 
               alt="${creative.name}"
               onload="(new Image()).src='${impressionUrls[0]}'" />
        </a>
      </div>
    `;
  }
}
