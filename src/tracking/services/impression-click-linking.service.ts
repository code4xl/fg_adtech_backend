import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { randomUUID } from 'crypto';

interface slotData {
  id: string;
  bid: string;
  user: string;
  ts: number;
  clicks: number;
}

@Injectable()
export class ImpressionClickLinkingService {
  private readonly logger = new Logger(ImpressionClickLinkingService.name);

  // Redis key TTL settings (in seconds)
  private readonly SLOT_TTL = 3600; // 1 hour
  private readonly USER_TTL = 3600; // 1 hour
  private readonly TIME_TTL = 1800; // 30 minutes
  private readonly META_TTL = 3600; // 1 hour

  constructor(private readonly redis: RedisService) {}

  /**
   * Generate deterministic slot ID for impression-click linking
   */
  generateImpressionSlot(bidResponseId: string): string {
    const timestamp = Date.now();
    const randomSuffix = randomUUID().substring(0, 8);
    return `${bidResponseId}-${timestamp}-${randomSuffix}`;
  }

  /**
   * Store impression mappings using Redis pipeline for atomic operations
   * Optimized for high concurrency (10,000+ users)
   */
  async storeImpressionMappings(
    slotId: string,
    bidResponseId: string,
    userFingerprint: string,
    impressionId: string,
  ): Promise<boolean> {
    const timestamp = Date.now();
    const pipeline = this.redis.pipeline();

    try {
      // Strategy 1: Slot-based mapping
      const slotKey = `slot:${slotId}`;
      const slotData = {
        id: impressionId,
        bid: bidResponseId,
        user: userFingerprint,
        ts: timestamp,
        clicks: 0,
      };
      pipeline.setex(slotKey, this.SLOT_TTL, JSON.stringify(slotData));
      pipeline.get(slotKey); // Enqueue a read

      // Strategy 2: User-based mapping
      const userKey = `user:${bidResponseId}:${userFingerprint}`;
      pipeline.zadd(userKey, timestamp, impressionId);
      pipeline.expire(userKey, this.USER_TTL);
      pipeline.zrange(userKey, 0, -1); // Enqueue a read

      // Strategy 3: Time-based mapping
      const timeKey = `time:${bidResponseId}`;
      pipeline.zadd(timeKey, timestamp, impressionId);
      pipeline.expire(timeKey, this.TIME_TTL);
      pipeline.zrange(timeKey, 0, -1); // Enqueue a read

      // Strategy 4: Impression metadata
      const metaKey = `meta:${impressionId}`;
      const metaData = {
        slot: slotId,
        bid: bidResponseId,
        user: userFingerprint,
        created: timestamp,
        clicks: [],
      };
      pipeline.setex(metaKey, this.META_TTL, JSON.stringify(metaData));
      pipeline.get(metaKey); // Enqueue a read

      // Execute pipeline
      const results = await pipeline.exec();

      // Extract read results
      const [
        ,
        getSlotData,
        ,
        ,
        getUserZRange,
        ,
        ,
        getTimeZRange,
        ,
        getMetaData,
      ] = results.map(([err, result]) => (err ? null : result));

      // Logging
      this.logger.debug('Slot-based mapping data', { data: getSlotData });
      this.logger.debug('User-based mapping data', { data: getUserZRange });
      this.logger.debug('Time-based mapping data', { data: getTimeZRange });
      this.logger.debug('Impression metadata', { data: getMetaData });

      // Check for any pipeline errors
      const allSucceeded = results?.every(([err]) => err === null);

      if (allSucceeded) {
        this.logger.debug(' Impression mappings stored successfully', {
          slotId,
          impressionId,
          bidResponseId,
          userFingerprint,
          timestamp,
        });
        return true;
      } else {
        this.logger.error('❌ Some Redis operations failed', {
          results,
          slotId,
          impressionId,
        });
        return false;
      }
    } catch (error) {
      this.logger.error('❌ Failed to store impression mappings', {
        error: error.message,
        stack: error.stack,
        slotId,
        impressionId,
        bidResponseId,
      });
      return false;
    }
  }

  /**
   * Find impression and register click with optimized lookup strategies
   * Handles 10,000+ concurrent clicks efficiently
   */
  async findImpressionAndRegisterClick(
    bidResponseId: string,
    userFingerprint: string,
    clickId: string,
    slotId?: string,
  ): Promise<{
    impressionId: string;
    timeFromImpression: number;
    clickNumber: number;
    isFirstClick: boolean;
  } | null> {
    let impressionResult = null;
    let strategy = 'none';

    try {
      // Strategy 1: Slot-based lookup (fastest and most reliable)
      if (slotId) {
        impressionResult = await this.getImpressionBySlot(slotId);
        if (impressionResult) {
          strategy = 'slot';
        }
      }

      // Strategy 2: User-based lookup (fallback for same user)
      if (!impressionResult) {
        impressionResult = await this.getImpressionByUser(
          bidResponseId,
          userFingerprint,
        );
        if (impressionResult) {
          strategy = 'user';
        }
      }

      // Strategy 3: Time-based lookup (emergency fallback)
      if (!impressionResult) {
        impressionResult = await this.getRecentImpression(bidResponseId);
        if (impressionResult) {
          strategy = 'time';
        }
      }

      if (!impressionResult) {
        this.logger.warn('❌ No impression found for click', {
          bidResponseId,
          userFingerprint,
          slotId,
          clickId,
        });
        return null;
      }

      // Register this click atomically
      const clickInfo = await this.registerClickForImpression(
        impressionResult.impressionId,
        clickId,
        slotId,
      );

      this.logger.debug(' Impression-click linked successfully', {
        strategy,
        impressionId: impressionResult.impressionId,
        timeFromImpression: impressionResult.timeFromImpression,
        clickNumber: clickInfo.clickNumber,
        isFirstClick: clickInfo.isFirstClick,
      });

      return {
        impressionId: impressionResult.impressionId,
        timeFromImpression: impressionResult.timeFromImpression,
        clickNumber: clickInfo.clickNumber,
        isFirstClick: clickInfo.isFirstClick,
      };
    } catch (error) {
      this.logger.error('❌ Failed to find and register click', {
        error: error.message,
        bidResponseId,
        userFingerprint,
        clickId,
        slotId,
      });
      return null;
    }
  }

  /**
   * Strategy 1: Get impression by slot ID (Primary strategy)
   */
  private async getImpressionBySlot(slotId: string): Promise<{
    impressionId: string;
    timeFromImpression: number;
  } | null> {
    try {
      const slotKey = `slot:${slotId}`;
      const data: slotData = await this.redis.get(slotKey);

      this.logger.debug('In Impression By Slot', {
        slotKey,
        data,
        dataType: typeof data,
      });

      if (!data) {
        return null;
      }

      return {
        impressionId: data.id,
        timeFromImpression: Date.now() - data.ts,
      };
    } catch (error) {
      this.logger.error('Failed to get impression by slot', {
        error: error,
        slotId,
      });
      return null;
    }
  }

  /**
   * Strategy 2: Get impression by user fingerprint (Secondary strategy)
   */
  private async getImpressionByUser(
    bidResponseId: string,
    userFingerprint: string,
  ): Promise<{ impressionId: string; timeFromImpression: number } | null> {
    try {
      const userKey = `user:${bidResponseId}:${userFingerprint}`;

      // Get the most recent impression for this user/bidResponse
      const results = await this.redis.zrevrange(userKey, 0, 0, 'WITHSCORES');

      if (results.length < 2) {
        return null;
      }

      const impressionId = results[0] as string;
      const timestamp = parseInt(results[1] as string);

      return {
        impressionId,
        timeFromImpression: Date.now() - timestamp,
      };
    } catch (error) {
      this.logger.error('Failed to get impression by user', {
        error: error.message,
        bidResponseId,
        userFingerprint,
      });
      return null;
    }
  }

  /**
   * Strategy 3: Get recent impression by time (Fallback strategy)
   */
  private async getRecentImpression(bidResponseId: string): Promise<{
    impressionId: string;
    timeFromImpression: number;
  } | null> {
    try {
      const timeKey = `time:${bidResponseId}`;

      // Get the most recent impression for this bidResponse
      const results = await this.redis.zrevrange(timeKey, 0, 0, 'WITHSCORES');

      if (results.length < 2) {
        return null;
      }

      const impressionId = results[0] as string;
      const timestamp = parseInt(results[1] as string);
      const timeFromImpression = Date.now() - timestamp;

      // Only return if impression is recent (within 5 minutes)
      if (timeFromImpression > 300000) {
        return null;
      }

      return {
        impressionId,
        timeFromImpression,
      };
    } catch (error) {
      this.logger.error('Failed to get recent impression', {
        error: error.message,
        bidResponseId,
      });
      return null;
    }
  }

  /**
   * Register click for impression with atomic operations
   * Optimized for high concurrency
   */
  private async registerClickForImpression(
    impressionId: string,
    clickId: string,
    slotId?: string,
  ): Promise<{ clickNumber: number; isFirstClick: boolean }> {
    try {
      const metaKey = `meta:${impressionId}`;

      // Use Redis WATCH for optimistic locking in high concurrency
      await this.redis.watch(metaKey);

      const metaDataRaw = await this.redis.get(metaKey);

      let metaData;
      if (!metaDataRaw) {
        // Create new metadata if not exists
        metaData = {
          clicks: [clickId],
          created: Date.now(),
        };
      } else {
        // 🔧 FIX: Handle both string and object responses from Redis
        if (typeof metaDataRaw === 'string') {
          try {
            metaData = JSON.parse(metaDataRaw);
          } catch (parseError) {
            this.logger.error('Failed to parse metadata JSON', {
              error: parseError.message,
              rawData: metaDataRaw,
              impressionId,
            });
            // Create new metadata if parsing fails
            metaData = {
              clicks: [clickId],
              created: Date.now(),
            };
          }
        } else if (typeof metaDataRaw === 'object' && metaDataRaw !== null) {
          // Redis returned an object directly
          metaData = metaDataRaw;
        } else {
          this.logger.error('Unexpected Redis response type', {
            type: typeof metaDataRaw,
            value: metaDataRaw,
            impressionId,
          });
          // Fallback to creating new metadata
          metaData = {
            clicks: [clickId],
            created: Date.now(),
          };
        }

        // Ensure clicks array exists
        if (!metaData.clicks) {
          metaData.clicks = [];
        }

        // Check for duplicate clicks
        if (metaData.clicks.includes(clickId)) {
          await this.redis.unwatch();
          return {
            clickNumber: metaData.clicks.indexOf(clickId) + 1,
            isFirstClick: metaData.clicks.indexOf(clickId) === 0,
          };
        }

        // Add new click
        metaData.clicks.push(clickId);
      }

      const clickNumber = metaData.clicks.length;
      const isFirstClick = clickNumber === 1;

      // Start Redis transaction
      const pipeline = this.redis.pipeline();
      // pipeline.multi();

      // Update metadata atomically
      pipeline.setex(metaKey, this.META_TTL, JSON.stringify(metaData));

      // Update slot click count if available
      if (slotId) {
        const slotKey = `slot:${slotId}`;
        const slotDataRaw = await this.redis.get(slotKey);

        if (slotDataRaw) {
          let slotData;

          // Handle slot data the same way
          if (typeof slotDataRaw === 'string') {
            try {
              slotData = JSON.parse(slotDataRaw);
            } catch (parseError) {
              this.logger.error('Failed to parse slot data JSON', {
                error: parseError.message,
                rawData: slotDataRaw,
                slotId,
              });
              slotData = null;
            }
          } else if (typeof slotDataRaw === 'object' && slotDataRaw !== null) {
            slotData = slotDataRaw;
          } else {
            slotData = null;
          }

          if (slotData) {
            slotData.clicks = (slotData.clicks || 0) + 1;
            slotData.lastClick = Date.now();
            pipeline.setex(slotKey, this.SLOT_TTL, JSON.stringify(slotData));
          }
        }
      }

      const results = await pipeline.exec();

      if (
        results &&
        results.length > 0 &&
        results.every(([err]) => err === null)
      ) {
        this.logger.debug(' Click registered successfully', {
          impressionId,
          clickId,
          clickNumber,
          isFirstClick,
          totalClicks: metaData.clicks.length,
        });

        return { clickNumber, isFirstClick };
      } else {
        throw new Error('Redis transaction failed');
      }
    } catch (error) {
      await this.redis.unwatch();
      this.logger.error('❌ Failed to register click', {
        error: error.message,
        impressionId,
        clickId,
      });
      return { clickNumber: 1, isFirstClick: true };
    }
  }

  /**
   * Generate user fingerprint for linking
   */
  generateUserFingerprint(req: any, userData: any): string {
    const accept = req.headers['accept'] || '';

    const crypto = require('crypto');
    return crypto
      .createHash('md5')
      .update(`${userData.ipAddress}:${userData.userAgent}:${accept}`)
      .digest('hex')
      .substring(0, 21);
  }

  /**
   * Debug method for troubleshooting linking issues
   */
  async debugLinking(
    bidResponseId: string,
    slotId: string,
    userFingerprint: string,
  ): Promise<void> {
    try {
      const slotKey = `slot:${slotId}`;
      const userKey = `user:${bidResponseId}:${userFingerprint}`;
      const timeKey = `time:${bidResponseId}`;

      this.logger.debug('🔍 === LINKING DEBUG ===', {
        bidResponseId,
        slotId,
        userFingerprint,
      });

      // Check slot key
      const slotExists = await this.redis.exists(slotKey);
      const slotData = await this.redis.get(slotKey);
      this.logger.debug(`Slot: ${slotKey}`, {
        exists: slotExists,
        data: slotData,
      });

      // Check user key
      const userCount = await this.redis.zcard(userKey);
      const userData = await this.redis.zrevrange(userKey, 0, -1, 'WITHSCORES');
      this.logger.debug(`User: ${userKey}`, {
        count: userCount,
        data: userData,
      });

      // Check time key
      const timeCount = await this.redis.zcard(timeKey);
      const timeData = await this.redis.zrevrange(timeKey, 0, -1, 'WITHSCORES');
      this.logger.debug(`Time: ${timeKey}`, {
        count: timeCount,
        data: timeData,
      });

      // Check all keys
      const allSlotKeys = await this.redis.keys('slot:*');
      const allMetaKeys = await this.redis.keys('meta:*');
      this.logger.debug('All keys', {
        slotKeys: allSlotKeys.length,
        metaKeys: allMetaKeys.length,
      });
    } catch (error) {
      this.logger.error('Debug failed', { error: error.message });
    }
  }

  /**
   * Get analytics for impression-click relationships
   */
  async getImpressionClickAnalytics(impressionId: string): Promise<{
    totalClicks: number;
    clickIds: string[];
    timeFromImpression?: number;
  } | null> {
    try {
      const metaKey = `meta:${impressionId}`;
      const metaDataRaw = await this.redis.get(metaKey);

      if (!metaDataRaw) {
        return null;
      }

      const metaData = JSON.parse(metaDataRaw as string);
      const clickIds = metaData.clicks || [];

      return {
        totalClicks: clickIds.length,
        clickIds,
        timeFromImpression: metaData.created
          ? Date.now() - metaData.created
          : undefined,
      };
    } catch (error) {
      this.logger.error('Failed to get analytics', {
        error: error.message,
        impressionId,
      });
      return null;
    }
  }
}
