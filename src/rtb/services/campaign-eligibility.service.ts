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
      // 1. Check Redis cache first
      const cacheKey = CAMPAIGN_KEYS.ELIGIBLE_CAMPAIGNS(
        inventoryId,
        userContext.deviceType,
      );
      const cached = await this.getCachedEligibility(cacheKey);

      if (cached) {
        this.logger.debug('Campaign eligibility cache hit', { inventoryId });
        return cached;
      }

      // 2. Get basic campaign pool (active campaigns with budget)
      const campaignPool = await this.getBasicCampaignPool(
        inventoryId,
        adSlotContext,
      );

      if (campaignPool.length === 0) {
        this.logger.debug('No campaigns in basic pool', { inventoryId });
        return [];
      }

      // 3. Apply targeting filters in order of selectivity
      // const eligibleCampaigns = await this.applyTargetingFilters(
      //   campaignPool,
      //   userContext,
      //   adSlotContext,
      // );

      // 4. Final budget validation (real-time check)
      const budgetValidated = await this.validateBudgets(campaignPool);

      // 5. Cache results for 5 minutes
      await this.cacheEligibility(cacheKey, budgetValidated, RTB_CACHE_TTL.CAMPAIGN_ELIGIBILITY_BUDGET);

      this.logger.log('Campaign eligibility calculated', {
        inventoryId,
        totalCampaigns: campaignPool.length,
        eligibleCampaigns: budgetValidated.length,
      });

      return budgetValidated;
    } catch (error) {
      this.logger.error('Failed to get eligible campaigns', {
        error: error.message,
        inventoryId,
      });
      return [];
    }
  }

  private async getCachedEligibility(cacheKey: string): Promise<CampaignWithTargeting[] | null> {
    try {
      const cached = await this.redis.get<string>(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.warn('Cache retrieval failed', {
        error: error.message,
        cacheKey,
      });
      return null;
    }
  }

  // Ask Mit about this
  private async getBasicCampaignPool(
    inventoryId: string,
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
    this.logger.debug("All Campaigns", {
      campaigns,
    })

    const budgetChecks = campaigns.map(async (campaign) => {
      const hasBudget = await this.checkBudgetAvailability(campaign.id);
      return hasBudget ? campaign : null;
    });

    const results = await Promise.all(budgetChecks);
    return results.filter((campaign) => campaign !== null);
  }

  private async applyTargetingFilters(
    campaigns: CampaignWithTargeting[],
    userContext: any,
    adSlotContext: any,
  ): Promise<CampaignWithTargeting[]> {
    const filteredCampaigns = [];

    for (const campaign of campaigns) {
      const isEligible = await this.checkTargetingRules(
        campaign,
        userContext,
        adSlotContext,
      );

      if (isEligible) {
        filteredCampaigns.push(campaign);
      }
    }

    return filteredCampaigns;
  }

  async checkBudgetAvailability(campaignId: string): Promise<boolean> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const spentKey = CAMPAIGN_KEYS.CAMPAIGN_BUDGET(campaignId, today);

      // Get current spend from Redis
      const spentToday =
        parseFloat((await this.redis.get<string>(spentKey)) || '0') / 100; // Convert from cents

      // Get campaign budget info (cached)
      const campaign = await this.getCampaignBudgetInfo(campaignId, today);
      if (!campaign) {
        this.logger.warn('Campaign not found for budget check', { campaignId });
        return false;
      }

      // Check daily budget
      const remainingDaily = Number(campaign.dailyBudget) - spentToday;
      const isWithinBudget = remainingDaily > 0.01; // Minimum $0.01 remaining

      this.logger.debug("Whyy plss", {
        spentToday,
        remainingDaily,
      })

      this.logger.debug('Budget availability checked', {
        campaignId,
        dailyBudget: campaign.dailyBudget,
        spentToday,
        remainingDaily,
        isWithinBudget,
      });

      return isWithinBudget;
    } catch (error) {
      this.logger.error('Budget availability check failed', {
        error: error.message,
        campaignId,
      });
      return false;
    }
  }

  private async getCampaignBudgetInfo(
    campaignId: string,
    today: string,
  ): Promise<CampaignBudgetInfo> {
    try {
      // Use cache for campaign budget info
      const cacheKey = CAMPAIGN_KEYS.CAMPAIGN_BUDGET(campaignId, today);
      const cached = await this.redis.get<string>(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Get from database
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        select: {
          id: true,
          campaignBudgetTracker: {
            where: {
              date: new Date().toISOString(),
            },
            select: {
              dailyBudget: true,
              totalBudget: true,
            },
          },
        },
      });

      if (!campaign?.campaignBudgetTracker[0]) {
        return null;
      }

      const budgetInfo = campaign.campaignBudgetTracker[0];

      this.logger.debug("Budget info", {
        budgetInfo,
      })

      // Cache for 1 hour
      await this.redis.set(cacheKey, JSON.stringify(budgetInfo), RTB_CACHE_TTL.CAMPAIGN_BUDGET_INFO);

      return budgetInfo;
    } catch (error) {
      this.logger.error('Failed to get campaign budget info', {
        error: error.message,
        campaignId,
      });
      return null;
    }
  }

  async checkTargetingRules(
    campaign: CampaignWithTargeting,
    userContext: any,
    adSlotContext: any,
  ): Promise<boolean> {
    try {
      // Early exit if campaign has no targeting rules
      if (!this.campaignTargetingService.hasTargetingRules(campaign)) {
        return true; // No targeting = all traffic eligible
      }

      // Evaluate each targeting type (AND logic - all must pass)
      const checks = await Promise.all([
        this.campaignTargetingService.checkGeographicTargeting(
          campaign.geographicTargeting,
          userContext,
        ),
        this.campaignTargetingService.checkDeviceTargeting(campaign.deviceTargeting, userContext),
        this.campaignTargetingService.checkDemographicTargeting(
          campaign.demographicTargeting,
          userContext,
        ),
        this.campaignTargetingService.checkTimeTargeting(campaign.timeTargeting, userContext),
        this.campaignTargetingService.checkContextualTargeting(
          campaign.contextualTargeting,
          adSlotContext,
        ),
        this.campaignTargetingService.checkBehavioralTargeting(
          campaign.behavioralTargeting,
          userContext,
        ),
        this.campaignTargetingService.checkFrequencyTargeting(
          campaign.frequencyTargeting,
          userContext,
          campaign.id,
        ),
      ]);

      const allRulesPassed = checks.every((result) => result === true);

      this.logger.debug('Targeting rules evaluated', {
        campaignId: campaign.id,
        rulesCount: checks.length,
        allPassed: allRulesPassed,
      });

      return allRulesPassed;
    } catch (error) {
      this.logger.error('Targeting rule evaluation failed', {
        error: error.message,
        campaignId: campaign.id,
      });
      return false;
    }
  }
}