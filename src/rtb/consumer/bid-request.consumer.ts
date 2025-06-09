// src/rtb/consumers/bid-request.consumer.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { KafkaService } from '../../kafka/kafka.service';
import { kafkaTopics } from '../../kafka/constants/kafka.config';
import { REDIS_KEYS } from '../../redis/constants/redis-keys';

@Injectable()
export class BidRequestConsumer implements OnModuleInit {
  private readonly logger = new Logger(BidRequestConsumer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly kafka: KafkaService,
  ) {}

  /**
   * Initialize Kafka subscriptions when module starts
   */
  async onModuleInit() {
    try {
      this.logger.log('Initializing RTB Kafka consumers...');

      // Subscribe to bid requests topic
      await this.kafka.subscribe(
        kafkaTopics.BID_REQUESTS,
        'rtb-bid-request-consumer',
        this.handleBidRequest.bind(this),
      );

      // Subscribe to auction results topic
      await this.kafka.subscribe(
        kafkaTopics.AUCTION_RESULTS,
        'rtb-auction-result-consumer',
        this.handleAuctionResult.bind(this),
      );

      this.logger.log('RTB Kafka consumers initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize RTB Kafka consumers:', error);
    }
  }

  /**
   * Process bid requests asynchronously for analytics and optimization
   */
  async handleBidRequest(payload: {
    key: string;
    value: any;
    topic: string;
    partition: number;
    offset: string;
  }) {
    try {
      const { bidRequest, auctionResult } = payload.value;

      this.logger.debug(
        `Processing async bid request: ${bidRequest.externalRequestId}`,
      );

      // 1. Update campaign metrics in real-time
      if (auctionResult?.winningBid) {
        await this.updateCampaignMetrics(auctionResult.winningBid, bidRequest);
      }

      // 2. Update inventory performance metrics
      await this.updateInventoryMetrics(bidRequest, auctionResult);

      // 3. Update publisher metrics
      await this.updatePublisherMetrics(bidRequest, auctionResult);

      // 4. Check and update budget constraints
      if (auctionResult?.winningBid) {
        await this.updateCampaignBudget(
          auctionResult.winningBid.campaignId,
          auctionResult.winningBid.finalPrice,
        );
      }

      // 5. Update frequency capping
      if (auctionResult?.winningBid && bidRequest.userContext?.userId) {
        await this.updateFrequencyCapping(
          bidRequest.userContext.userId,
          auctionResult.winningBid,
        );
      }

      // 6. Fraud detection and quality scoring
      await this.analyzeBidQuality(bidRequest, auctionResult);

      this.logger.debug(
        `Async processing completed for: ${bidRequest.externalRequestId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error in bid request consumer: ${error.message}`,
        error,
      );

      // Publish to DLQ for manual review
      await this.publishToDLQ(payload, error.message);
    }
  }

  /**
   * Process auction results for analytics
   */
  async handleAuctionResult(payload: {
    key: string;
    value: any;
    topic: string;
    partition: number;
    offset: string;
  }) {
    try {
      const auctionData = payload.value;

      this.logger.debug(
        `Processing auction result: ${auctionData.bidRequestId}`,
      );

      // 1. Store auction analytics
      await this.storeAuctionAnalytics(auctionData);

      // 2. Update real-time performance dashboards
      await this.updatePerformanceDashboards(auctionData);

      // 3. Check for budget exhaustion alerts
      if (auctionData.winningBid) {
        await this.checkBudgetAlerts(auctionData.winningBid.campaignId);
      }

      // 4. Update bid optimization models
      await this.updateBidOptimizationData(auctionData);
    } catch (error) {
      this.logger.error(
        `Error in auction result consumer: ${error.message}`,
        error,
      );
    }
  }

  /**
   * Update campaign performance metrics in real-time
   */
  private async updateCampaignMetrics(winningBid: any, bidRequest: any) {
    try {
      const campaignId = winningBid.campaignId;

      // Update Redis counters
      await Promise.all([
        // Campaign-level metrics
        this.redis.incr(REDIS_KEYS.CAMPAIGN_IMPRESSIONS(campaignId)),
        this.redis.incrby(
          REDIS_KEYS.CAMPAIGN_SPEND(campaignId),
          winningBid.finalPrice,
        ),

        // Creative-level metrics
        this.redis.incr(REDIS_KEYS.CREATIVE_IMPRESSIONS(winningBid.creativeId)),
      ]);

      // Update hourly metrics in database
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const currentHour = now.getHours();

      await this.prisma.hourlyMetrics.upsert({
        where: {
          campaignId_inventoryId_date_hour: {
            campaignId,
            inventoryId: bidRequest.inventoryId,
            date: today,
            hour: currentHour,
          },
        },
        update: {
          impressions: { increment: 1 },
          spend: { increment: winningBid.finalPrice },
        },
        create: {
          campaignId,
          inventoryId: bidRequest.inventoryId,
          date: today,
          hour: currentHour,
          impressions: 1,
          clicks: 0,
          spend: winningBid.finalPrice,
          revenue: 0,
        },
      });

      this.logger.debug(`Updated campaign metrics for: ${campaignId}`);
    } catch (error) {
      this.logger.error(`Error updating campaign metrics: ${error.message}`);
    }
  }

  /**
   * Update inventory performance metrics
   */
  private async updateInventoryMetrics(bidRequest: any, auctionResult: any) {
    try {
      const inventoryId = bidRequest.inventoryId;

      // Update inventory counters
      await this.redis.incr(REDIS_KEYS.INVENTORY_IMPRESSIONS(inventoryId));

      if (auctionResult?.winningBid) {
        // Calculate publisher revenue (assuming 70% revenue share)
        const publisherRevenue = auctionResult.winningBid.finalPrice * 0.7;
        await this.redis.incrby(
          REDIS_KEYS.INVENTORY_REVENUE(inventoryId),
          publisherRevenue,
        );
      }

      // Update inventory performance cache
      const performanceKey = REDIS_KEYS.INVENTORY_PERFORMANCE(inventoryId);
      const currentPerformance: any = (await this.redis.get(
        performanceKey,
      )) || {
        requests: 0,
        fills: 0,
        revenue: 0,
      };

      const updatedPerformance = {
        requests: currentPerformance.requests + 1,
        fills: currentPerformance.fills + (auctionResult?.winningBid ? 1 : 0),
        revenue:
          currentPerformance.revenue +
          (auctionResult?.winningBid?.finalPrice || 0),
        fillRate:
          (currentPerformance.fills + (auctionResult?.winningBid ? 1 : 0)) /
          (currentPerformance.requests + 1),
        lastUpdated: new Date().toISOString(),
      };

      await this.redis.set(performanceKey, updatedPerformance, 3600); // Cache for 1 hour
    } catch (error) {
      this.logger.error(`Error updating inventory metrics: ${error.message}`);
    }
  }

  /**
   * Update publisher metrics
   */
  private async updatePublisherMetrics(bidRequest: any, auctionResult: any) {
    try {
      const publisherId = bidRequest.publisherId;

      await this.redis.incr(REDIS_KEYS.PUBLISHER_IMPRESSIONS(publisherId));

      if (auctionResult?.winningBid) {
        const publisherRevenue = auctionResult.winningBid.finalPrice * 0.7;
        await this.redis.incrby(
          REDIS_KEYS.PUBLISHER_REVENUE(publisherId),
          publisherRevenue,
        );
      }
    } catch (error) {
      this.logger.error(`Error updating publisher metrics: ${error.message}`);
    }
  }

  /**
   * Update campaign budget tracking
   */
  private async updateCampaignBudget(campaignId: string, spend: number) {
    try {
      const today = new Date();
      const dateString = today.toISOString().split('T')[0];

      // Update daily budget tracker
      await this.prisma.campaignBudgetTracker.upsert({
        where: {
          campaignId_date: {
            campaignId,
            date: new Date(dateString),
          },
        },
        update: {
          spentToday: { increment: spend },
          remainingBudget: { decrement: spend },
          lastUpdated: new Date(),
        },
        create: {
          campaignId,
          date: new Date(dateString),
          totalBudget: 1000, // Default - should be set from campaign
          dailyBudget: 100, // Default - should be set from campaign
          spentToday: spend,
          remainingBudget: 100 - spend,
          isExhausted: false,
        },
      });

      // Check if budget is exhausted
      const budgetTracker = await this.prisma.campaignBudgetTracker.findUnique({
        where: {
          campaignId_date: {
            campaignId,
            date: new Date(dateString),
          },
        },
      });

      if (budgetTracker && budgetTracker.remainingBudget.toNumber() <= 0) {
        await this.prisma.campaignBudgetTracker.update({
          where: { id: budgetTracker.id },
          data: { isExhausted: true },
        });

        // Invalidate campaign eligibility cache
        // This will force recalculation on next bid request
        const pattern = 'campaigns:eligible:*';
        // Note: In production, you might want a more targeted cache invalidation
        this.logger.log(`Budget exhausted for campaign ${campaignId}`);
      }
    } catch (error) {
      this.logger.error(`Error updating campaign budget: ${error.message}`);
    }
  }

  /**
   * Update frequency capping counters
   */
  private async updateFrequencyCapping(userId: string, winningBid: any) {
    try {
      // Update user-campaign frequency
      const campaignFreqKey = REDIS_KEYS.USER_CAMPAIGN_FREQUENCY(
        userId,
        winningBid.campaignId,
      );
      await this.redis.incr(campaignFreqKey);
      await this.redis.expire(campaignFreqKey, 86400); // Expire after 24 hours

      // Update user-creative frequency
      const creativeFreqKey = REDIS_KEYS.USER_CREATIVE_FREQUENCY(
        userId,
        winningBid.creativeId,
      );
      await this.redis.incr(creativeFreqKey);
      await this.redis.expire(creativeFreqKey, 86400); // Expire after 24 hours
    } catch (error) {
      this.logger.error(`Error updating frequency capping: ${error.message}`);
    }
  }

  /**
   * Analyze bid quality for fraud detection
   */
  private async analyzeBidQuality(bidRequest: any, auctionResult: any) {
    try {
      const userContext = bidRequest.userContext || {};

      // Simple fraud detection patterns
      if (userContext.ipAddress) {
        const ipClickRate = await this.redis.incr(
          REDIS_KEYS.IP_CLICK_RATE(userContext.ipAddress),
        );
        await this.redis.expire(
          REDIS_KEYS.IP_CLICK_RATE(userContext.ipAddress),
          3600,
        );

        // Flag suspicious IP behavior
        if (ipClickRate > 100) {
          // More than 100 requests per hour
          this.logger.warn(
            `High request rate from IP: ${userContext.ipAddress}`,
          );
          // Could trigger additional fraud checks or bid adjustments
        }
      }
    } catch (error) {
      this.logger.error(`Error in bid quality analysis: ${error.message}`);
    }
  }

  /**
   * Store auction analytics for reporting
   */
  private async storeAuctionAnalytics(auctionData: any) {
    try {
      // Store key metrics in Redis for fast dashboard queries
      const analyticsKey = `analytics:auction:${new Date().toISOString().split('T')[0]}`;

      const currentAnalytics: any = (await this.redis.get(analyticsKey)) || {
        totalAuctions: 0,
        successfulAuctions: 0,
        totalRevenue: 0,
        avgAuctionDuration: 0,
      };

      const updatedAnalytics = {
        totalAuctions: currentAnalytics.totalAuctions + 1,
        successfulAuctions:
          currentAnalytics.successfulAuctions +
          (auctionData.winningBid ? 1 : 0),
        totalRevenue:
          currentAnalytics.totalRevenue +
          (auctionData.winningBid?.finalPrice || 0),
        avgAuctionDuration:
          (currentAnalytics.avgAuctionDuration *
            currentAnalytics.totalAuctions +
            (auctionData.auctionDuration || 0)) /
          (currentAnalytics.totalAuctions + 1),
        lastUpdated: new Date().toISOString(),
      };

      await this.redis.set(analyticsKey, updatedAnalytics, 86400); // Cache for 24 hours
    } catch (error) {
      this.logger.error(`Error storing auction analytics: ${error.message}`);
    }
  }

  /**
   * Update real-time performance dashboards
   */
  private async updatePerformanceDashboards(auctionData: any) {
    // Placeholder for real-time dashboard updates
    // Could publish to WebSocket channels, update Redis streams, etc.
  }

  /**
   * Check for budget exhaustion alerts
   */
  private async checkBudgetAlerts(campaignId: string) {
    // Placeholder for budget alert logic
    // Could send notifications when budget reaches certain thresholds
  }

  /**
   * Update bid optimization data
   */
  private async updateBidOptimizationData(auctionData: any) {
    // Placeholder for ML model data updates
    // Feed data to bid optimization algorithms
  }

  /**
   * Publish failed messages to Dead Letter Queue
   */
  private async publishToDLQ(originalPayload: any, errorMessage: string) {
    try {
      await this.kafka.publish(kafkaTopics.DLQ_BID_REQUESTS, {
        key: `dlq:${Date.now()}`,
        value: {
          originalPayload,
          error: errorMessage,
          timestamp: new Date().toISOString(),
          retryCount: originalPayload.retryCount || 0,
        },
      });
    } catch (dlqError) {
      this.logger.error(`Failed to publish to DLQ: ${dlqError.message}`);
    }
  }
}
