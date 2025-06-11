// src/rtb/processors/auction.processor.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { KafkaService } from '../../kafka/kafka.service';
import { kafkaTopics } from '../../kafka/constants/kafka.config';
import RTBProducer from '../producer/rtb.producer';

@Injectable()
export class AuctionProcessor {
  private readonly logger = new Logger(AuctionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly kafka: KafkaService,
    private readonly rtbProducer: RTBProducer,
  ) {
    this.logger.log('Auction Processor initialized - Phase 4');
  }

  async processAuctionCompletion(auctionData: {
    auctionId: string;
    requestId: string;
    inventoryId: string;
    campaignIds: string[];
    winner: any | null;
    totalBids: number;
    validBids: number;
    processingTime: number;
    auctionType: string;
    floorPrice?: number;
    finalPrice?: number;
    timestamp: string;
  }): Promise<void> {
    this.logger.debug('Processing auction completion', {
      auctionId: auctionData.auctionId,
      hasWinner: !!auctionData.winner,
      totalBids: auctionData.totalBids,
      processingTime: auctionData.processingTime,
    });

    try {
      // 1. Store auction log in database for historical analysis
      await this.storeAuctionLog(auctionData);

      // 2. Update real-time analytics metrics
      await this.updateRealTimeMetrics(auctionData);

      // 3. Generate performance analytics
      await this.generatePerformanceAnalytics(auctionData);

      // 4. Update campaign performance metrics
      if (auctionData.winner) {
        await this.updateCampaignMetrics(auctionData.winner, auctionData);
      }

      // 5. Update inventory performance metrics
      await this.updateInventoryMetrics(auctionData);

      // 6. Publish to analytics pipeline for further processing
      await this.rtbProducer.publishToAnalyticsPipeline(auctionData);

      this.logger.log('✅ Auction analytics processed', {
        auctionId: auctionData.auctionId,
        processingTime: auctionData.processingTime,
        hasWinner: !!auctionData.winner,
      });
    } catch (error) {
      this.logger.error('❌ Failed to process auction completion', {
        error: error.message,
        auctionId: auctionData.auctionId,
      });
      throw error;
    }
  }

  /**
   * Process auction timeout scenarios
   *
   * **Why timeout processing matters:**
   * - Timeouts represent lost revenue opportunities
   * - Pattern analysis helps optimize processing pipeline
   * - Enables alerting for system performance issues
   * - Provides data for capacity planning
   */
  async processAuctionTimeout(timeoutData: {
    auctionId: string;
    requestId: string;
    inventoryId: string;
    timeoutDuration: number;
    partialResults?: any;
    errorContext: string;
  }): Promise<void> {
    this.logger.warn('Processing auction timeout', {
      auctionId: timeoutData.auctionId,
      timeoutDuration: timeoutData.timeoutDuration,
      errorContext: timeoutData.errorContext,
    });

    try {
      // 1. Store timeout record for analysis
      await this.storeTimeoutRecord(timeoutData);

      // 2. Update timeout metrics
      await this.updateTimeoutMetrics(timeoutData);

      // 3. Generate timeout alert if pattern detected
      await this.checkTimeoutPatterns(timeoutData);

      // 4. Clean up any partial auction state
      await this.cleanupPartialAuctionState(timeoutData.auctionId);

      this.logger.log('Timeout processed', {
        auctionId: timeoutData.auctionId,
      });
    } catch (error) {
      this.logger.error('Failed to process auction timeout', {
        error: error.message,
        auctionId: timeoutData.auctionId,
      });
    }
  }

  /**
   * Process hourly auction aggregations
   *
   * **Why hourly aggregations:**
   * - Provides near real-time performance insights
   * - Enables trend analysis and alerting
   * - Feeds into ML models for optimization
   * - Supports advertiser and publisher dashboards
   */
  async processHourlyAggregation(): Promise<void> {
    const currentHour = new Date();
    currentHour.setMinutes(0, 0, 0);

    const previousHour = new Date(currentHour.getTime() - 60 * 60 * 1000);

    this.logger.log('Processing hourly aggregation', {
      hour: previousHour.toISOString(),
    });

    try {
      // 1. Aggregate auction metrics for previous hour
      const auctionMetrics = await this.aggregateAuctionMetrics(previousHour);

      // 2. Aggregate campaign performance
      const campaignMetrics = await this.aggregateCampaignMetrics(previousHour);

      // 3. Aggregate inventory performance
      const inventoryMetrics =
        await this.aggregateInventoryMetrics(previousHour);

      // 4. Store aggregated data
      await this.storeHourlyAggregations({
        hour: previousHour,
        auctionMetrics,
        campaignMetrics,
        inventoryMetrics,
      });

      // 5. Publish to Timescale for long-term analytics
      await this.publishToTimescale({
        hour: previousHour,
        auctionMetrics,
        campaignMetrics,
        inventoryMetrics,
      });

      // 6. Check for performance alerts
      await this.checkPerformanceAlerts(auctionMetrics);

      this.logger.log('✅ Hourly aggregation completed', {
        hour: previousHour.toISOString(),
        totalAuctions: auctionMetrics.totalAuctions,
        fillRate: auctionMetrics.fillRate,
      });
    } catch (error) {
      this.logger.error('❌ Hourly aggregation failed', {
        error: error.message,
        hour: previousHour.toISOString(),
      });
    }
  }

  // ==========================================
  // AUCTION LOG STORAGE
  // ==========================================

  /**
   * Store auction log in database
   */
  private async storeAuctionLog(auctionData: any): Promise<void> {
    try {
      await this.prisma.auctionLog.create({
        data: {
          id: auctionData.auctionId,
          bidRequestId: auctionData.requestId,
          // inventoryId: auctionData.inventoryId,
          status: auctionData.winner ? 'COMPLETED' : 'NO_BIDS',
          totalBids: auctionData.totalBids,
          validBids: auctionData.validBids,
          winningBidId: auctionData.winner?.id || null,
          // winningCampaignId: auctionData.winner?.campaignId || null,
          floorPrice: auctionData.floorPrice,
          finalPrice: auctionData.finalPrice,
          // processingTime: auctionData.processingTime,
          auctionType: auctionData.auctionType,
          // metadata: JSON.stringify({
          //     campaignIds: auctionData.campaignIds,
          //     timestamp: auctionData.timestamp
          // }),
          // createdAt: new Date(auctionData.timestamp)
          auctionDuration: auctionData.processingTime,
        },
      });

      this.logger.debug('Auction log stored', {
        auctionId: auctionData.auctionId,
      });
    } catch (error) {
      this.logger.error('Failed to store auction log', {
        error: error.message,
        auctionId: auctionData.auctionId,
      });
      throw error;
    }
  }

  /**
   * Store timeout record for analysis
   */
  private async storeTimeoutRecord(timeoutData: any): Promise<void> {
    try {
      await this.prisma.auctionLog.create({
        data: {
          id: timeoutData.auctionId,
          bidRequestId: timeoutData.requestId,
          // inventoryId: timeoutData.inventoryId,
          status: 'TIMEOUT',
          totalBids: 0,
          validBids: 0,
          auctionDuration: timeoutData.timeoutDuration,
          errorMessage: JSON.stringify({
            errorContext: timeoutData.errorContext,
            partialResults: timeoutData.partialResults,
          }),
          auctionType: 'SECOND_PRICE',
        },
      });

      this.logger.debug('Timeout record stored', {
        auctionId: timeoutData.auctionId,
      });
    } catch (error) {
      this.logger.warn('Failed to store timeout record', {
        error: error.message,
        auctionId: timeoutData.auctionId,
      });
    }
  }

  // ==========================================
  // REAL-TIME METRICS
  // ==========================================

  /**
   * Update real-time metrics in Redis
   */
  private async updateRealTimeMetrics(auctionData: any): Promise<void> {
    try {
      const hour = new Date().getHours();
      const dateHour = `${new Date().toISOString().split('T')[0]}_${hour}`;

      const metricUpdates = [
        // Auction volume metrics
        this.redis.incr(`metrics:auctions:total:${dateHour}`),
        this.redis.incr(
          `metrics:auctions:${auctionData.winner ? 'filled' : 'unfilled'}:${dateHour}`,
        ),

        // Processing time metrics
        this.redis.incrby(
          `metrics:processing_time:total:${dateHour}`,
          auctionData.processingTime,
        ),
        this.redis.incr(`metrics:processing_time:count:${dateHour}`),

        // Bid metrics
        this.redis.incrby(
          `metrics:bids:total:${dateHour}`,
          auctionData.totalBids,
        ),
        this.redis.incrby(
          `metrics:bids:valid:${dateHour}`,
          auctionData.validBids,
        ),

        // Revenue metrics (if auction won)
        ...(auctionData.winner
          ? [
              this.redis.incrbyfloat(
                `metrics:revenue:total:${dateHour}`,
                auctionData.finalPrice || 0,
              ),
            ]
          : []),

        // Set expiration for all metrics (7 days)
        this.redis.expire(`metrics:auctions:total:${dateHour}`, 7 * 24 * 3600),
        this.redis.expire(
          `metrics:processing_time:total:${dateHour}`,
          7 * 24 * 3600,
        ),
      ];

      await Promise.all(metricUpdates);

      this.logger.debug('Real-time metrics updated', {
        auctionId: auctionData.auctionId,
        dateHour,
      });
    } catch (error) {
      this.logger.warn('Failed to update real-time metrics', {
        error: error.message,
        auctionId: auctionData.auctionId,
      });
    }
  }

  /**
   * Update timeout metrics
   */
  private async updateTimeoutMetrics(timeoutData: any): Promise<void> {
    try {
      const hour = new Date().getHours();
      const dateHour = `${new Date().toISOString().split('T')[0]}_${hour}`;

      await Promise.all([
        this.redis.incr(`metrics:auctions:timeout:${dateHour}`),
        this.redis.incrby(
          `metrics:timeout_duration:total:${dateHour}`,
          timeoutData.timeoutDuration,
        ),
        this.redis.incr(`metrics:timeout_duration:count:${dateHour}`),
        this.redis.expire(
          `metrics:auctions:timeout:${dateHour}`,
          7 * 24 * 3600,
        ),
      ]);

      this.logger.debug('Timeout metrics updated', {
        auctionId: timeoutData.auctionId,
        timeoutDuration: timeoutData.timeoutDuration,
      });
    } catch (error) {
      this.logger.warn('Failed to update timeout metrics', {
        error: error.message,
      });
    }
  }

  // ==========================================
  // PERFORMANCE ANALYTICS
  // ==========================================

  /**
   * Generate performance analytics
   */
  private async generatePerformanceAnalytics(auctionData: any): Promise<void> {
    try {
      // Calculate performance ratios
      const fillRate = auctionData.winner ? 1 : 0;
      const bidEfficiency =
        auctionData.totalBids > 0
          ? auctionData.validBids / auctionData.totalBids
          : 0;

      // Store analytics data
      const analyticsData = {
        auctionId: auctionData.auctionId,
        inventoryId: auctionData.inventoryId,
        fillRate,
        bidEfficiency,
        processingTime: auctionData.processingTime,
        totalBids: auctionData.totalBids,
        validBids: auctionData.validBids,
        revenue: auctionData.finalPrice || 0,
        timestamp: new Date(auctionData.timestamp),
      };

      // This would be stored in a separate analytics table or published to analytics service
      this.logger.debug('Performance analytics generated', {
        auctionId: auctionData.auctionId,
        fillRate,
        bidEfficiency,
        processingTime: auctionData.processingTime,
      });
    } catch (error) {
      this.logger.warn('Failed to generate performance analytics', {
        error: error.message,
        auctionId: auctionData.auctionId,
      });
    }
  }

  /**
   * Update campaign performance metrics
   */
  private async updateCampaignMetrics(
    winner: any,
    auctionData: any,
  ): Promise<void> {
    try {
      const hour = new Date().getHours();
      const dateHour = `${new Date().toISOString().split('T')[0]}_${hour}`;
      const campaignKey = `campaign:${winner.campaignId}`;

      await Promise.all([
        // Campaign-specific metrics
        this.redis.incr(`metrics:${campaignKey}:auctions_won:${dateHour}`),
        this.redis.incrbyfloat(
          `metrics:${campaignKey}:spend:${dateHour}`,
          auctionData.finalPrice || 0,
        ),
        this.redis.incrby(
          `metrics:${campaignKey}:processing_time:${dateHour}`,
          auctionData.processingTime,
        ),

        // Set expiration
        this.redis.expire(
          `metrics:${campaignKey}:auctions_won:${dateHour}`,
          7 * 24 * 3600,
        ),
      ]);

      this.logger.debug('Campaign metrics updated', {
        campaignId: winner.campaignId,
        spend: auctionData.finalPrice,
      });
    } catch (error) {
      this.logger.warn('Failed to update campaign metrics', {
        error: error.message,
        campaignId: winner.campaignId,
      });
    }
  }

  /**
   * Update inventory performance metrics
   */
  private async updateInventoryMetrics(auctionData: any): Promise<void> {
    try {
      const hour = new Date().getHours();
      const dateHour = `${new Date().toISOString().split('T')[0]}_${hour}`;
      const inventoryKey = `inventory:${auctionData.inventoryId}`;

      await Promise.all([
        // Inventory-specific metrics
        this.redis.incr(`metrics:${inventoryKey}:requests:${dateHour}`),
        this.redis.incr(
          `metrics:${inventoryKey}:${auctionData.winner ? 'filled' : 'unfilled'}:${dateHour}`,
        ),
        ...(auctionData.winner
          ? [
              this.redis.incrbyfloat(
                `metrics:${inventoryKey}:revenue:${dateHour}`,
                auctionData.finalPrice || 0,
              ),
            ]
          : []),

        // Set expiration
        this.redis.expire(
          `metrics:${inventoryKey}:requests:${dateHour}`,
          7 * 24 * 3600,
        ),
      ]);

      this.logger.debug('Inventory metrics updated', {
        inventoryId: auctionData.inventoryId,
        filled: !!auctionData.winner,
      });
    } catch (error) {
      this.logger.warn('Failed to update inventory metrics', {
        error: error.message,
        inventoryId: auctionData.inventoryId,
      });
    }
  }

  // ==========================================
  // AGGREGATION METHODS
  // ==========================================

  /**
   * Aggregate auction metrics for specified hour
   */
  private async aggregateAuctionMetrics(hour: Date): Promise<any> {
    const dateHour = `${hour.toISOString().split('T')[0]}_${hour.getHours()}`;

    try {
      const [
        totalAuctions,
        filledAuctions,
        unfilledAuctions,
        timeoutAuctions,
        totalProcessingTime,
        processingTimeCount,
        totalBids,
        validBids,
        totalRevenue,
      ]: any = await Promise.all([
        this.redis.get(`metrics:auctions:total:${dateHour}`),
        this.redis.get(`metrics:auctions:filled:${dateHour}`),
        this.redis.get(`metrics:auctions:unfilled:${dateHour}`),
        this.redis.get(`metrics:auctions:timeout:${dateHour}`),
        this.redis.get(`metrics:processing_time:total:${dateHour}`),
        this.redis.get(`metrics:processing_time:count:${dateHour}`),
        this.redis.get(`metrics:bids:total:${dateHour}`),
        this.redis.get(`metrics:bids:valid:${dateHour}`),
        this.redis.get(`metrics:revenue:total:${dateHour}`),
      ]);

      const totalAuctionsNum = parseInt(totalAuctions || '0');
      const filledAuctionsNum = parseInt(filledAuctions || '0');
      const processingTimeTotal = parseInt(totalProcessingTime || '0');
      const processingTimeCountNum = parseInt(processingTimeCount || '0');

      return {
        hour: hour.toISOString(),
        totalAuctions: totalAuctionsNum,
        filledAuctions: filledAuctionsNum,
        unfilledAuctions: parseInt(unfilledAuctions || '0'),
        timeoutAuctions: parseInt(timeoutAuctions || '0'),
        fillRate:
          totalAuctionsNum > 0 ? filledAuctionsNum / totalAuctionsNum : 0,
        avgProcessingTime:
          processingTimeCountNum > 0
            ? processingTimeTotal / processingTimeCountNum
            : 0,
        totalBids: parseInt(totalBids || '0'),
        validBids: parseInt(validBids || '0'),
        bidEfficiency:
          parseInt(totalBids || '0') > 0
            ? parseInt(validBids || '0') / parseInt(totalBids || '0')
            : 0,
        totalRevenue: parseFloat(totalRevenue || '0'),
      };
    } catch (error) {
      this.logger.error('Failed to aggregate auction metrics', {
        error: error.message,
        hour: hour.toISOString(),
      });
      return null;
    }
  }

  /**
   * Aggregate campaign metrics for specified hour
   */
  private async aggregateCampaignMetrics(hour: Date): Promise<any[]> {
    // This would query Redis for all campaign metrics and aggregate them
    // For now, returning empty array as placeholder
    return [];
  }

  /**
   * Aggregate inventory metrics for specified hour
   */
  private async aggregateInventoryMetrics(hour: Date): Promise<any[]> {
    // This would query Redis for all inventory metrics and aggregate them
    // For now, returning empty array as placeholder
    return [];
  }

  /**
   * Store hourly aggregations
   */
  private async storeHourlyAggregations(data: any): Promise<void> {
    try {
      // Store in database for historical analysis
      // await this.prisma.hourlyMetrics.create({ data: ... });

      this.logger.debug('Hourly aggregations stored', {
        hour: data.hour.toISOString(),
      });
    } catch (error) {
      this.logger.error('Failed to store hourly aggregations', {
        error: error.message,
        hour: data.hour.toISOString(),
      });
    }
  }

  /**
   * Publish to Timescale for long-term analytics
   */
  private async publishToTimescale(data: any): Promise<void> {
    try {
      await this.kafka.publish(kafkaTopics.TIMESCALE_SYNC, {
        key: `hourly_${data.hour.getTime()}`,
        value: {
          type: 'hourly_aggregation',
          data,
          timestamp: new Date().toISOString(),
        },
      });

      this.logger.debug('Published to Timescale sync', {
        hour: data.hour.toISOString(),
      });
    } catch (error) {
      this.logger.warn('Failed to publish to Timescale', {
        error: error.message,
        hour: data.hour.toISOString(),
      });
    }
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Check for timeout patterns and generate alerts
   */
  private async checkTimeoutPatterns(timeoutData: any): Promise<void> {
    try {
      const hour = new Date().getHours();
      const dateHour = `${new Date().toISOString().split('T')[0]}_${hour}`;

      const timeoutCount: any = await this.redis.get(
        `metrics:auctions:timeout:${dateHour}`,
      );
      const totalCount: any = await this.redis.get(
        `metrics:auctions:total:${dateHour}`,
      );

      const timeoutRate =
        parseInt(totalCount || '0') > 0
          ? parseInt(timeoutCount || '0') / parseInt(totalCount || '0')
          : 0;

      // Alert if timeout rate exceeds 5%
      if (timeoutRate > 0.05) {
        await this.generateTimeoutAlert(timeoutRate, dateHour);
      }
    } catch (error) {
      this.logger.warn('Failed to check timeout patterns', {
        error: error.message,
      });
    }
  }

  /**
   * Generate timeout alert
   */
  private async generateTimeoutAlert(
    timeoutRate: number,
    dateHour: string,
  ): Promise<void> {
    try {
      await this.kafka.publish('system-alerts', {
        key: `timeout_alert_${dateHour}`,
        value: {
          alertType: 'high_timeout_rate',
          timeoutRate,
          threshold: 0.05,
          hour: dateHour,
          timestamp: new Date().toISOString(),
        },
      });

      this.logger.warn('Timeout alert generated', {
        timeoutRate,
        dateHour,
      });
    } catch (error) {
      this.logger.error('Failed to generate timeout alert', {
        error: error.message,
      });
    }
  }

  /**
   * Check for performance alerts
   */
  private async checkPerformanceAlerts(metrics: any): Promise<void> {
    try {
      // Check fill rate alert (< 80%)
      if (metrics.fillRate < 0.8) {
        await this.generatePerformanceAlert('low_fill_rate', metrics);
      }

      // Check processing time alert (> 100ms average)
      if (metrics.avgProcessingTime > 100) {
        await this.generatePerformanceAlert('high_processing_time', metrics);
      }
    } catch (error) {
      this.logger.warn('Failed to check performance alerts', {
        error: error.message,
      });
    }
  }

  /**
   * Generate performance alert
   */
  private async generatePerformanceAlert(
    alertType: string,
    metrics: any,
  ): Promise<void> {
    try {
      await this.kafka.publish('system-alerts', {
        key: `performance_alert_${alertType}_${Date.now()}`,
        value: {
          alertType,
          metrics,
          timestamp: new Date().toISOString(),
        },
      });

      this.logger.warn('Performance alert generated', {
        alertType,
        metrics: {
          fillRate: metrics.fillRate,
          avgProcessingTime: metrics.avgProcessingTime,
        },
      });
    } catch (error) {
      this.logger.error('Failed to generate performance alert', {
        error: error.message,
        alertType,
      });
    }
  }

  /**
   * Clean up partial auction state
   */
  private async cleanupPartialAuctionState(auctionId: string): Promise<void> {
    try {
      // Clean up any temporary Redis keys for this auction
      const keysToClean = [
        `auction:state:${auctionId}`,
        `auction:lock:${auctionId}`,
        `auction:bids:${auctionId}`,
      ];

      await Promise.all(keysToClean.map((key) => this.redis.del(key)));

      this.logger.debug('Partial auction state cleaned', {
        auctionId,
      });
    } catch (error) {
      this.logger.warn('Failed to clean partial auction state', {
        error: error.message,
        auctionId,
      });
    }
  }
}
