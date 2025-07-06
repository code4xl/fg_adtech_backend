import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { v4 as uuidv4 } from 'uuid';
import { REDIS_KEYS } from 'src/rtb/constants/cache-keys';

export interface SyncMetrics {
  totalProcessed: number;
  totalErrors: number;
  lastSyncTime: Date;
  averageProcessingTime: number;
  batchSizes: number[];
}

@Injectable()
export class RedisPostgresSyncService {
  private readonly logger = new Logger(RedisPostgresSyncService.name);

  private syncMetrics: SyncMetrics = {
    totalProcessed: 0,
    totalErrors: 0,
    lastSyncTime: new Date(),
    averageProcessingTime: 0,
    batchSizes: [],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * 🎯 FIXED: Single cron job that syncs impressions THEN clicks
   */
  @Cron(CronExpression.EVERY_30_MINUTES) // Every 30 minute
  async syncImpressionsThenClicks(): Promise<void> {
    const batchId = uuidv4();
    const startTime = Date.now();

    this.logger.debug('🔄 Starting sequential sync: impressions → clicks', {
      batchId,
    });

    try {
      //  STEP 1: Sync impressions FIRST
      await this.syncImpressionsOnly();

      //  STEP 2: Then sync clicks (impressions are now in PostgreSQL)
      await this.syncClicksOnly();

      const processingTime = Date.now() - startTime;
      this.logger.debug(' Sequential sync completed', {
        batchId,
        processingTimeMs: processingTime,
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error('❌ Sequential sync failed:', {
        error: error.message,
        batchId,
        processingTimeMs: processingTime,
      });
    }
  }

  /**
   * 🔧 Convert existing syncImpressions to internal method
   */
  private async syncImpressionsOnly(): Promise<number> {
    const startTime = Date.now();
    const batchId = uuidv4().substring(0, 8);

    this.logger.debug('🔄 Syncing impressions', { batchId });

    try {
      let totalProcessed = 0;
      const errors: any[] = [];
      const chunkSize = 500;

      while (true) {
        const chunk = await this.getPendingImpressions(chunkSize);

        if (chunk.length === 0) {
          this.logger.debug(' No more pending impressions');
          break;
        }

        try {
          const processed = await this.insertImpressionBatch(chunk);
          totalProcessed += processed;

          this.logger.debug(` Processed impressions chunk`, {
            batchId,
            chunkSize: chunk.length,
            processed,
            totalProcessed,
          });
        } catch (chunkError) {
          this.logger.error(`❌ Failed to process impressions chunk:`, {
            error: chunkError.message,
            batchId,
            chunkSize: chunk.length,
          });

          await this.returnFailedItems(REDIS_KEYS.PENDING_IMPRESSIONS, chunk);
          errors.push({ chunkSize: chunk.length, error: chunkError.message });
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const processingTime = Date.now() - startTime;
      this.updateSyncMetrics(processingTime, totalProcessed, errors.length > 0);

      this.logger.debug(' Impressions sync completed', {
        batchId,
        totalProcessed,
        errors: errors.length,
        processingTimeMs: processingTime,
      });

      await this.updateRedisMetrics(
        'impressions',
        totalProcessed,
        processingTime,
      );
      return totalProcessed;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateSyncMetrics(processingTime, 0, true);
      this.logger.error('❌ Impressions sync failed:', {
        error: error.message,
        batchId,
      });
      return 0;
    }
  }

  /**
   * 🔧 Convert existing syncClicks to internal method
   */
  private async syncClicksOnly(): Promise<number> {
    const startTime = Date.now();
    const batchId = uuidv4().substring(0, 8);

    this.logger.debug('🔄 Syncing clicks', { batchId });

    try {
      let totalProcessed = 0;
      const errors: any[] = [];
      const chunkSize = 500;

      while (true) {
        const chunk = await this.getPendingClicks(chunkSize);

        if (chunk.length === 0) {
          this.logger.debug(' No more pending clicks');
          break;
        }

        try {
          const processed = await this.insertClickBatch(chunk);
          totalProcessed += processed;

          this.logger.debug(` Processed clicks chunk`, {
            batchId,
            chunkSize: chunk.length,
            processed,
            totalProcessed,
          });
        } catch (chunkError) {
          this.logger.error(`❌ Failed to process clicks chunk:`, {
            error: chunkError.message,
            batchId,
            chunkSize: chunk.length,
          });

          await this.returnFailedItems(REDIS_KEYS.PENDING_CLICKS, chunk);
          errors.push({ chunkSize: chunk.length, error: chunkError.message });
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const processingTime = Date.now() - startTime;
      this.updateSyncMetrics(processingTime, totalProcessed, errors.length > 0);

      this.logger.debug(' Clicks sync completed', {
        batchId,
        totalProcessed,
        errors: errors.length,
        processingTimeMs: processingTime,
      });

      await this.updateRedisMetrics('clicks', totalProcessed, processingTime);
      return totalProcessed;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateSyncMetrics(processingTime, 0, true);
      this.logger.error('❌ Clicks sync failed:', {
        error: error.message,
        batchId,
      });
      return 0;
    }
  }

  /**
   * Atomically get and remove impressions from Redis
   * This prevents data loss during processing
   */
  private async getPendingImpressions(
    count: number,
  ): Promise<ImpressionData[]> {
    try {
      const items = await this.redis.lpop(
        REDIS_KEYS.PENDING_IMPRESSIONS,
        count,
      );

      if (!items || items.length === 0) {
        return [];
      }

      // Parse JSON items and filter out invalid ones
      return items
        .map((item: string) => {
          try {
            return JSON.parse(item);
          } catch (parseError) {
            this.logger.warn('Failed to parse impression data:', {
              data: item,
              error: parseError.message,
            });
            return null;
          }
        })
        .filter(Boolean);
    } catch (error) {
      this.logger.error(
        'Failed to atomically get impressions from Redis:',
        error,
      );
      return [];
    }
  }

  /**
   * Atomically get and remove clicks from Redis
   */
  private async getPendingClicks(count: number): Promise<ClickData[]> {
    try {
      // Use LPOP with COUNT to atomically remove items from the left
      const items = await this.redis.lpop(REDIS_KEYS.PENDING_CLICKS, count);

      if (!items || items.length === 0) {
        return [];
      }

      // Parse JSON items and filter out invalid ones
      return items
        .map((item: string) => {
          try {
            return JSON.parse(item);
          } catch (parseError) {
            this.logger.warn('Failed to parse click data:', {
              data: item,
              error: parseError.message,
            });
            return null;
          }
        })
        .filter(Boolean);
    } catch (error) {
      this.logger.error('Failed to atomically get clicks from Redis:', error);
      return [];
    }
  }

  /**
   * Return failed items back to Redis for retry
   * Add them to the front of the queue to maintain order
   */
  private async returnFailedItems(key: string, items: any[]): Promise<void> {
    try {
      if (items.length === 0) return;

      const pipeline = this.redis.pipeline();

      // Add items back to the front of the list (right side for FIFO)
      for (const item of items.reverse()) {
        pipeline.rpush(key, JSON.stringify(item));
      }

      await pipeline.exec();

      this.logger.debug('Returned failed items to Redis for retry', {
        key,
        itemCount: items.length,
      });
    } catch (error) {
      this.logger.error('Failed to return items to Redis:', {
        error: error.message,
        key,
        itemCount: items.length,
      });
    }
  }

  /**
   * Insert impression batch into PostgreSQL
   * (Same as before - no changes needed)
   */
  private async insertImpressionBatch(
    impressions: ImpressionData[],
  ): Promise<number> {
    try {
      this.logger.debug('Inserting impression batch', {
        impressions,
        count: impressions.length,
      });

      // Transform Redis data to PostgreSQL format
      const impressionData = impressions.map((impression) => ({
        id: impression.id || uuidv4(),
        creativeId: impression.creativeId,
        campaignId: impression.campaignId,
        inventoryId: impression.inventoryId,
        publisherId: impression.publisherId,
        advertiserId: impression.advertiserId,
        bidResponseId: impression.bidResponseId,
        websiteId: impression.websiteId,
        templateId: impression.templateId || null,
        timestamp: impression.timestamp
          ? new Date(impression.timestamp)
          : new Date(),
        userAgent: impression.userAgent || null,
        ipAddress: impression.ipAddress || null,
        deviceType: impression.deviceType || null,
        country: impression.country || null,
        region: impression.region || null,
        city: impression.city || null,
        viewable: impression.viewable || false,
        viewTime: impression.viewTime
          ? parseInt(impression.viewTime.toString())
          : null,
        isBot: impression.isBot || false,
        fraudScore: impression.fraudScore
          ? parseFloat(impression.fraudScore.toString())
          : 0,
        syncedToTimescale: false,
        slotId: impression.slotId || null,
        userFingerprint: impression.userFingerprint || null,
        bidPrice: impression.bidPrice
          ? parseFloat(impression.bidPrice.toString())
          : 0,
        finalPrice: impression.finalPrice
          ? parseFloat(impression.finalPrice.toString())
          : 0,
        createdAt: new Date(),
      }));

      // Use Prisma's createMany for batch insert
      const result = await this.prisma.impressionEvent.createMany({
        data: impressionData,
        skipDuplicates: true, // Skip if ID already exists
      });

      return result.count;
    } catch (error) {
      this.logger.error('Failed to insert impression batch:', error);
      throw error;
    }
  }

  /**
   * Insert click batch into PostgreSQL
   * (Same as before - no changes needed)
   */
  private async insertClickBatch(clicks: ClickData[]): Promise<number> {
    try {
      this.logger.debug('Inserting click batch', {
        clicks,
        count: clicks.length,
      });

      // Transform Redis data to PostgreSQL format
      const clickData = clicks.map((click) => ({
        id: click.id || uuidv4(),
        impressionId: click.impressionId,
        creativeId: click.creativeId,
        campaignId: click.campaignId,
        inventoryId: click.inventoryId,
        publisherId: click.publisherId,
        advertiserId: click.advertiserId,
        bidResponseId: click.bidResponseId || null,
        websiteId: click.websiteId || null,
        templateId: click.templateId || null,
        landingUrl: click.landingUrl || null,
        timeFromImpression: click.timeFromImpression
          ? parseInt(click.timeFromImpression.toString())
          : null,
        timestamp: click.timestamp ? new Date(click.timestamp) : new Date(),
        userAgent: click.userAgent || null,
        ipAddress: click.ipAddress || null,
        deviceType: click.deviceType || null,
        country: click.country || null,
        region: click.region || null,
        city: click.city || null,
        isBot: click.isBot || false,
        fraudScore: click.fraudScore
          ? parseFloat(click.fraudScore.toString())
          : null,
        syncedToTimescale: false,
        slotId: click.slotId || null,
        userFingerprint: click.userFingerprint || null,
        createdAt: new Date(),
      }));

      // Use Prisma's createMany for batch insert
      const result = await this.prisma.clickEvent.createMany({
        data: clickData,
        skipDuplicates: true, // Skip if ID already exists
      });

      return result.count;
    } catch (error) {
      this.logger.error('Failed to insert click batch:', error);
      throw error;
    }
  }

  /**
   * Update sync metrics
   * (Same as before - no changes needed)
   */
  private updateSyncMetrics(
    processingTime: number,
    processedCount: number,
    hasError: boolean,
  ): void {
    this.syncMetrics.totalProcessed += processedCount;
    this.syncMetrics.lastSyncTime = new Date();

    if (hasError) {
      this.syncMetrics.totalErrors++;
    }

    // Update average processing time (rolling average)
    const currentAvg = this.syncMetrics.averageProcessingTime;
    const totalRecords = this.syncMetrics.totalProcessed;

    if (totalRecords > 0) {
      this.syncMetrics.averageProcessingTime =
        (currentAvg * (totalRecords - processedCount) + processingTime) /
        totalRecords;
    }

    // Track batch sizes for optimization
    if (processedCount > 0) {
      this.syncMetrics.batchSizes.push(processedCount);
      // Keep only last 100 batch sizes
      if (this.syncMetrics.batchSizes.length > 100) {
        this.syncMetrics.batchSizes = this.syncMetrics.batchSizes.slice(-100);
      }
    }
  }

  /**
   * Update Redis metrics
   * (Same as before - no changes needed)
   */
  private async updateRedisMetrics(
    eventType: 'impressions' | 'clicks',
    processedCount: number,
    processingTime: number,
  ): Promise<void> {
    try {
      const now = new Date();
      const hour = now.toISOString().substring(0, 13); // YYYY-MM-DDTHH

      const pipeline = this.redis.pipeline();

      // Update sync metrics
      pipeline.incr(`sync:${eventType}:processed:${hour}`);
      pipeline.incrby(`sync:${eventType}:count:${hour}`, processedCount);
      pipeline.set(`sync:${eventType}:last_processing_time`, processingTime);
      pipeline.set(`sync:${eventType}:last_sync_time`, now.toISOString());

      // Set expiration (keep for 24 hours)
      pipeline.expire(`sync:${eventType}:processed:${hour}`, 86400);
      pipeline.expire(`sync:${eventType}:count:${hour}`, 86400);
      pipeline.expire(`sync:${eventType}:last_processing_time`, 86400);
      pipeline.expire(`sync:${eventType}:last_sync_time`, 86400);

      await pipeline.exec();
    } catch (error) {
      this.logger.error('Failed to update Redis metrics:', error);
    }
  }

  /**
   * Get sync metrics for monitoring
   */
  async getSyncMetrics(): Promise<SyncMetrics> {
    return { ...this.syncMetrics };
  }

  /**
   * Manual sync trigger for testing/recovery
   */
  async triggerManualSync(): Promise<{ impressions: number; clicks: number }> {
    this.logger.debug('🔄 Manual sync triggered');

    const impressionsStart = Date.now();
    await this.syncImpressionsOnly();

    const clicksStart = Date.now();
    await this.syncClicksOnly();

    return {
      impressions: Date.now() - impressionsStart,
      clicks: Date.now() - clicksStart,
    };
  }

  /**
   * Get pending counts for monitoring
   */
  async getPendingCounts(): Promise<{ impressions: number; clicks: number }> {
    try {
      const [impressionsCount, clicksCount] = await Promise.all([
        this.redis.llen(REDIS_KEYS.PENDING_IMPRESSIONS),
        this.redis.llen(REDIS_KEYS.PENDING_CLICKS),
      ]);

      return {
        impressions: impressionsCount,
        clicks: clicksCount,
      };
    } catch (error) {
      this.logger.error('Failed to get pending counts:', error);
      return { impressions: 0, clicks: 0 };
    }
  }
}
