// src/rtb/services/creative-performance.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_KEYS } from '../../redis/constants/redis-keys';
import { CreativePerformance } from '../interfaces/creative-performance.interface';

@Injectable()
export class CreativePerformanceService {
  private readonly logger = new Logger(CreativePerformanceService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get real-time creative performance for bid optimization
   */
  async getCreativePerformance(
    creativeId: string,
  ): Promise<CreativePerformance | null> {
    try {
      // Get real-time counters from Redis
      const [impressions, clicks, ctr, performanceScore] = await Promise.all([
        this.redis.get(REDIS_KEYS.CREATIVE_IMPRESSIONS(creativeId)) || 0,
        this.redis.get(REDIS_KEYS.CREATIVE_CLICKS(creativeId)) || 0,
        this.redis.get(REDIS_KEYS.CREATIVE_CTR(creativeId)) || 0,
        this.redis.get(REDIS_KEYS.CREATIVE_PERFORMANCE_SCORE(creativeId)) || 0,
      ]);

      // Calculate spend from impression events (if needed for more accuracy) -- NEED TO REVIEW
      const spend = await this.getCreativeSpend(creativeId);

      const performance: CreativePerformance = {
        creativeId,
        impressions: Number(impressions),
        clicks: Number(clicks),
        ctr: Number(ctr),
        spend: Number(spend),
        performanceScore:
          Number(performanceScore) ||
          this.calculatePerformanceScore(
            Number(ctr),
            Number(impressions),
            Number(clicks),
          ),
        lastUpdated: new Date(),
      };

      // Update performance score if it wasn't cached
      if (!performanceScore && performance.impressions > 0) {
        await this.updatePerformanceScore(
          creativeId,
          performance.performanceScore,
        );
      }

      return performance;
    } catch (error) {
      this.logger.error(
        `Error getting creative performance for ${creativeId}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Get performance history for inventory type to help with bid optimization
   */
  async getInventoryPerformanceHistory(inventoryId: string): Promise<any> {
    try {
      // Get top performing creatives for this inventory type in the last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const topPerformers = await this.prisma.impressionEvent.groupBy({
        by: ['creativeId'],
        where: {
          inventoryId,
          timestamp: {
            gte: sevenDaysAgo,
          },
        },
        _count: {
          id: true,
        },
        _avg: {
          price: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 10,
      });

      // Get click rates for these creatives
      const performanceHistory = await Promise.all(
        topPerformers.map(async (performer) => {
          const performance = await this.getCreativePerformance(
            performer.creativeId,
          );
          return {
            creativeId: performer.creativeId,
            impressions: performer._count.id,
            avgPrice: performer._avg.price,
            ...performance,
          };
        }),
      );

      return {
        topPerformers: performanceHistory,
        inventoryId,
        timeRange: '7d',
        generatedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Error getting inventory performance history: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Update creative performance metrics in real-time
   */
  async updateCreativeMetrics(
    creativeId: string,
    type: 'impression' | 'click',
    data?: { price?: number },
  ): Promise<void> {
    try {
      if (type === 'impression') {
        // Increment impression counter
        await this.redis.incr(REDIS_KEYS.CREATIVE_IMPRESSIONS(creativeId));

        // Update spend if price provided
        if (data?.price) {
          await this.redis.incrby(
            REDIS_KEYS.CAMPAIGN_SPEND(creativeId), // Using campaign spend key for creative spend
            data.price,
          );
        }
      } else if (type === 'click') {
        // Increment click counter
        await this.redis.incr(REDIS_KEYS.CREATIVE_CLICKS(creativeId));
      }

      // Recalculate and update CTR
      await this.updateCreativeCTR(creativeId);

      // Update performance score
      const performance = await this.getCreativePerformance(creativeId);
      if (performance) {
        const newScore = this.calculatePerformanceScore(
          performance.ctr,
          performance.impressions,
          performance.clicks,
        );
        await this.updatePerformanceScore(creativeId, newScore);
      }
    } catch (error) {
      this.logger.error(`Error updating creative metrics: ${error.message}`);
    }
  }

  /**
   * Get creative performance recommendations for bid optimization
   */
  async getCreativeRecommendations(creativeId: string): Promise<any> {
    try {
      const performance = await this.getCreativePerformance(creativeId);
      if (!performance) return null;

      const recommendations = {
        creativeId,
        bidMultiplier: this.calculateBidMultiplier(performance),
        recommendedAction: this.getRecommendedAction(performance),
        confidenceScore: this.calculateConfidenceScore(performance),
        insights: this.generateInsights(performance),
      };

      return recommendations;
    } catch (error) {
      this.logger.error(
        `Error getting creative recommendations: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Batch update performance scores for multiple creatives
   */
  async batchUpdatePerformanceScores(creativeIds: string[]): Promise<void> {
    try {
      const promises = creativeIds.map(async (creativeId) => {
        const performance = await this.getCreativePerformance(creativeId);
        if (performance && performance.impressions > 0) {
          const score = this.calculatePerformanceScore(
            performance.ctr,
            performance.impressions,
            performance.clicks,
          );
          await this.updatePerformanceScore(creativeId, score);
        }
      });

      await Promise.all(promises);
      this.logger.debug(
        `Updated performance scores for ${creativeIds.length} creatives`,
      );
    } catch (error) {
      this.logger.error(`Error in batch update: ${error.message}`);
    }
  }

  // Private helper methods

  private async updateCreativeCTR(creativeId: string): Promise<void> {
    try {
      const [impressions, clicks] = await Promise.all([
        this.redis.get(REDIS_KEYS.CREATIVE_IMPRESSIONS(creativeId)) || 0,
        this.redis.get(REDIS_KEYS.CREATIVE_CLICKS(creativeId)) || 0,
      ]);

      const ctr =
        Number(impressions) > 0 ? Number(clicks) / Number(impressions) : 0;
      await this.redis.set(REDIS_KEYS.CREATIVE_CTR(creativeId), ctr);
    } catch (error) {
      this.logger.warn(
        `Error updating CTR for creative ${creativeId}: ${error.message}`,
      );
    }
  }

  private async updatePerformanceScore(
    creativeId: string,
    score: number,
  ): Promise<void> {
    try {
      await this.redis.set(
        REDIS_KEYS.CREATIVE_PERFORMANCE_SCORE(creativeId),
        score,
      );
    } catch (error) {
      this.logger.warn(`Error updating performance score: ${error.message}`);
    }
  }

  private async getCreativeSpend(creativeId: string): Promise<number> {
    try {
      // Get spend from Redis counter or calculate from database if needed
      const spend =
        (await this.redis.get(`counters:creative:spend:${creativeId}`)) || 0;
      return Number(spend);
    } catch (error) {
      this.logger.warn(`Error getting creative spend: ${error.message}`);
      return 0;
    }
  }

  /**
   * Calculate performance score based on CTR, impression volume, and engagement
   * Score ranges from 0.0 to 1.0
   */
  private calculatePerformanceScore(
    ctr: number,
    impressions: number,
    clicks: number,
  ): number {
    try {
      // Base CTR component (0-0.4 weight)
      const ctrScore = Math.min(ctr * 100, 10) / 10; // Normalize CTR to 0-1 scale

      // Volume component (0-0.3 weight) - rewards creatives with more data
      const volumeScore = Math.min(impressions / 1000, 1); // Scale to 0-1

      // Engagement component (0-0.3 weight) - absolute click performance
      const engagementScore = Math.min(clicks / 100, 1); // Scale to 0-1

      // Weighted performance score
      const performanceScore =
        ctrScore * 0.4 + volumeScore * 0.3 + engagementScore * 0.3;

      return Math.min(Math.max(performanceScore, 0), 1); // Ensure 0-1 range
    } catch (error) {
      this.logger.warn(`Error calculating performance score: ${error.message}`);
      return 0.5; // Default neutral score
    }
  }

  /**
   * Calculate bid multiplier based on performance
   */
  private calculateBidMultiplier(performance: CreativePerformance): number {
    const baseMultiplier = 1.0;

    // Adjust based on performance score
    if (performance.performanceScore > 0.8) return baseMultiplier * 1.5; // Top performers
    if (performance.performanceScore > 0.6) return baseMultiplier * 1.2; // Good performers
    if (performance.performanceScore > 0.4) return baseMultiplier * 1.0; // Average
    if (performance.performanceScore > 0.2) return baseMultiplier * 0.8; // Below average

    return baseMultiplier * 0.6; // Poor performers
  }

  /**
   * Get recommended action based on performance
   */
  private getRecommendedAction(performance: CreativePerformance): string {
    if (performance.impressions < 100) return 'GATHER_DATA';
    if (performance.performanceScore > 0.8) return 'INCREASE_BUDGET';
    if (performance.performanceScore > 0.6) return 'MAINTAIN';
    if (performance.performanceScore > 0.3) return 'OPTIMIZE';
    return 'PAUSE_OR_REPLACE';
  }

  /**
   * Calculate confidence score based on data volume
   */
  private calculateConfidenceScore(performance: CreativePerformance): number {
    // More impressions = higher confidence in the metrics
    return Math.min(performance.impressions / 1000, 1);
  }

  /**
   * Generate actionable insights
   */
  private generateInsights(performance: CreativePerformance): string[] {
    const insights: string[] = [];

    if (performance.impressions < 100) {
      insights.push('Need more data to make reliable optimizations');
    }

    if (performance.ctr > 0.02) {
      insights.push('High CTR indicates strong creative appeal');
    } else if (performance.ctr < 0.005) {
      insights.push('Low CTR suggests creative needs optimization');
    }

    if (performance.performanceScore > 0.8) {
      insights.push('Top performer - consider increasing budget allocation');
    }

    return insights;
  }
}
