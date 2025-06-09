// src/rtb/services/campaign-eligibility.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { REDIS_KEYS } from '../../redis/constants/redis-keys';
import { EligibleCampaign } from '../interfaces/campaign-eligibility.interface';
import { CreativePerformanceService } from './creative-performance.service';

@Injectable()
export class CampaignEligibilityService {
  private readonly logger = new Logger(CampaignEligibilityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly creativePerformanceService: CreativePerformanceService,
  ) {}

  /**
   * MULTI-TIER CACHING: Find eligible campaigns with creative performance
   * L1: Redis (eligible campaigns per inventory)
   * L2: PostgreSQL (campaign targeting rules)
   * L3: Real-time budget checks
   */
  async findEligibleCampaigns(
    bidRequest: any,
    performanceContext: any,
  ): Promise<EligibleCampaign[]> {
    const startTime = Date.now();

    try {
      // L1 CACHE: Check Redis for eligible campaigns
      const cacheKey = REDIS_KEYS.ELIGIBLE_CAMPAIGNS(bidRequest.inventoryId);
      let eligibleCampaigns =
        await this.redis.get<EligibleCampaign[]>(cacheKey);

      if (eligibleCampaigns && eligibleCampaigns.length > 0) {
        this.logger.debug(
          `L1 Cache hit for inventory ${bidRequest.inventoryId}`,
        );

        // Still need to check real-time budget constraints
        const budgetValidatedCampaigns =
          await this.validateBudgetConstraints(eligibleCampaigns);

        // Enrich with creative performance for bid optimization
        return await this.enrichWithCreativePerformance(
          budgetValidatedCampaigns,
        );
      }

      // L2 DATABASE: Query PostgreSQL with targeting rules
      this.logger.debug(
        `L1 Cache miss, querying database for inventory ${bidRequest.inventoryId}`,
      );

      const campaigns =
        await this.queryEligibleCampaignsFromDatabase(bidRequest);

      // L3 BUDGET: Apply real-time budget checks
      const budgetValidatedCampaigns =
        await this.validateBudgetConstraints(campaigns);

      // CACHE: Store results in Redis for future requests (cache for 5 minutes)
      if (budgetValidatedCampaigns.length > 0) {
        await this.redis.set(cacheKey, budgetValidatedCampaigns, 300);
        this.logger.debug(
          `Cached ${budgetValidatedCampaigns.length} eligible campaigns`,
        );
      }

      // ENRICH: Add creative performance scores
      const enrichedCampaigns = await this.enrichWithCreativePerformance(
        budgetValidatedCampaigns,
      );

      this.logger.debug(
        `Found ${enrichedCampaigns.length} eligible campaigns in ${Date.now() - startTime}ms`,
      );

      return enrichedCampaigns;
    } catch (error) {
      this.logger.error(
        `Error finding eligible campaigns: ${error.message}`,
        error,
      );
      return [];
    }
  }

  /**
   * Query database for campaigns matching targeting criteria
   */
  private async queryEligibleCampaignsFromDatabase(
    bidRequest: any,
  ): Promise<EligibleCampaign[]> {
    const userContext = bidRequest.userContext || {};
    const currentDate = new Date();

    // Build targeting filters based on bid request context
    const targetingFilters = this.buildTargetingFilters(
      bidRequest,
      userContext,
    );

    // Query campaigns with all targeting rules
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        status: 'ACTIVE',
        startDate: { lte: currentDate },
        endDate: { gte: currentDate },
        // Add inventory format matching
        creatives: {
          some: {
            status: 'APPROVED',
            adSlotTemplate: {
              format: bidRequest.inventory?.adSlotTemplate?.format,
            },
          },
        },
      },
      include: {
        advertiser: true,
        creatives: {
          where: {
            status: 'APPROVED',
            adSlotTemplate: {
              format: bidRequest.inventory?.adSlotTemplate?.format,
            },
          },
          include: {
            adSlotTemplate: true,
          },
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

    // Apply targeting filters
    const eligibleCampaigns: EligibleCampaign[] = [];

    for (const campaign of campaigns) {
      if (
        await this.matchesTargetingCriteria(campaign, bidRequest, userContext)
      ) {
        eligibleCampaigns.push({
          id: campaign.id,
          advertiserId: campaign.advertiserId,
          bidAmount: campaign.bidAmount?.toNumber() || 0,
          creatives: campaign.creatives.map((creative) => ({
            id: creative.id,
            performanceScore: 0, // Will be enriched later
            ctr: 0, // Will be enriched later
          })),
          dailyBudgetRemaining: 0, // Will be calculated in budget validation
          totalBudgetRemaining: 0, // Will be calculated in budget validation
        });
      }
    }

    return eligibleCampaigns;
  }

  /**
   * Build targeting filters from bid request context
   */
  private buildTargetingFilters(bidRequest: any, userContext: any) {
    return {
      country: userContext.country,
      region: userContext.region,
      city: userContext.city,
      deviceType: userContext.deviceType,
      browserType: userContext.browserType,
      osType: userContext.osType,
      inventoryFormat: bidRequest.inventory?.adSlotTemplate?.format,
      inventoryPosition: bidRequest.inventory?.adSlotTemplate?.position,
    };
  }

  /**
   * Check if campaign matches targeting criteria
   */
  private async matchesTargetingCriteria(
    campaign: any,
    bidRequest: any,
    userContext: any,
  ): Promise<boolean> {
    try {
      // 1. GEOGRAPHIC TARGETING
      if (
        !this.matchesGeographicTargeting(
          campaign.geographicTargeting,
          userContext,
        )
      ) {
        return false;
      }

      // 2. DEVICE TARGETING
      if (!this.matchesDeviceTargeting(campaign.deviceTargeting, userContext)) {
        return false;
      }

      // 3. DEMOGRAPHIC TARGETING (if available)
      if (
        !this.matchesDemographicTargeting(
          campaign.demographicTargeting,
          userContext,
        )
      ) {
        return false;
      }

      // 4. TIME TARGETING
      if (!this.matchesTimeTargeting(campaign.timeTargeting)) {
        return false;
      }

      // 5. CONTEXTUAL TARGETING
      if (
        !this.matchesContextualTargeting(
          campaign.contextualTargeting,
          bidRequest,
        )
      ) {
        return false;
      }

      // 6. FREQUENCY CAPPING (check against Redis)
      if (!(await this.passesFrequencyCapping(campaign, userContext))) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.warn(`Error in targeting criteria check: ${error.message}`);
      return false;
    }
  }

  /**
   * Validate real-time budget constraints
   */
  private async validateBudgetConstraints(
    campaigns: EligibleCampaign[],
  ): Promise<EligibleCampaign[]> {
    const today = new Date().toISOString().split('T')[0]; // 2025-06-08T00:00:00.000Z
    const validCampaigns: EligibleCampaign[] = [];

    for (const campaign of campaigns) {
      try {
        // Get current budget tracker
        const budgetTracker =
          await this.prisma.campaignBudgetTracker.findUnique({
            where: {
              campaignId_date: {
                campaignId: campaign.id,
                date: new Date(today),
              },
            },
          });

        if (budgetTracker) {
          // Check if campaign has budget remaining
          if (
            budgetTracker.remainingBudget.toNumber() > 0 &&
            !budgetTracker.isExhausted
          ) {
            campaign.dailyBudgetRemaining =
              budgetTracker.dailyBudget.toNumber(); // -- CHUL GAND KI
            campaign.totalBudgetRemaining =
              budgetTracker.remainingBudget.toNumber();
            validCampaigns.push(campaign);
          }
        } else {
          // If no budget tracker exists, campaign might be new - include it
          validCampaigns.push(campaign);
        }
      } catch (error) {
        this.logger.warn(
          `Error validating budget for campaign ${campaign.id}: ${error.message}`,
        );
        // Include campaign if we can't validate budget (fail open)
        validCampaigns.push(campaign);
      }
    }

    return validCampaigns;
  }

  /**
   * Enrich campaigns with creative performance data
   */
  private async enrichWithCreativePerformance(
    campaigns: EligibleCampaign[],
  ): Promise<EligibleCampaign[]> {
    for (const campaign of campaigns) {
      for (const creative of campaign.creatives) {
        try {
          const performance =
            await this.creativePerformanceService.getCreativePerformance(
              creative.id,
            );

          if (performance) {
            creative.performanceScore = performance.performanceScore;
            creative.ctr = performance.ctr;
          }
        } catch (error) {
          this.logger.warn(
            `Error getting performance for creative ${creative.id}: ${error.message}`,
          );
          // Set default performance scores
          creative.performanceScore = 0.5;
          creative.ctr = 0.01;
        }
      }
    }

    return campaigns;
  }

  // Targeting matching methods
  private matchesGeographicTargeting(
    geographicTargeting: any[],
    userContext: any,
  ): boolean {
    if (!geographicTargeting || geographicTargeting.length === 0) return true;

    for (const targeting of geographicTargeting) {
      const isIncludeRule = targeting.isInclude;

      // Check country matching
      if (targeting.countries?.length > 0) {
        const countryMatch = targeting.countries.includes(userContext.country);
        if (isIncludeRule && !countryMatch) return false;
        if (!isIncludeRule && countryMatch) return false;
      }

      // Check region/state matching
      if (targeting.states?.length > 0) {
        const stateMatch = targeting.states.includes(userContext.region);
        if (isIncludeRule && !stateMatch) return false;
        if (!isIncludeRule && stateMatch) return false;
      }

      // Check city matching
      if (targeting.cities?.length > 0) {
        const cityMatch = targeting.cities.includes(userContext.city);
        if (isIncludeRule && !cityMatch) return false;
        if (!isIncludeRule && cityMatch) return false;
      }
    }

    return true;
  }

  private matchesDeviceTargeting(
    deviceTargeting: any[],
    userContext: any,
  ): boolean {
    if (!deviceTargeting || deviceTargeting.length === 0) return true;

    for (const targeting of deviceTargeting) {
      const isIncludeRule = targeting.isInclude;

      // Check device type
      if (targeting.deviceTypes?.length > 0) {
        const deviceMatch = targeting.deviceTypes.includes(
          userContext.deviceType,
        );
        if (isIncludeRule && !deviceMatch) return false;
        if (!isIncludeRule && deviceMatch) return false;
      }

      // Check browser type
      if (targeting.browsers?.length > 0) {
        const browserMatch = targeting.browsers.includes(
          userContext.browserType,
        );
        if (isIncludeRule && !browserMatch) return false;
        if (!isIncludeRule && browserMatch) return false;
      }

      // Check OS type
      if (targeting.operatingSystems?.length > 0) {
        const osMatch = targeting.operatingSystems.includes(userContext.osType);
        if (isIncludeRule && !osMatch) return false;
        if (!isIncludeRule && osMatch) return false;
      }
    }

    return true;
  }

  private matchesDemographicTargeting(
    demographicTargeting: any[],
    userContext: any,
  ): boolean {
    if (!demographicTargeting || demographicTargeting.length === 0) return true;

    // For now, return true if we don't have demographic data
    // In production, you'd implement age, gender, etc. matching
    return true;
  }

  private matchesTimeTargeting(timeTargeting: any[]): boolean {
    if (!timeTargeting || timeTargeting.length === 0) return true;

    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0 = Sunday

    for (const targeting of timeTargeting) {
      // Check hour range
      if (targeting.startHour !== null && targeting.endHour !== null) {
        if (
          currentHour < targeting.startHour ||
          currentHour > targeting.endHour
        ) {
          return false;
        }
      }

      // Check days of week
      if (targeting.daysOfWeek?.length > 0) {
        const dayNames = [
          'SUNDAY',
          'MONDAY',
          'TUESDAY',
          'WEDNESDAY',
          'THURSDAY',
          'FRIDAY',
          'SATURDAY',
        ];
        const currentDayName = dayNames[currentDay];
        if (!targeting.daysOfWeek.includes(currentDayName)) {
          return false;
        }
      }
    }

    return true;
  }

  private matchesContextualTargeting(
    contextualTargeting: any[],
    bidRequest: any,
  ): boolean {
    if (!contextualTargeting || contextualTargeting.length === 0) return true;

    for (const targeting of contextualTargeting) {
      const isIncludeRule = targeting.isInclude;

      // Check content categories
      if (targeting.contentCategories?.length > 0) {
        const websiteCategories = bidRequest.website?.websiteCategories || [];
        const categoryMatch = targeting.contentCategories.some(
          (category: string) =>
            websiteCategories.some((webCat: any) => webCat.name === category),
        );

        if (isIncludeRule && !categoryMatch) return false;
        if (!isIncludeRule && categoryMatch) return false;
      }
    }

    return true;
  }

  private async passesFrequencyCapping(
    campaign: any,
    userContext: any,
  ): Promise<boolean> {
    if (!userContext.userId) return true; // Can't apply frequency capping without user ID

    try {
      for (const frequencyRule of campaign.frequencyTargeting || []) {
        const frequencyKey = REDIS_KEYS.USER_CAMPAIGN_FREQUENCY(
          userContext.userId,
          campaign.id,
        );

        const currentCount = (await this.redis.get(frequencyKey)) || 0;

        if (currentCount >= frequencyRule.maxImpressions) {
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.warn(`Error checking frequency capping: ${error.message}`);
      return true; // Fail open
    }
  }
}
