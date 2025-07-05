import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { CLICK_AND_IMPRESSION_KEYS } from 'src/rtb/constants/cache-keys';
export const commissionMap = {
  STANDARD: 0.4, // 40%
  PREMIUM: 0.3, // 30%
  ELITE: 0.2, // 20%
};

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  generateId(): string {
    return uuidv4();
  }

  async getImpressionData(bidResponseId: string): Promise<any> {
    try {
      const cachedData: string = await this.redis.get(
        CLICK_AND_IMPRESSION_KEYS.BID_RESPONSE(bidResponseId),
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
   * Process impression event in Redis with immediate budget deduction
   * ✅ Handles ALL Prisma model fields properly
   */
  async processImpression(impression: ImpressionEvent): Promise<void> {
    const pipeline = this.redis.pipeline();
    const today = this.getDateString();

    try {
      // 1. Store COMPLETE event data in pending queue for batch processing
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

        // FIX: Include slotId and userFingerprint
        slotId: impression.slotId || null,
        userFingerprint: impression.userFingerprint || null,

        // FIX: Include bidPrice
        bidPrice: impression.bidPrice || 0,
        finalPrice: impression.finalPrice || 0,

        // User data (properly handle null values):
        userAgent: impression.userAgent || null,
        ipAddress: impression.ipAddress || null,
        deviceType: impression.deviceType || null,

        // Viewability data:
        viewable:
          impression.viewable !== undefined ? impression.viewable : null,
        viewTime: impression.viewTime || null,

        // Fraud data:
        isBot: impression.isBot !== undefined ? impression.isBot : false,
        fraudScore: impression.fraudScore,

        // Additional fields:
        referrer: impression.referrer || null,
        country: impression.country || null,
        region: impression.region || null,
        city: impression.city || null,

        // Metadata:
        syncedToTimescale: false,
        syncedAt: null,
      };

      this.logger.debug('Impression Data', {
        impressionData,
      });

      pipeline.lpush(
        CLICK_AND_IMPRESSION_KEYS.PENDING_IMPRESSIONS,
        JSON.stringify(impressionData),
      );
      const costPerImpression = impression.finalPrice / 1000; // Convert CPM to per-impression

      await this.deductCampaignBudget(
        impression.campaignId,
        costPerImpression,
        impression.id,
      );
      // 2. Update real-time metrics
      pipeline.incr(
        CLICK_AND_IMPRESSION_KEYS.CAMPAIGN_IMPRESSIONS(
          impression.campaignId,
          today,
        ),
      );
      pipeline.incr(
        CLICK_AND_IMPRESSION_KEYS.CREATIVE_IMPRESSIONS(
          impression.creativeId,
          today,
        ),
      );

      // 3. Update budget spending (critical for budget control)
      pipeline.incrbyfloat(
        CLICK_AND_IMPRESSION_KEYS.DAILY_BUDGET_SPEND(
          impression.campaignId,
          today,
        ),
        costPerImpression,
      );

      // 4. Update revenue splitting
      const publisherRevenueDetails: string = await this.redis.get(
        CLICK_AND_IMPRESSION_KEYS.PUBLISHER_REVENUE_TIERS(
          impression.publisherId,
        ),
      );
      const publisherRevenueTier = publisherRevenueDetails
        ? JSON.parse(publisherRevenueDetails)
        : { tier: 'STANDARD', paymentThreshold: 100.0 }; // Default values
      this.logger.debug(
        `Publisher revenue tier: ${publisherRevenueTier.tier}, threshold: ${publisherRevenueTier}`,
      );

      const systemRevenue =
        costPerImpression * commissionMap[publisherRevenueTier.tier];
      const publisherRevenue = costPerImpression - systemRevenue;
      pipeline.incrbyfloat(
        CLICK_AND_IMPRESSION_KEYS.PUBLISHER_REVENUE(
          impression.publisherId,
          today,
        ),
        publisherRevenue,
      );
      pipeline.incrbyfloat(
        CLICK_AND_IMPRESSION_KEYS.SYSTEM_REVENUE(today),
        systemRevenue,
      );
      pipeline.incrbyfloat(
        CLICK_AND_IMPRESSION_KEYS.CREATIVE_SPENDING(
          impression.creativeId,
          today,
        ),
        costPerImpression,
      );
      pipeline.incrbyfloat(
        CLICK_AND_IMPRESSION_KEYS.CAMPAIGN_SPENDING(
          impression.campaignId,
          today,
        ),
        costPerImpression,
      );
      pipeline.incrbyfloat(
        CLICK_AND_IMPRESSION_KEYS.ADVERTISER_SPENDING(
          impression.advertiserId,
          today,
        ),
        costPerImpression,
      );

      // 5. Set expiration for metrics
      pipeline.expire(
        CLICK_AND_IMPRESSION_KEYS.CAMPAIGN_IMPRESSIONS(
          impression.campaignId,
          today,
        ),
        2592000,
      );
      pipeline.expire(
        CLICK_AND_IMPRESSION_KEYS.CREATIVE_IMPRESSIONS(
          impression.creativeId,
          today,
        ),
        2592000,
      );
      pipeline.expire(
        CLICK_AND_IMPRESSION_KEYS.PUBLISHER_REVENUE(
          impression.publisherId,
          today,
        ),
        2592000,
      );
      pipeline.expire(CLICK_AND_IMPRESSION_KEYS.SYSTEM_REVENUE(today), 2592000);
      pipeline.expire(
        CLICK_AND_IMPRESSION_KEYS.CREATIVE_SPENDING(
          impression.creativeId,
          today,
        ),
        2592000,
      );
      pipeline.expire(
        CLICK_AND_IMPRESSION_KEYS.CAMPAIGN_SPENDING(
          impression.campaignId,
          today,
        ),
        2592000,
      );
      pipeline.expire(
        CLICK_AND_IMPRESSION_KEYS.ADVERTISER_SPENDING(
          impression.advertiserId,
          today,
        ),
        2592000,
      );
      // Execute all operations atomically
      await pipeline.exec();

      this.logger.debug(
        `Impression processed with complete data (budget, campaign & creative impression stored): ${impression.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process impression: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
  private async deductCampaignBudget(
    campaignId: string,
    cost: number,
    impressionId: string,
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Atomic budget deduction when impression is confirmed
    await this.prisma.campaignDailyBudget.update({
      where: { campaignId_date: { campaignId, date: today } },
      data: {
        spentToday: { increment: cost },
        remainingToday: { decrement: cost },
        lastUpdated: new Date(),
      },
    });

    // Record transaction for audit trail
    await this.prisma.budgetTransaction.create({
      data: {
        campaignId,
        type: 'IMPRESSION_COST',
        amount: cost,
        impressionId,
        description: 'Budget deducted for delivered impression',
      },
    });
  }
  /**
   * Process click event in Redis
   * ✅ Handles ALL Prisma model fields properly
   */
  async processClick(click: ClickEvent): Promise<void> {
    const pipeline = this.redis.pipeline();
    const today = this.getDateString();

    try {
      // 1. Store COMPLETE click data in pending queue for batch processing
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

        // User data:
        userAgent: click.userAgent || null,
        ipAddress: click.ipAddress || null,
        deviceType: click.deviceType || null,

        landingUrl: click.landingUrl || null,

        // Fraud data:
        isBot: click.isBot !== undefined ? click.isBot : false,
        fraudScore: click.fraudScore || null,
        timeFromImpression: click.timeFromImpression || null,

        // Additional fields:
        referrer: click.referrer || null,
        country: click.country || null,
        region: click.region || null,
        city: click.city || null,

        // Metadata:
        syncedToTimescale: false,
        syncedAt: null,
      };

      pipeline.lpush(
        CLICK_AND_IMPRESSION_KEYS.PENDING_CLICKS,
        JSON.stringify(clickData),
      );

      // 2. Update real-time metrics
      pipeline.incr(
        CLICK_AND_IMPRESSION_KEYS.CAMPAIGN_CLICKS(click.campaignId, today),
      );
      pipeline.incr(
        CLICK_AND_IMPRESSION_KEYS.CREATIVE_CLICKS(click.creativeId, today),
      );

      // 3. Set expiration for metrics (30 days)
      pipeline.expire(
        CLICK_AND_IMPRESSION_KEYS.CAMPAIGN_CLICKS(click.campaignId, today),
        2592000,
      );
      pipeline.expire(
        CLICK_AND_IMPRESSION_KEYS.CREATIVE_CLICKS(click.creativeId, today),
        2592000,
      );

      // Execute all operations atomically
      await pipeline.exec();

      this.logger.debug(`Click processed with complete data: ${click.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to process click: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * IMPROVED: Get bid response from database with complete data
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

      this.logger.debug('Please', {
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
      });

      // Return data in expected format
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

  // ... (rest of the methods remain the same as they're working correctly)

  /**
   * Get real-time metrics from Redis
   */
  async getCampaignMetrics(campaignId: string, date?: string): Promise<any> {
    const dateStr = date || this.getDateString();

    try {
      const [impressions, clicks, spending] = await Promise.all([
        this.redis.get(
          CLICK_AND_IMPRESSION_KEYS.CAMPAIGN_IMPRESSIONS(campaignId, dateStr),
        ),
        this.redis.get(
          CLICK_AND_IMPRESSION_KEYS.CAMPAIGN_CLICKS(campaignId, dateStr),
        ),
        this.redis.get(
          CLICK_AND_IMPRESSION_KEYS.DAILY_BUDGET_SPEND(campaignId, dateStr),
        ),
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
        this.redis.get(
          CLICK_AND_IMPRESSION_KEYS.CREATIVE_IMPRESSIONS(creativeId, dateStr),
        ),
        this.redis.get(
          CLICK_AND_IMPRESSION_KEYS.CREATIVE_CLICKS(creativeId, dateStr),
        ),
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
        CLICK_AND_IMPRESSION_KEYS.PUBLISHER_REVENUE(publisherId, dateStr),
      );
      return parseFloat(revenue as string) || 0;
    } catch (error) {
      this.logger.error(`Failed to get publisher revenue: ${error.message}`);
      return 0;
    }
  }

  // /**
  //  * Health check for Redis connection
  //  */
  async checkRedisHealth(): Promise<{ status: string; latency?: number }> {
    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;

      return {
        status: 'healthy',
        latency,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
      };
    }
  }

  // /**
  //  * Get pending events count for monitoring
  //  */
  async getPendingEventsCount(): Promise<{
    impressions: number;
    clicks: number;
  }> {
    try {
      const [impressions, clicks] = await Promise.all([
        this.redis.llen(CLICK_AND_IMPRESSION_KEYS.PENDING_IMPRESSIONS),
        this.redis.llen(CLICK_AND_IMPRESSION_KEYS.PENDING_CLICKS),
      ]);

      return {
        impressions,
        clicks,
      };
    } catch (error) {
      this.logger.error(`Failed to get pending events count: ${error.message}`);
      return { impressions: 0, clicks: 0 };
    }
  }

  /**
   * Utility: Get current date string (YYYY-MM-DD)
   */
  private getDateString(date?: Date): string {
    const d = date || new Date();
    return d.toISOString().split('T')[0];
  }

  public async syncPublisherRevenueTiers() {
    try {
      this.logger.log('Syncing publisher revenue tiers...');

      // Fetch all publishers
      const publishers = await this.prisma.publisher.findMany({
        select: {
          id: true,
          tier: true,
          paymentThreshold: true,
        },
      });

      if (!publishers || publishers.length === 0) {
        this.logger.warn('No publishers found to sync revenue tiers');
        return;
      }
      this.logger.log(`Found ${publishers.length} publishers to sync`);
      // Iterate through each publisher and sync their revenue tier
      for (const publisher of publishers) {
        const { id, tier, paymentThreshold } = publisher;

        // set revenue tier for publishers
        await this.redis.set(
          CLICK_AND_IMPRESSION_KEYS.PUBLISHER_REVENUE_TIERS(id),
          JSON.stringify({
            tier,
            paymentThreshold,
          }),
        );
      }
    } catch (error) {}
  }
}
