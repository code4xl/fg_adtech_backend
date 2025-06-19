import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { RedisService } from "src/redis/redis.service";
import { CAMPAIGN_KEYS, REDIS_KEYS, RTB_CACHE_TTL } from "../constants/cache-keys";
import { CampaignBudgetInfo, CampaignBudgetTracker, CampaignWithTargeting } from "../types/campaign.types";
import { CampaignTargetingService } from "./campaign-targeting.service";

@Injectable()
export class CampaignEligibilityService {
  private readonly logger = new Logger(CampaignEligibilityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly campaignTargetingService: CampaignTargetingService,
  ) { }

  async getEligibleCampaigns(
    inventoryId: string,
    userContext: any,
    adSlotContext: any,
  ): Promise<any[]> {
    this.logger.debug('Getting eligible campaigns', {
      inventoryId,
      deviceType: userContext.deviceType,
      country: userContext.country,
    });

    try {
      // 1. Check Redis cache first  --> Redundant as we are checking in the cache earlier
      // const cacheKey = CAMPAIGN_KEYS.ELIGIBLE_CAMPAIGNS(
      //   inventoryId,
      //   userContext.deviceType,
      // );
      // const cached = await this.getCachedEligibility(cacheKey);

      // if (cached) {
      //   this.logger.debug('Campaign eligibility cache hit', { inventoryId });
      //   return cached;
      // }

      // 2. Get basic campaign pool (active campaigns with budget)
      const campaignPool = await this.getBasicCampaignPool(
        adSlotContext,
      );

      if (campaignPool.length === 0) {
        this.logger.debug('No campaigns in basic pool', { inventoryId });
        return [];  // Google ka flow start (ig)
      }

      // 3. Apply targeting filters in order of selectivity
      const eligibleCampaigns = await this.applyTargetingFilters(
        campaignPool,
        userContext,
        adSlotContext,
      );

      // 4. Final budget validation (real-time check)
      const budgetValidatedCampaigns = await this.validateBudgets(eligibleCampaigns);

      // 5. Cache results for 5 minutes --> Redundant as we are caching the result in the higher function
      // await this.cacheEligibility(cacheKey, budgetValidatedCampaigns, RTB_CACHE_TTL.CAMPAIGN_ELIGIBILITY_BUDGET);

      this.logger.log('Campaign eligibility calculated', {
        inventoryId,
        totalCampaigns: campaignPool.length,
        eligibleCampaigns: budgetValidatedCampaigns.length,
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

  // private async getCachedEligibility(cacheKey: string): Promise<CampaignWithTargeting[] | null> {
  //   try {
  //     const cached = await this.redis.get<string>(cacheKey);
  //     return cached ? JSON.parse(cached) : null;
  //   } catch (error) {
  //     this.logger.warn('Cache retrieval failed', {
  //       error: error.message,
  //       cacheKey,
  //     });
  //     return null;
  //   }
  // }

  private async getBasicCampaignPool(
    adSlotContext: any,
  ): Promise<CampaignWithTargeting[]> {
    const now = new Date();

    return await this.prisma.campaign.findMany({
      where: {
        status: 'ACTIVE',
        startDate: { lte: now },
        endDate: { gte: now },
        creatives: {
          some: {
            status: 'APPROVED',
            adSlotTemplate: {
              width: adSlotContext.width,
              height: adSlotContext.height,
              format: adSlotContext.format,
            },
          },
        },
      },
      include: {
        creatives: {
          where: {
            status: 'APPROVED',
            adSlotTemplate: {
              width: adSlotContext.width,
              height: adSlotContext.height,
              format: adSlotContext.format,
            },
          },
          include: {
            adSlotTemplate: true,
          },
        },
        advertiser: {
          select: { id: true, name: true },
        },
        // Include all targeting rules
        demographicTargeting: true,
        geographicTargeting: true,
        deviceTargeting: true,
        contextualTargeting: true,
        behavioralTargeting: true,
        timeTargeting: true,
        frequencyTargeting: true,
      },
    });
  }

  private async cacheEligibility(
    cacheKey: string,
    campaigns: CampaignWithTargeting[],
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await this.redis.set(cacheKey, JSON.stringify(campaigns), ttlSeconds);
    } catch (error) {
      this.logger.warn('Cache storage failed', {
        error: error.message,
        cacheKey,
      });
    }
  }

  private async validateBudgets(campaigns: CampaignWithTargeting[]): Promise<CampaignWithTargeting[]> {
    const budgetChecks = campaigns.map(async (campaign) => {
      const hasBudget = await this.checkBudgetAvailability(campaign.id);
      return hasBudget ? campaign : null;
    });

    const results = await Promise.all(budgetChecks);
    return results.filter((campaign) => campaign !== null);
  }

  // private async applyTargetingFilters(
  //   campaigns: CampaignWithTargeting[],
  //   userContext: any,
  //   adSlotContext: any,
  // ): Promise<CampaignWithTargeting[]> {
  //   const filteredCampaigns = [];

  //   for (const campaign of campaigns) {
  //     const isEligible = await this.checkTargetingRules(
  //       campaign,
  //       userContext,
  //       adSlotContext,
  //     );

  //     if (isEligible) {
  //       filteredCampaigns.push(campaign);
  //     }
  //   }

  //   return filteredCampaigns;
  // }
  private async applyTargetingFilters(
    campaigns: CampaignWithTargeting[],
    userContext: any,
    adSlotContext: any,
  ): Promise<CampaignWithTargeting[]> {

    // Process in parallel batches of 10
    const batchSize = 10;
    const eligibleCampaigns: CampaignWithTargeting[] = [];

    for (let i = 0; i < campaigns.length; i += batchSize) {
      const batch = campaigns.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async (campaign) => {
          const isEligible = await this.checkTargetingRules(campaign, userContext, adSlotContext);
          return isEligible ? campaign : null;
        })
      );

      eligibleCampaigns.push(...batchResults.filter(Boolean));
    }

    return eligibleCampaigns;
  }

  async checkBudgetAvailability(campaignId: string): Promise<boolean> {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const spentKey = CAMPAIGN_KEYS.CAMPAIGN_BUDGET(campaignId, today);

      // Get current spend from Redis with proper null handling
      const spentData = await this.redis.get<string>(spentKey);
      const spentToday = spentData ? parseFloat(spentData) : 0; // Direct INR value, no conversion needed

      // Get campaign budget info
      const budgetInfo = await this.getCampaignBudgetInfo(campaignId, today);
      if (!budgetInfo) {
        this.logger.warn('Campaign budget info not found', { campaignId });
        return false;
      }

      // Ensure proper number conversion
      const dailyBudget = Number(budgetInfo.dailyBudget);
      const remainingDaily = dailyBudget - spentToday;
      const isWithinBudget = remainingDaily > 1; // Minimum ₹1 remaining (INR)

      this.logger.debug('Budget availability checked', {
        campaignId,
        dailyBudget: `₹${dailyBudget}`,
        spentToday: `₹${spentToday}`,
        remainingDaily: `₹${remainingDaily}`,
        isWithinBudget,
        currency: 'INR',
        budgetInfoType: typeof budgetInfo.dailyBudget,
        spentTodayType: typeof spentToday,
      });

      return isWithinBudget;
    } catch (error) {
      this.logger.error('Budget availability check failed', {
        error: error.message,
        campaignId,
      });
      return false; // Fail safely
    }
  }

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

      // Get from database with proper date matching
      const budgetTracker = await this.prisma.campaignBudgetTracker.findFirst({
        where: {
          campaignId,
          date: {
            equals: new Date(today).toISOString(), // Proper date matching
          },
        },
        select: {
          dailyBudget: true,
          totalBudget: true,
        },
      });

      if (!budgetTracker) {
        this.logger.warn('No budget tracker found for campaign', {
          campaignId,
          today
        });
        return null;
      }

      const budgetInfo = {
        dailyBudget: budgetTracker.dailyBudget,
        totalBudget: budgetTracker.totalBudget,
      };

      // Cache for 1 hour with proper serialization
      await this.redis.set(
        cacheKey,
        JSON.stringify(budgetInfo),
        RTB_CACHE_TTL.CAMPAIGN_BUDGET_INFO
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

  // async checkTargetingRules(
  //   campaign: CampaignWithTargeting,
  //   userContext: any,
  //   adSlotContext: any,
  // ): Promise<boolean> {
  //   try {
  //     // Early exit if campaign has no targeting rules
  //     if (!this.campaignTargetingService.hasTargetingRules(campaign)) {
  //       return true; // No targeting = all traffic eligible
  //     }

  //     // Evaluate each targeting type (AND logic - all must pass)
  //     const checks = await Promise.all([
  //       this.campaignTargetingService.checkGeographicTargeting(
  //         campaign.geographicTargeting,
  //         userContext,
  //       ),
  //       this.campaignTargetingService.checkDeviceTargeting(campaign.deviceTargeting, userContext),
  //       this.campaignTargetingService.checkDemographicTargeting(
  //         campaign.demographicTargeting,
  //         userContext,
  //       ),
  //       this.campaignTargetingService.checkTimeTargeting(campaign.timeTargeting, userContext),
  //       this.campaignTargetingService.checkContextualTargeting(
  //         campaign.contextualTargeting,
  //         adSlotContext,
  //       ),
  //       this.campaignTargetingService.checkBehavioralTargeting(
  //         campaign.behavioralTargeting,
  //         userContext,
  //       ),
  //       this.campaignTargetingService.checkFrequencyTargeting(
  //         campaign.frequencyTargeting,
  //         userContext,
  //         campaign.id,
  //       ),
  //     ]);

  //     const allRulesPassed = checks.every((result) => result === true);

  //     this.logger.debug('Targeting rules evaluated', {
  //       campaignId: campaign.id,
  //       rulesCount: checks.length,
  //       allPassed: allRulesPassed,
  //     });

  //     return allRulesPassed;
  //   } catch (error) {
  //     this.logger.error('Targeting rule evaluation failed', {
  //       error: error.message,
  //       campaignId: campaign.id,
  //     });
  //     return false;
  //   }
  // }

  async checkTargetingRules(campaign: CampaignWithTargeting, userContext: any, adSlotContext: any): Promise<boolean> {
    if (!this.campaignTargetingService.hasTargetingRules(campaign)) {
      return true;
    }

    // Run all checks in parallel instead of sequential
    const [
      geoCheck,
      deviceCheck,
      demoCheck,
      timeCheck,
      contextCheck,
      behaviorCheck,
      frequencyCheck
    ] = await Promise.all([
      this.campaignTargetingService.checkGeographicTargeting(campaign.geographicTargeting, userContext),
      this.campaignTargetingService.checkDeviceTargeting(campaign.deviceTargeting, userContext),
      this.campaignTargetingService.checkDemographicTargeting(campaign.demographicTargeting, userContext),
      this.campaignTargetingService.checkTimeTargeting(campaign.timeTargeting, userContext),
      this.campaignTargetingService.checkContextualTargeting(campaign.contextualTargeting, adSlotContext),
      this.campaignTargetingService.checkBehavioralTargeting(campaign.behavioralTargeting, userContext),
      this.campaignTargetingService.checkFrequencyTargeting(campaign.frequencyTargeting, userContext, campaign.id)
    ]);

    return geoCheck && deviceCheck && demoCheck && timeCheck && contextCheck && behaviorCheck && frequencyCheck;
  }
}