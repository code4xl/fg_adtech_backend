import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { KafkaService } from '../../kafka/kafka.service';
import { RedisService } from '../../redis/redis.service';
import { RTBCacheService } from './rtb-cache.service';
import { CampaignEligibilityService } from './campaign-eligibility.service';
import { CreateBidRequestDto, BidResponseDto, HealthCheckDto } from '../dto';

import { v4 as uuidv4 } from 'uuid';
import RTBProducer from '../producer/rtb.producer';

@Injectable()
export class RTBService {
  private readonly logger = new Logger(RTBService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rtbProducer: RTBProducer,
  ) {
    this.logger.log('RTB Service initialized - Phase 3 Complete');
  }

  async getBidResponse(requestId: string): Promise<BidResponseDto | null> {
    this.logger.debug('Getting bid response', { requestId });

    try {
      // 1. Check Redis cache first for fast response
      const cachedResponse = await this.getCachedBidResponse(requestId);
      if (cachedResponse) {
        this.logger.debug('Bid response cache hit', { requestId });
        return cachedResponse;
      }

      // 2. Get from database if not cached
      const bidResponse = await this.getBidResponseFromDatabase(requestId);
      if (!bidResponse) {
        this.logger.warn('Bid response not found', { requestId });
        return null;
      }

      // 3. Cache the response for future requests (if completed)
      if (bidResponse.status === 'completed') {
        await this.cacheBidResponse(requestId, bidResponse);
      }

      return bidResponse;
    } catch (error) {
      this.logger.error('Failed to get bid response', {
        error: error.message,
        requestId,
      });
      throw error;
    }
  }

  private async getCachedBidResponse(
    requestId: string,
  ): Promise<BidResponseDto | null> {
    try {
      const cacheKey = REDIS_KEYS.AUCTION_RESULT(requestId);
      const cached = await this.redis.get<string>(cacheKey);

      if (!cached) {
        return null;
      }

      return JSON.parse(cached);
    } catch (error) {
      this.logger.warn('Failed to get cached bid response', {
        error: error.message,
        requestId,
      });
      return null;
    }
  }

  private async getBidResponseFromDatabase(
    requestId: string,
  ): Promise<BidResponseDto | null> {
    try {
      // Get bid request first
      const bidRequest = await this.prisma.bidRequest.findFirst({
        where: {
          OR: [{ id: requestId }, { externalRequestId: requestId }],
        },
        include: {
          bidResponses: {
            include: {
              creative: true,
              campaign: true,
            },
          },
          auctionLog: true,
        },
      });

      if (!bidRequest) {
        return null;
      }

      // Check auction status
      if (!bidRequest.auctionLog) {
        return {
          requestId,
          status: 'processing',
          message: 'Auction in progress',
        };
      }

      // Check if auction completed with no bids
      if (bidRequest.auctionLog.status === 'NO_BIDS') {
        return {
          requestId,
          status: 'no_bids',
          message: 'No eligible campaigns found',
        };
      }

      // Find winning bid
      const winningBid = bidRequest.bidResponses.find(
        (bid) => bid.status === 'WON',
      );

      if (!winningBid) {
        return {
          requestId,
          status: 'no_bids',
          message: 'Auction completed with no winner',
        };
      }

      // Format winning bid response
      return {
        requestId,
        status: 'completed',
        winningBid: {
          price: Number(winningBid.finalPrice || winningBid.bidPrice),
          currency: winningBid.currency,
          campaignId: winningBid.campaignId,
          creativeId: winningBid.creativeId,
          adMarkup: winningBid.adMarkup || '',
          impressionUrls: winningBid.impressionUrls || [],
          clickUrls: winningBid.clickUrls || [],
          landingUrl: winningBid.creative?.landingUrl,
        },
        auctionData: {
          totalBids: bidRequest.auctionLog.totalBids,
          validBids: bidRequest.auctionLog.validBids,
          auctionDuration: `${bidRequest.auctionLog.auctionDuration || 0}ms`,
          timestamp:
            bidRequest.auctionLog.completedAt?.toISOString() ||
            new Date().toISOString(),
          floorPrice: Number(bidRequest.floorPrice) || undefined,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get bid response from database', {
        error: error.message,
        requestId,
      });
      throw error;
    }
  }

  private async cacheBidResponse(
    requestId: string,
    bidResponse: BidResponseDto,
  ): Promise<void> {
    try {
      const cacheKey = REDIS_KEYS.AUCTION_RESULT(requestId);
      await this.redis.set(cacheKey, JSON.stringify(bidResponse), 3600); // 1 hour TTL
    } catch (error) {
      this.logger.warn('Failed to cache bid response', {
        error: error.message,
        requestId,
      });
    }
  }

  private async recordProcessingMetrics(
    requestId: string,
    processingTime: number,
  ): Promise<void> {
    try {
      // Update hourly metrics
      const hour = new Date().getHours();
      const metricsKey = `metrics:requests:${hour}`;

      await Promise.all([
        this.redis.incr(metricsKey),
        this.redis.incrby(`metrics:latency:${hour}`, processingTime),
        this.redis.expire(metricsKey, 7200), // 2 hours TTL
      ]);
    } catch (error) {
      this.logger.warn('Failed to record processing metrics', {
        error: error.message,
        requestId,
      });
    }
  }

  private async recordErrorMetrics(
    requestId: string,
    errorMessage: string,
  ): Promise<void> {
    try {
      const hour = new Date().getHours();
      const errorKey = `metrics:errors:${hour}`;

      await this.redis.incr(errorKey);
      await this.redis.expire(errorKey, 7200); // 2 hours TTL
    } catch (error) {
      this.logger.warn('Failed to record error metrics', {
        error: error.message,
      });
    }
  }
}
