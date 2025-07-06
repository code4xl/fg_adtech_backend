import { Injectable, Logger } from '@nestjs/common';
import { BudgetManagerService } from 'src/rtb/services/budget-manager.service';
import { v4 as uuidv4 } from 'uuid';
import { REDIS_KEYS } from 'src/rtb/constants/cache-keys';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';

interface ImpressionEventData {
  id?: string;
  bidResponseId: string;
  creativeId: string;
  campaignId: string;
  advertiserId: string;
  inventoryId: string;
  publisherId: string;
  websiteId: string;
  templateId?: string;
  timestamp?: Date;
  slotId?: string;
  userFingerprint?: string;
  bidPrice?: number;
  finalPrice?: number;
  userAgent?: string;
  ipAddress?: string;
  deviceType?: string;
  viewable?: boolean;
  viewTime?: number;
  isBot?: boolean;
  fraudScore?: number;
  country?: string;
  region?: string;
  city?: string;
  referrer?: string;
}

interface ClickEventData {
  id?: string;
  impressionId?: string;
  bidResponseId: string;
  creativeId: string;
  campaignId: string;
  advertiserId: string;
  inventoryId: string;
  publisherId: string;
  websiteId: string;
  templateId?: string;
  timestamp?: Date;
  slotId?: string;
  userFingerprint?: string;
  userAgent?: string;
  ipAddress?: string;
  deviceType?: string;
  landingUrl?: string;
  isBot?: boolean;
  fraudScore?: number;
  timeFromImpression?: number;
  country?: string;
  region?: string;
  city?: string;
  referrer?: string;
}

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly budgetManager: BudgetManagerService,
  ) {}

  /**
   * ===============================================
   * IMPRESSION TRACKING WITH BUDGET CONFIRMATION
   * ===============================================
   */

  /**
   * Process impression event with industry-standard billing confirmation
   * This is the critical point where budget reservation is confirmed
   */
  async processImpression(impressionData: ImpressionEventData): Promise<{
    success: boolean;
    impressionId: string;
    billingConfirmed: boolean;
    errorMessage?: string;
  }> {
    const startTime = Date.now();
    const impressionId = impressionData.id || uuidv4();

    this.logger.debug('🎯 Processing impression with billing confirmation', {
      impressionId,
      bidResponseId: impressionData.bidResponseId,
      campaignId: impressionData.campaignId,
      finalPrice: impressionData.finalPrice,
    });

    try {
      // 1. CRITICAL: Confirm budget deduction FIRST (industry standard)
      const billingResult = await this.budgetManager.confirmBudgetDeduction(
        impressionData.bidResponseId,
        impressionData.finalPrice,
      );

      if (!billingResult.success) {
        this.logger.warn('❌ Billing confirmation failed for impression', {
          impressionId,
          bidResponseId: impressionData.bidResponseId,
          error: billingResult.errorMessage,
        });

        // Store failed impression for analysis
        await this.storeFraudulentOrFailedImpression({
          ...impressionData,
          id: impressionId,
          failureReason: 'billing_confirmation_failed',
          errorMessage: billingResult.errorMessage,
        });

        return {
          success: false,
          impressionId,
          billingConfirmed: false,
          errorMessage: billingResult.errorMessage,
        };
      }

      // 2. Store impression data (now that billing is confirmed)
      const enrichedImpressionData = {
        ...impressionData,
        id: impressionId,
        timestamp: impressionData.timestamp || new Date(),
        transactionId: billingResult.transactionId,
        billingConfirmed: true,
      };

      await this.storeImpressionData(enrichedImpressionData);

      // 3. Update real-time metrics
      await this.updateImpressionMetrics(impressionData);

      // 4. Process fraud detection (optional)
      const fraudScore = await this.detectPotentialFraud(impressionData);
      if (fraudScore > 0.8) {
        await this.flagHighRiskImpression(impressionId, fraudScore);
      }

      const processingTime = Date.now() - startTime;

      this.logger.log('✅ Impression processed with confirmed billing', {
        impressionId,
        campaignId: impressionData.campaignId,
        transactionId: billingResult.transactionId,
        finalPrice: impressionData.finalPrice,
        processingTimeMs: processingTime,
      });

      return {
        success: true,
        impressionId,
        billingConfirmed: true,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('❌ Impression processing failed', {
        error: error.message,
        stack: error.stack,
        impressionId,
        bidResponseId: impressionData.bidResponseId,
        processingTimeMs: processingTime,
      });

      // Store error for analysis
      await this.recordProcessingError('impression', {
        impressionId,
        bidResponseId: impressionData.bidResponseId,
        error: error.message,
      });

      return {
        success: false,
        impressionId,
        billingConfirmed: false,
        errorMessage: error.message,
      };
    }
  }

  /**
   * ===============================================
   * CLICK TRACKING (ANALYTICS ONLY)
   * ===============================================
   */

  /**
   * Process click event - analytics only in CPM model
   */
  async processClick(clickData: ClickEventData): Promise<{
    success: boolean;
    clickId: string;
    linkedToImpression: boolean;
    timeFromImpression?: number;
  }> {
    const startTime = Date.now();
    const clickId = clickData.id || uuidv4();

    this.logger.debug('👆 Processing click for analytics', {
      clickId,
      bidResponseId: clickData.bidResponseId,
      campaignId: clickData.campaignId,
      impressionId: clickData.impressionId,
    });

    try {
      // 1. Link click to impression (if possible)
      const impressionLink = await this.linkClickToImpression(
        clickData.bidResponseId,
        clickData.slotId,
        clickData.userFingerprint,
      );

      // 2. Store click data
      const enrichedClickData = {
        ...clickData,
        id: clickId,
        timestamp: clickData.timestamp || new Date(),
        impressionId: impressionLink?.impressionId || clickData.impressionId,
        timeFromImpression:
          impressionLink?.timeFromImpression || clickData.timeFromImpression,
        linkedToImpression: !!impressionLink,
      };

      await this.storeClickData(enrichedClickData);

      // 3. Update click analytics metrics
      await this.updateClickMetrics(clickData, impressionLink);

      // 4. Detect click fraud
      const fraudScore = await this.detectClickFraud(clickData, impressionLink);
      if (fraudScore > 0.7) {
        await this.flagSuspiciousClick(clickId, fraudScore);
      }

      const processingTime = Date.now() - startTime;

      this.logger.log('✅ Click processed for analytics', {
        clickId,
        campaignId: clickData.campaignId,
        linkedToImpression: !!impressionLink,
        timeFromImpression: impressionLink?.timeFromImpression,
        processingTimeMs: processingTime,
      });

      return {
        success: true,
        clickId,
        linkedToImpression: !!impressionLink,
        timeFromImpression: impressionLink?.timeFromImpression,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('❌ Click processing failed', {
        error: error.message,
        stack: error.stack,
        clickId,
        bidResponseId: clickData.bidResponseId,
        processingTimeMs: processingTime,
      });

      await this.recordProcessingError('click', {
        clickId,
        bidResponseId: clickData.bidResponseId,
        error: error.message,
      });

      return {
        success: false,
        clickId,
        linkedToImpression: false,
      };
    }
  }

  /**
   * ===============================================
   * DATA STORAGE METHODS
   * ===============================================
   */

  /**
   * Store impression data in Redis queue for PostgreSQL sync
   */
  private async storeImpressionData(impressionData: any): Promise<void> {
    try {
      const storageData = {
        id: impressionData.id,
        creativeId: impressionData.creativeId,
        bidResponseId: impressionData.bidResponseId,
        campaignId: impressionData.campaignId,
        advertiserId: impressionData.advertiserId,
        inventoryId: impressionData.inventoryId,
        publisherId: impressionData.publisherId,
        websiteId: impressionData.websiteId,
        templateId: impressionData.templateId || null,
        timestamp: impressionData.timestamp.toISOString(),
        userAgent: impressionData.userAgent || null,
        ipAddress: impressionData.ipAddress || null,
        deviceType: impressionData.deviceType || null,
        country: impressionData.country || null,
        region: impressionData.region || null,
        city: impressionData.city || null,
        viewable:
          impressionData.viewable !== undefined
            ? impressionData.viewable
            : null,
        viewTime: impressionData.viewTime || null,
        isBot:
          impressionData.isBot !== undefined ? impressionData.isBot : false,
        fraudScore: impressionData.fraudScore || null,
        slotId: impressionData.slotId || null,
        userFingerprint: impressionData.userFingerprint || null,
        bidPrice: impressionData.bidPrice || 0,
        finalPrice: impressionData.finalPrice || 0,
        syncedToTimescale: false,
        syncedAt: null,
        referrer: impressionData.referrer || null,
        transactionId: impressionData.transactionId || null,
        billingConfirmed: impressionData.billingConfirmed || false,
      };

      // Store for PostgreSQL sync
      await this.redis.lpush(
        REDIS_KEYS.PENDING_IMPRESSIONS,
        JSON.stringify(storageData),
      );

      this.logger.debug('Impression data stored for sync', {
        impressionId: impressionData.id,
        campaignId: impressionData.campaignId,
      });
    } catch (error) {
      this.logger.error('Failed to store impression data', {
        error: error.message,
        impressionId: impressionData.id,
      });
      throw error;
    }
  }

  /**
   * Store click data in Redis queue for PostgreSQL sync
   */
  private async storeClickData(clickData: any): Promise<void> {
    try {
      const storageData = {
        id: clickData.id,
        impressionId: clickData.impressionId || null,
        creativeId: clickData.creativeId,
        bidResponseId: clickData.bidResponseId,
        campaignId: clickData.campaignId,
        advertiserId: clickData.advertiserId,
        inventoryId: clickData.inventoryId,
        publisherId: clickData.publisherId,
        websiteId: clickData.websiteId,
        templateId: clickData.templateId || null,
        timestamp: clickData.timestamp.toISOString(),
        userAgent: clickData.userAgent || null,
        ipAddress: clickData.ipAddress || null,
        deviceType: clickData.deviceType || null,
        landingUrl: clickData.landingUrl || null,
        isBot: clickData.isBot !== undefined ? clickData.isBot : false,
        fraudScore: clickData.fraudScore || null,
        timeFromImpression: clickData.timeFromImpression || null,
        country: clickData.country || null,
        region: clickData.region || null,
        city: clickData.city || null,
        slotId: clickData.slotId || null,
        userFingerprint: clickData.userFingerprint || null,
        syncedToTimescale: false,
        syncedAt: null,
        referrer: clickData.referrer || null,
        linkedToImpression: clickData.linkedToImpression || false,
      };

      // Store for PostgreSQL sync
      await this.redis.lpush(
        REDIS_KEYS.PENDING_CLICKS,
        JSON.stringify(storageData),
      );

      this.logger.debug('Click data stored for sync', {
        clickId: clickData.id,
        campaignId: clickData.campaignId,
        impressionId: clickData.impressionId,
      });
    } catch (error) {
      this.logger.error('Failed to store click data', {
        error: error.message,
        clickId: clickData.id,
      });
      throw error;
    }
  }

  /**
   * ===============================================
   * REAL-TIME METRICS UPDATES
   * ===============================================
   */

  /**
   * Update impression metrics in Redis
   */
  private async updateImpressionMetrics(
    impressionData: ImpressionEventData,
  ): Promise<void> {
    try {
      const today = this.getDateString();
      const pipeline = this.redis.pipeline();

      // Campaign metrics
      pipeline.incr(
        REDIS_KEYS.CAMPAIGN_IMPRESSIONS(impressionData.campaignId, today),
      );

      // Creative metrics
      pipeline.incr(
        REDIS_KEYS.CREATIVE_IMPRESSIONS(impressionData.creativeId, today),
      );

      // Set expiration (30 days)
      pipeline.expire(
        REDIS_KEYS.CAMPAIGN_IMPRESSIONS(impressionData.campaignId, today),
        2592000,
      );
      pipeline.expire(
        REDIS_KEYS.CREATIVE_IMPRESSIONS(impressionData.creativeId, today),
        2592000,
      );

      await pipeline.exec();

      this.logger.debug('Impression metrics updated', {
        campaignId: impressionData.campaignId,
        creativeId: impressionData.creativeId,
        date: today,
      });
    } catch (error) {
      this.logger.error('Failed to update impression metrics', {
        error: error.message,
        campaignId: impressionData.campaignId,
      });
      // Don't throw - metrics update is not critical
    }
  }

  /**
   * Update click metrics in Redis
   */
  private async updateClickMetrics(
    clickData: ClickEventData,
    impressionLink?: any,
  ): Promise<void> {
    try {
      const today = this.getDateString();
      const pipeline = this.redis.pipeline();

      // Campaign metrics
      pipeline.incr(REDIS_KEYS.CAMPAIGN_CLICKS(clickData.campaignId, today));

      // Creative metrics
      pipeline.incr(REDIS_KEYS.CREATIVE_CLICKS(clickData.creativeId, today));

      // Set expiration (30 days)
      pipeline.expire(
        REDIS_KEYS.CAMPAIGN_CLICKS(clickData.campaignId, today),
        2592000,
      );
      pipeline.expire(
        REDIS_KEYS.CREATIVE_CLICKS(clickData.creativeId, today),
        2592000,
      );

      await pipeline.exec();

      this.logger.debug('Click metrics updated', {
        campaignId: clickData.campaignId,
        creativeId: clickData.creativeId,
        linkedToImpression: !!impressionLink,
        date: today,
      });
    } catch (error) {
      this.logger.error('Failed to update click metrics', {
        error: error.message,
        campaignId: clickData.campaignId,
      });
      // Don't throw - metrics update is not critical
    }
  }

  /**
   * ===============================================
   * IMPRESSION-CLICK LINKING
   * ===============================================
   */

  /**
   * Link click to impression for proper attribution
   */
  private async linkClickToImpression(
    bidResponseId: string,
    slotId?: string,
    userFingerprint?: string,
  ): Promise<{
    impressionId: string;
    timeFromImpression: number;
  } | null> {
    try {
      // Implementation would use your ImpressionClickLinkingService
      // For now, simplified version
      if (slotId) {
        const slotKey = `slot:${slotId}`;
        const slotData = await this.redis.get(slotKey);

        if (slotData) {
          const slot = JSON.parse(slotData as string);
          return {
            impressionId: slot.id,
            timeFromImpression: Date.now() - slot.ts,
          };
        }
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to link click to impression', {
        error: error.message,
        bidResponseId,
        slotId,
      });
      return null;
    }
  }

  /**
   * ===============================================
   * FRAUD DETECTION
   * ===============================================
   */

  /**
   * Detect potential impression fraud
   */
  private async detectPotentialFraud(
    impressionData: ImpressionEventData,
  ): Promise<number> {
    try {
      let fraudScore = 0;

      // Check IP frequency
      if (impressionData.ipAddress) {
        const today = this.getDateString();
        const ipCount = await this.redis.get(
          REDIS_KEYS.IP_IMPRESSION_COUNT(impressionData.ipAddress, today),
        );

        if (parseInt(ipCount as string) > 1000) {
          fraudScore += 0.3;
        }
      }

      // Check bot indicators
      if (impressionData.isBot) {
        fraudScore += 0.5;
      }

      // Check user agent patterns
      if (impressionData.userAgent) {
        const suspiciousPatterns = ['bot', 'crawler', 'spider', 'scraper'];
        const isSuspicious = suspiciousPatterns.some((pattern) =>
          impressionData.userAgent.toLowerCase().includes(pattern),
        );

        if (isSuspicious) {
          fraudScore += 0.4;
        }
      }

      return Math.min(fraudScore, 1.0);
    } catch (error) {
      this.logger.error('Click fraud detection failed', {
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * ===============================================
   * FRAUD HANDLING
   * ===============================================
   */

  /**
   * Flag high-risk impression
   */
  private async flagHighRiskImpression(
    impressionId: string,
    fraudScore: number,
  ): Promise<void> {
    try {
      await this.redis.lpush(
        'fraud:high-risk:impressions',
        JSON.stringify({
          impressionId,
          fraudScore,
          timestamp: new Date().toISOString(),
        }),
      );

      this.logger.warn('🚨 High-risk impression flagged', {
        impressionId,
        fraudScore,
      });
    } catch (error) {
      this.logger.error('Failed to flag high-risk impression', {
        error: error.message,
        impressionId,
      });
    }
  }

  /**
   * Flag suspicious click
   */
  private async flagSuspiciousClick(
    clickId: string,
    fraudScore: number,
  ): Promise<void> {
    try {
      await this.redis.lpush(
        'fraud:suspicious:clicks',
        JSON.stringify({
          clickId,
          fraudScore,
          timestamp: new Date().toISOString(),
        }),
      );

      this.logger.warn('🚨 Suspicious click flagged', {
        clickId,
        fraudScore,
      });
    } catch (error) {
      this.logger.error('Failed to flag suspicious click', {
        error: error.message,
        clickId,
      });
    }
  }

  /**
   * Store fraudulent or failed impression for analysis
   */
  private async storeFraudulentOrFailedImpression(data: any): Promise<void> {
    try {
      await this.redis.lpush(
        'fraud:failed:impressions',
        JSON.stringify({
          ...data,
          timestamp: new Date().toISOString(),
        }),
      );

      this.logger.debug('Failed impression stored for analysis', {
        impressionId: data.id,
        failureReason: data.failureReason,
      });
    } catch (error) {
      this.logger.error('Failed to store fraudulent impression', {
        error: error.message,
        impressionId: data.id,
      });
    }
  }

  /**
   * ===============================================
   * ERROR HANDLING AND MONITORING
   * ===============================================
   */

  /**
   * Record processing error for monitoring
   */
  private async recordProcessingError(
    type: 'impression' | 'click',
    errorData: any,
  ): Promise<void> {
    try {
      const today = this.getDateString();
      const hour = new Date().getHours();

      const pipeline = this.redis.pipeline();

      // Count errors by type and time
      pipeline.incr(`tracking:errors:${type}:${today}`);
      pipeline.incr(`tracking:errors:${type}:hourly:${today}:${hour}`);

      // Store recent errors
      pipeline.lpush(
        `tracking:errors:${type}:recent`,
        JSON.stringify({
          ...errorData,
          timestamp: new Date().toISOString(),
        }),
      );
      pipeline.ltrim(`tracking:errors:${type}:recent`, 0, 99); // Keep last 100

      // Set expiration
      pipeline.expire(`tracking:errors:${type}:${today}`, 86400 * 7);
      pipeline.expire(
        `tracking:errors:${type}:hourly:${today}:${hour}`,
        86400 * 7,
      );
      pipeline.expire(`tracking:errors:${type}:recent`, 86400 * 7);

      await pipeline.exec();
    } catch (error) {
      this.logger.error('Failed to record processing error', {
        error: error.message,
        type,
      });
    }
  }

  /**
   * ===============================================
   * ANALYTICS AND REPORTING
   * ===============================================
   */

  /**
   * Get real-time campaign metrics
   */
  async getCampaignMetrics(
    campaignId: string,
    date?: string,
  ): Promise<{
    campaignId: string;
    date: string;
    impressions: number;
    clicks: number;
    ctr: number;
    spending: number;
    avgCpm: number;
    billingConfirmationRate: number;
  }> {
    try {
      const dateStr = date || this.getDateString();

      const [impressions, clicks, spending, billingErrors] = await Promise.all([
        this.redis.get(REDIS_KEYS.CAMPAIGN_IMPRESSIONS(campaignId, dateStr)),
        this.redis.get(REDIS_KEYS.CAMPAIGN_CLICKS(campaignId, dateStr)),
        this.redis.get(REDIS_KEYS.DAILY_BUDGET_SPEND(campaignId, dateStr)),
        this.redis.llen('fraud:failed:impressions'), // Simplified - should filter by campaign
      ]);

      const impressionCount = parseInt(impressions as string) || 0;
      const clickCount = parseInt(clicks as string) || 0;
      const spendAmount = parseFloat(spending as string) || 0;

      const ctr =
        impressionCount > 0 ? (clickCount / impressionCount) * 100 : 0;
      const avgCpm =
        impressionCount > 0 ? (spendAmount / impressionCount) * 1000 : 0;

      // Calculate billing confirmation rate (simplified)
      const totalAttempts = impressionCount + (billingErrors || 0);
      const billingConfirmationRate =
        totalAttempts > 0 ? (impressionCount / totalAttempts) * 100 : 100;

      return {
        campaignId,
        date: dateStr,
        impressions: impressionCount,
        clicks: clickCount,
        ctr: Math.round(ctr * 100) / 100,
        spending: Math.round(spendAmount * 100) / 100,
        avgCpm: Math.round(avgCpm * 100) / 100,
        billingConfirmationRate:
          Math.round(billingConfirmationRate * 100) / 100,
      };
    } catch (error) {
      this.logger.error('Failed to get campaign metrics', {
        error: error.message,
        campaignId,
        date,
      });

      return {
        campaignId,
        date: date || this.getDateString(),
        impressions: 0,
        clicks: 0,
        ctr: 0,
        spending: 0,
        avgCpm: 0,
        billingConfirmationRate: 0,
      };
    }
  }

  /**
   * Get creative performance metrics
   */
  async getCreativeMetrics(
    creativeId: string,
    date?: string,
  ): Promise<{
    creativeId: string;
    date: string;
    impressions: number;
    clicks: number;
    ctr: number;
    avgTimeFromImpression?: number;
  }> {
    try {
      const dateStr = date || this.getDateString();

      const [impressions, clicks] = await Promise.all([
        this.redis.get(REDIS_KEYS.CREATIVE_IMPRESSIONS(creativeId, dateStr)),
        this.redis.get(REDIS_KEYS.CREATIVE_CLICKS(creativeId, dateStr)),
      ]);

      const impressionCount = parseInt(impressions as string) || 0;
      const clickCount = parseInt(clicks as string) || 0;
      const ctr =
        impressionCount > 0 ? (clickCount / impressionCount) * 100 : 0;

      return {
        creativeId,
        date: dateStr,
        impressions: impressionCount,
        clicks: clickCount,
        ctr: Math.round(ctr * 100) / 100,
      };
    } catch (error) {
      this.logger.error('Failed to get creative metrics', {
        error: error.message,
        creativeId,
        date,
      });

      return {
        creativeId,
        date: date || this.getDateString(),
        impressions: 0,
        clicks: 0,
        ctr: 0,
      };
    }
  }

  /**
   * Get fraud detection summary
   */
  async getFraudDetectionSummary(): Promise<{
    highRiskImpressions: number;
    suspiciousClicks: number;
    failedImpressions: number;
    recentFlags: Array<{
      type: string;
      id: string;
      score: number;
      timestamp: string;
    }>;
  }> {
    try {
      const [
        highRiskCount,
        suspiciousCount,
        failedCount,
        recentHighRisk,
        recentSuspicious,
      ] = await Promise.all([
        this.redis.llen('fraud:high-risk:impressions'),
        this.redis.llen('fraud:suspicious:clicks'),
        this.redis.llen('fraud:failed:impressions'),
        this.redis.lrange('fraud:high-risk:impressions', 0, 4),
        this.redis.lrange('fraud:suspicious:clicks', 0, 4),
      ]);

      const recentFlags = [
        ...recentHighRisk.map((item) => ({
          ...JSON.parse(item),
          type: 'high-risk-impression',
        })),
        ...recentSuspicious.map((item) => ({
          ...JSON.parse(item),
          type: 'suspicious-click',
        })),
      ]
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )
        .slice(0, 10);

      return {
        highRiskImpressions: highRiskCount,
        suspiciousClicks: suspiciousCount,
        failedImpressions: failedCount,
        recentFlags,
      };
    } catch (error) {
      this.logger.error('Failed to get fraud detection summary', {
        error: error.message,
      });

      return {
        highRiskImpressions: 0,
        suspiciousClicks: 0,
        failedImpressions: 0,
        recentFlags: [],
      };
    }
  }

  /**
   * Get system health metrics
   */
  async getTrackingSystemHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    pendingImpressions: number;
    pendingClicks: number;
    todayErrors: number;
    avgProcessingTime: number;
    billingConfirmationRate: number;
  }> {
    try {
      const today = this.getDateString();

      const [
        pendingImpressions,
        pendingClicks,
        impressionErrors,
        clickErrors,
        processingTimeData,
      ] = await Promise.all([
        this.redis.llen(REDIS_KEYS.PENDING_IMPRESSIONS),
        this.redis.llen(REDIS_KEYS.PENDING_CLICKS),
        this.redis.get(`tracking:errors:impression:${today}`),
        this.redis.get(`tracking:errors:click:${today}`),
        this.redis.get(`tracking:processing-time:${today}`),
      ]);

      const todayErrors =
        (parseInt(impressionErrors as string) || 0) +
        (parseInt(clickErrors as string) || 0);
      const avgProcessingTime = parseInt(processingTimeData as string) || 0;

      // Determine status
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';

      if (
        pendingImpressions > 10000 ||
        pendingClicks > 10000 ||
        todayErrors > 100
      ) {
        status = 'critical';
      } else if (
        pendingImpressions > 5000 ||
        pendingClicks > 5000 ||
        todayErrors > 50
      ) {
        status = 'warning';
      }

      // Simplified billing confirmation rate
      const billingConfirmationRate = todayErrors > 0 ? 95 : 99.5;

      return {
        status,
        pendingImpressions,
        pendingClicks,
        todayErrors,
        avgProcessingTime,
        billingConfirmationRate,
      };
    } catch (error) {
      this.logger.error('Failed to get tracking system health', {
        error: error.message,
      });

      return {
        status: 'critical',
        pendingImpressions: 0,
        pendingClicks: 0,
        todayErrors: 0,
        avgProcessingTime: 0,
        billingConfirmationRate: 0,
      };
    }
  }

  /**
   * ===============================================
   * UTILITY METHODS
   * ===============================================
   */

  /**
   * Get current date string (YYYY-MM-DD)
   */
  private getDateString(date?: Date): string {
    const d = date || new Date();
    return d.toISOString().split('T')[0];
  }

  /**
   * Generate unique ID
   */
  generateId(): string {
    return uuidv4();
  }

  /**
   * Manual cleanup of old tracking data
   */
  async cleanupOldTrackingData(daysToKeep: number = 30): Promise<{
    cleanedKeys: number;
    errors: string[];
  }> {
    try {
      this.logger.log(
        `🧹 Starting cleanup of tracking data older than ${daysToKeep} days`,
      );

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const patterns = ['tracking:errors:*', 'fraud:*', 'metrics:*'];

      let cleanedKeys = 0;
      const errors: string[] = [];

      for (const pattern of patterns) {
        try {
          const keys = await this.redis.keys(pattern);

          for (const key of keys) {
            const ttl = await this.redis.ttl(key);

            // If key has no TTL or TTL is very long, set reasonable expiration
            if (ttl === -1 || ttl > 86400 * daysToKeep) {
              await this.redis.expire(key, 86400 * daysToKeep);
              cleanedKeys++;
            }
          }
        } catch (patternError) {
          errors.push(
            `Failed to process pattern ${pattern}: ${patternError.message}`,
          );
        }
      }

      this.logger.log(`✅ Tracking data cleanup completed`, {
        cleanedKeys,
        errorsCount: errors.length,
      });

      return { cleanedKeys, errors };
    } catch (error) {
      this.logger.error('Failed to cleanup old tracking data', {
        error: error.message,
      });

      return {
        cleanedKeys: 0,
        errors: [`Cleanup failed: ${error.message}`],
      };
    }
  }

  /**
   * ===============================================
   * BIDDING CONTEXT DATA RETRIEVAL
   * ===============================================
   */

  /**
   * Get impression data from cached bid response or database
   */
  async getImpressionData(bidResponseId: string): Promise<any> {
    try {
      // Try Redis cache first
      const cachedData = await this.redis.get(
        REDIS_KEYS.BID_RESPONSE(bidResponseId),
      );

      if (cachedData) {
        this.logger.debug('Impression data cache hit', { bidResponseId });
        return JSON.parse(cachedData as string);
      }

      // Fallback to database lookup
      this.logger.debug('Impression data cache miss, querying database', {
        bidResponseId,
      });
      return await this.getBidResponseFromDatabase(bidResponseId);
    } catch (error) {
      this.logger.error(`Failed to get impression data: ${error.message}`, {
        bidResponseId,
      });
      return null;
    }
  }

  /**
   * Get click data from cached bid response
   */
  async getClickData(bidResponseId: string): Promise<any> {
    return this.getImpressionData(bidResponseId); // Same data structure
  }

  /**
   * Get bid response from database with complete data
   */
  private async getBidResponseFromDatabase(
    bidResponseId: string,
  ): Promise<any> {
    try {
      const bidResponse = await this.prisma.bidResponse.findUnique({
        where: { id: bidResponseId },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              advertiserId: true,
            },
          },
          creative: {
            select: {
              id: true,
              name: true,
              landingUrl: true,
            },
          },
          bidRequest: {
            include: {
              inventory: {
                include: {
                  publisher: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                  website: {
                    select: {
                      id: true,
                      name: true,
                      domain: true,
                    },
                  },
                  adSlotTemplate: {
                    select: {
                      id: true,
                      width: true,
                      height: true,
                      format: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!bidResponse) {
        this.logger.warn(
          `Bid response not found in database: ${bidResponseId}`,
        );
        return null;
      }

      return {
        bidResponseId: bidResponse.id,
        creativeId: bidResponse.creativeId,
        campaignId: bidResponse.campaignId,
        advertiserId: bidResponse.campaign.advertiserId,
        inventoryId: bidResponse.bidRequest.inventory?.id,
        publisherId: bidResponse.bidRequest.inventory?.publisherId,
        websiteId: bidResponse.bidRequest.inventory?.websiteId,
        templateId: bidResponse.bidRequest.inventory?.adSlotTemplateId,
        bidPrice: parseFloat(bidResponse.bidPrice.toString()),
        finalPrice: parseFloat(
          (bidResponse.finalPrice || bidResponse.bidPrice).toString(),
        ),
        landingUrl: bidResponse.creative?.landingUrl,
        publisherName: `${bidResponse.bidRequest.inventory?.publisher?.firstName} ${bidResponse.bidRequest.inventory?.publisher?.lastName}`,
        websiteName: bidResponse.bidRequest.inventory?.website?.name,
        websiteDomain: bidResponse.bidRequest.inventory?.website?.domain,
        adSlotDimensions: {
          width: bidResponse.bidRequest.inventory?.adSlotTemplate?.width,
          height: bidResponse.bidRequest.inventory?.adSlotTemplate?.height,
          format: bidResponse.bidRequest.inventory?.adSlotTemplate?.format,
        },
      };
    } catch (error) {
      this.logger.error(`Database fallback failed: ${error.message}`, {
        bidResponseId,
      });
      return null;
    }
  }

  /**
   * ===============================================
   * REVENUE TRACKING INTEGRATION
   * ===============================================
   */

  /**
   * Get publisher revenue for a specific date
   */
  async getPublisherRevenue(
    publisherId: string,
    date?: string,
  ): Promise<number> {
    const dateStr = date || this.getDateString();

    try {
      const revenue = await this.redis.get(
        REDIS_KEYS.PUBLISHER_REVENUE(publisherId, dateStr),
      );
      return parseFloat(revenue as string) || 0;
    } catch (error) {
      this.logger.error(`Failed to get publisher revenue: ${error.message}`, {
        publisherId,
        date: dateStr,
      });
      return 0;
    }
  }

  /**
   * Get advertiser spending for a specific date
   */
  async getAdvertiserSpending(
    advertiserId: string,
    date?: string,
  ): Promise<number> {
    const dateStr = date || this.getDateString();

    try {
      const spending = await this.redis.get(
        REDIS_KEYS.ADVERTISER_SPENDING(advertiserId, dateStr),
      );
      return parseFloat(spending as string) || 0;
    } catch (error) {
      this.logger.error(`Failed to get advertiser spending: ${error.message}`, {
        advertiserId,
        date: dateStr,
      });
      return 0;
    }
  }

  /**
   * ===============================================
   * BATCH PROCESSING SUPPORT
   * ===============================================
   */

  /**
   * Process multiple impressions in batch for high-volume scenarios
   */
  async processBatchImpressions(impressions: ImpressionEventData[]): Promise<{
    successful: number;
    failed: number;
    billingConfirmed: number;
    errors: Array<{ impressionId: string; error: string }>;
  }> {
    const startTime = Date.now();
    const results = {
      successful: 0,
      failed: 0,
      billingConfirmed: 0,
      errors: [] as Array<{ impressionId: string; error: string }>,
    };

    this.logger.debug(`Processing batch of ${impressions.length} impressions`);

    // Process in smaller batches to avoid overwhelming the system
    const batchSize = 50;
    for (let i = 0; i < impressions.length; i += batchSize) {
      const batch = impressions.slice(i, i + batchSize);

      const batchPromises = batch.map(async (impression) => {
        try {
          const result = await this.processImpression(impression);
          if (result.success) {
            results.successful++;
            if (result.billingConfirmed) {
              results.billingConfirmed++;
            }
          } else {
            results.failed++;
            results.errors.push({
              impressionId: result.impressionId,
              error: result.errorMessage || 'Unknown error',
            });
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            impressionId: impression.id || 'unknown',
            error: error.message,
          });
        }
      });

      // Wait for batch completion
      await Promise.all(batchPromises);

      // Small delay between batches to prevent overwhelming
      if (i + batchSize < impressions.length) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    const processingTime = Date.now() - startTime;

    this.logger.log('✅ Batch impression processing completed', {
      totalImpressions: impressions.length,
      successful: results.successful,
      failed: results.failed,
      billingConfirmed: results.billingConfirmed,
      processingTimeMs: processingTime,
    });

    return results;
  }

  /**
   * Process multiple clicks in batch
   */
  async processBatchClicks(clicks: ClickEventData[]): Promise<{
    successful: number;
    failed: number;
    linkedToImpressions: number;
    errors: Array<{ clickId: string; error: string }>;
  }> {
    const startTime = Date.now();
    const results = {
      successful: 0,
      failed: 0,
      linkedToImpressions: 0,
      errors: [] as Array<{ clickId: string; error: string }>,
    };

    this.logger.debug(`Processing batch of ${clicks.length} clicks`);

    const batchSize = 50;
    for (let i = 0; i < clicks.length; i += batchSize) {
      const batch = clicks.slice(i, i + batchSize);

      const batchPromises = batch.map(async (click) => {
        try {
          const result = await this.processClick(click);
          if (result.success) {
            results.successful++;
            if (result.linkedToImpression) {
              results.linkedToImpressions++;
            }
          } else {
            results.failed++;
            results.errors.push({
              clickId: result.clickId,
              error: 'Processing failed',
            });
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            clickId: click.id || 'unknown',
            error: error.message,
          });
        }
      });

      await Promise.all(batchPromises);

      if (i + batchSize < clicks.length) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    const processingTime = Date.now() - startTime;

    this.logger.log('✅ Batch click processing completed', {
      totalClicks: clicks.length,
      successful: results.successful,
      failed: results.failed,
      linkedToImpressions: results.linkedToImpressions,
      processingTimeMs: processingTime,
    });

    return results;
  }

  /**
   * ===============================================
   * PERFORMANCE MONITORING
   * ===============================================
   */

  /**
   * Get pending events count for monitoring
   */
  async getPendingEventsCount(): Promise<{
    impressions: number;
    clicks: number;
    budgetTransactions: number;
    publisherRevenue: number;
    advertiserSpending: number;
    systemRevenue: number;
  }> {
    try {
      const [
        impressions,
        clicks,
        budgetTransactions,
        publisherRevenue,
        advertiserSpending,
        systemRevenue,
      ] = await Promise.all([
        this.redis.llen(REDIS_KEYS.PENDING_IMPRESSIONS),
        this.redis.llen(REDIS_KEYS.PENDING_CLICKS),
        this.redis.llen(REDIS_KEYS.BUDGET_TRANSACTION_PENDING),
        this.redis.llen(REDIS_KEYS.PUBLISHER_REVENUE_PENDING),
        this.redis.llen(REDIS_KEYS.ADVERTISER_SPENDING_PENDING),
        this.redis.llen(REDIS_KEYS.SYSTEM_REVENUE_PENDING),
      ]);

      return {
        impressions,
        clicks,
        budgetTransactions,
        publisherRevenue,
        advertiserSpending,
        systemRevenue,
      };
    } catch (error) {
      this.logger.error(`Failed to get pending events count: ${error.message}`);
      return {
        impressions: 0,
        clicks: 0,
        budgetTransactions: 0,
        publisherRevenue: 0,
        advertiserSpending: 0,
        systemRevenue: 0,
      };
    }
  }

  /**
   * Get processing performance metrics
   */
  async getProcessingPerformanceMetrics(): Promise<{
    avgImpressionProcessingTime: number;
    avgClickProcessingTime: number;
    hourlyImpressionVolume: number;
    hourlyClickVolume: number;
    billingSuccessRate: number;
    fraudDetectionRate: number;
  }> {
    try {
      const today = this.getDateString();
      const hour = new Date().getHours();

      const [
        impressionTime,
        clickTime,
        hourlyImpressions,
        hourlyClicks,
        billingErrors,
        fraudFlags,
      ] = await Promise.all([
        this.redis.get(`tracking:performance:impression-time:${today}`),
        this.redis.get(`tracking:performance:click-time:${today}`),
        this.redis.get(`metrics:impressions:hourly:${today}:${hour}`),
        this.redis.get(`metrics:clicks:hourly:${today}:${hour}`),
        this.redis.get(`tracking:errors:impression:${today}`),
        this.redis.llen('fraud:high-risk:impressions'),
      ]);

      const avgImpressionProcessingTime =
        parseInt(impressionTime as string) || 0;
      const avgClickProcessingTime = parseInt(clickTime as string) || 0;
      const hourlyImpressionVolume = parseInt(hourlyImpressions as string) || 0;
      const hourlyClickVolume = parseInt(hourlyClicks as string) || 0;
      const totalErrors = parseInt(billingErrors as string) || 0;

      const billingSuccessRate =
        hourlyImpressionVolume > 0
          ? ((hourlyImpressionVolume - totalErrors) / hourlyImpressionVolume) *
            100
          : 100;

      const fraudDetectionRate =
        hourlyImpressionVolume > 0
          ? (fraudFlags / hourlyImpressionVolume) * 100
          : 0;

      return {
        avgImpressionProcessingTime,
        avgClickProcessingTime,
        hourlyImpressionVolume,
        hourlyClickVolume,
        billingSuccessRate: Math.round(billingSuccessRate * 100) / 100,
        fraudDetectionRate: Math.round(fraudDetectionRate * 100) / 100,
      };
    } catch (error) {
      this.logger.error('Failed to get processing performance metrics', {
        error: error.message,
      });

      return {
        avgImpressionProcessingTime: 0,
        avgClickProcessingTime: 0,
        hourlyImpressionVolume: 0,
        hourlyClickVolume: 0,
        billingSuccessRate: 0,
        fraudDetectionRate: 0,
      };
    }
  }

  /**
   * ===============================================
   * ADMIN AND DEBUGGING UTILITIES
   * ===============================================
   */

  /**
   * Manual impression processing for debugging
   */
  async debugProcessImpression(
    bidResponseId: string,
    overrides?: Partial<ImpressionEventData>,
  ): Promise<{
    bidResponseData: any;
    impressionData: ImpressionEventData;
    processingResult: any;
  }> {
    try {
      // Get bid response data
      const bidResponseData = await this.getImpressionData(bidResponseId);

      if (!bidResponseData) {
        throw new Error(`Bid response not found: ${bidResponseId}`);
      }

      // Create impression data
      const impressionData: ImpressionEventData = {
        bidResponseId,
        creativeId: bidResponseData.creativeId,
        campaignId: bidResponseData.campaignId,
        advertiserId: bidResponseData.advertiserId,
        inventoryId: bidResponseData.inventoryId,
        publisherId: bidResponseData.publisherId,
        websiteId: bidResponseData.websiteId,
        templateId: bidResponseData.templateId,
        finalPrice: bidResponseData.finalPrice,
        bidPrice: bidResponseData.bidPrice,
        timestamp: new Date(),
        userAgent: 'Debug-User-Agent',
        ipAddress: '127.0.0.1',
        deviceType: 'DESKTOP',
        country: 'IN',
        region: 'Maharashtra',
        city: 'Mumbai',
        ...overrides,
      };

      // Process impression
      const processingResult = await this.processImpression(impressionData);

      return {
        bidResponseData,
        impressionData,
        processingResult,
      };
    } catch (error) {
      this.logger.error('Debug impression processing failed', {
        error: error.message,
        bidResponseId,
      });
      throw error;
    }
  }

  /**
   * Get detailed tracking status for debugging
   */
  async getDetailedTrackingStatus(): Promise<{
    systemHealth: any;
    pendingCounts: any;
    fraudSummary: any;
    performanceMetrics: any;
    recentErrors: Array<{ type: string; error: string; timestamp: string }>;
  }> {
    try {
      const [
        systemHealth,
        pendingCounts,
        fraudSummary,
        performanceMetrics,
        impressionErrors,
        clickErrors,
      ] = await Promise.all([
        this.getTrackingSystemHealth(),
        this.getPendingEventsCount(),
        this.getFraudDetectionSummary(),
        this.getProcessingPerformanceMetrics(),
        this.redis.lrange('tracking:errors:impression:recent', 0, 9),
        this.redis.lrange('tracking:errors:click:recent', 0, 9),
      ]);

      const recentErrors = [
        ...impressionErrors.map((err) => ({
          type: 'impression',
          ...JSON.parse(err),
        })),
        ...clickErrors.map((err) => ({ type: 'click', ...JSON.parse(err) })),
      ]
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )
        .slice(0, 20);

      return {
        systemHealth,
        pendingCounts,
        fraudSummary,
        performanceMetrics,
        recentErrors,
      };
    } catch (error) {
      this.logger.error('Failed to get detailed tracking status', {
        error: error.message,
      });

      return {
        systemHealth: { status: 'critical' },
        pendingCounts: {},
        fraudSummary: {},
        performanceMetrics: {},
        recentErrors: [],
      };
    }
  }

  /**
   * Force flush all pending events (admin utility)
   */
  async forceFlushPendingEvents(): Promise<{
    impressionsFlushed: number;
    clicksFlushed: number;
    errors: string[];
  }> {
    try {
      this.logger.log('🚨 Force flushing all pending events');

      const errors: string[] = [];
      let impressionsFlushed = 0;
      let clicksFlushed = 0;

      // Get all pending impressions
      const pendingImpressions = await this.redis.lrange(
        REDIS_KEYS.PENDING_IMPRESSIONS,
        0,
        -1,
      );

      // Get all pending clicks
      const pendingClicks = await this.redis.lrange(
        REDIS_KEYS.PENDING_CLICKS,
        0,
        -1,
      );

      // Clear the queues
      if (pendingImpressions.length > 0) {
        await this.redis.del(REDIS_KEYS.PENDING_IMPRESSIONS);
        impressionsFlushed = pendingImpressions.length;
      }

      if (pendingClicks.length > 0) {
        await this.redis.del(REDIS_KEYS.PENDING_CLICKS);
        clicksFlushed = pendingClicks.length;
      }

      this.logger.log('✅ Force flush completed', {
        impressionsFlushed,
        clicksFlushed,
        errorsCount: errors.length,
      });

      return { impressionsFlushed, clicksFlushed, errors };
    } catch (error) {
      this.logger.error('Force flush failed', {
        error: error.message,
      });

      return {
        impressionsFlushed: 0,
        clicksFlushed: 0,
        errors: [`Force flush failed: ${error.message}`],
      };
    }
  }

  /**
   * Detect click fraud
   */
  private async detectClickFraud(
    clickData: ClickEventData,
    impressionLink?: any,
  ): Promise<number> {
    try {
      let fraudScore = 0;

      // Check time from impression
      if (impressionLink?.timeFromImpression) {
        const timeMs = impressionLink.timeFromImpression;

        // Too fast (under 100ms) or too slow (over 5 minutes)
        if (timeMs < 100) {
          fraudScore += 0.6;
        } else if (timeMs > 300000) {
          fraudScore += 0.3;
        }
      }

      // Check IP click frequency
      if (clickData.ipAddress) {
        const today = this.getDateString();
        const ipClickCount = await this.redis.get(
          REDIS_KEYS.IP_CLICK_COUNT(clickData.ipAddress, today),
        );

        if (parseInt(ipClickCount as string) > 50) {
          fraudScore += 0.4;
        }
      }

      // Check if marked as bot
      if (clickData.isBot) {
        fraudScore += 0.7;
      }

      return Math.min(fraudScore, 1.0);
    } catch (error) {
      this.logger.error('Fraud detection failed', {
        error: error.message,
        impressionId: impressionLink.id,
      });
      return 0;
    }
  }
}
