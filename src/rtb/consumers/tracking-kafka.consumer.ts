// src/rtb/consumers/tracking-kafka.consumer.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { KafkaService } from '../../kafka/kafka.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { kafkaTopics } from '../../kafka/constants/kafka.config';

/**
 * Tracking Kafka Consumer - Phase 5 Implementation
 *
 * **Core Responsibility: Process tracking events for analytics and data pipeline**
 *
 * **Why this consumer is essential:**
 * - Processes high-volume tracking events asynchronously
 * - Aggregates data for analytics and reporting
 * - Manages data flow to Timescale for long-term storage
 * - Handles batch processing for efficiency
 *
 * **Key Functions:**
 * 1. Consume impression and click events from Kafka
 * 2. Aggregate data for real-time analytics
 * 3. Prepare data for Timescale synchronization
 * 4. Handle error scenarios and dead letter queues
 * 5. Generate performance alerts and notifications
 *
 * **Performance Optimizations:**
 * - Batch processing for database operations
 * - Parallel processing of different event types
 * - Efficient data transformation for downstream systems
 * - Circuit breaker patterns for external dependencies
 */
@Injectable()
export class TrackingKafkaConsumer implements OnModuleInit {
  private readonly logger = new Logger(TrackingKafkaConsumer.name);

  constructor(
    private readonly kafka: KafkaService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    this.logger.log('Tracking Kafka Consumer initialized - Phase 5');
  }

  /**
   * Initialize Kafka subscriptions on module startup
   *
   * **Why multiple subscriptions:**
   * - Impressions and clicks have different processing requirements
   * - Separate consumer groups allow independent scaling
   * - Different error handling strategies for each event type
   */
  async onModuleInit() {
    try {
      this.logger.log('Initializing Tracking Kafka subscriptions...');

      // Primary subscription: Process impression events
      await this.subscribeToImpressions();

      // Secondary subscription: Process click events
      await this.subscribeToClicks();

      // Analytics subscription: Process aggregated data
      await this.subscribeToAnalytics();

      // Error handling subscription: Process failed tracking events
      await this.subscribeToTrackingDLQ();

      this.logger.log('✅ Tracking Kafka Consumer fully initialized');
    } catch (error) {
      this.logger.error('❌ Failed to initialize Tracking Kafka Consumer', {
        error: error.message,
      });
      throw error;
    }
  }

  // ==========================================
  // SUBSCRIPTION METHODS
  // ==========================================

  /**
   * Subscribe to impression events
   *
   * **Why dedicated impression processing:**
   * - Impressions have higher volume than clicks
   * - Different aggregation requirements
   * - Viewability processing is impression-specific
   */
  private async subscribeToImpressions(): Promise<void> {
    await this.kafka.subscribe(
      kafkaTopics.IMPRESSIONS,
      'tracking-impression-processor',
      this.processImpressionEvent.bind(this),
    );

    this.logger.log('👁️ Subscribed to impression events topic');
  }

  /**
   * Subscribe to click events
   *
   * **Why separate click processing:**
   * - Click processing includes conversion tracking
   * - CTR calculations are click-specific
   * - Different fraud detection algorithms
   */
  private async subscribeToClicks(): Promise<void> {
    await this.kafka.subscribe(
      kafkaTopics.CLICKS,
      'tracking-click-processor',
      this.processClickEvent.bind(this),
    );

    this.logger.log('👆 Subscribed to click events topic');
  }

  /**
   * Subscribe to analytics aggregation
   */
  private async subscribeToAnalytics(): Promise<void> {
    await this.kafka.subscribe(
      kafkaTopics.CAMPAIGN_METRICS,
      'tracking-analytics-processor',
      this.processAnalyticsEvent.bind(this),
    );

    this.logger.log('📊 Subscribed to analytics events topic');
  }

  /**
   * Subscribe to tracking dead letter queue
   */
  private async subscribeToTrackingDLQ(): Promise<void> {
    await this.kafka.subscribe(
      kafkaTopics.DLQ_TRACKING,
      'tracking-dlq-processor',
      this.processDLQEvent.bind(this),
    );

    this.logger.log('🚨 Subscribed to tracking DLQ');
  }

  // ==========================================
  // EVENT PROCESSING HANDLERS
  // ==========================================

  /**
   * Process impression event from Kafka
   *
   * **Why comprehensive impression processing:**
   * - Impressions drive most RTB analytics
   * - Viewability data affects inventory quality scores
   * - Real-time aggregation enables campaign optimization
   *
   * **Processing steps:**
   * 1. Validate and enrich impression data
   * 2. Update real-time aggregations
   * 3. Calculate performance metrics
   * 4. Prepare data for Timescale sync
   * 5. Generate alerts if needed
   */
  private async processImpressionEvent(payload: {
    key: string;
    value: any;
    topic: string;
    partition: number;
    offset: string;
  }): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.debug('Processing impression event', {
        impressionId: payload.key,
        partition: payload.partition,
        offset: payload.offset,
      });

      // 1. Deserialize and validate impression data
      const impressionData = this.deserializeImpressionEvent(payload.value);
      this.validateImpressionEvent(impressionData);

      // 2. Update hourly aggregations
      await this.updateHourlyImpressionAggregations(impressionData);

      // 3. Update campaign performance metrics
      await this.updateCampaignPerformanceMetrics(impressionData, 'impression');

      // 4. Update inventory performance metrics
      await this.updateInventoryPerformanceMetrics(
        impressionData,
        'impression',
      );

      // 5. Process viewability metrics if available
      if (impressionData.viewable !== null) {
        await this.processViewabilityMetrics(impressionData);
      }

      // 6. Check for performance alerts
      await this.checkPerformanceAlerts(impressionData, 'impression');

      // 7. Prepare for Timescale synchronization
      await this.prepareForTimescaleSync(impressionData, 'impression');

      const processingTime = Date.now() - startTime;

      this.logger.debug('✅ Impression event processed', {
        impressionId: payload.key,
        campaignId: impressionData.campaignId,
        processingTime: `${processingTime}ms`,
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('❌ Impression event processing failed', {
        impressionId: payload.key,
        error: error.message,
        processingTime: `${processingTime}ms`,
      });

      // Send to DLQ for manual review
      await this.handleTrackingError(payload, error, 'impression_processing');
    }
  }

  /**
   * Process click event from Kafka
   *
   * **Why comprehensive click processing:**
   * - Clicks enable CTR calculation and optimization
   * - Click patterns indicate campaign effectiveness
   * - Conversion tracking starts with click events
   *
   * **Processing steps:**
   * 1. Validate and enrich click data
   * 2. Update CTR metrics in real-time
   * 3. Process conversion attribution
   * 4. Analyze click patterns for fraud
   * 5. Update bid optimization data
   */
  private async processClickEvent(payload: {
    key: string;
    value: any;
    topic: string;
    partition: number;
    offset: string;
  }): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.debug('Processing click event', {
        clickId: payload.key,
        partition: payload.partition,
        offset: payload.offset,
      });

      // 1. Deserialize and validate click data
      const clickData = this.deserializeClickEvent(payload.value);
      this.validateClickEvent(clickData);

      // 2. Update hourly click aggregations
      await this.updateHourlyClickAggregations(clickData);

      // 3. Calculate and update CTR metrics
      await this.updateCTRMetrics(clickData);

      // 4. Update campaign performance metrics
      await this.updateCampaignPerformanceMetrics(clickData, 'click');

      // 5. Process fraud detection results
      if (clickData.fraudScore > 0.5) {
        await this.processFraudDetection(clickData);
      }

      // 6. Update click patterns for optimization
      await this.updateClickPatterns(clickData);

      // 7. Check for performance alerts
      await this.checkPerformanceAlerts(clickData, 'click');

      // 8. Prepare for Timescale synchronization
      await this.prepareForTimescaleSync(clickData, 'click');

      const processingTime = Date.now() - startTime;

      this.logger.debug('✅ Click event processed', {
        clickId: payload.key,
        campaignId: clickData.campaignId,
        processingTime: `${processingTime}ms`,
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('❌ Click event processing failed', {
        clickId: payload.key,
        error: error.message,
        processingTime: `${processingTime}ms`,
      });

      // Send to DLQ for manual review
      await this.handleTrackingError(payload, error, 'click_processing');
    }
  }

  /**
   * Process analytics aggregation event
   *
   * **Why analytics processing:**
   * - Generates insights for campaign optimization
   * - Creates reports for advertisers and publishers
   * - Feeds machine learning models
   */
  private async processAnalyticsEvent(payload: {
    key: string;
    value: any;
    topic: string;
    partition: number;
    offset: string;
  }): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.debug('Processing analytics event', {
        key: payload.key,
        partition: payload.partition,
      });

      const analyticsData = this.deserializeAnalyticsEvent(payload.value);

      // Process based on analytics type
      switch (analyticsData.type) {
        case 'hourly_aggregation':
          await this.processHourlyAggregation(analyticsData);
          break;

        case 'campaign_performance':
          await this.processCampaignPerformance(analyticsData);
          break;

        case 'inventory_quality':
          await this.processInventoryQuality(analyticsData);
          break;

        default:
          this.logger.warn('Unknown analytics event type', {
            type: analyticsData.type,
            key: payload.key,
          });
      }

      const processingTime = Date.now() - startTime;
      this.logger.debug('✅ Analytics event processed', {
        key: payload.key,
        type: analyticsData.type,
        processingTime: `${processingTime}ms`,
      });
    } catch (error) {
      this.logger.error('❌ Analytics event processing failed', {
        key: payload.key,
        error: error.message,
      });

      await this.handleTrackingError(payload, error, 'analytics_processing');
    }
  }

  /**
   * Process DLQ events for error recovery
   */
  private async processDLQEvent(payload: {
    key: string;
    value: any;
    topic: string;
    partition: number;
    offset: string;
  }): Promise<void> {
    this.logger.warn('Processing DLQ tracking event', {
      originalKey: payload.value.originalKey,
      errorType: payload.value.errorType,
      retryCount: payload.value.retryCount,
    });

    try {
      // Attempt reprocessing based on original event type
      switch (payload.value.originalEventType) {
        case 'impression':
          await this.processImpressionEvent({
            ...payload,
            value: payload.value.originalData,
          });
          break;

        case 'click':
          await this.processClickEvent({
            ...payload,
            value: payload.value.originalData,
          });
          break;

        default:
          this.logger.error('Unknown DLQ event type', {
            originalEventType: payload.value.originalEventType,
          });
      }

      this.logger.log('✅ DLQ event reprocessed successfully');
    } catch (error) {
      this.logger.error('❌ DLQ event reprocessing failed', {
        error: error.message,
        retryCount: payload.value.retryCount,
      });

      // If max retries exceeded, log for manual intervention
      if (payload.value.retryCount >= 3) {
        this.logger.error('Max retries exceeded for DLQ event', {
          originalKey: payload.value.originalKey,
          errorType: payload.value.errorType,
        });
      }
    }
  }

  // ==========================================
  // AGGREGATION METHODS
  // ==========================================

  /**
   * Update hourly impression aggregations
   *
   * **Why hourly aggregations:**
   * - Enables real-time performance dashboards
   * - Supports campaign pacing decisions
   * - Provides data for ML model training
   */
  private async updateHourlyImpressionAggregations(
    impressionData: any,
  ): Promise<void> {
    try {
      const hour = new Date().getHours();
      const date = new Date().toISOString().split('T')[0];
      const dateHour = `${date}_${hour}`;

      // Update Redis counters for real-time access
      const aggregationPromises = [
        // Global aggregations
        this.redis.incr(`agg:impressions:total:${dateHour}`),
        this.redis.incrbyfloat(
          `agg:revenue:total:${dateHour}`,
          Number(impressionData.price),
        ),

        // Campaign-level aggregations
        this.redis.incr(
          `agg:impressions:campaign:${impressionData.campaignId}:${dateHour}`,
        ),
        this.redis.incrbyfloat(
          `agg:revenue:campaign:${impressionData.campaignId}:${dateHour}`,
          Number(impressionData.price),
        ),

        // Inventory-level aggregations
        this.redis.incr(
          `agg:impressions:inventory:${impressionData.inventoryId}:${dateHour}`,
        ),
        this.redis.incrbyfloat(
          `agg:revenue:inventory:${impressionData.inventoryId}:${dateHour}`,
          Number(impressionData.publisherRevenue),
        ),

        // Device type aggregations
        this.redis.incr(
          `agg:impressions:device:${impressionData.deviceType}:${dateHour}`,
        ),

        // Geographic aggregations
        ...(impressionData.country
          ? [
              this.redis.incr(
                `agg:impressions:country:${impressionData.country}:${dateHour}`,
              ),
            ]
          : []),

        // Set expiration for all keys (30 days)
        this.redis.expire(`agg:impressions:total:${dateHour}`, 30 * 24 * 3600),
      ];

      await Promise.all(aggregationPromises);

      this.logger.debug('Hourly impression aggregations updated', {
        impressionId: impressionData.id,
        dateHour,
        campaignId: impressionData.campaignId,
      });
    } catch (error) {
      this.logger.warn('Failed to update hourly impression aggregations', {
        error: error.message,
        impressionId: impressionData.id,
      });
    }
  }

  /**
   * Update hourly click aggregations
   */
  private async updateHourlyClickAggregations(clickData: any): Promise<void> {
    try {
      const hour = new Date().getHours();
      const date = new Date().toISOString().split('T')[0];
      const dateHour = `${date}_${hour}`;

      const aggregationPromises = [
        // Global click aggregations
        this.redis.incr(`agg:clicks:total:${dateHour}`),

        // Campaign-level click aggregations
        this.redis.incr(
          `agg:clicks:campaign:${clickData.campaignId}:${dateHour}`,
        ),

        // Device type click aggregations
        this.redis.incr(
          `agg:clicks:device:${clickData.deviceType}:${dateHour}`,
        ),

        // Fraud detection aggregations
        ...(clickData.fraudScore > 0.5
          ? [this.redis.incr(`agg:clicks:fraudulent:${dateHour}`)]
          : []),

        // Set expiration
        this.redis.expire(`agg:clicks:total:${dateHour}`, 30 * 24 * 3600),
      ];

      await Promise.all(aggregationPromises);

      this.logger.debug('Hourly click aggregations updated', {
        clickId: clickData.id,
        dateHour,
        campaignId: clickData.campaignId,
      });
    } catch (error) {
      this.logger.warn('Failed to update hourly click aggregations', {
        error: error.message,
        clickId: clickData.id,
      });
    }
  }

  /**
   * Update CTR metrics
   *
   * **Why real-time CTR is critical:**
   * - Enables immediate campaign optimization
   * - Affects bid adjustments in real-time
   * - Provides feedback for creative performance
   */
  private async updateCTRMetrics(clickData: any): Promise<void> {
    try {
      // Get current impression and click counts
      const hour = new Date().getHours();
      const dateHour = `${new Date().toISOString().split('T')[0]}_${hour}`;

      const [
        campaignImpressions,
        campaignClicks,
        creativeImpressions,
        creativeClicks,
      ]: any = await Promise.all([
        this.redis.get(
          `agg:impressions:campaign:${clickData.campaignId}:${dateHour}`,
        ),
        this.redis.get(
          `agg:clicks:campaign:${clickData.campaignId}:${dateHour}`,
        ),
        this.redis.get(`counters:creative:impressions:${clickData.creativeId}`),
        this.redis.get(`counters:creative:clicks:${clickData.creativeId}`),
      ]);

      // Calculate CTR values
      const campaignCTR = campaignImpressions
        ? (parseInt(campaignClicks || '0') / parseInt(campaignImpressions)) *
          100
        : 0;

      const creativeCTR = creativeImpressions
        ? (parseInt(creativeClicks || '0') / parseInt(creativeImpressions)) *
          100
        : 0;

      // Store calculated CTR values
      await Promise.all([
        this.redis.set(
          `metrics:ctr:campaign:${clickData.campaignId}:${dateHour}`,
          campaignCTR.toFixed(4),
          3600,
        ),
        this.redis.set(
          `metrics:ctr:creative:${clickData.creativeId}`,
          creativeCTR.toFixed(4),
          3600,
        ),
      ]);

      this.logger.debug('CTR metrics updated', {
        campaignId: clickData.campaignId,
        creativeId: clickData.creativeId,
        campaignCTR: campaignCTR.toFixed(4),
        creativeCTR: creativeCTR.toFixed(4),
      });
    } catch (error) {
      this.logger.warn('Failed to update CTR metrics', {
        error: error.message,
        clickId: clickData.id,
      });
    }
  }

  // ==========================================
  // PERFORMANCE MONITORING METHODS
  // ==========================================

  /**
   * Update campaign performance metrics
   */
  private async updateCampaignPerformanceMetrics(
    eventData: any,
    eventType: 'impression' | 'click',
  ): Promise<void> {
    try {
      const performanceKey = `performance:campaign:${eventData.campaignId}`;

      // Get current performance data
      const currentPerformance = await this.redis.get<string>(performanceKey);
      let performanceData = currentPerformance
        ? JSON.parse(currentPerformance)
        : {
            impressions: 0,
            clicks: 0,
            spend: 0,
            revenue: 0,
            ctr: 0,
            lastUpdated: new Date().toISOString(),
          };

      // Update based on event type
      if (eventType === 'impression') {
        performanceData.impressions += 1;
        performanceData.spend += Number(eventData.price || 0);
        performanceData.revenue += Number(eventData.publisherRevenue || 0);
      } else if (eventType === 'click') {
        performanceData.clicks += 1;
      }

      // Recalculate CTR
      performanceData.ctr =
        performanceData.impressions > 0
          ? (performanceData.clicks / performanceData.impressions) * 100
          : 0;

      performanceData.lastUpdated = new Date().toISOString();

      // Store updated performance data
      await this.redis.set(
        performanceKey,
        JSON.stringify(performanceData),
        3600,
      );

      this.logger.debug('Campaign performance metrics updated', {
        campaignId: eventData.campaignId,
        eventType,
        ctr: performanceData.ctr.toFixed(4),
      });
    } catch (error) {
      this.logger.warn('Failed to update campaign performance metrics', {
        error: error.message,
        campaignId: eventData.campaignId,
      });
    }
  }

  /**
   * Update inventory performance metrics
   */
  private async updateInventoryPerformanceMetrics(
    eventData: any,
    eventType: 'impression' | 'click',
  ): Promise<void> {
    try {
      const performanceKey = `performance:inventory:${eventData.inventoryId}`;

      const currentPerformance = await this.redis.get<string>(performanceKey);
      let performanceData = currentPerformance
        ? JSON.parse(currentPerformance)
        : {
            impressions: 0,
            revenue: 0,
            fillRate: 0,
            viewabilityRate: 0,
            lastUpdated: new Date().toISOString(),
          };

      if (eventType === 'impression') {
        performanceData.impressions += 1;
        performanceData.revenue += Number(eventData.publisherRevenue || 0);

        // Update viewability rate if data available
        if (eventData.viewable !== null) {
          const currentViewable = performanceData.viewableImpressions || 0;
          const newViewable = currentViewable + (eventData.viewable ? 1 : 0);
          performanceData.viewableImpressions = newViewable;
          performanceData.viewabilityRate =
            (newViewable / performanceData.impressions) * 100;
        }
      }

      performanceData.lastUpdated = new Date().toISOString();

      await this.redis.set(
        performanceKey,
        JSON.stringify(performanceData),
        3600,
      );

      this.logger.debug('Inventory performance metrics updated', {
        inventoryId: eventData.inventoryId,
        eventType,
        impressions: performanceData.impressions,
        revenue: performanceData.revenue,
      });
    } catch (error) {
      this.logger.warn('Failed to update inventory performance metrics', {
        error: error.message,
        inventoryId: eventData.inventoryId,
      });
    }
  }

  // ==========================================
  // SPECIALIZED PROCESSING METHODS
  // ==========================================

  /**
   * Process viewability metrics
   */
  private async processViewabilityMetrics(impressionData: any): Promise<void> {
    try {
      const hour = new Date().getHours();
      const dateHour = `${new Date().toISOString().split('T')[0]}_${hour}`;

      await Promise.all([
        // Global viewability metrics
        this.redis.incr(
          `metrics:viewability:${impressionData.viewable ? 'viewable' : 'nonviewable'}:${dateHour}`,
        ),

        // Inventory-specific viewability
        this.redis.incr(
          `metrics:viewability:inventory:${impressionData.inventoryId}:${impressionData.viewable ? 'viewable' : 'nonviewable'}:${dateHour}`,
        ),

        // View time metrics (if available)
        ...(impressionData.viewTime
          ? [
              this.redis.incrby(
                `metrics:viewtime:total:${dateHour}`,
                impressionData.viewTime,
              ),
            ]
          : []),
      ]);

      this.logger.debug('Viewability metrics processed', {
        impressionId: impressionData.id,
        viewable: impressionData.viewable,
        viewTime: impressionData.viewTime,
      });
    } catch (error) {
      this.logger.warn('Failed to process viewability metrics', {
        error: error.message,
        impressionId: impressionData.id,
      });
    }
  }

  /**
   * Process fraud detection results
   */
  private async processFraudDetection(clickData: any): Promise<void> {
    try {
      // Increment fraud counters
      const hour = new Date().getHours();
      const dateHour = `${new Date().toISOString().split('T')[0]}_${hour}`;

      await Promise.all([
        this.redis.incr(`fraud:clicks:detected:${dateHour}`),
        this.redis.incr(
          `fraud:clicks:campaign:${clickData.campaignId}:${dateHour}`,
        ),
        this.redis.incrbyfloat(
          `fraud:score:total:${dateHour}`,
          clickData.fraudScore,
        ),
      ]);

      // If fraud score is very high, generate alert
      if (clickData.fraudScore > 0.8) {
        await this.generateFraudAlert(clickData);
      }

      this.logger.debug('Fraud detection processed', {
        clickId: clickData.id,
        fraudScore: clickData.fraudScore,
        campaignId: clickData.campaignId,
      });
    } catch (error) {
      this.logger.warn('Failed to process fraud detection', {
        error: error.message,
        clickId: clickData.id,
      });
    }
  }

  /**
   * Check for performance alerts
   */
  private async checkPerformanceAlerts(
    eventData: any,
    eventType: 'impression' | 'click',
  ): Promise<void> {
    try {
      // Check campaign performance thresholds
      const performanceKey = `performance:campaign:${eventData.campaignId}`;
      const performanceData = await this.redis.get<string>(performanceKey);

      if (performanceData) {
        const metrics = JSON.parse(performanceData);

        // Check for low CTR alert (< 0.5%)
        if (
          eventType === 'click' &&
          metrics.ctr < 0.5 &&
          metrics.impressions > 1000
        ) {
          await this.generatePerformanceAlert(
            'low_ctr',
            eventData.campaignId,
            metrics,
          );
        }

        // Check for high spend rate
        if (eventType === 'impression' && metrics.spend > 0) {
          const hourlySpendRate = metrics.spend; // Simplified calculation
          if (hourlySpendRate > 100) {
            // $100/hour threshold
            await this.generatePerformanceAlert(
              'high_spend_rate',
              eventData.campaignId,
              metrics,
            );
          }
        }
      }
    } catch (error) {
      this.logger.warn('Failed to check performance alerts', {
        error: error.message,
        eventType,
        campaignId: eventData.campaignId,
      });
    }
  }

  /**
   * Prepare data for Timescale synchronization
   */
  private async prepareForTimescaleSync(
    eventData: any,
    eventType: 'impression' | 'click',
  ): Promise<void> {
    try {
      // Add to batch sync queue
      const syncKey = `timescale:batch:${eventType}`;
      const syncData = {
        ...eventData,
        syncTimestamp: new Date().toISOString(),
        eventType,
      };

      await this.redis.rpush(syncKey, JSON.stringify(syncData));

      // Trigger batch sync if queue is large enough
      const queueSize = await this.redis.llen(syncKey);
      if (queueSize >= 100) {
        // Batch size threshold
        await this.triggerTimescaleSync(eventType);
      }

      this.logger.debug('Data prepared for Timescale sync', {
        eventId: eventData.id,
        eventType,
        queueSize,
      });
    } catch (error) {
      this.logger.warn('Failed to prepare for Timescale sync', {
        error: error.message,
        eventId: eventData.id,
      });
    }
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Deserialize impression event with validation
   */
  private deserializeImpressionEvent(data: any): any {
    try {
      const event = typeof data === 'string' ? JSON.parse(data) : data;
      return event;
    } catch (error) {
      throw new Error(`Invalid impression event format: ${error.message}`);
    }
  }

  /**
   * Deserialize click event with validation
   */
  private deserializeClickEvent(data: any): any {
    try {
      const event = typeof data === 'string' ? JSON.parse(data) : data;
      return event;
    } catch (error) {
      throw new Error(`Invalid click event format: ${error.message}`);
    }
  }

  /**
   * Deserialize analytics event
   */
  private deserializeAnalyticsEvent(data: any): any {
    try {
      const event = typeof data === 'string' ? JSON.parse(data) : data;
      return event;
    } catch (error) {
      throw new Error(`Invalid analytics event format: ${error.message}`);
    }
  }

  /**
   * Validate impression event structure
   */
  private validateImpressionEvent(event: any): void {
    if (!event.id || !event.campaignId || !event.creativeId) {
      throw new Error('Missing required impression event fields');
    }
  }

  /**
   * Validate click event structure
   */
  private validateClickEvent(event: any): void {
    if (!event.id || !event.campaignId || !event.creativeId) {
      throw new Error('Missing required click event fields');
    }
  }

  /**
   * Handle tracking processing errors
   */
  private async handleTrackingError(
    payload: any,
    error: Error,
    processingStage: string,
  ): Promise<void> {
    try {
      await this.kafka.publish(kafkaTopics.DLQ_TRACKING, {
        key: payload.key,
        value: {
          originalData: payload.value,
          originalKey: payload.key,
          originalEventType: processingStage.split('_')[0],
          errorType: this.categorizeError(error),
          errorMessage: error.message,
          processingStage,
          timestamp: new Date().toISOString(),
          retryCount: 0,
          maxRetries: 3,
        },
      });

      this.logger.warn('Tracking event sent to DLQ', {
        key: payload.key,
        processingStage,
        errorMessage: error.message,
      });
    } catch (dlqError) {
      this.logger.error('Failed to send tracking event to DLQ', {
        error: dlqError.message,
        originalError: error.message,
      });
    }
  }

  /**
   * Categorize errors for appropriate handling
   */
  private categorizeError(
    error: Error,
  ): 'validation' | 'database' | 'network' | 'processing' {
    const message = error.message.toLowerCase();

    if (message.includes('missing') || message.includes('invalid')) {
      return 'validation';
    }
    if (message.includes('database') || message.includes('prisma')) {
      return 'database';
    }
    if (message.includes('network') || message.includes('timeout')) {
      return 'network';
    }
    return 'processing';
  }

  /**
   * Generate fraud alert
   */
  private async generateFraudAlert(clickData: any): Promise<void> {
    try {
      await this.kafka.publish('fraud-alerts', {
        key: clickData.id,
        value: {
          alertType: 'high_fraud_score',
          clickId: clickData.id,
          campaignId: clickData.campaignId,
          fraudScore: clickData.fraudScore,
          userAgent: clickData.userAgent,
          ipAddress: clickData.ipAddress,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.warn('Failed to generate fraud alert', {
        error: error.message,
        clickId: clickData.id,
      });
    }
  }

  /**
   * Generate performance alert
   */
  private async generatePerformanceAlert(
    alertType: string,
    campaignId: string,
    metrics: any,
  ): Promise<void> {
    try {
      await this.kafka.publish('performance-alerts', {
        key: `${alertType}_${campaignId}`,
        value: {
          alertType,
          campaignId,
          metrics,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.warn('Failed to generate performance alert', {
        error: error.message,
        alertType,
        campaignId,
      });
    }
  }

  /**
   * Trigger Timescale batch synchronization
   */
  private async triggerTimescaleSync(
    eventType: 'impression' | 'click',
  ): Promise<void> {
    try {
      await this.kafka.publish(kafkaTopics.TIMESCALE_SYNC, {
        key: `sync_${eventType}_${Date.now()}`,
        value: {
          syncType: 'batch',
          eventType,
          triggeredAt: new Date().toISOString(),
        },
      });

      this.logger.debug('Timescale sync triggered', {
        eventType,
      });
    } catch (error) {
      this.logger.warn('Failed to trigger Timescale sync', {
        error: error.message,
        eventType,
      });
    }
  }

  /**
   * Process hourly aggregation (placeholder)
   */
  private async processHourlyAggregation(data: any): Promise<void> {
    // Implementation for hourly aggregation processing
    this.logger.debug('Processing hourly aggregation', data);
  }

  /**
   * Process campaign performance (placeholder)
   */
  private async processCampaignPerformance(data: any): Promise<void> {
    // Implementation for campaign performance processing
    this.logger.debug('Processing campaign performance', data);
  }

  /**
   * Process inventory quality (placeholder)
   */
  private async processInventoryQuality(data: any): Promise<void> {
    // Implementation for inventory quality processing
    this.logger.debug('Processing inventory quality', data);
  }

  /**
   * Update click patterns for optimization
   *
   * **Why click patterns matter:**
   * - Identifies user behavior trends for bid optimization
   * - Detects fraudulent click patterns
   * - Provides insights for creative optimization
   * - Enables A/B testing effectiveness measurement
   */
  private async updateClickPatterns(clickData: any): Promise<void> {
    try {
      const hour = new Date().getHours();
      const dateHour = `${new Date().toISOString().split('T')[0]}_${hour}`;

      // Update click pattern metrics
      const patternPromises = [
        // Click area patterns
        ...(clickData.clickArea
          ? [
              this.redis.incr(
                `patterns:click_area:${clickData.clickArea}:${dateHour}`,
              ),
              this.redis.incr(
                `patterns:click_area:campaign:${clickData.campaignId}:${clickData.clickArea}:${dateHour}`,
              ),
            ]
          : []),

        // Time-based click patterns
        this.redis.incr(`patterns:click_time:hour_${hour}:${dateHour}`),
        this.redis.incr(
          `patterns:click_time:campaign:${clickData.campaignId}:hour_${hour}:${dateHour}`,
        ),

        // Device-based click patterns
        ...(clickData.deviceType
          ? [
              this.redis.incr(
                `patterns:click_device:${clickData.deviceType}:${dateHour}`,
              ),
              this.redis.incr(
                `patterns:click_device:campaign:${clickData.campaignId}:${clickData.deviceType}:${dateHour}`,
              ),
            ]
          : []),

        // Click pattern by creative
        this.redis.incr(
          `patterns:click_creative:${clickData.creativeId}:${dateHour}`,
        ),

        // Time from impression to click pattern
        ...(clickData.timeFromImpression
          ? [
              this.redis.incrby(
                `patterns:time_to_click:total:${dateHour}`,
                clickData.timeFromImpression,
              ),
              this.redis.incr(`patterns:time_to_click:count:${dateHour}`),
            ]
          : []),

        // Set expiration for pattern data (30 days)
        this.redis.expire(
          `patterns:click_area:${clickData.clickArea}:${dateHour}`,
          30 * 24 * 3600,
        ),
      ];

      await Promise.all(patternPromises);

      // Calculate and store click area preferences for this campaign
      if (clickData.clickArea) {
        await this.updateClickAreaPreferences(
          clickData.campaignId,
          clickData.clickArea,
        );
      }

      // Update time-to-click analytics
      if (clickData.timeFromImpression) {
        await this.updateTimeToClickAnalytics(
          clickData.campaignId,
          clickData.timeFromImpression,
        );
      }

      this.logger.debug('Click patterns updated', {
        clickId: clickData.id,
        campaignId: clickData.campaignId,
        clickArea: clickData.clickArea,
        timeFromImpression: clickData.timeFromImpression,
      });
    } catch (error) {
      this.logger.warn('Failed to update click patterns', {
        error: error.message,
        clickId: clickData.id,
      });
    }
  }

  /**
   * Update click area preferences for campaign optimization
   *
   * **Why click area analysis matters:**
   * - Helps optimize creative design
   * - Identifies most engaging parts of ads
   * - Supports A/B testing of creative layouts
   * - Improves click-through rates
   */
  private async updateClickAreaPreferences(
    campaignId: string,
    clickArea: string,
  ): Promise<void> {
    try {
      const preferencesKey = `preferences:click_areas:${campaignId}`;

      // Get current preferences
      const currentPreferences = await this.redis.get<string>(preferencesKey);
      let preferences = currentPreferences
        ? JSON.parse(currentPreferences)
        : {};

      // Update click area count
      preferences[clickArea] = (preferences[clickArea] || 0) + 1;

      // Calculate total clicks
      const totalClicks: any = Object.values(preferences).reduce(
        (sum: number, count: number) => sum + count,
        0,
      );

      // Calculate percentages
      const preferencesWithPercentages = {};
      for (const [area, count] of Object.entries(preferences)) {
        preferencesWithPercentages[area] = {
          clicks: count,
          percentage: (((count as number) / totalClicks) * 100).toFixed(2),
        };
      }

      // Store updated preferences
      await this.redis.set(
        preferencesKey,
        JSON.stringify(preferencesWithPercentages),
        7200,
      ); // 2-hour cache

      this.logger.debug('Click area preferences updated', {
        campaignId,
        clickArea,
        totalClicks,
        preferences: preferencesWithPercentages,
      });
    } catch (error) {
      this.logger.warn('Failed to update click area preferences', {
        error: error.message,
        campaignId,
        clickArea,
      });
    }
  }

  /**
   * Update time-to-click analytics
   *
   * **Why time-to-click analysis matters:**
   * - Measures ad engagement effectiveness
   * - Identifies optimal impression-to-click timing
   * - Helps detect fraudulent rapid clicks
   * - Provides insights for frequency capping
   */
  private async updateTimeToClickAnalytics(
    campaignId: string,
    timeFromImpression: number,
  ): Promise<void> {
    try {
      const analyticsKey = `analytics:time_to_click:${campaignId}`;

      // Get current analytics
      const currentAnalytics = await this.redis.get<string>(analyticsKey);
      let analytics = currentAnalytics
        ? JSON.parse(currentAnalytics)
        : {
            totalClicks: 0,
            totalTime: 0,
            averageTime: 0,
            minTime: null,
            maxTime: null,
            timeRanges: {
              immediate: 0, // 0-1 seconds
              quick: 0, // 1-10 seconds
              normal: 0, // 10-60 seconds
              delayed: 0, // 1-10 minutes
              late: 0, // >10 minutes
            },
          };

      // Update analytics
      analytics.totalClicks += 1;
      analytics.totalTime += timeFromImpression;
      analytics.averageTime = analytics.totalTime / analytics.totalClicks;

      // Update min/max times
      analytics.minTime =
        analytics.minTime === null
          ? timeFromImpression
          : Math.min(analytics.minTime, timeFromImpression);
      analytics.maxTime =
        analytics.maxTime === null
          ? timeFromImpression
          : Math.max(analytics.maxTime, timeFromImpression);

      // Update time range buckets
      const timeInSeconds = timeFromImpression / 1000;
      if (timeInSeconds <= 1) {
        analytics.timeRanges.immediate += 1;
      } else if (timeInSeconds <= 10) {
        analytics.timeRanges.quick += 1;
      } else if (timeInSeconds <= 60) {
        analytics.timeRanges.normal += 1;
      } else if (timeInSeconds <= 600) {
        // 10 minutes
        analytics.timeRanges.delayed += 1;
      } else {
        analytics.timeRanges.late += 1;
      }

      // Store updated analytics
      await this.redis.set(analyticsKey, JSON.stringify(analytics), 3600); // 1-hour cache

      this.logger.debug('Time-to-click analytics updated', {
        campaignId,
        timeFromImpression,
        averageTime: analytics.averageTime,
        totalClicks: analytics.totalClicks,
      });
    } catch (error) {
      this.logger.warn('Failed to update time-to-click analytics', {
        error: error.message,
        campaignId,
        timeFromImpression,
      });
    }
  }
}
