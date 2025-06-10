// src/rtb/services/click-tracking.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { KafkaService } from '../../kafka/kafka.service';
import { RedisService } from '../../redis/redis.service';
import { RTBRedisService } from '../../redis/services/rtb-redis.service';
import { kafkaTopics } from '../../kafka/constants/kafka.config';
import { WithRetry } from '../../common/resilience/retry.decorator';
import { v4 as uuidv4 } from 'uuid';
import { ClickEventDto } from '../dto';

/**
 * Click Tracking Service - Phase 5 Implementation
 *
 * **Core Responsibility: Process ad click events and calculate conversion metrics**
 *
 * **Why this service is critical:**
 * - Enables accurate click-through rate (CTR) calculation
 * - Supports conversion tracking and attribution
 * - Provides data for campaign optimization
 * - Required for cost-per-click (CPC) billing models
 *
 * **Key Functions:**
 * 1. Track individual click events with impression linkage
 * 2. Update real-time CTR and performance metrics
 * 3. Detect and prevent click fraud
 * 4. Support conversion tracking through landing page analysis
 * 5. Provide data for bid optimization algorithms
 *
 * **Performance Optimizations:**
 * - Async processing to maintain redirect speed
 * - Redis counters for real-time CTR calculation
 * - Efficient impression-to-click linking
 * - Fraud detection without blocking legitimate clicks
 */
@Injectable()
export class ClickTrackingService {
  private readonly logger = new Logger(ClickTrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaService,
    private readonly redis: RedisService,
    private readonly rtbRedis: RTBRedisService,
  ) {
    this.logger.log('Click Tracking Service initialized - Phase 5');
  }

  /**
   * Track click from HTTP request context
   *
   * **Why this method exists:**
   * - Primary entry point for click tracking
   * - Handles bid response validation and impression linking
   * - Coordinates all click processing steps
   * - Provides comprehensive error handling
   */
  async trackClick(
    bidResponseId: string,
    userContext: any,
    requestContext: any,
    redirectUrl: string,
  ): Promise<any> {
    const startTime = Date.now();

    this.logger.debug('Processing click', {
      bidResponseId,
      redirectUrl,
      userAgent: userContext.userAgent,
      ip: userContext.ipAddress,
    });

    try {
      // 1. Get bid response details and validate
      const bidResponse = await this.getBidResponse(bidResponseId);
      if (!bidResponse) {
        throw new NotFoundException(`Bid response ${bidResponseId} not found`);
      }

      // 2. Find associated impression event
      const impression = await this.findAssociatedImpression(
        bidResponseId,
        userContext.userId,
        userContext.sessionId,
      );

      // 3. Check for duplicate clicks
      const isDuplicate = await this.checkDuplicateClick(
        bidResponseId,
        userContext.userId,
        userContext.sessionId,
      );

      if (isDuplicate) {
        this.logger.warn('Duplicate click detected', {
          bidResponseId,
          userId: userContext.userId,
        });
        return { status: 'duplicate', bidResponseId, redirectUrl };
      }

      // Phase 6: NEW - Trigger TimescaleDB sync
      const eventID = uuidv4();
      await this.publishTimescaleSyncEvent('click', uuidv4());

      // 4. Detect potential click fraud
      const fraudScore = await this.calculateClickFraudScore(
        userContext,
        requestContext,
        impression,
      );

      if (fraudScore > 0.8) {
        this.logger.warn('High fraud score click detected', {
          bidResponseId,
          fraudScore,
          userId: userContext.userId,
        });
        // Still process but mark as fraudulent
      }

      // 5. Create comprehensive click event
      const click = await this.createClickEvent(
        eventID,
        bidResponse,
        impression,
        userContext,
        requestContext,
        redirectUrl,
        fraudScore,
      );

      // 6. Update real-time performance counters
      await this.updateCounters(click);

      // 7. Publish to Kafka for analytics pipeline
      await this.publishToKafka(click);

      // 8. Update click-based performance metrics
      await this.updatePerformanceMetrics(click);

      const processingTime = Date.now() - startTime;

      this.logger.log('✅ Click tracked successfully', {
        clickId: click.id,
        bidResponseId,
        campaignId: click.campaignId,
        impressionId: click.impressionId,
        processingTime: `${processingTime}ms`,
      });

      return click;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('❌ Click tracking failed', {
        error: error.message,
        bidResponseId,
        redirectUrl,
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
      await this.kafka.publish(kafkaTopics.TIMESCALE_SYNC, {
        key: `${eventType}-${eventId}`,
        value: {
          eventType: 'REAL_TIME_SYNC',
          tableName: eventType === 'impression' ? 'impressions' : 'clicks',
          eventId,
          [`${eventType}Id`]: eventId,
          timestamp: new Date().toISOString(),
        },
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
   * Track click from DTO (for batch processing)
   *
   * **Why separate DTO method:**
   * - Enables batch processing with different validation
   * - Supports API-based click reporting
   * - Allows for different context sources
   */
  async trackClickFromDTO(clickDto: ClickEventDto): Promise<any> {
    const userContext = {
      userId: clickDto.userId,
      sessionId: clickDto.sessionId,
      userAgent: clickDto.userAgent,
      ipAddress: clickDto.ipAddress,
      deviceType: clickDto.deviceType,
      country: clickDto.country,
    };

    const requestContext = {
      pageUrl: clickDto.pageUrl,
      referrerUrl: clickDto.referrerUrl,
      timestamp: clickDto.timestamp || new Date().toISOString(),
      clickX: clickDto.clickX,
      clickY: clickDto.clickY,
      clickArea: clickDto.clickArea,
    };

    return await this.trackClick(
      clickDto.bidResponseId,
      userContext,
      requestContext,
      clickDto.landingUrl,
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
   * - Creative data for click area analysis
   * - Campaign data for performance attribution
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
              adSlotTemplate: true,
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
   * Find associated impression event
   *
   * **Why impression linking matters:**
   * - Enables time-to-click analysis
   * - Supports conversion attribution
   * - Provides context for fraud detection
   * - Required for accurate CTR calculation
   */
  private async findAssociatedImpression(
    bidResponseId: string,
    userId?: string,
    sessionId?: string,
  ): Promise<any> {
    try {
      // Build search criteria starting from most specific
      const searchCriteria: any = {
        bidResponseId,
      };

      // Add user criteria if available
      if (userId) {
        searchCriteria.userId = userId;
      } else if (sessionId) {
        searchCriteria.sessionId = sessionId;
      }

      // Look for recent impression (within last 24 hours)
      searchCriteria.timestamp = {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      };

      const impression = await this.prisma.impressionEvent.findFirst({
        where: searchCriteria,
        orderBy: {
          timestamp: 'desc',
        },
      });

      if (impression) {
        this.logger.debug('Associated impression found', {
          impressionId: impression.id,
          bidResponseId,
          timeDiff: Date.now() - impression.timestamp.getTime(),
        });
      } else {
        this.logger.warn('No associated impression found', {
          bidResponseId,
          userId,
          sessionId,
        });
      }

      return impression;
    } catch (error) {
      this.logger.error('Failed to find associated impression', {
        error: error.message,
        bidResponseId,
      });
      return null;
    }
  }

  /**
   * Check for duplicate clicks
   *
   * **Why duplicate detection matters:**
   * - Prevents click fraud and accidental double-clicks
   * - Maintains accurate CTR metrics
   * - Protects advertiser budgets
   * - Industry standard practice
   */
  private async checkDuplicateClick(
    bidResponseId: string,
    userId?: string,
    sessionId?: string,
  ): Promise<boolean> {
    try {
      // Check for recent duplicate based on available identifiers
      const duplicateChecks = [];

      // Check by bid response ID + user ID (if available)
      if (userId) {
        const userKey = `dup:click:${bidResponseId}:${userId}`;
        duplicateChecks.push(this.redis.get(userKey));
      }

      // Check by bid response ID + session ID (if available)
      if (sessionId) {
        const sessionKey = `dup:click:${bidResponseId}:${sessionId}`;
        duplicateChecks.push(this.redis.get(sessionKey));
      }

      // Check by bid response ID only (as fallback)
      const bidKey = `dup:click:${bidResponseId}`;
      duplicateChecks.push(this.redis.get(bidKey));

      const results = await Promise.all(duplicateChecks);
      const hasDuplicate = results.some((result) => result !== null);

      if (!hasDuplicate) {
        // Set duplicate prevention keys with 1-hour TTL
        const ttl = 3600;
        const promises = [];

        if (userId) {
          promises.push(
            this.redis.set(`dup:click:${bidResponseId}:${userId}`, '1', ttl),
          );
        }
        if (sessionId) {
          promises.push(
            this.redis.set(`dup:click:${bidResponseId}:${sessionId}`, '1', ttl),
          );
        }
        promises.push(this.redis.set(`dup:click:${bidResponseId}`, '1', ttl));

        await Promise.all(promises);
      }

      return hasDuplicate;
    } catch (error) {
      this.logger.warn('Duplicate click check failed', {
        error: error.message,
        bidResponseId,
      });
      return false; // Fail open to not block legitimate clicks
    }
  }

  /**
   * Calculate click fraud score
   *
   * **Why click fraud detection:**
   * - Protects advertisers from fraudulent charges
   * - Maintains platform credibility
   * - Required for quality traffic metrics
   * - Industry standard practice
   */
  private async calculateClickFraudScore(
    userContext: any,
    requestContext: any,
    impression?: any,
  ): Promise<number> {
    try {
      let fraudScore = 0;

      // 1. Check time from impression to click
      if (impression) {
        const timeDiff = Date.now() - impression.timestamp.getTime();

        // Clicks within 100ms are suspicious (too fast for human)
        if (timeDiff < 100) {
          fraudScore += 0.4;
        } else if (timeDiff < 500) {
          fraudScore += 0.2;
        }

        // Clicks after 1 hour are also suspicious
        if (timeDiff > 60 * 60 * 1000) {
          fraudScore += 0.3;
        }
      }

      // 2. Check for bot indicators
      if (this.detectBot(userContext.userAgent)) {
        fraudScore += 0.5;
      }

      // 3. Check IP patterns
      const ipClickRate = await this.getIPClickRate(userContext.ipAddress);
      if (ipClickRate > 10) {
        // More than 10 clicks per hour from same IP
        fraudScore += 0.3;
      }

      // 4. Check missing context
      if (!userContext.userAgent || userContext.userAgent.length < 10) {
        fraudScore += 0.2;
      }

      // 5. Check for known fraudulent patterns
      if (
        userContext.ipAddress?.startsWith('10.') ||
        userContext.ipAddress?.startsWith('192.168.')
      ) {
        fraudScore += 0.2;
      }

      // Cap fraud score at 1.0
      return Math.min(fraudScore, 1.0);
    } catch (error) {
      this.logger.warn('Click fraud score calculation failed', {
        error: error.message,
      });
      return 0; // Default to no fraud if calculation fails
    }
  }

  /**
   * Create comprehensive click event record
   *
   * **Why comprehensive data collection:**
   * - Enables detailed click analysis
   * - Supports conversion attribution
   * - Provides data for fraud detection
   * - Required for performance optimization
   */
  private async createClickEvent(
    eventID: string,
    bidResponse: any,
    impression: any,
    userContext: any,
    requestContext: any,
    redirectUrl: string,
    fraudScore: number,
  ): Promise<any> {
    try {
      const clickData = {
        id: eventID,
        // Link to impression if found
        impressionId: impression?.id || null,

        // Primary identifiers
        creativeId: bidResponse.creativeId,
        bidResponseId: bidResponse.id,

        // Hierarchy for analytics
        campaignId: bidResponse.campaignId,
        advertiserId: bidResponse.campaign.advertiserId,
        inventoryId: bidResponse.bidRequest.inventoryId,
        publisherId: bidResponse.bidRequest.publisherId,
        websiteId: bidResponse.bidRequest.websiteId,

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

        // Click details
        clickX: requestContext.clickX,
        clickY: requestContext.clickY,
        clickArea:
          requestContext.clickArea ||
          this.determineClickArea(
            requestContext.clickX,
            requestContext.clickY,
            bidResponse.creative,
          ),

        // Landing page data
        landingUrl: redirectUrl,
        landingLoaded: null, // Will be updated by subsequent tracking

        // Fraud detection
        isBot: this.detectBot(userContext.userAgent),
        fraudScore,
        clickPattern: await this.determineClickPattern(userContext),

        // Attribution
        referrerUrl: requestContext.referrerUrl,
        pageUrl: requestContext.pageUrl,
        timeFromImpression: impression
          ? Date.now() - impression.timestamp.getTime()
          : null,

        // Sync status for Timescale
        syncedToTimescale: false,
      };

      const click = await this.prisma.clickEvent.create({
        data: clickData,
      });

      this.logger.debug('Click event created', {
        clickId: click.id,
        campaignId: click.campaignId,
        impressionId: click.impressionId,
        fraudScore,
      });

      return click;
    } catch (error) {
      this.logger.error('Failed to create click event', {
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
   * - Provide sub-second CTR metrics
   * - Enable real-time campaign optimization
   * - Support bid adjustment algorithms
   * - Feed into performance dashboards
   */
  @WithRetry(3, 100, 2, [Error])
  private async updateCounters(click: any): Promise<void> {
    try {
      // Use RTB Redis service for sophisticated counter updates
      await this.rtbRedis.incrementClickCounters({
        creativeId: click.creativeId,
        campaignId: click.campaignId,
        inventoryId: click.inventoryId,
        publisherId: click.publisherId,
      });

      // Update hourly metrics for performance tracking
      const hour = new Date().getHours();
      const dateHour = `${new Date().toISOString().split('T')[0]}_${hour}`;

      await Promise.all([
        // Click metrics
        this.redis.incr(`metrics:clicks:total:${dateHour}`),
        this.redis.incr(`metrics:clicks:${click.deviceType}:${dateHour}`),

        // Fraud metrics
        ...(click.fraudScore > 0.5
          ? [this.redis.incr(`metrics:clicks:fraudulent:${dateHour}`)]
          : []),

        // Set expiration for metrics (7 days)
        this.redis.expire(`metrics:clicks:total:${dateHour}`, 7 * 24 * 3600),
      ]);

      this.logger.debug('Click counters updated', {
        clickId: click.id,
        campaignId: click.campaignId,
      });
    } catch (error) {
      this.logger.error('Failed to update click counters', {
        error: error.message,
        clickId: click.id,
      });
      // Don't throw - counter update failure shouldn't block click tracking
    }
  }

  /**
   * Publish click to Kafka for analytics
   *
   * **Why Kafka publishing:**
   * - Enables real-time analytics processing
   * - Supports conversion tracking pipeline
   * - Provides audit trail for billing
   * - Enables integration with external systems
   */
  @WithRetry(3, 200, 2, [Error])
  private async publishToKafka(click: any): Promise<void> {
    try {
      await this.kafka.publish(kafkaTopics.CLICKS, {
        key: click.id,
        value: {
          ...click,
          eventType: 'click',
          publishedAt: new Date().toISOString(),
          version: '1.0',
        },
      });

      this.logger.debug('Click published to Kafka', {
        clickId: click.id,
        topic: kafkaTopics.CLICKS,
      });
    } catch (error) {
      this.logger.error('Failed to publish click to Kafka', {
        error: error.message,
        clickId: click.id,
      });
      // Don't throw - Kafka failure shouldn't block click tracking
    }
  }

  /**
   * Update click-based performance metrics
   *
   * **Why performance metrics matter:**
   * - Enable real-time CTR calculation
   * - Support bid optimization algorithms
   * - Provide campaign performance insights
   * - Required for quality score calculation
   */
  private async updatePerformanceMetrics(click: any): Promise<void> {
    try {
      // Update campaign-level CTR metrics
      const campaignMetrics = await this.rtbRedis.getPerformanceMetrics(
        click.campaignId,
        'campaign',
      );

      // Update creative-level CTR metrics
      const creativeMetrics = await this.rtbRedis.getPerformanceMetrics(
        click.creativeId,
        'creative',
      );

      // Store updated metrics for quick access
      const metricsData = {
        campaignCTR: campaignMetrics.ctr,
        creativeCTR: creativeMetrics.ctr,
        updatedAt: new Date().toISOString(),
      };

      // Cache performance metrics for bid optimization
      await this.redis.set(
        `performance:campaign:${click.campaignId}`,
        JSON.stringify(metricsData),
        300, // 5-minute cache
      );

      this.logger.debug('Performance metrics updated', {
        campaignId: click.campaignId,
        campaignCTR: campaignMetrics.ctr,
        creativeCTR: creativeMetrics.ctr,
      });
    } catch (error) {
      this.logger.warn('Failed to update performance metrics', {
        error: error.message,
        clickId: click.id,
      });
    }
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Detect if user agent indicates bot traffic
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
   * Get click rate for specific IP address
   */
  private async getIPClickRate(ipAddress: string): Promise<number> {
    try {
      const hour = new Date().getHours();
      const dateHour = `${new Date().toISOString().split('T')[0]}_${hour}`;
      const ipKey = `ip:clicks:${ipAddress}:${dateHour}`;

      const clickCount = (await this.redis.get<string>(ipKey)) || '0';

      // Increment and set expiration
      await this.redis.incr(ipKey);
      await this.redis.expire(ipKey, 3600); // 1-hour expiration

      return parseInt(clickCount);
    } catch (error) {
      this.logger.warn('Failed to get IP click rate', {
        error: error.message,
        ipAddress,
      });
      return 0;
    }
  }

  /**
   * Determine click area based on coordinates and ad size
   */
  private determineClickArea(
    clickX?: number,
    clickY?: number,
    creative?: any,
  ): string {
    if (!clickX || !clickY || !creative?.adSlotTemplate) {
      return 'unknown';
    }

    const width = creative.adSlotTemplate.width;
    const height = creative.adSlotTemplate.height;

    // Determine area based on relative position
    const relativeX = clickX / width;
    const relativeY = clickY / height;

    if (relativeX < 0.33) {
      return relativeY < 0.33
        ? 'top-left'
        : relativeY > 0.66
          ? 'bottom-left'
          : 'left';
    } else if (relativeX > 0.66) {
      return relativeY < 0.33
        ? 'top-right'
        : relativeY > 0.66
          ? 'bottom-right'
          : 'right';
    } else {
      return relativeY < 0.33 ? 'top' : relativeY > 0.66 ? 'bottom' : 'center';
    }
  }

  /**
   * Determine click pattern for fraud detection
   */
  private async determineClickPattern(userContext: any): Promise<string> {
    try {
      if (!userContext.userId) {
        return 'unknown';
      }

      // Check recent click history for this user
      const recentClicks = await this.prisma.clickEvent.count({
        where: {
          userId: userContext.userId,
          timestamp: {
            gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
          },
        },
      });

      if (recentClicks > 10) {
        return 'rapid_fire';
      } else if (recentClicks > 5) {
        return 'frequent';
      } else {
        return 'normal';
      }
    } catch (error) {
      this.logger.warn('Failed to determine click pattern', {
        error: error.message,
        userId: userContext.userId,
      });
      return 'unknown';
    }
  }
}
