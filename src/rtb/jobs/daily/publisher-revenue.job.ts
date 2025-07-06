// src/rtb/jobs/daily/publisher-revenue.job.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisService } from 'src/redis/redis.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { REDIS_KEYS } from 'src/rtb/constants/cache-keys';

@Injectable()
export class PublisherRevenueJob {
  private readonly logger = new Logger(PublisherRevenueJob.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Process publisher revenue data from Redis to PostgreSQL
   * Runs daily at midnight
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processPublisherRevenue(): Promise<void> {
    const startTime = Date.now();
    const batchId = uuidv4();

    this.logger.log('🚀 Starting daily publisher revenue processing', {
      batchId,
      timestamp: new Date().toISOString(),
    });

    try {
      // ===== 1. PROCESS PENDING PUBLISHER REVENUE =====
      const revenueCount = await this.processPendingRevenue(batchId);

      // ===== 2. SYNC DAILY REVENUE AGGREGATIONS =====
      const dailyCount = await this.syncDailyRevenue(batchId, false);

      const processingTime = Date.now() - startTime;

      this.logger.log('✅ Publisher revenue processing completed', {
        batchId,
        revenueRecordsProcessed: revenueCount,
        dailyRecordsProcessed: dailyCount,
        processingTimeMs: processingTime,
      });

      // ===== 3. UPDATE PROCESSING METRICS =====
      // await this.updateProcessingMetrics(
      //   revenueCount,
      //   dailyCount,
      //   processingTime,
      // );
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('❌ Publisher revenue processing failed', {
        error: error.message,
        batchId,
        processingTimeMs: processingTime,
      });

      // Record failure metrics
      // await this.recordFailureMetrics(error.message);
    }
  }

  /**
   * Process pending publisher revenue records from Redis
   */
  private async processPendingRevenue(batchId: string): Promise<number> {
    let totalProcessed = 0;
    const chunkSize = 500; // Process in chunks

    this.logger.debug('Processing pending publisher revenue', { batchId });

    try {
      while (true) {
        // Get chunk of pending revenue records
        const chunk = await this.redis.lpop(
          REDIS_KEYS.PUBLISHER_REVENUE_PENDING,
          chunkSize,
        );

        if (!chunk || chunk.length === 0) {
          this.logger.debug('No more pending publisher revenue records');
          break; // exit loop if no more records
        }

        // Parse and validate records
        const validRecords = chunk
          .map((item: string) => {
            try {
              return JSON.parse(item);
            } catch (parseError) {
              this.logger.warn('Failed to parse publisher revenue record', {
                data: item,
                error: parseError.message,
              });
              return null;
            }
          })
          .filter(Boolean);

        if (validRecords.length === 0) {
          continue;
        }

        // Transform data for PostgreSQL
        const revenueData = validRecords.map((record) => ({
          publisherId: record.publisherId,
          campaignId: record.campaignId,
          inventoryId: record.inventoryId,
          websiteId: record.websiteId,
          grossRevenue: record.grossRevenue,
          commissionRate: record.commissionRate,
          netRevenue: record.netRevenue,
          eventType: record.eventType,
          createdAt: new Date(record.createdAt),
        }));

        // Batch insert to PostgreSQL
        const result = await this.prisma.publisherRevenue.createMany({
          data: revenueData,
          skipDuplicates: true,
        });

        totalProcessed += result.count;

        this.logger.debug('Publisher revenue chunk processed', {
          batchId,
          chunkSize: validRecords.length,
          inserted: result.count,
          totalProcessed,
        });

        // Small delay to prevent database overload
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      return totalProcessed;
    } catch (error) {
      this.logger.error('Failed to process pending publisher revenue', {
        error: error.message,
        batchId,
        totalProcessed,
      });
      throw error;
    }
  }

  /**
   * Sync daily publisher revenue aggregations
   */
  private async syncDailyRevenue(
    batchId: string,
    isManual: boolean,
  ): Promise<number> {
    const yesterday = new Date();
    if (!isManual) {
      yesterday.setDate(yesterday.getDate() - 1);
    }
    const dateStr = yesterday.toISOString().split('T')[0];

    this.logger.debug('Syncing daily publisher revenue aggregations', {
      batchId,
      date: dateStr,
    });

    try {
      const dailyKeys = await this.redis.keys(`publisher:daily:*:${dateStr}`);

      if (dailyKeys.length === 0) {
        this.logger.debug('No daily publisher revenue data found', {
          date: dateStr,
        });
        return 0;
      }

      let processedCount = 0;

      for (const key of dailyKeys) {
        try {
          const keyParts = key.split(':');
          if (keyParts.length !== 4) {
            this.logger.warn('Invalid daily key format', { key });
            continue;
          }

          const publisherId = keyParts[2];

          // 🔧 FIX: Use hgetall instead of smembers
          const dailyData = await this.redis.hgetall(key);

          if (!dailyData || Object.keys(dailyData).length === 0) {
            continue;
          }

          // Parse daily data
          const totalImpressions = parseInt(
            dailyData['totalImpressions'] || '0',
          );
          const totalClicks = parseInt(dailyData['totalClicks'] || '0');
          const grossRevenue = parseFloat(dailyData['grossRevenue'] || '0');
          const netRevenue = parseFloat(dailyData['netRevenue'] || '0');
          const commissionPaid = parseFloat(dailyData['commissionPaid'] || '0');

          // Upsert daily revenue record
          await this.prisma.publisherDailyRevenue.upsert({
            where: {
              publisherId_date: {
                publisherId,
                date: yesterday,
              },
            },
            create: {
              id: uuidv4(),
              publisherId,
              date: yesterday,
              totalImpressions,
              totalClicks,
              grossRevenue,
              netRevenue,
              commissionPaid,
              lastUpdated: new Date(),
            },
            update: {
              totalImpressions,
              totalClicks,
              grossRevenue,
              netRevenue,
              commissionPaid,
              lastUpdated: new Date(),
            },
          });

          processedCount++;

          // Clean up processed Redis key
          await this.redis.del(key);

          this.logger.debug('Daily publisher revenue synced', {
            publisherId,
            date: dateStr,
            totalImpressions,
            totalClicks,
            grossRevenue,
            netRevenue,
          });
        } catch (error) {
          this.logger.error('Failed to sync daily revenue for publisher', {
            error: error.message,
            key,
            batchId,
          });
        }
      }

      return processedCount;
    } catch (error) {
      this.logger.error('Failed to sync daily publisher revenue', {
        error: error.message,
        batchId,
        date: dateStr,
      });
      throw error;
    }
  }

  /**
   * Update processing metrics in Redis
   */
  private async updateProcessingMetrics(
    revenueCount: number,
    dailyCount: number,
    processingTime: number,
  ): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const pipeline = this.redis.pipeline();

      // Update job metrics
      pipeline.setex(
        `job:publisher-revenue:last-run:${today}`,
        86400 * 7, // 7 days
        new Date().toISOString(),
      );

      pipeline.setex(
        `job:publisher-revenue:records-processed:${today}`,
        86400 * 7,
        revenueCount.toString(),
      );

      pipeline.setex(
        `job:publisher-revenue:daily-records:${today}`,
        86400 * 7,
        dailyCount.toString(),
      );

      pipeline.setex(
        `job:publisher-revenue:processing-time:${today}`,
        86400 * 7,
        processingTime.toString(),
      );

      pipeline.incr(`job:publisher-revenue:success-count:${today}`);
      pipeline.expire(
        `job:publisher-revenue:success-count:${today}`,
        86400 * 7,
      );

      await pipeline.exec();
    } catch (error) {
      this.logger.warn('Failed to update processing metrics', {
        error: error.message,
      });
    }
  }

  /**
   * Record failure metrics
   */
  private async recordFailureMetrics(errorMessage: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const pipeline = this.redis.pipeline();

      pipeline.incr(`job:publisher-revenue:failure-count:${today}`);
      pipeline.expire(
        `job:publisher-revenue:failure-count:${today}`,
        86400 * 7,
      );

      pipeline.lpush(
        `job:publisher-revenue:recent-errors`,
        JSON.stringify({
          error: errorMessage,
          timestamp: new Date().toISOString(),
        }),
      );
      pipeline.ltrim(`job:publisher-revenue:recent-errors`, 0, 99); // Keep last 100 errors
      pipeline.expire(`job:publisher-revenue:recent-errors`, 86400 * 7);

      await pipeline.exec();
    } catch (error) {
      this.logger.warn('Failed to record failure metrics', {
        error: error.message,
      });
    }
  }

  /**
   * Manual trigger for publisher revenue processing
   * Useful for testing or emergency processing
   */
  async triggerManualProcessing(): Promise<{
    success: boolean;
    revenueProcessed: number;
    dailyProcessed: number;
    processingTime: number;
  }> {
    const startTime = Date.now();
    const batchId = `manual-${uuidv4()}`;

    try {
      this.logger.log('🔄 Manual publisher revenue processing triggered', {
        batchId,
      });

      const revenueCount = await this.processPendingRevenue(batchId);
      const dailyCount = await this.syncDailyRevenue(batchId, true);
      const processingTime = Date.now() - startTime;

      return {
        success: true,
        revenueProcessed: revenueCount,
        dailyProcessed: dailyCount,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('Manual publisher revenue processing failed', {
        error: error.message,
        batchId,
      });

      return {
        success: false,
        revenueProcessed: 0,
        dailyProcessed: 0,
        processingTime,
      };
    }
  }

  /**
   * Get processing status and metrics
   */
  async getProcessingStatus(): Promise<{
    lastRun?: string;
    pendingRecords: number;
    todayProcessed: number;
    todayDailyRecords: number;
    successCount: number;
    failureCount: number;
    // recentErrors: any[];
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [
        lastRun,
        pendingRecords,
        todayProcessed,
        todayDailyRecords,
        successCount,
        failureCount,
        // recentErrors,
      ] = await Promise.all([
        this.redis.get(`job:publisher-revenue:last-run:${today}`),
        this.redis.llen('publisher:revenue:pending'),
        this.redis.get(`job:publisher-revenue:records-processed:${today}`),
        this.redis.get(`job:publisher-revenue:daily-records:${today}`),
        this.redis.get(`job:publisher-revenue:success-count:${today}`),
        this.redis.get(`job:publisher-revenue:failure-count:${today}`),
        // this.redis.lrange(`job:publisher-revenue:recent-errors`, 0, 4), // Last 5 errors
      ]);

      return {
        lastRun: lastRun as string,
        pendingRecords,
        todayProcessed: parseInt(todayProcessed as string) || 0,
        todayDailyRecords: parseInt(todayDailyRecords as string) || 0,
        successCount: parseInt(successCount as string) || 0,
        failureCount: parseInt(failureCount as string) || 0,
        // recentErrors: recentErrors.map((error) => {
        //   try {
        //     return JSON.parse(error);
        //   } catch {
        //     return { error, timestamp: 'unknown' };
        //   }
        // }),
      };
    } catch (error) {
      this.logger.error('Failed to get processing status', {
        error: error.message,
      });

      return {
        pendingRecords: 0,
        todayProcessed: 0,
        todayDailyRecords: 0,
        successCount: 0,
        failureCount: 0,
        // recentErrors: [],
      };
    }
  }
}
