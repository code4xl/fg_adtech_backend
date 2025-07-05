// src/rtb/jobs/daily/system-revenue.job.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisService } from 'src/redis/redis.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { CLICK_AND_IMPRESSION_KEYS } from 'src/rtb/constants/cache-keys';

@Injectable()
export class SystemRevenueJob {
  private readonly logger = new Logger(SystemRevenueJob.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Process system revenue data from Redis to PostgreSQL
   * Runs daily at 12:10 AM (after publisher and advertiser jobs)
   */
  @Cron('10 0 * * *') // 12:10 AM daily
  async processSystemRevenue(): Promise<void> {
    const startTime = Date.now();
    const batchId = uuidv4();

    this.logger.log('🚀 Starting daily system revenue processing', {
      batchId,
      timestamp: new Date().toISOString(),
    });

    try {
      // ===== 1. PROCESS PENDING SYSTEM REVENUE =====
      const revenueCount = await this.processPendingSystemRevenue(batchId);

      // ===== 2. SYNC DAILY SYSTEM REVENUE AGGREGATIONS =====
      const dailyCount = await this.syncDailySystemRevenue(batchId, false);

      // ===== 3. UPDATE SYSTEM HEALTH METRICS =====
      // await this.updateSystemHealthMetrics(batchId);

      const processingTime = Date.now() - startTime;

      this.logger.log('✅ System revenue processing completed', {
        batchId,
        revenueRecordsProcessed: revenueCount,
        dailyRecordsProcessed: dailyCount,
        processingTimeMs: processingTime,
      });

      // ===== 4. UPDATE PROCESSING METRICS =====
      // await this.updateProcessingMetrics(
      //   revenueCount,
      //   dailyCount,
      //   processingTime,
      // );
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('❌ System revenue processing failed', {
        error: error.message,
        batchId,
        processingTimeMs: processingTime,
      });

      // Record failure metrics
      // await this.recordFailureMetrics(error.message);
    }
  }

  /**
   * Process pending system revenue records from Redis
   */
  private async processPendingSystemRevenue(batchId: string): Promise<number> {
    let totalProcessed = 0;
    const chunkSize = 500; // Process in chunks

    this.logger.debug('Processing pending system revenue', { batchId });

    try {
      while (true) {
        // Get chunk of pending system revenue records
        const chunk = await this.redis.lpop(
          CLICK_AND_IMPRESSION_KEYS.SYSTEM_REVENUE_PENDING,
          chunkSize,
        );

        if (!chunk || chunk.length === 0) {
          this.logger.debug('No more pending system revenue records');
          break;
        }

        // Parse and validate records
        const validRecords = chunk
          .map((item: string) => {
            try {
              return JSON.parse(item);
            } catch (parseError) {
              this.logger.warn('Failed to parse system revenue record', {
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
          id: uuidv4(),
          campaignId: record.campaignId,
          publisherId: record.publisherId,
          advertiserId: record.advertiserId,
          creativeId: record.creativeId,
          inventoryId: record.inventoryId,
          grossRevenue: record.grossRevenue,
          publisherShare: record.publisherShare,
          systemEarning: record.systemEarning,
          commissionRate: record.commissionRate,
          eventType: record.eventType,
          createdAt: new Date(record.createdAt),
        }));

        // Batch insert to PostgreSQL
        const result = await this.prisma.systemRevenue.createMany({
          data: revenueData,
          skipDuplicates: true,
        });

        totalProcessed += result.count;

        this.logger.debug('System revenue chunk processed', {
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
      this.logger.error('Failed to process pending system revenue', {
        error: error.message,
        batchId,
        totalProcessed,
      });
      throw error;
    }
  }

  /**
   * Sync daily system revenue aggregations
   */
  private async syncDailySystemRevenue(
    batchId: string,
    isManual: boolean,
  ): Promise<number> {
    const yesterday = new Date();
    if (!isManual) {
      yesterday.setDate(yesterday.getDate() - 1);
    }
    const dateStr = yesterday.toISOString().split('T')[0];

    this.logger.debug('Syncing daily system revenue aggregations', {
      batchId,
      date: dateStr,
    });

    try {
      const systemDailyKey =
        CLICK_AND_IMPRESSION_KEYS.SYSTEM_REVENUE_DAILY(dateStr);

      // 🔧 FIX: Use hgetall instead of smembers
      const dailyData = await this.redis.hgetall(systemDailyKey);

      if (!dailyData || Object.keys(dailyData).length === 0) {
        this.logger.debug('No daily system revenue data found', {
          date: dateStr,
        });
        return 0;
      }

      // Parse daily data
      const totalImpressions = parseInt(dailyData['totalImpressions'] || '0');
      const totalClicks = parseInt(dailyData['totalClicks'] || '0');
      const totalGrossRevenue = parseFloat(
        dailyData['totalGrossRevenue'] || '0',
      );
      const totalCommissionEarned = parseFloat(
        dailyData['totalCommissionEarned'] || '0',
      );
      const totalPublisherPayout = parseFloat(
        dailyData['totalPublisherPayout'] || '0',
      );

      // Get additional metrics from database for enrichment
      const [activeCampaigns, activePublishers, activeAdvertisers] =
        await Promise.all([
          this.getActiveCampaignsCount(yesterday),
          this.getActivePublishersCount(yesterday),
          this.getActiveAdvertisersCount(yesterday),
        ]);

      // Upsert daily system revenue record
      await this.prisma.systemDailyRevenue.upsert({
        where: {
          date: yesterday,
        },
        create: {
          id: uuidv4(),
          date: yesterday,
          totalImpressions,
          totalClicks,
          totalGrossRevenue,
          totalCommissionEarned,
          totalPublisherPayout,
          activeCampaigns,
          activePublishers,
          activeAdvertisers,
          lastUpdated: new Date(),
        },
        update: {
          totalImpressions,
          totalClicks,
          totalGrossRevenue,
          totalCommissionEarned,
          totalPublisherPayout,
          activeCampaigns,
          activePublishers,
          activeAdvertisers,
          lastUpdated: new Date(),
        },
      });

      // Clean up processed Redis key
      await this.redis.del(systemDailyKey);

      this.logger.log('Daily system revenue synced', {
        date: dateStr,
        totalImpressions,
        totalClicks,
        totalGrossRevenue,
        totalCommissionEarned,
        totalPublisherPayout,
        activeCampaigns,
        activePublishers,
        activeAdvertisers,
      });

      return 1;
    } catch (error) {
      this.logger.error('Failed to sync daily system revenue', {
        error: error.message,
        batchId,
        date: dateStr,
      });
      throw error;
    }
  }

  /**
   * Get count of active campaigns for the date
   */
  private async getActiveCampaignsCount(date: Date): Promise<number> {
    try {
      const count = await this.prisma.campaign.count({
        where: {
          status: 'ACTIVE',
          startDate: { lte: date },
          endDate: { gte: date },
        },
      });

      return count;
    } catch (error) {
      this.logger.warn('Failed to get active campaigns count', {
        error: error.message,
        date,
      });
      return 0;
    }
  }

  /**
   * Get count of active publishers for the date
   */
  private async getActivePublishersCount(date: Date): Promise<number> {
    try {
      // Count publishers who had revenue on this date
      const count = await this.prisma.publisherRevenue.findMany({
        where: {
          createdAt: {
            gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
            lt: new Date(
              date.getFullYear(),
              date.getMonth(),
              date.getDate() + 1,
            ),
          },
        },
        select: {
          publisherId: true,
        },
        distinct: ['publisherId'],
      });

      return count.length;
    } catch (error) {
      this.logger.warn('Failed to get active publishers count', {
        error: error.message,
        date,
      });
      return 0;
    }
  }

  /**
   * Get count of active advertisers for the date
   */
  private async getActiveAdvertisersCount(date: Date): Promise<number> {
    try {
      // Count advertisers who had spending on this date
      const count = await this.prisma.advertiserSpending.findMany({
        where: {
          createdAt: {
            gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
            lt: new Date(
              date.getFullYear(),
              date.getMonth(),
              date.getDate() + 1,
            ),
          },
        },
        select: {
          advertiserId: true,
        },
        distinct: ['advertiserId'],
      });

      return count.length;
    } catch (error) {
      this.logger.warn('Failed to get active advertisers count', {
        error: error.message,
        date,
      });
      return 0;
    }
  }

  /**
   * Update system health metrics
   */
  private async updateSystemHealthMetrics(batchId: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get pending counts across all queues
      const [
        pendingImpressions,
        pendingClicks,
        pendingPublisherRevenue,
        pendingAdvertiserSpending,
        pendingSystemRevenue,
        pendingBudgetTransactions,
      ] = await Promise.all([
        this.redis.llen('events:impressions:pending'),
        this.redis.llen('events:clicks:pending'),
        this.redis.llen('publisher:revenue:pending'),
        this.redis.llen('advertiser:spending:pending'),
        this.redis.llen('system:revenue:pending'),
        this.redis.llen('budget:transactions:pending'),
      ]);

      // Calculate system health score (0-100)
      const totalPending =
        pendingImpressions +
        pendingClicks +
        pendingPublisherRevenue +
        pendingAdvertiserSpending +
        pendingSystemRevenue +
        pendingBudgetTransactions;

      let healthScore = 100;
      if (totalPending > 10000) healthScore = 60; // Warning level
      if (totalPending > 50000) healthScore = 30; // Critical level
      if (totalPending > 100000) healthScore = 10; // Emergency level

      // Update health metrics in Redis
      const pipeline = this.redis.pipeline();

      pipeline.setex(
        `system:health:score:${today}`,
        86400,
        healthScore.toString(),
      );
      pipeline.setex(
        `system:health:pending-total:${today}`,
        86400,
        totalPending.toString(),
      );
      pipeline.setex(
        `system:health:last-check:${today}`,
        86400,
        new Date().toISOString(),
      );

      // Store individual queue lengths
      pipeline.setex(
        `system:health:pending-impressions:${today}`,
        86400,
        pendingImpressions.toString(),
      );
      pipeline.setex(
        `system:health:pending-clicks:${today}`,
        86400,
        pendingClicks.toString(),
      );
      pipeline.setex(
        `system:health:pending-publisher-revenue:${today}`,
        86400,
        pendingPublisherRevenue.toString(),
      );
      pipeline.setex(
        `system:health:pending-advertiser-spending:${today}`,
        86400,
        pendingAdvertiserSpending.toString(),
      );
      pipeline.setex(
        `system:health:pending-system-revenue:${today}`,
        86400,
        pendingSystemRevenue.toString(),
      );
      pipeline.setex(
        `system:health:pending-budget-transactions:${today}`,
        86400,
        pendingBudgetTransactions.toString(),
      );

      await pipeline.exec();

      this.logger.debug('System health metrics updated', {
        batchId,
        healthScore,
        totalPending,
        breakdown: {
          impressions: pendingImpressions,
          clicks: pendingClicks,
          publisherRevenue: pendingPublisherRevenue,
          advertiserSpending: pendingAdvertiserSpending,
          systemRevenue: pendingSystemRevenue,
          budgetTransactions: pendingBudgetTransactions,
        },
      });
    } catch (error) {
      this.logger.error('Failed to update system health metrics', {
        error: error.message,
        batchId,
      });
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
        `job:system-revenue:last-run:${today}`,
        86400 * 7, // 7 days
        new Date().toISOString(),
      );

      pipeline.setex(
        `job:system-revenue:records-processed:${today}`,
        86400 * 7,
        revenueCount.toString(),
      );

      pipeline.setex(
        `job:system-revenue:daily-records:${today}`,
        86400 * 7,
        dailyCount.toString(),
      );

      pipeline.setex(
        `job:system-revenue:processing-time:${today}`,
        86400 * 7,
        processingTime.toString(),
      );

      pipeline.incr(`job:system-revenue:success-count:${today}`);
      pipeline.expire(`job:system-revenue:success-count:${today}`, 86400 * 7);

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

      pipeline.incr(`job:system-revenue:failure-count:${today}`);
      pipeline.expire(`job:system-revenue:failure-count:${today}`, 86400 * 7);

      pipeline.lpush(
        `job:system-revenue:recent-errors`,
        JSON.stringify({
          error: errorMessage,
          timestamp: new Date().toISOString(),
        }),
      );
      pipeline.ltrim(`job:system-revenue:recent-errors`, 0, 99); // Keep last 100 errors
      pipeline.expire(`job:system-revenue:recent-errors`, 86400 * 7);

      await pipeline.exec();
    } catch (error) {
      this.logger.warn('Failed to record failure metrics', {
        error: error.message,
      });
    }
  }

  /**
   * Manual trigger for system revenue processing
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
      this.logger.log('🔄 Manual system revenue processing triggered', {
        batchId,
      });

      const revenueCount = await this.processPendingSystemRevenue(batchId);
      const dailyCount = await this.syncDailySystemRevenue(batchId, true);
      await this.updateSystemHealthMetrics(batchId);
      const processingTime = Date.now() - startTime;

      return {
        success: true,
        revenueProcessed: revenueCount,
        dailyProcessed: dailyCount,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('Manual system revenue processing failed', {
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
    systemHealth: {
      score: number;
      totalPending: number;
      breakdown: {
        impressions: number;
        clicks: number;
        publisherRevenue: number;
        advertiserSpending: number;
        systemRevenue: number;
        budgetTransactions: number;
      };
    };
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
        healthScore,
        totalPending,
        pendingImpressions,
        pendingClicks,
        pendingPublisherRevenue,
        pendingAdvertiserSpending,
        pendingSystemRevenue,
        pendingBudgetTransactions,
        // recentErrors,
      ] = await Promise.all([
        this.redis.get(`job:system-revenue:last-run:${today}`),
        this.redis.llen('system:revenue:pending'),
        this.redis.get(`job:system-revenue:records-processed:${today}`),
        this.redis.get(`job:system-revenue:daily-records:${today}`),
        this.redis.get(`job:system-revenue:success-count:${today}`),
        this.redis.get(`job:system-revenue:failure-count:${today}`),
        this.redis.get(`system:health:score:${today}`),
        this.redis.get(`system:health:pending-total:${today}`),
        this.redis.get(`system:health:pending-impressions:${today}`),
        this.redis.get(`system:health:pending-clicks:${today}`),
        this.redis.get(`system:health:pending-publisher-revenue:${today}`),
        this.redis.get(`system:health:pending-advertiser-spending:${today}`),
        this.redis.get(`system:health:pending-system-revenue:${today}`),
        this.redis.get(`system:health:pending-budget-transactions:${today}`),
        // this.redis.lrange(`job:system-revenue:recent-errors`, 0, 4), // Last 5 errors
      ]);

      return {
        lastRun: lastRun as string,
        pendingRecords,
        todayProcessed: parseInt(todayProcessed as string) || 0,
        todayDailyRecords: parseInt(todayDailyRecords as string) || 0,
        successCount: parseInt(successCount as string) || 0,
        failureCount: parseInt(failureCount as string) || 0,
        systemHealth: {
          score: parseInt(healthScore as string) || 100,
          totalPending: parseInt(totalPending as string) || 0,
          breakdown: {
            impressions: parseInt(pendingImpressions as string) || 0,
            clicks: parseInt(pendingClicks as string) || 0,
            publisherRevenue: parseInt(pendingPublisherRevenue as string) || 0,
            advertiserSpending:
              parseInt(pendingAdvertiserSpending as string) || 0,
            systemRevenue: parseInt(pendingSystemRevenue as string) || 0,
            budgetTransactions:
              parseInt(pendingBudgetTransactions as string) || 0,
          },
        },
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
        systemHealth: {
          score: 0,
          totalPending: 0,
          breakdown: {
            impressions: 0,
            clicks: 0,
            publisherRevenue: 0,
            advertiserSpending: 0,
            systemRevenue: 0,
            budgetTransactions: 0,
          },
        },
        // recentErrors: [],
      };
    }
  }

  /**
   * Get system revenue insights for dashboard
   */
  async getRevenueInsights(days: number = 30): Promise<{
    totalSystemEarnings: number;
    totalPublisherPayouts: number;
    averageDailyRevenue: number;
    topPerformingDays: any[];
    commissionTrends: any[];
  }> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get daily system revenue for the period
      const dailyRevenues = await this.prisma.systemDailyRevenue.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: {
          date: 'desc',
        },
      });

      if (dailyRevenues.length === 0) {
        return {
          totalSystemEarnings: 0,
          totalPublisherPayouts: 0,
          averageDailyRevenue: 0,
          topPerformingDays: [],
          commissionTrends: [],
        };
      }

      // Calculate totals
      const totalSystemEarnings = dailyRevenues.reduce(
        (sum, day) => sum + Number(day.totalCommissionEarned),
        0,
      );

      const totalPublisherPayouts = dailyRevenues.reduce(
        (sum, day) => sum + Number(day.totalPublisherPayout),
        0,
      );

      const averageDailyRevenue = totalSystemEarnings / dailyRevenues.length;

      // Top performing days (by commission earned)
      const topPerformingDays = dailyRevenues
        .sort(
          (a, b) =>
            Number(b.totalCommissionEarned) - Number(a.totalCommissionEarned),
        )
        .slice(0, 5)
        .map((day) => ({
          date: day.date.toISOString().split('T')[0],
          commission: Number(day.totalCommissionEarned),
          impressions: day.totalImpressions,
          clicks: day.totalClicks,
        }));

      // Commission trends (last 7 days for chart)
      const commissionTrends = dailyRevenues
        .slice(0, 7)
        .reverse()
        .map((day) => ({
          date: day.date.toISOString().split('T')[0],
          commission: Number(day.totalCommissionEarned),
          publisherPayout: Number(day.totalPublisherPayout),
          grossRevenue: Number(day.totalGrossRevenue),
        }));

      return {
        totalSystemEarnings,
        totalPublisherPayouts,
        averageDailyRevenue,
        topPerformingDays,
        commissionTrends,
      };
    } catch (error) {
      this.logger.error('Failed to get revenue insights', {
        error: error.message,
        days,
      });

      return {
        totalSystemEarnings: 0,
        totalPublisherPayouts: 0,
        averageDailyRevenue: 0,
        topPerformingDays: [],
        commissionTrends: [],
      };
    }
  }
}
