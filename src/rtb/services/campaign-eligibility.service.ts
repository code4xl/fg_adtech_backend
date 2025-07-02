import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import {
  CAMPAIGN_KEYS,
  REDIS_KEYS,
  RTB_CACHE_TTL,
} from '../constants/cache-keys';
import { CampaignWithTargeting } from '../types/campaign.types';
import { CampaignTargetingService } from './campaign-targeting.service';
import { InventoryFormat } from '@prisma/client';
import { BudgetInitializationService } from 'src/tracking/services/budget-initialization.service';
import { BudgetValidationService } from 'src/tracking/services/budget-validation.service';

interface BudgetStatus {
  dailyBudget: number;
  spentToday: number;
  isExhausted: boolean;
}

// Updated interface to match new schema
interface CampaignBudgetInfo {
  dailyBudget: number;
  totalBudget: number;
}

@Injectable()
export class CampaignEligibilityService {
  private readonly logger = new Logger(CampaignEligibilityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly campaignTargetingService: CampaignTargetingService,
    private readonly budgetValidation: BudgetValidationService,
    private readonly budgetInit: BudgetInitializationService,
  ) {}

  async getEligibleCampaigns(
    inventoryId: string,
    userContext: any,
    adSlotContext: any,
  ): Promise<CampaignWithTargeting[]> {
    const startTime = Date.now();

    this.logger.debug('Getting eligible campaigns with caching', {
      inventoryId,
      deviceType: userContext.deviceType,
      country: userContext.country,
      adSlot: `${adSlotContext.width}x${adSlotContext.height}`,
    });

    try {
      // 1. Get campaign pool from cache (BIGGEST OPTIMIZATION)
      const campaignPool = await this.getCachedCampaignPool(
        adSlotContext.width,
        adSlotContext.height,
        adSlotContext.format,
      );

      if (campaignPool.length === 0) {
        this.logger.debug('No campaigns in basic pool', { inventoryId });
        return [];
      }

      // 2. Apply targeting filters in parallel batches
      // const targetingFilteredCampaigns = await this.applyTargetingFiltersOptimized(
      //   campaignPool,
      //   userContext,
      //   adSlotContext,
      // );

      // 3. Batch validate budgets using cache
      const budgetValidatedCampaigns =
        await this.batchValidateBudgets(campaignPool);

      const processingTime = Date.now() - startTime;

      this.logger.log('Campaign eligibility calculated (CACHED)', {
        inventoryId,
        totalCampaigns: campaignPool.length,
        // targetingFiltered: targetingFilteredCampaigns.length,
        budgetFiltered: budgetValidatedCampaigns.length,
        processingTime: `${processingTime}ms`,
      });

      return budgetValidatedCampaigns;
    } catch (error) {
      this.logger.error('Failed to get eligible campaigns', {
        error: error.message,
        inventoryId,
      });
      return [];
    }
  }

  private async getCachedCampaignPool(
    width: number,
    height: number,
    format: InventoryFormat,
  ): Promise<CampaignWithTargeting[]> {
    const cacheKey = `campaigns:pool:${width}x${height}:${format}`;

    // Try cache first
    const cached = await this.redis.get<string>(cacheKey);
    if (cached) {
      this.logger.debug('✅ Campaign pool cache HIT', {
        width,
        height,
        format,
      });
      return JSON.parse(cached);
    }

    this.logger.debug('❌ Campaign pool cache MISS - querying DB', {
      width,
      height,
      format,
    });

    // Fallback to database (expensive)
    const now = new Date();
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        status: 'ACTIVE',
        startDate: { lte: now },
        endDate: { gte: now },
        creatives: {
          some: {
            status: 'APPROVED',
            adSlotTemplate: {
              width: width,
              height: height,
              format: format,
            },
          },
        },
      },
      include: {
        creatives: {
          where: {
            status: 'APPROVED',
            adSlotTemplate: {
              width: width,
              height: height,
              format: format,
            },
          },
          include: {
            adSlotTemplate: true,
          },
        },
        advertiser: {
          select: { id: true, name: true },
        },
        // Include all targeting rules for filtering
        demographicTargeting: true,
        geographicTargeting: true,
        deviceTargeting: true,
        contextualTargeting: true,
        behavioralTargeting: true,
        timeTargeting: true,
        frequencyTargeting: true,
      },
    });

    // Cache for 10 minutes (campaigns don't change frequently)
    await this.redis.set(cacheKey, JSON.stringify(campaigns), 600);

    this.logger.debug('Campaign pool cached', {
      width,
      height,
      format,
      campaignCount: campaigns.length,
      ttl: '10 minutes',
    });

    return campaigns;
  }

  private async applyTargetingFiltersOptimized(
    campaigns: CampaignWithTargeting[],
    userContext: any,
    adSlotContext: any,
  ): Promise<CampaignWithTargeting[]> {
    // Process in parallel batches of 20 for better performance
    const batchSize = 20;
    const eligibleCampaigns: CampaignWithTargeting[] = [];

    for (let i = 0; i < campaigns.length; i += batchSize) {
      const batch = campaigns.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async (campaign) => {
          const isEligible = await this.checkTargetingRulesFast(
            campaign,
            userContext,
            adSlotContext,
          );
          return isEligible ? campaign : null;
        }),
      );

      eligibleCampaigns.push(...batchResults.filter(Boolean));
    }

    this.logger.debug('Targeting filters applied (optimized)', {
      totalCampaigns: campaigns.length,
      eligibleAfterTargeting: eligibleCampaigns.length,
      batchSize,
    });

    return eligibleCampaigns;
  }

  async checkTargetingRulesFast(
    campaign: CampaignWithTargeting,
    userContext: any,
    adSlotContext: any,
  ): Promise<boolean> {
    try {
      // Early exit if campaign has no targeting rules
      if (!this.campaignTargetingService.hasTargetingRules(campaign)) {
        return true; // No targeting = all traffic eligible
      }

      // Fast geographic check (most selective first)
      if (campaign.geographicTargeting?.length > 0) {
        const geoPass =
          await this.campaignTargetingService.checkGeographicTargeting(
            campaign.geographicTargeting,
            userContext,
          );
        if (!geoPass) return false;
      }

      // Fast device check
      if (campaign.deviceTargeting?.length > 0) {
        const devicePass =
          await this.campaignTargetingService.checkDeviceTargeting(
            campaign.deviceTargeting,
            userContext,
          );
        if (!devicePass) return false;
      }

      // Fast time check
      if (campaign.timeTargeting?.length > 0) {
        const timePass = await this.campaignTargetingService.checkTimeTargeting(
          campaign.timeTargeting,
          userContext,
        );
        if (!timePass) return false;
      }

      // Run remaining checks in parallel (less selective)
      const [demoPass, contextPass, behaviorPass, frequencyPass] =
        await Promise.all([
          campaign.demographicTargeting?.length > 0
            ? this.campaignTargetingService.checkDemographicTargeting(
                campaign.demographicTargeting,
                userContext,
              )
            : true,
          campaign.contextualTargeting?.length > 0
            ? this.campaignTargetingService.checkContextualTargeting(
                campaign.contextualTargeting,
                adSlotContext,
              )
            : true,
          campaign.behavioralTargeting?.length > 0
            ? this.campaignTargetingService.checkBehavioralTargeting(
                campaign.behavioralTargeting,
                userContext,
              )
            : true,
          campaign.frequencyTargeting?.length > 0
            ? this.campaignTargetingService.checkFrequencyTargeting(
                campaign.frequencyTargeting,
                userContext,
                campaign.id,
              )
            : true,
        ]);

      return demoPass && contextPass && behaviorPass && frequencyPass;
    } catch (error) {
      this.logger.error('Fast targeting rule evaluation failed', {
        error: error.message,
        campaignId: campaign.id,
      });
      return false;
    }
  }

  private async batchValidateBudgets(
    campaigns: CampaignWithTargeting[],
  ): Promise<CampaignWithTargeting[]> {
    if (campaigns.length === 0) return [];

    const budgetChecks = await Promise.all(
      campaigns.map(async (campaign: CampaignWithTargeting) => {
        try {
          // FIX: Safe bid amount extraction
          let bidAmount = 1.0;
          if (campaign.bidAmount) {
            bidAmount = Number(campaign.bidAmount) || 1.0;
          }

          const hasValidBudget = await this.checkBudgetAvailability(
            campaign.id,
            bidAmount,
          );
          return { campaignId: campaign.id, hasValidBudget };
        } catch (error) {
          this.logger.warn(
            `Budget check failed for campaign ${campaign.id}:`,
            error,
          );
          return { campaignId: campaign.id, hasValidBudget: false };
        }
      }),
    );

    const budgetMap = new Map<string, boolean>();
    budgetChecks.forEach(({ campaignId, hasValidBudget }) => {
      budgetMap.set(campaignId, hasValidBudget);
    });

    const validCampaigns = campaigns.filter(
      (campaign) => budgetMap.get(campaign.id) === true,
    );

    this.logger.debug('Batch budget validation completed', {
      totalCampaigns: campaigns.length,
      validBudgets: validCampaigns.length,
      rejectedBudgets: campaigns.length - validCampaigns.length,
    });

    return validCampaigns;
  }

  async checkBudgetAvailability(
    campaignId: string,
    bidAmount: number,
  ): Promise<boolean> {
    return await this.budgetValidation.validateCampaignBudget(
      campaignId,
      bidAmount,
    );
  }

  private async getCachedBudgetStatus(
    campaignId: string,
    today: string,
  ): Promise<BudgetStatus | null> {
    const cacheKey = `budget:status:${campaignId}:${today}`;

    // Try cache first
    const cached = await this.redis.get<string>(cacheKey);
    if (cached) {
      this.logger.debug('✅ Budget status cache HIT', { campaignId });
      return JSON.parse(cached);
    }

    this.logger.debug('❌ Budget status cache MISS - querying DB', {
      campaignId,
    });

    // Fallback to database - UPDATED to use CampaignDailyBudget
    const dailyBudget = await this.prisma.campaignDailyBudget.findFirst({
      where: {
        campaignId,
        date: new Date(today),
      },
      select: {
        spentToday: true,
        remainingToday: true,
        isExhausted: true,
      },
    });

    if (!dailyBudget) {
      return null;
    }

    const budgetStatus: BudgetStatus = {
      dailyBudget:
        Number(dailyBudget.spentToday) + Number(dailyBudget.remainingToday), // Calculate total from spent + remaining
      spentToday: Number(dailyBudget.spentToday),
      isExhausted: dailyBudget.isExhausted,
    };

    // Cache for 30 seconds (budget changes frequently)
    await this.redis.set(cacheKey, JSON.stringify(budgetStatus), 30);

    this.logger.debug('Budget status cached', {
      campaignId,
      budgetStatus,
      ttl: '30 seconds',
    });

    return budgetStatus;
  }

  // UPDATED: This method is no longer needed as we're using the new budget structure
  // But keeping it for reference or if you need it elsewhere
  private async getCampaignBudgetInfo(
    campaignId: string,
    today: string,
  ): Promise<CampaignBudgetInfo | null> {
    try {
      const cacheKey = CAMPAIGN_KEYS.CAMPAIGN_BUDGET_INFO(campaignId, today);
      const cached = await this.redis.get<string>(cacheKey);

      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          dailyBudget: parsed.dailyBudget,
          totalBudget: parsed.totalBudget,
        };
      }

      // UPDATED: Query both CampaignBudget and CampaignDailyBudget
      const [campaignBudget, dailyBudget] = await Promise.all([
        this.prisma.campaignBudget.findUnique({
          where: { campaignId },
          select: { totalBudget: true, dailyBudget: true },
        }),
        this.prisma.campaignDailyBudget.findFirst({
          where: {
            campaignId,
            date: new Date(today),
          },
          select: { spentToday: true, remainingToday: true },
        }),
      ]);

      if (!campaignBudget) {
        this.logger.warn('No campaign budget found', { campaignId, today });
        return null;
      }

      const budgetInfo: CampaignBudgetInfo = {
        totalBudget: Number(campaignBudget.totalBudget),
        dailyBudget: Number(campaignBudget.dailyBudget),
      };

      await this.redis.set(
        cacheKey,
        JSON.stringify(budgetInfo),
        RTB_CACHE_TTL.CAMPAIGN_BUDGET_INFO,
      );

      return budgetInfo;
    } catch (error) {
      this.logger.error('Failed to get campaign budget info', {
        error: error.message,
        campaignId,
        today,
      });
      return null;
    }
  }

  async invalidateCampaignPoolCache(
    width?: number,
    height?: number,
    format?: string,
  ): Promise<void> {
    try {
      if (width && height && format) {
        // Invalidate specific ad slot
        const cacheKey = `campaigns:pool:${width}x${height}:${format}`;
        await this.redis.del(cacheKey);
        this.logger.debug('Invalidated specific campaign pool cache', {
          width,
          height,
          format,
        });
      } else {
        // Invalidate all campaign pools (when campaign status changes)
        const pattern = 'campaigns:pool:*';
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await Promise.all(keys.map((key) => this.redis.del(key)));
          this.logger.debug('Invalidated all campaign pool caches', {
            keysInvalidated: keys.length,
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to invalidate campaign pool cache', {
        error: error.message,
      });
    }
  }

  async invalidateBudgetCache(campaignId: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const cacheKey = `budget:status:${campaignId}:${today}`;
      await this.redis.del(cacheKey);
      this.logger.debug('Invalidated budget cache', { campaignId });
    } catch (error) {
      this.logger.error('Failed to invalidate budget cache', {
        error: error.message,
      });
    }
  }

  async warmupCaches(): Promise<void> {
    try {
      this.logger.log(
        'Starting comprehensive cache warmup for all ad formats...',
      );

      // ===== BANNER FORMAT (Most Common) =====
      const bannerSizes = [
        { width: 728, height: 90, format: 'BANNER' }, // Leaderboard
        { width: 300, height: 250, format: 'BANNER' }, // Medium Rectangle
        { width: 320, height: 50, format: 'BANNER' }, // Mobile Banner
        { width: 160, height: 600, format: 'BANNER' }, // Wide Skyscraper
        { width: 300, height: 600, format: 'BANNER' }, // Half Page
        { width: 970, height: 250, format: 'BANNER' }, // Billboard
        { width: 336, height: 280, format: 'BANNER' }, // Large Rectangle
        { width: 468, height: 60, format: 'BANNER' }, // Banner
        { width: 234, height: 60, format: 'BANNER' }, // Half Banner
        { width: 120, height: 600, format: 'BANNER' }, // Skyscraper
      ];

      // ===== NATIVE FORMAT =====
      const nativeSizes = [
        { width: 300, height: 250, format: 'NATIVE' }, // Native Rectangle
        { width: 320, height: 240, format: 'NATIVE' }, // Mobile Native
        { width: 600, height: 400, format: 'NATIVE' }, // Large Native
        { width: 400, height: 300, format: 'NATIVE' }, // Standard Native
        { width: 280, height: 200, format: 'NATIVE' }, // Small Native
      ];

      // ===== VIDEO FORMAT =====
      const videoSizes = [
        { width: 640, height: 480, format: 'VIDEO' }, // Standard Video
        { width: 854, height: 480, format: 'VIDEO' }, // Wide Video
        { width: 1280, height: 720, format: 'VIDEO' }, // HD Video
        { width: 320, height: 240, format: 'VIDEO' }, // Mobile Video
        { width: 300, height: 250, format: 'VIDEO' }, // Square Video
        { width: 1920, height: 1080, format: 'VIDEO' }, // Full HD Video
      ];

      // ===== INTERSTITIAL FORMAT =====
      const interstitialSizes = [
        { width: 320, height: 480, format: 'INTERSTITIAL' }, // Mobile Portrait
        { width: 480, height: 320, format: 'INTERSTITIAL' }, // Mobile Landscape
        { width: 768, height: 1024, format: 'INTERSTITIAL' }, // Tablet Portrait
        { width: 1024, height: 768, format: 'INTERSTITIAL' }, // Tablet Landscape
        { width: 414, height: 736, format: 'INTERSTITIAL' }, // iPhone Plus
        { width: 375, height: 667, format: 'INTERSTITIAL' }, // iPhone Standard
      ];

      // ===== REWARDED FORMAT =====
      const rewardedSizes = [
        { width: 320, height: 480, format: 'REWARDED' }, // Mobile Portrait
        { width: 480, height: 320, format: 'REWARDED' }, // Mobile Landscape
        { width: 640, height: 480, format: 'REWARDED' }, // Standard Rewarded
        { width: 854, height: 480, format: 'REWARDED' }, // Wide Rewarded
        { width: 300, height: 250, format: 'REWARDED' }, // Square Rewarded
      ];

      // ===== COMBINE ALL POPULAR SIZES =====
      const allPopularSizes = [
        ...bannerSizes,
        ...nativeSizes,
        ...videoSizes,
        ...interstitialSizes,
        ...rewardedSizes,
      ];

      this.logger.log('Warming up campaign pools for all formats', {
        totalSizes: allPopularSizes.length,
        bannerSizes: bannerSizes.length,
        nativeSizes: nativeSizes.length,
        videoSizes: videoSizes.length,
        interstitialSizes: interstitialSizes.length,
        rewardedSizes: rewardedSizes.length,
      });

      // ===== WARM UP CAMPAIGN POOLS (PARALLEL BATCHES) =====

      // Process in batches to avoid overwhelming the database
      const batchSize = 5;
      let warmedCount = 0;

      for (let i = 0; i < allPopularSizes.length; i += batchSize) {
        const batch = allPopularSizes.slice(i, i + batchSize);

        this.logger.debug(
          `Warming up batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allPopularSizes.length / batchSize)}`,
          {
            batchSizes: batch.map((s) => `${s.width}x${s.height}-${s.format}`),
          },
        );

        // Process batch in parallel
        const batchPromises = batch.map((size) =>
          this.getCachedCampaignPool(
            size.width,
            size.height,
            size.format as InventoryFormat,
          )
            .then((campaigns) => {
              warmedCount++;
              this.logger.debug(
                `✅ Warmed ${size.width}x${size.height}-${size.format}`,
                {
                  campaignCount: campaigns.length,
                },
              );
              return campaigns.length;
            })
            .catch((error) => {
              this.logger.warn(
                `❌ Failed to warm ${size.width}x${size.height}-${size.format}`,
                {
                  error: error.message,
                },
              );
              return 0;
            }),
        );

        await Promise.all(batchPromises);

        // Small delay between batches to avoid database overload
        if (i + batchSize < allPopularSizes.length) {
          await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay
        }
      }

      // ===== WARM UP BUDGET STATUS FOR ACTIVE CAMPAIGNS =====

      this.logger.log('Warming up budget status for active campaigns...');

      const activeCampaigns = await this.prisma.campaign.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
        take: 20, // Limit to top 20 active campaigns to avoid overload
      });

      const today = new Date().toISOString().split('T')[0];
      let budgetWarmedCount = 0;

      // Process budget warmup in smaller batches
      const budgetBatchSize = 10;
      for (let i = 0; i < activeCampaigns.length; i += budgetBatchSize) {
        const budgetBatch = activeCampaigns.slice(i, i + budgetBatchSize);

        const budgetPromises = budgetBatch.map((campaign) =>
          this.getCachedBudgetStatus(campaign.id, today)
            .then(() => {
              budgetWarmedCount++;
              return true;
            })
            .catch((error) => {
              this.logger.warn(
                `Failed to warm budget for campaign ${campaign.id}`,
                {
                  error: error.message,
                },
              );
              return false;
            }),
        );

        await Promise.all(budgetPromises);
      }

      // ===== COMPLETION SUMMARY =====

      this.logger.log('🎯 Comprehensive cache warmup completed!', {
        campaignPoolsWarmed: warmedCount,
        totalSizesAttempted: allPopularSizes.length,
        budgetStatusWarmed: budgetWarmedCount,
        totalCampaignsAttempted: activeCampaigns.length,
        formatBreakdown: {
          banner: bannerSizes.length,
          native: nativeSizes.length,
          video: videoSizes.length,
          interstitial: interstitialSizes.length,
          rewarded: rewardedSizes.length,
        },
      });
    } catch (error) {
      this.logger.error('❌ Comprehensive cache warmup failed', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}
