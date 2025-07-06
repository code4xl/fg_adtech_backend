// src/rtb/jobs/daily/advertiser-spending.job.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RedisService } from 'src/redis/redis.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { REDIS_KEYS } from 'src/rtb/constants/cache-keys';

@Injectable()
export class AdvertiserSpendingJob {
  private readonly logger = new Logger(AdvertiserSpendingJob.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Process advertiser spending data from Redis to PostgreSQL
   * Runs daily at 1:05 AM IST (5 minutes after publisher revenue job)
   */
  @Cron('5 1 * * *', {
    name: 'processAdvertiserSpending',
    timeZone: 'Asia/Kolkata', // Set to Indian Standard Time
  })
  async processAdvertiserSpending(): Promise<void> {
    const startTime = Date.now();
    const batchId = uuidv4();

    this.logger.debug('🚀 Starting daily advertiser spending processing', {
      batchId,
      timestamp: new Date().toISOString(),
    });

    try {
      // ===== 1. PROCESS PENDING ADVERTISER SPENDING =====
      const spendingCount = await this.processPendingSpending(batchId);

      // ===== 2. SYNC DAILY SPENDING AGGREGATIONS =====
      const dailyCount = await this.syncDailySpending(batchId, false);

      // ===== 3. PROCESS BUDGET TRANSACTIONS =====
      const transactionCount = await this.processBudgetTransactions(batchId);

      const processingTime = Date.now() - startTime;

      this.logger.debug(' Advertiser spending processing completed', {
        batchId,
        spendingRecordsProcessed: spendingCount,
        dailyRecordsProcessed: dailyCount,
        budgetTransactionsProcessed: transactionCount,
        processingTimeMs: processingTime,
      });

      // ===== 4. UPDATE PROCESSING METRICS =====
      // await this.updateProcessingMetrics(
      //   spendingCount,
      //   dailyCount,
      //   transactionCount,
      //   processingTime,
      // );
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('❌ Advertiser spending processing failed', {
        error: error.message,
        batchId,
        processingTimeMs: processingTime,
      });

      // Record failure metrics
      // await this.recordFailureMetrics(error.message);
    }
  }

  /**
   * Process pending advertiser spending records from Redis
   */
  private async processPendingSpending(batchId: string): Promise<number> {
    let totalProcessed = 0;
    const chunkSize = 500; // Process in chunks

    this.logger.debug('Processing pending advertiser spending', { batchId });

    try {
      while (true) {
        // Get chunk of pending spending records
        const chunk = await this.redis.lpop(
          REDIS_KEYS.ADVERTISER_SPENDING_PENDING,
          chunkSize,
        );

        if (!chunk || chunk.length === 0) {
          this.logger.debug('No more pending advertiser spending records');
          break;
        }

        // Parse and validate records
        const validRecords = chunk
          .map((item: string) => {
            try {
              return JSON.parse(item);
            } catch (parseError) {
              this.logger.warn('Failed to parse advertiser spending record', {
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
        const spendingData = validRecords.map((record) => ({
          id: uuidv4(),
          advertiserId: record.advertiserId,
          campaignId: record.campaignId,
          creativeId: record.creativeId,
          amount: record.amount,
          eventType: record.eventType,
          createdAt: new Date(record.createdAt),
        }));

        // Batch insert to PostgreSQL
        const result = await this.prisma.advertiserSpending.createMany({
          data: spendingData,
          skipDuplicates: true,
        });

        totalProcessed += result.count;

        this.logger.debug('Advertiser spending chunk processed', {
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
      this.logger.error('Failed to process pending advertiser spending', {
        error: error.message,
        batchId,
        totalProcessed,
      });
      throw error;
    }
  }

  /**
   * Sync daily advertiser spending aggregations
   */
  private async syncDailySpending(
    batchId: string,
    isManual: boolean,
  ): Promise<number> {
    const yesterday = new Date();
    if (!isManual) {
      yesterday.setDate(yesterday.getDate() - 1);
    }
    const dateStr = yesterday.toISOString().split('T')[0];

    this.logger.debug('Syncing daily advertiser spending aggregations', {
      batchId,
      date: dateStr,
    });

    try {
      const dailyKeys = await this.redis.keys(
        `advertiser:daily:*:*:${dateStr}`,
      );

      if (dailyKeys.length === 0) {
        this.logger.debug('No daily advertiser spending data found', {
          date: dateStr,
        });
        return 0;
      }

      let processedCount = 0;

      for (const key of dailyKeys) {
        try {
          const keyParts = key.split(':');
          if (keyParts.length !== 5) {
            this.logger.warn('Invalid daily key format', { key });
            continue;
          }

          const advertiserId = keyParts[2];
          const campaignId = keyParts[3];

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
          const totalSpend = parseFloat(dailyData['totalSpend'] || '0');

          // Upsert daily spending record
          await this.prisma.advertiserDailySpending.upsert({
            where: {
              advertiserId_campaignId_date: {
                advertiserId,
                campaignId,
                date: yesterday,
              },
            },
            create: {
              id: uuidv4(),
              advertiserId,
              campaignId,
              date: yesterday,
              totalImpressions,
              totalClicks,
              totalSpend,
              lastUpdated: new Date(),
            },
            update: {
              totalImpressions,
              totalClicks,
              totalSpend,
              lastUpdated: new Date(),
            },
          });

          processedCount++;

          // Clean up processed Redis key
          await this.redis.del(key);

          this.logger.debug('Daily advertiser spending synced', {
            advertiserId,
            campaignId,
            date: dateStr,
            totalImpressions,
            totalClicks,
            totalSpend,
          });
        } catch (advertiserError) {
          this.logger.error('Failed to sync daily spending for advertiser', {
            error: advertiserError.message,
            key,
            batchId,
          });
        }
      }

      return processedCount;
    } catch (error) {
      this.logger.error('Failed to sync daily advertiser spending', {
        error: error.message,
        batchId,
        date: dateStr,
      });
      throw error;
    }
  }

  /**
   * Process budget transactions from Redis to PostgreSQL
   */
  private async processBudgetTransactions(batchId: string): Promise<number> {
    let totalProcessed = 0;
    const chunkSize = 500;

    this.logger.debug('Processing pending budget transactions', { batchId });

    try {
      while (true) {
        // Get chunk of pending budget transactions
        const chunk = await this.redis.lpop(
          REDIS_KEYS.BUDGET_TRANSACTION_PENDING,
          chunkSize,
        );

        if (!chunk || chunk.length === 0) {
          this.logger.debug('No more pending budget transactions');
          break;
        }

        // Parse and validate records
        const validRecords = chunk
          .map((item: string) => {
            try {
              return JSON.parse(item);
            } catch (parseError) {
              this.logger.warn('Failed to parse budget transaction record', {
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
        const transactionData = validRecords.map((record) => ({
          id: uuidv4(), //
          campaignId: record.campaignId, //
          type: record.type, //
          amount: record.amount, //
          description: record.description, //
          publisherId: record.publisherId,
          inventoryId: record.inventoryId,
          createdAt: new Date(record.createdAt),
        }));

        // Batch insert to PostgreSQL
        const result = await this.prisma.budgetTransaction.createMany({
          data: transactionData,
          skipDuplicates: true,
        });

        totalProcessed += result.count;

        this.logger.debug('Budget transactions chunk processed', {
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
      this.logger.error('Failed to process pending budget transactions', {
        error: error.message,
        batchId,
        totalProcessed,
      });
      throw error;
    }
  }

  /**
   * Update processing metrics in Redis
   */
  private async updateProcessingMetrics(
    spendingCount: number,
    dailyCount: number,
    transactionCount: number,
    processingTime: number,
  ): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const pipeline = this.redis.pipeline();

      // Update job metrics
      pipeline.setex(
        `job:advertiser-spending:last-run:${today}`,
        86400 * 7, // 7 days
        new Date().toISOString(),
      );

      pipeline.setex(
        `job:advertiser-spending:records-processed:${today}`,
        86400 * 7,
        spendingCount.toString(),
      );

      pipeline.setex(
        `job:advertiser-spending:daily-records:${today}`,
        86400 * 7,
        dailyCount.toString(),
      );

      pipeline.setex(
        `job:advertiser-spending:transactions:${today}`,
        86400 * 7,
        transactionCount.toString(),
      );

      pipeline.setex(
        `job:advertiser-spending:processing-time:${today}`,
        86400 * 7,
        processingTime.toString(),
      );

      pipeline.incr(`job:advertiser-spending:success-count:${today}`);
      pipeline.expire(
        `job:advertiser-spending:success-count:${today}`,
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

      pipeline.incr(`job:advertiser-spending:failure-count:${today}`);
      pipeline.expire(
        `job:advertiser-spending:failure-count:${today}`,
        86400 * 7,
      );

      pipeline.lpush(
        `job:advertiser-spending:recent-errors`,
        JSON.stringify({
          error: errorMessage,
          timestamp: new Date().toISOString(),
        }),
      );
      pipeline.ltrim(`job:advertiser-spending:recent-errors`, 0, 99);
      pipeline.expire(`job:advertiser-spending:recent-errors`, 86400 * 7);

      await pipeline.exec();
    } catch (error) {
      this.logger.warn('Failed to record failure metrics', {
        error: error.message,
      });
    }
  }

  /**
   * Manual trigger for advertiser spending processing
   */
  async triggerManualProcessing(): Promise<{
    success: boolean;
    spendingProcessed: number;
    dailyProcessed: number;
    transactionsProcessed: number;
    processingTime: number;
  }> {
    const startTime = Date.now();
    const batchId = `manual-${uuidv4()}`;

    try {
      this.logger.debug('🔄 Manual advertiser spending processing triggered', {
        batchId,
      });

      const spendingCount = await this.processPendingSpending(batchId);
      const dailyCount = await this.syncDailySpending(batchId, true);
      const transactionCount = await this.processBudgetTransactions(batchId);
      const processingTime = Date.now() - startTime;

      return {
        success: true,
        spendingProcessed: spendingCount,
        dailyProcessed: dailyCount,
        transactionsProcessed: transactionCount,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('Manual advertiser spending processing failed', {
        error: error.message,
        batchId,
      });

      return {
        success: false,
        spendingProcessed: 0,
        dailyProcessed: 0,
        transactionsProcessed: 0,
        processingTime,
      };
    }
  }

  /**
   * Get processing status and metrics
   */
  async getProcessingStatus(): Promise<{
    lastRun?: string;
    pendingSpending: number;
    pendingTransactions: number;
    todaySpendingProcessed: number;
    todayDailyRecords: number;
    todayTransactions: number;
    successCount: number;
    failureCount: number;
    // recentErrors: any[];
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [
        lastRun,
        pendingSpending,
        pendingTransactions,
        todaySpendingProcessed,
        todayDailyRecords,
        todayTransactions,
        successCount,
        failureCount,
        // recentErrors,
      ] = await Promise.all([
        this.redis.get(`job:advertiser-spending:last-run:${today}`),
        this.redis.llen('advertiser:spending:pending'),
        this.redis.llen('budget:transactions:pending'),
        this.redis.get(`job:advertiser-spending:records-processed:${today}`),
        this.redis.get(`job:advertiser-spending:daily-records:${today}`),
        this.redis.get(`job:advertiser-spending:transactions:${today}`),
        this.redis.get(`job:advertiser-spending:success-count:${today}`),
        this.redis.get(`job:advertiser-spending:failure-count:${today}`),
        // this.redis.lrange(`job:advertiser-spending:recent-errors`, 0, 4),
      ]);

      return {
        lastRun: lastRun as string,
        pendingSpending,
        pendingTransactions,
        todaySpendingProcessed: parseInt(todaySpendingProcessed as string) || 0,
        todayDailyRecords: parseInt(todayDailyRecords as string) || 0,
        todayTransactions: parseInt(todayTransactions as string) || 0,
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
        pendingSpending: 0,
        pendingTransactions: 0,
        todaySpendingProcessed: 0,
        todayDailyRecords: 0,
        todayTransactions: 0,
        successCount: 0,
        failureCount: 0,
        // recentErrors: [],
      };
    }
  }
}
