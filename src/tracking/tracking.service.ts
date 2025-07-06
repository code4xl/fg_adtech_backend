// src/tracking/tracking.service.ts - Enhanced version
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetManagerService } from 'src/rtb/services/budget-manager.service';
import { v4 as uuidv4 } from 'uuid';
import { REDIS_KEYS } from 'src/rtb/constants/cache-keys';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly budgetManager: BudgetManagerService,
  ) {}

  generateId(): string {
    return uuidv4();
  }

  async getImpressionData(bidResponseId: string): Promise<any> {
    try {
      const cachedData: string = await this.redis.get(
        REDIS_KEYS.BID_RESPONSE(bidResponseId),
      );

      if (!cachedData) {
        // Fallback to database lookup
        this.logger.debug('Fallback to database lookup');
        return await this.getBidResponseFromDatabase(bidResponseId);
      }

      return JSON.parse(cachedData);
    } catch (error) {
      this.logger.error(`Failed to get impression data: ${error.message}`);
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
   * 🔧 FIXED: Process impression event with correct reservation confirmation
   */
  async processImpression(impression: ImpressionEvent): Promise<void> {
    const pipeline = this.redis.pipeline();
    const today = this.getDateString();

    try {
      this.logger.debug('Processing impression with financial tracking', {
        impressionId: impression.id,
        campaignId: impression.campaignId,
        publisherId: impression.publisherId,
        finalPrice: impression.finalPrice,
        bidResponseId: impression.bidResponseId,
      });

      // ===== 1. STORE COMPLETE EVENT DATA =====
      const impressionData: ImpressionData = {
        id: impression.id,
        bidResponseId: impression.bidResponseId,
        creativeId: impression.creativeId,
        campaignId: impression.campaignId,
        advertiserId: impression.advertiserId,
        inventoryId: impression.inventoryId,
        publisherId: impression.publisherId,
        websiteId: impression.websiteId,
        templateId: impression.templateId,
        timestamp: impression.timestamp.toISOString(),
        slotId: impression.slotId || null,
        userFingerprint: impression.userFingerprint || null,
        bidPrice: impression.bidPrice || 0,
        finalPrice: impression.finalPrice || 0,
        userAgent: impression.userAgent || null,
        ipAddress: impression.ipAddress || null,
        deviceType: impression.deviceType || null,
        viewable:
          impression.viewable !== undefined ? impression.viewable : null,
        viewTime: impression.viewTime || null,
        isBot: impression.isBot !== undefined ? impression.isBot : false,
        fraudScore: impression.fraudScore,
        country: impression.country || null,
        region: impression.region || null,
        city: impression.city || null,
        syncedToTimescale: false,
        syncedAt: null,
        referrer: impression.referrer || null,
      };

      // Store for PostgreSQL sync
      pipeline.lpush(
        REDIS_KEYS.PENDING_IMPRESSIONS,
        JSON.stringify(impressionData),
      );

      // 🔧 SIMPLIFIED: Use only bidResponseId as reservation ID
      const reservationId = impression.bidResponseId;

      // 🔧 FIX: Use per-impression cost consistently
      const costPerImpression = (impression.finalPrice || 0) / 1000;

      await this.budgetManager.confirmReservedBudget(
        reservationId,
        impression.campaignId,
        impression.publisherId,
        impression.inventoryId,
        impression.websiteId,
        impression.advertiserId,
        impression.creativeId,
        costPerImpression,
      );

      // ===== 2. UPDATE REAL-TIME METRICS =====
      pipeline.incr(
        REDIS_KEYS.CAMPAIGN_IMPRESSIONS(impression.campaignId, today),
      );
      pipeline.incr(
        REDIS_KEYS.CREATIVE_IMPRESSIONS(impression.creativeId, today),
      );

      // ===== 3. SET EXPIRATION FOR METRICS =====
      pipeline.expire(
        REDIS_KEYS.CAMPAIGN_IMPRESSIONS(impression.campaignId, today),
        2592000,
      );
      pipeline.expire(
        REDIS_KEYS.CREATIVE_IMPRESSIONS(impression.creativeId, today),
        2592000,
      );

      await pipeline.exec();

      this.logger.debug(
        ` Impression processed with financial tracking: ${impression.id}`,
        {
          finalPrice: impression.finalPrice,
          costPerImpression,
          publisherId: impression.publisherId,
          reservationId,
        },
      );
    } catch (error) {
      this.logger.error(`❌ Failed to process impression: ${error.message}`, {
        impressionId: impression.id,
        bidResponseId: impression.bidResponseId,
        error: error.stack,
      });
      throw error;
    }
  }

  /**
   *  Process click event with complete financial tracking
   */
  async processClick(click: ClickEvent): Promise<void> {
    const pipeline = this.redis.pipeline();
    const today = this.getDateString();

    try {
      this.logger.debug('Processing click with financial tracking', {
        clickId: click.id,
        campaignId: click.campaignId,
        publisherId: click.publisherId,
      });

      // ===== 1. STORE COMPLETE CLICK DATA =====
      const clickData: ClickData = {
        id: click.id,
        impressionId: click.impressionId || null,
        bidResponseId: click.bidResponseId,
        creativeId: click.creativeId,
        campaignId: click.campaignId,
        advertiserId: click.advertiserId,
        inventoryId: click.inventoryId,
        publisherId: click.publisherId,
        websiteId: click.websiteId,
        templateId: click.templateId || null,
        timestamp: click.timestamp.toISOString(),
        slotId: click.slotId || null,
        userFingerprint: click.userFingerprint || null,
        userAgent: click.userAgent || null,
        ipAddress: click.ipAddress || null,
        deviceType: click.deviceType || null,
        landingUrl: click.landingUrl || null,
        isBot: click.isBot !== undefined ? click.isBot : false,
        fraudScore: click.fraudScore || null,
        timeFromImpression: click.timeFromImpression || null,
        country: click.country || null,
        region: click.region || null,
        city: click.city || null,
        syncedToTimescale: false,
        syncedAt: null,
        referrer: click.referrer || null,
      };

      // Store for PostgreSQL sync
      pipeline.lpush(REDIS_KEYS.PENDING_CLICKS, JSON.stringify(clickData));

      // ===== 2. UPDATE REAL-TIME METRICS =====
      pipeline.incr(REDIS_KEYS.CAMPAIGN_CLICKS(click.campaignId, today));
      pipeline.incr(REDIS_KEYS.CREATIVE_CLICKS(click.creativeId, today));

      // ===== 4. SET EXPIRATION FOR METRICS =====
      pipeline.expire(
        REDIS_KEYS.CAMPAIGN_CLICKS(click.campaignId, today),
        2592000,
      );
      pipeline.expire(
        REDIS_KEYS.CREATIVE_CLICKS(click.creativeId, today),
        2592000,
      );

      await pipeline.exec();

      this.logger.debug(
        ` Click processed with financial tracking: ${click.id}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to process click: ${error.message}`,
        error.stack,
      );
      throw error;
    }
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
          campaign: true,
          creative: true,
          bidRequest: {
            include: {
              inventory: {
                include: {
                  publisher: true,
                  website: true,
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
        advertiserId: bidResponse.advertiserId,
        inventoryId: bidResponse.bidRequest.inventory?.id,
        publisherId: bidResponse.bidRequest.inventory?.publisherId,
        websiteId: bidResponse.bidRequest.inventory?.websiteId,
        templateId: bidResponse.bidRequest.inventory.adSlotTemplateId,
        bidPrice: parseFloat(bidResponse.bidPrice.toString()),
        finalPrice: parseFloat(bidResponse.finalPrice.toString()),
        landingUrl: bidResponse.landingUrl,
      };
    } catch (error) {
      this.logger.error(`Database fallback failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Get real-time metrics from Redis
   */
  async getCampaignMetrics(campaignId: string, date?: string): Promise<any> {
    const dateStr = date || this.getDateString();

    try {
      const [impressions, clicks, spending] = await Promise.all([
        this.redis.get(REDIS_KEYS.CAMPAIGN_IMPRESSIONS(campaignId, dateStr)),
        this.redis.get(REDIS_KEYS.CAMPAIGN_CLICKS(campaignId, dateStr)),
        this.redis.get(REDIS_KEYS.DAILY_BUDGET_SPEND(campaignId, dateStr)),
      ]);

      const impressionCount = parseInt(impressions as string) || 0;
      const clickCount = parseInt(clicks as string) || 0;
      const spendAmount = parseFloat(spending as string) || 0;

      return {
        campaignId,
        date: dateStr,
        impressions: impressionCount,
        clicks: clickCount,
        ctr: impressionCount > 0 ? (clickCount / impressionCount) * 100 : 0,
        spending: spendAmount,
        avgCpm:
          impressionCount > 0 ? (spendAmount / impressionCount) * 1000 : 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get campaign metrics: ${error.message}`);
      return null;
    }
  }

  /**
   * Get creative performance metrics
   */
  async getCreativeMetrics(creativeId: string, date?: string): Promise<any> {
    const dateStr = date || this.getDateString();

    try {
      const [impressions, clicks] = await Promise.all([
        this.redis.get(REDIS_KEYS.CREATIVE_IMPRESSIONS(creativeId, dateStr)),
        this.redis.get(REDIS_KEYS.CREATIVE_CLICKS(creativeId, dateStr)),
      ]);

      const impressionCount = parseInt(impressions as string) || 0;
      const clickCount = parseInt(clicks as string) || 0;

      return {
        creativeId,
        date: dateStr,
        impressions: impressionCount,
        clicks: clickCount,
        ctr: impressionCount > 0 ? (clickCount / impressionCount) * 100 : 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get creative metrics: ${error.message}`);
      return null;
    }
  }

  /**
   * Get publisher revenue metrics
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
      this.logger.error(`Failed to get publisher revenue: ${error.message}`);
      return 0;
    }
  }

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
   * Utility: Get current date string (YYYY-MM-DD)
   */
  private getDateString(date?: Date): string {
    const d = date || new Date();
    return d.toISOString().split('T')[0];
  }
}
