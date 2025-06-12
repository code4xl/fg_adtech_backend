import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { KafkaService } from '../../kafka/kafka.service';
import { RedisService } from '../../redis/redis.service';
import { RTBCacheService } from './rtb-cache.service';
import { CampaignEligibilityService } from './campaign-eligibility.service';
import { CreateBidRequestDto, BidResponseDto, HealthCheckDto } from '../dto';
import { kafkaTopics } from '../../kafka/constants/kafka.config';
import { REDIS_KEYS } from '../../redis/constants/redis-keys';
import { v4 as uuidv4 } from 'uuid';
import RTBProducer from '../producer/rtb.producer';

@Injectable()
export class RTBService {
  private readonly logger = new Logger(RTBService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaService,
    private readonly redis: RedisService,
    private readonly rtbCache: RTBCacheService,
    private readonly campaignEligibility: CampaignEligibilityService,
    private readonly rtbProducer: RTBProducer,
  ) {
    this.logger.log('RTB Service initialized - Phase 3 Complete');
  }

  async processBidRequest(bidRequestData: CreateBidRequestDto): Promise<{
    requestId: string;
    auctionId: string;
    status: string;
  }> {
    const startTime = Date.now();

    try {
      this.logger.debug('Processing bid request', {
        externalRequestId: bidRequestData.externalRequestId,
        inventoryId: bidRequestData.inventoryId,
      });

      // 1. Generate internal request ID and auction ID
      const requestId = uuidv4();
      const auctionId = uuidv4();

      // 2. Enrich bid request with additional context
      const enrichedRequest = await this.enrichBidRequest(
        bidRequestData,
        requestId,
      );

      // 3. Store bid request in database
      const bidRequest = await this.createBidRequest(
        enrichedRequest,
        auctionId,
      );

      // 4. Cache bid request in Redis for fast access
      await this.cacheBidRequest(bidRequest);

      // 5. Publish to Kafka for async auction processing
      await this.rtbProducer.publishBidRequestForProcessing(bidRequest);

      // 6. Record processing metrics
      const processingTime = Date.now() - startTime;
      await this.recordProcessingMetrics(requestId, processingTime);

      this.logger.log('Bid request processed successfully', {
        requestId,
        auctionId,
        processingTime: `${processingTime}ms`,
      });

      return {
        requestId: bidRequest.id,
        auctionId,
        status: 'processing',
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('Bid request processing failed', {
        error: error.message,
        externalRequestId: bidRequestData.externalRequestId,
        processingTime: `${processingTime}ms`,
      });

      // Record error metrics
      await this.recordErrorMetrics(
        bidRequestData.externalRequestId,
        error.message,
      );

      throw error;
    }
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

  async getSystemHealth(): Promise<HealthCheckDto> {
    this.logger.debug('Performing system health check');

    try {
      // Run health checks in parallel for speed
      const [databaseHealth, redisHealth, kafkaHealth, performanceMetrics] =
        await Promise.allSettled([
          this.checkDatabaseHealth(),
          this.checkRedisHealth(),
          this.checkKafkaHealth(),
          this.getPerformanceMetrics(),
        ]);

      // Determine overall system status
      const allHealthy = [databaseHealth, redisHealth, kafkaHealth].every(
        (result) =>
          result.status === 'fulfilled' && result.value === 'connected',
      );

      const status = allHealthy ? 'healthy' : 'degraded';

      return {
        status,
        timestamp: new Date().toISOString(),
        version: '1.0.0-phase3',
        components: {
          database: this.getHealthStatus(databaseHealth),
          redis: this.getHealthStatus(redisHealth),
          kafka: this.getHealthStatus(kafkaHealth),
        },
        metrics:
          performanceMetrics.status === 'fulfilled'
            ? performanceMetrics.value
            : {
                requestsPerSecond: 0,
                averageLatency: 'unknown',
                cacheHitRate: 'unknown',
                errorRate: 'unknown',
              },
      };
    } catch (error) {
      this.logger.error('Health check failed', { error: error.message });
      throw error;
    }
  }

  // /**
  //  * Generate auction ID for tracking
  //  */
  // private generateAuctionId(requestId: string): string {
  //   const random = Math.random().toString(36).substring(2, 6);
  //   return `auction_${requestId.split('_')[1]}_${random}`;
  // }

  /**
   * Enrich bid request with server-side context
   */
  private async enrichBidRequest(
    bidRequestData: CreateBidRequestDto,
    requestId: string,
  ): Promise<any> {
    return {
      ...bidRequestData,
      id: requestId,
      requestTimestamp: new Date(),
      // Add server-side enrichments
      serverContext: {
        processedAt: new Date().toISOString(),
        version: '1.0.0-phase3',
        requestId,
      },
    };
  }

  private async createBidRequest(
    enrichedRequest: any,
    auctionId: string,
  ): Promise<any> {
    try {
      const bidRequest = await this.prisma.bidRequest.create({
        data: {
          externalRequestId: enrichedRequest.externalRequestId,
          inventoryId: enrichedRequest.inventoryId,
          publisherId: enrichedRequest.publisherId,
          websiteId: enrichedRequest.websiteId,
          userContext: enrichedRequest.userContext,
          adSlotContext: enrichedRequest.adSlotContext,
          floorPrice: enrichedRequest.floorPrice,
          auctionType: enrichedRequest.auctionType || 'SECOND_PRICE',
          timeout: enrichedRequest.timeout || 200,
          requestTimestamp: enrichedRequest.requestTimestamp,
        },
      });

      this.logger.debug('Bid request stored in database', {
        id: bidRequest.id,
        auctionId,
      });

      return { ...bidRequest, auctionId };
    } catch (error) {
      this.logger.error('Failed to store bid request', {
        error: error.message,
        externalRequestId: enrichedRequest.externalRequestId,
      });
      throw error;
    }
  }

  private async cacheBidRequest(bidRequest: any): Promise<void> {
    try {
      const cacheKey = REDIS_KEYS.BID_REQUEST(bidRequest.id);
      await this.redis.set(cacheKey, JSON.stringify(bidRequest), 3600); // 1 hour TTL

      this.logger.debug('Bid request cached', { requestId: bidRequest.id });
    } catch (error) {
      // Non-blocking error - log but don't throw
      this.logger.warn('Failed to cache bid request', {
        error: error.message,
        requestId: bidRequest.id,
      });
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

  private async checkDatabaseHealth(): Promise<string> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'connected';
    } catch (error) {
      this.logger.error('Database health check failed', {
        error: error.message,
      });
      return 'disconnected';
    }
  }

  private async checkRedisHealth(): Promise<string> {
    try {
      await this.redis.set('health:check', 'ok', 10);
      const result = await this.redis.get('health:check');
      return result === 'ok' ? 'connected' : 'error';
    } catch (error) {
      this.logger.error('Redis health check failed', { error: error.message });
      return 'disconnected';
    }
  }

  private async checkKafkaHealth(): Promise<string> {
    try {
      // Simple topic existence check
      const topicExists = await this.kafka.checkTopicExists(
        kafkaTopics.BID_REQUESTS,
      );
      return topicExists ? 'connected' : 'error';
    } catch (error) {
      this.logger.error('Kafka health check failed', { error: error.message });
      return 'disconnected';
    }
  }

  private async getPerformanceMetrics(): Promise<{
    requestsPerSecond: number;
    averageLatency: string;
    cacheHitRate: string;
    errorRate: string;
    activeAuctions?: number;
  }> {
    try {
      const hour = new Date().getHours();
      const prevHour = hour === 0 ? 23 : hour - 1;

      const [
        currentRequests,
        currentLatency,
        currentErrors,
        prevRequests,
        prevLatency,
      ] = await Promise.all([
        this.redis.get<string>(`metrics:requests:${hour}`),
        this.redis.get<string>(`metrics:latency:${hour}`),
        this.redis.get<string>(`metrics:errors:${hour}`),
        this.redis.get<string>(`metrics:requests:${prevHour}`),
        this.redis.get<string>(`metrics:latency:${prevHour}`),
      ]);

      const requests =
        parseInt(currentRequests || '0') + parseInt(prevRequests || '0');
      const totalLatency =
        parseInt(currentLatency || '0') + parseInt(prevLatency || '0');
      const errors = parseInt(currentErrors || '0');

      const requestsPerSecond = Math.round(requests / 3600); // Requests per second over 2 hours
      const averageLatency =
        requests > 0 ? `${Math.round(totalLatency / requests)}ms` : '0ms';
      const errorRate =
        requests > 0 ? `${((errors / requests) * 100).toFixed(2)}%` : '0%';

      // Estimate cache hit rate (simplified)
      const cacheHitRate = '85%'; // TODO: Implement actual cache hit tracking

      return {
        requestsPerSecond,
        averageLatency,
        cacheHitRate,
        errorRate,
      };
    } catch (error) {
      this.logger.error('Failed to get performance metrics', {
        error: error.message,
      });
      throw error;
    }
  }

  private getHealthStatus(result: PromiseSettledResult<string>): string {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return 'error';
  }
}
