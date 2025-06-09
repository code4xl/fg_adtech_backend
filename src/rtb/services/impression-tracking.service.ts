// src/rtb/services/impression-tracking.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { KafkaService } from '../../kafka/kafka.service';
import { RedisService } from '../../redis/redis.service';
import { RTBRedisService } from '../../redis/services/rtb-redis.service';
import { kafkaTopics } from '../../kafka/constants/kafka.config';
import { REDIS_KEYS } from '../../redis/constants/redis-keys';

import { WithRetry } from '../../common/resilience/retry.decorator';
import { ImpressionEventDto } from '../dto/';

/**
 * Impression Tracking Service - Phase 5 Implementation
 *
 * **Core Responsibility: Process ad impression events and maintain real-time analytics**
 *
 * **Why this service is critical:**
 * - Enables accurate billing for impressions served
 * - Provides real-time campaign performance data
 * - Supports viewability measurement for quality assurance
 * - Feeds machine learning models for bid optimization
 *
 * **Key Functions:**
 * 1. Track individual impression events
 * 2. Update real-time performance counters
 * 3. Manage campaign budget consumption
 * 4. Detect and prevent fraud/duplicate impressions
 * 5. Publish analytics data for downstream processing
 *
 * **Performance Optimizations:**
 * - Async database writes to maintain response speed
 * - Redis counters for real-time metrics
 * - Batch processing for high-volume scenarios
 * - Kafka integration for scalable analytics pipeline
 */
@Injectable()
export class ImpressionTrackingService {
  private readonly logger = new Logger(ImpressionTrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaService,
    private readonly redis: RedisService,
    private readonly rtbRedis: RTBRedisService,
  ) {
    this.logger.log('Impression Tracking Service initialized - Phase 5');
  }

  /**
   * Track impression from HTTP request context
   *
   * **Why this method exists:**
   * - Primary entry point for impression tracking
   * - Handles bid response validation and context enrichment
   * - Coordinates all impression processing steps
   * - Provides comprehensive error handling
   */
  async trackImpression(
    bidResponseId: string,
    userContext: any,
    requestContext: any,
  ): Promise<any> {
    const startTime = Date.now();

    this.logger.debug('Processing impression', {
      bidResponseId,
      userAgent: userContext.userAgent,
      ip: userContext.ipAddress,
    });

    try {
      // 1. Get bid response details and validate
      const bidResponse = await this.getBidResponse(bidResponseId);
      if (!bidResponse) {
        throw new NotFoundException(`Bid response ${bidResponseId} not found`);
      }

      // 2. Check for duplicate impressions
      const isDuplicate = await this.checkDuplicateImpression(
        bidResponseId,
        userContext.userId,
        userContext.sessionId,
      );

      if (isDuplicate) {
        this.logger.warn('Duplicate impression detected', {
          bidResponseId,
          userId: userContext.userId,
        });
        return { status: 'duplicate', bidResponseId };
      }

      // 3. Create comprehensive impression event
      const impression = await this.createImpressionEvent(
        bidResponse,
        userContext,
        requestContext,
      );

      // 4. Update real-time performance counters
      await this.updateCounters(impression);

      await this.publishTimescaleSyncEvent('impression', impressionEvent.id);

      // 5. Update campaign budget spend
      await this.updateCampaignSpend(impression);

      // 6. Publish to Kafka for analytics pipeline
      await this.publishToKafka(impression);

      // 7. Check and update frequency capping
      await this.updateFrequencyCapping(impression);

      const processingTime = Date.now() - startTime;

      this.logger.log('✅ Impression tracked successfully', {
        impressionId: impression.id,
        bidResponseId,
        campaignId: impression.campaignId,
        processingTime: `${processingTime}ms`,
      });

      return impression;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('❌ Impression tracking failed', {
        error: error.message,
        bidResponseId,
        processingTime: `${processingTime}ms`,
      });

      throw error;
    }
  }

  // Add this new method to the existing service:
  /**
   * Publish TimescaleDB sync event
   *
   * **Why async sync:**
   * - Maintains fast HTTP response times
   * - Enables reliable data synchronization
   * - Provides retry mechanisms for failed syncs
   */
  private async publishTimescaleSyncEvent(
    eventType: 'impression' | 'click',
    eventId: string,
  ) {
    try {
      await this.kafka.publish(kafkaTopics.TIMESTREAM_SYNC, {
        eventType: 'REAL_TIME_SYNC',
        tableName: eventType === 'impression' ? 'impressions' : 'clicks',
        eventId,
        [`${eventType}Id`]: eventId,
        timestamp: new Date().toISOString(),
      });

      this.logger.debug(
        `TimescaleDB sync event published for ${eventType}: ${eventId}`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to publish TimescaleDB sync event for ${eventType} ${eventId}:`,
        error,
      );
      // Don't throw - sync failure shouldn't break impression tracking
    }
  }

  /**
   * Track impression from DTO (for batch processing)
   *
   * **Why separate DTO method:**
   * - Enables batch processing with different validation
   * - Supports API-based impression reporting
   * - Allows for different context sources
   */
  async trackImpressionFromDTO(
    impressionDto: ImpressionEventDto,
  ): Promise<any> {
    const userContext = {
      userId: impressionDto.userId,
      sessionId: impressionDto.sessionId,
      userAgent: impressionDto.userAgent,
      ipAddress: impressionDto.ipAddress,
      deviceType: impressionDto.deviceType,
      browserType: impressionDto.browserType,
      osType: impressionDto.osType,
      country: impressionDto.country,
      region: impressionDto.region,
      city: impressionDto.city,
    };

    const requestContext = {
      pageUrl: impressionDto.pageUrl,
      referrerUrl: impressionDto.referrerUrl,
      pageCategory: impressionDto.pageCategory,
      timestamp: impressionDto.timestamp || new Date().toISOString(),
      viewable: impressionDto.viewable,
      viewTime: impressionDto.viewTime,
      viewablePixels: impressionDto.viewablePixels,
    };

    return await this.trackImpression(
      impressionDto.bidResponseId,
      userContext,
      requestContext,
    );
  }

  // ==========================================
  // PRIVATE PROCESSING METHODS
  // ==========================================

  /**
   * Get bid response details from database
   *
   * **Why comprehensive bid response data:**
   * - Need campaign and creative IDs for tracking
   * - Price information for budget management
   * - Advertiser data for revenue attribution
   * - Creative data for performance analysis
   */
  private async getBidResponse(bidResponseId: string): Promise<any> {
    try {
      const bidResponse = await this.prisma.bidResponse.findUnique({
        where: { id: bidResponseId },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              advertiserId: true,
              bidStrategy: true,
            },
          },
          creative: {
            select: {
              id: true,
              name: true,
              type: true,
              landingUrl: true,
            },
          },
          bidRequest: {
            select: {
              id: true,
              inventoryId: true,
              publisherId: true,
              websiteId: true,
            },
          },
        },
      });

      if (!bidResponse) {
        this.logger.warn('Bid response not found', { bidResponseId });
        return null;
      }

      return bidResponse;
    } catch (error) {
      this.logger.error('Failed to get bid response', {
        error: error.message,
        bidResponseId,
      });
      throw error;
    }
  }

  /**
   * Check for duplicate impressions
   *
   * **Why duplicate detection matters:**
   * - Prevents double billing for same impression
   * - Maintains accurate performance metrics
   * - Detects potential fraud or technical issues
   * - Industry standard practice
   */
  private async checkDuplicateImpression(
    bidResponseId: string,
    userId?: string,
    sessionId?: string,
  ): Promise<boolean> {
    try {
      // Check for recent duplicate based on available identifiers
      const duplicateChecks = [];

      // Check by bid response ID + user ID (if available)
      if (userId) {
        const userKey = `dup:imp:${bidResponseId}:${userId}`;
        duplicateChecks.push(this.redis.get(userKey));
      }

      // Check by bid response ID + session ID (if available)
      if (sessionId) {
        const sessionKey = `dup:imp:${bidResponseId}:${sessionId}`;
        duplicateChecks.push(this.redis.get(sessionKey));
      }

      // Check by bid response ID only (as fallback)
      const bidKey = `dup:imp:${bidResponseId}`;
      duplicateChecks.push(this.redis.get(bidKey));

      const results = await Promise.all(duplicateChecks);
      const hasDuplicate = results.some((result) => result !== null);

      if (!hasDuplicate) {
        // Set duplicate prevention keys with 1-hour TTL
        const ttl = 3600;
        const promises = [];

        if (userId) {
          promises.push(
            this.redis.set(`dup:imp:${bidResponseId}:${userId}`, '1', ttl),
          );
        }
        if (sessionId) {
          promises.push(
            this.redis.set(`dup:imp:${bidResponseId}:${sessionId}`, '1', ttl),
          );
        }
        promises.push(this.redis.set(`dup:imp:${bidResponseId}`, '1', ttl));

        await Promise.all(promises);
      }

      return hasDuplicate;
    } catch (error) {
      this.logger.warn('Duplicate check failed', {
        error: error.message,
        bidResponseId,
      });
      return false; // Fail open to not block legitimate impressions
    }
  }

  /**
   * Create comprehensive impression event record
   *
   * **Why comprehensive data collection:**
   * - Enables detailed performance analysis
   * - Supports fraud detection algorithms
   * - Provides data for ML-based optimizations
   * - Required for viewability measurement
   */
  private async createImpressionEvent(
    bidResponse: any,
    userContext: any,
    requestContext: any,
  ): Promise<any> {
    try {
      const impressionData = {
        // Primary identifiers
        creativeId: bidResponse.creativeId,
        bidResponseId: bidResponse.id,

        // Hierarchy for analytics
        campaignId: bidResponse.campaignId,
        advertiserId: bidResponse.campaign.advertiserId,
        inventoryId: bidResponse.bidRequest.inventoryId,
        publisherId: bidResponse.bidRequest.publisherId,
        websiteId: bidResponse.bidRequest.websiteId,

        // Financial data
        price: bidResponse.finalPrice || bidResponse.bidPrice,
        publisherRevenue: this.calculatePublisherRevenue(
          bidResponse.finalPrice || bidResponse.bidPrice,
        ),

        // User context
        userId: userContext.userId,
        sessionId: userContext.sessionId,

        // Technical details
        userAgent: userContext.userAgent,
        ipAddress: userContext.ipAddress,
        deviceType: userContext.deviceType,
        browserType: userContext.browserType,
        osType: userContext.osType,

        // Geographic context
        country: userContext.country,
        region: userContext.region,
        city: userContext.city,

        // Viewability metrics
        viewable: requestContext.viewable,
        viewTime: requestContext.viewTime,
        viewablePixels: requestContext.viewablePixels,
        adSizePixels: this.calculateAdSize(bidResponse.creative),

        // Fraud detection
        isBot: this.detectBot(userContext.userAgent),
        fraudScore: await this.calculateFraudScore(userContext),

        // Attribution
        referrerUrl: requestContext.referrerUrl,
        pageUrl: requestContext.pageUrl,
        pageCategory: requestContext.pageCategory,

        // Sync status for Timestream
        syncedToTimestream: false,
      };

      const impression = await this.prisma.impressionEvent.create({
        data: impressionData,
      });

      this.logger.debug('Impression event created', {
        impressionId: impression.id,
        campaignId: impression.campaignId,
        price: impression.price,
      });

      return impression;
    } catch (error) {
      this.logger.error('Failed to create impression event', {
        error: error.message,
        bidResponseId: bidResponse.id,
      });
      throw error;
    }
  }

  /**
   * Update real-time performance counters
   *
   * **Why Redis counters are essential:**
   * - Provide sub-second performance metrics
   * - Enable real-time campaign optimization
   * - Support budget pacing decisions
   * - Feed into bid adjustment algorithms
   */
  @WithRetry(3, 100, 2, [Error])
  private async updateCounters(impression: any): Promise<void> {
    try {
      // Use RTB Redis service for sophisticated counter updates
      await this.rtbRedis.incrementImpressionCounters({
        creativeId: impression.creativeId,
        campaignId: impression.campaignId,
        inventoryId: impression.inventoryId,
        publisherId: impression.publisherId,
      });

      // Update hourly metrics for performance tracking
      const hour = new Date().getHours();
      const dateHour = `${new Date().toISOString().split('T')[0]}_${hour}`;

      await Promise.all([
        // Performance metrics
        this.redis.incr(`metrics:impressions:total:${dateHour}`),
        this.redis.incr(
          `metrics:impressions:${impression.deviceType}:${dateHour}`,
        ),
        this.redis.incrbyfloat(
          `metrics:revenue:total:${dateHour}`,
          Number(impression.price),
        ),

        // Viewability metrics (if available)
        ...(impression.viewable !== null
          ? [
              this.redis.incr(
                `metrics:impressions:${impression.viewable ? 'viewable' : 'nonviewable'}:${dateHour}`,
              ),
            ]
          : []),

        // Set expiration for metrics (7 days)
        this.redis.expire(
          `metrics:impressions:total:${dateHour}`,
          7 * 24 * 3600,
        ),
      ]);

      this.logger.debug('Impression counters updated', {
        impressionId: impression.id,
        campaignId: impression.campaignId,
      });
    } catch (error) {
      this.logger.error('Failed to update impression counters', {
        error: error.message,
        impressionId: impression.id,
      });
      // Don't throw - counter update failure shouldn't block impression tracking
    }
  }

  /**
   * Update campaign spend atomically
   *
   * **Why atomic spend updates:**
   * - Prevents budget overspend in high-traffic scenarios
   * - Maintains accurate financial tracking
   * - Enables real-time budget alerts
   * - Required for campaign pacing
   */
  private async updateCampaignSpend(impression: any): Promise<void> {
    try {
      const spendAmount = Number(impression.price);

      const spendResult = await this.rtbRedis.incrementCampaignSpend(
        impression.campaignId,
        spendAmount,
      );

      if (!spendResult.success) {
        this.logger.warn('Campaign spend increment failed - budget exhausted', {
          campaignId: impression.campaignId,
          requestedAmount: spendAmount,
          remainingBudget: spendResult.remainingBudget,
        });

        // Publish budget exhaustion alert
        await this.publishBudgetAlert(
          impression.campaignId,
          spendResult.remainingBudget,
        );
      }

      this.logger.debug('Campaign spend updated', {
        campaignId: impression.campaignId,
        spendAmount,
        success: spendResult.success,
        newTotal: spendResult.newTotal,
      });
    } catch (error) {
      this.logger.error('Failed to update campaign spend', {
        error: error.message,
        campaignId: impression.campaignId,
        impressionId: impression.id,
      });
      // Don't throw - spend update failure shouldn't block impression tracking
    }
  }

  /**
   * Publish impression to Kafka for analytics
   *
   * **Why Kafka publishing:**
   * - Enables real-time analytics processing
   * - Supports data pipeline for ML models
   * - Provides audit trail for billing
   * - Enables integration with external systems
   */
  @WithRetry(3, 200, 2, [Error])
  private async publishToKafka(impression: any): Promise<void> {
    try {
      await this.kafka.publish(kafkaTopics.IMPRESSIONS, {
        key: impression.id,
        value: {
          ...impression,
          eventType: 'impression',
          publishedAt: new Date().toISOString(),
          version: '1.0',
        },
      });

      this.logger.debug('Impression published to Kafka', {
        impressionId: impression.id,
        topic: kafkaTopics.IMPRESSIONS,
      });
    } catch (error) {
      this.logger.error('Failed to publish impression to Kafka', {
        error: error.message,
        impressionId: impression.id,
      });
      // Don't throw - Kafka failure shouldn't block impression tracking
    }
  }

  /**
   * Update frequency capping counters
   *
   * **Why frequency capping matters:**
   * - Prevents ad fatigue for users
   * - Optimizes budget allocation
   * - Improves user experience
   * - Industry best practice
   */
  private async updateFrequencyCapping(impression: any): Promise<void> {
    try {
      if (!impression.userId) {
        return; // Can't apply frequency capping without user ID
      }

      // Update user-creative frequency counter
      await this.rtbRedis.checkAndUpdateFrequencyCap(
        impression.userId,
        impression.creativeId,
        10, // Max 10 impressions per user per creative (configurable)
        24, // 24-hour window
      );

      // Update user-campaign frequency counter
      const campaignFreqKey = REDIS_KEYS.USER_CAMPAIGN_FREQUENCY(
        impression.userId,
        impression.campaignId,
      );
      await this.redis.incr(campaignFreqKey);
      await this.redis.expire(campaignFreqKey, 24 * 3600); // 24-hour TTL

      this.logger.debug('Frequency capping updated', {
        userId: impression.userId,
        campaignId: impression.campaignId,
        creativeId: impression.creativeId,
      });
    } catch (error) {
      this.logger.warn('Failed to update frequency capping', {
        error: error.message,
        impressionId: impression.id,
      });
    }
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Calculate publisher revenue from impression price
   *
   * **Why revenue calculation:**
   * - Publishers need to see their earnings in real-time
   * - Revenue share typically 70-80% to publisher
   * - Required for accurate financial reporting
   */
  private calculatePublisherRevenue(impressionPrice: number): number {
    const PUBLISHER_REVENUE_SHARE = 0.75; // 75% to publisher
    return Number((impressionPrice * PUBLISHER_REVENUE_SHARE).toFixed(4));
  }

  /**
   * Calculate ad size in pixels
   */
  private calculateAdSize(creative: any): string | null {
    if (!creative?.adSlotTemplate) {
      return null;
    }

    return `${creative.adSlotTemplate.width}x${creative.adSlotTemplate.height}`;
  }

  /**
   * Detect if user agent indicates bot traffic
   *
   * **Why bot detection matters:**
   * - Prevents fraudulent impression billing
   * - Maintains traffic quality metrics
   * - Required for viewability measurement
   * - Protects advertiser ROI
   */
  private detectBot(userAgent: string): boolean {
    if (!userAgent) {
      return true; // Missing user agent is suspicious
    }

    const botIndicators = [
      'bot',
      'crawler',
      'spider',
      'scraper',
      'facebookexternalhit',
      'twitterbot',
      'linkedinbot',
      'googlebot',
      'bingbot',
      'slurp',
      'duckduckbot',
      'headlesschrome',
      'phantomjs',
      'selenium',
    ];

    const ua = userAgent.toLowerCase();
    return botIndicators.some((indicator) => ua.includes(indicator));
  }

  /**
   * Calculate fraud score based on user context
   *
   * **Why fraud scoring:**
   * - Identifies potentially fraudulent impressions
   * - Enables quality filtering
   * - Protects advertiser investment
   * - Industry standard practice
   */
  private async calculateFraudScore(userContext: any): Promise<number> {
    try {
      let fraudScore = 0;

      // Check for bot indicators
      if (this.detectBot(userContext.userAgent)) {
        fraudScore += 0.5;
      }

      // Check IP reputation (simplified)
      if (
        userContext.ipAddress === '127.0.0.1' ||
        userContext.ipAddress.startsWith('10.') ||
        userContext.ipAddress.startsWith('192.168.')
      ) {
        fraudScore += 0.3; // Private/local IPs are suspicious
      }

      // Check for missing context
      if (!userContext.country) {
        fraudScore += 0.1;
      }

      if (!userContext.deviceType || userContext.deviceType === 'unknown') {
        fraudScore += 0.1;
      }

      // Cap fraud score at 1.0
      return Math.min(fraudScore, 1.0);
    } catch (error) {
      this.logger.warn('Fraud score calculation failed', {
        error: error.message,
      });
      return 0; // Default to no fraud if calculation fails
    }
  }

  /**
   * Publish budget exhaustion alert
   */
  private async publishBudgetAlert(
    campaignId: string,
    remainingBudget: number,
  ): Promise<void> {
    try {
      await this.kafka.publish(kafkaTopics.CAMPAIGN_BUDGET_ALERTS, {
        key: campaignId,
        value: {
          campaignId,
          alertType: 'budget_exhausted',
          remainingBudget,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.warn('Failed to publish budget alert', {
        error: error.message,
        campaignId,
      });
    }
  }
}
