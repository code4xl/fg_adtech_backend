import { Logger } from '@nestjs/common';
import { REDIS_KEYS, RTB_CACHE_TTL } from '../constants/cache-keys';
import { RedisService } from 'src/redis/redis.service';
import { BidRequestWithAuction } from '../types/bid-request.types';

export class RtbCacheService {
  private readonly logger = new Logger(RtbCacheService.name);
  constructor(private readonly redis: RedisService) {}

  public async cacheBidRequest(
    bidRequest: BidRequestWithAuction,
  ): Promise<void> {
    try {
      const cacheKey = REDIS_KEYS.BID_REQUEST(bidRequest.id);
      await this.redis.set(
        cacheKey,
        JSON.stringify(bidRequest),
        RTB_CACHE_TTL.BID_REQUEST,
      );
      this.logger.debug('Bid request cached', { requestId: bidRequest.id });
    } catch (error) {
      this.logger.warn('Failed to cache bid request', {
        error: error.message,
        requestId: bidRequest.id,
      });
    }
  }

  public async recordProcessingMetrics(
    requestId: string,
    processingTime: number,
  ): Promise<void> {
    try {
      // Update hourly metrics
      const hour = new Date().getHours();
      const metricsKey = REDIS_KEYS.HOURLY_BID_REQUEST_METRICS(hour);

      await Promise.all([
        this.redis.incr(metricsKey),
        this.redis.incrby(
          REDIS_KEYS.HOURLY_BID_REQUEST_LATENCY(hour),
          processingTime,
        ),
        this.redis.expire(metricsKey, RTB_CACHE_TTL.HOURLY_BID_REQUEST_METRICS), // 2 hours TTL
      ]);
    } catch (error) {
      this.logger.warn('Failed to record processing metrics', {
        error: error.message,
        requestId,
      });
    }
  }

  public async recordErrorMetrics(
    requestId: string,
    errorMessage: string,
  ): Promise<void> {
    try {
      const hour = new Date().getHours();
      const errorKey = REDIS_KEYS.HOURLY_BID_RESPONSE_ERRORS(hour);

      await this.redis.incr(errorKey);
      await this.redis.expire(
        errorKey,
        RTB_CACHE_TTL.HOURLY_BID_RESPONSE_ERRORS,
      ); // 2 hours TTL
    } catch (error) {
      this.logger.warn('Failed to record error metrics', {
        error: error.message,
      });
    }
  }
}
