import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { REDIS_KEYS } from '../../redis/constants/redis-keys';

@Injectable()
export class CampaignEligibilityService {
  private readonly logger = new Logger(CampaignEligibilityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    this.logger.log(
      'Campaign Eligibility Service initialized - Phase 3 Complete',
    );
  }

  /**
   * Get all eligible campaigns for a bid request
   *
   * **Why this caching strategy:**
   * - Campaign eligibility calculation involves 10+ database queries
   * - Results are stable for 5-minute periods
   * - Cache key includes device type for targeting accuracy
   * - Memory usage is reasonable (few KB per cache entry)
   */
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
      // const cacheKey = this.buildCacheKey(inventoryId, userContext, adSlotContext);
      const cacheKey = REDIS_KEYS.ELIGIBLE_CAMPAIGNS(
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
      const eligibleCampaigns = await this.applyTargetingFilters(
        campaignPool,
        userContext,
        adSlotContext,
      );

      // 4. Final budget validation (real-time check)
      const budgetValidated = await this.validateBudgets(eligibleCampaigns);

      // 5. Cache results for 5 minutes
      await this.cacheEligibility(cacheKey, budgetValidated, 300);

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

  /**
   * Check if a specific campaign has budget available
   *
   * **Why real-time budget checking:**
   * - Campaign budgets are updated constantly with each impression
   * - Redis counters provide atomic increment operations
   * - Prevents overspend in high-traffic scenarios
   * - Sub-millisecond response time
   */
  async checkBudgetAvailability(campaignId: string): Promise<boolean> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const spentKey = REDIS_KEYS.CAMPAIGN_BUDGET(campaignId, today);

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

  /**
   * Evaluate targeting rules for a campaign
   *
   * **Why comprehensive targeting:**
   * - Advertisers need precise audience targeting
   * - Each rule type serves different marketing objectives
   * - Boolean logic allows complex targeting combinations
   * - Performance impact is minimized through smart ordering
   */
  async checkTargetingRules(
    campaign: any,
    userContext: any,
    adSlotContext: any,
  ): Promise<boolean> {
    try {
      // Early exit if campaign has no targeting rules
      if (!this.hasTargetingRules(campaign)) {
        return true; // No targeting = all traffic eligible
      }

      // Evaluate each targeting type (AND logic - all must pass)
      const checks = await Promise.all([
        this.checkGeographicTargeting(
          campaign.geographicTargeting,
          userContext,
        ),
        this.checkDeviceTargeting(campaign.deviceTargeting, userContext),
        this.checkDemographicTargeting(
          campaign.demographicTargeting,
          userContext,
        ),
        this.checkTimeTargeting(campaign.timeTargeting, userContext),
        this.checkContextualTargeting(
          campaign.contextualTargeting,
          adSlotContext,
        ),
        this.checkBehavioralTargeting(
          campaign.behavioralTargeting,
          userContext,
        ),
        this.checkFrequencyTargeting(
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

  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  private buildCacheKey(
    inventoryId: string,
    userContext: any,
    adSlotContext: any,
  ): string {
    // Include key targeting dimensions in cache key
    return `eligible:${inventoryId}:${userContext.deviceType}:${userContext.country}:${adSlotContext.format}`;
  }

  private async getCachedEligibility(cacheKey: string): Promise<any[] | null> {
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

  private async cacheEligibility(
    cacheKey: string,
    campaigns: any[],
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

  /**
   * Get basic campaign pool with essential filters
   *
   * **Why this initial filter:**
   * - Eliminates obviously ineligible campaigns early
   * - Reduces targeting evaluation workload by 80%+
   * - Database indexed queries for fast response
   */
  private async getBasicCampaignPool(
    inventoryId: string,
    adSlotContext: any,
  ): Promise<any[]> {
    const now = new Date();

    return await this.prisma.campaign.findMany({
      where: {
        status: 'ACTIVE',
        startDate: { lte: now },
        endDate: { gte: now },
        // Has approved creatives matching ad slot
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

  /**
   * Apply targeting filters in order of selectivity
   */
  private async applyTargetingFilters(
    campaigns: any[],
    userContext: any,
    adSlotContext: any,
  ): Promise<any[]> {
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

  /**
   * Validate budgets for final campaign list
   */
  private async validateBudgets(campaigns: any[]): Promise<any[]> {
    const budgetChecks = campaigns.map(async (campaign) => {
      const hasBudget = await this.checkBudgetAvailability(campaign.id);
      return hasBudget ? campaign : null;
    });

    const results = await Promise.all(budgetChecks);
    return results.filter((campaign) => campaign !== null);
  }

  private async getCampaignBudgetInfo(
    campaignId: string,
    today: string,
  ): Promise<any> {
    try {
      // Use cache for campaign budget info
      const cacheKey = REDIS_KEYS.CAMPAIGN_BUDGET(campaignId, today);
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
              date: new Date().toISOString().split('T')[0],
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

      // Cache for 1 hour
      await this.redis.set(cacheKey, JSON.stringify(budgetInfo), 3600);

      return budgetInfo;
    } catch (error) {
      this.logger.error('Failed to get campaign budget info', {
        error: error.message,
        campaignId,
      });
      return null;
    }
  }

  private hasTargetingRules(campaign: any): boolean {
    return !!(
      campaign.geographicTargeting?.length ||
      campaign.deviceTargeting?.length ||
      campaign.demographicTargeting?.length ||
      campaign.timeTargeting?.length ||
      campaign.contextualTargeting?.length ||
      campaign.behavioralTargeting?.length ||
      campaign.frequencyTargeting?.length
    );
  }

  // ==========================================
  // TARGETING RULE EVALUATORS
  // ==========================================

  /**
   * Geographic targeting evaluation
   *
   * **Why geographic targeting:**
   * - Location-specific campaigns (local businesses)
   * - Regulatory compliance (GDPR, local laws)
   * - Language and cultural relevance
   * - Time zone considerations
   */
  private async checkGeographicTargeting(
    rules: any[],
    userContext: any,
  ): Promise<boolean> {
    if (!rules || rules.length === 0) return true;

    for (const rule of rules) {
      const isMatch = this.evaluateGeographicRule(rule, userContext);

      if (rule.isInclude && isMatch) {
        return true; // Include rule matched
      }
      if (!rule.isInclude && isMatch) {
        return false; // Exclude rule matched
      }
    }

    // If we have include rules but none matched
    const hasIncludeRules = rules.some((rule) => rule.isInclude);
    return !hasIncludeRules;
  }

  private evaluateGeographicRule(rule: any, userContext: any): boolean {
    // Country targeting
    if (rule.countries?.length > 0) {
      if (!rule.countries.includes(userContext.country)) {
        return false;
      }
    }

    // State/region targeting
    if (rule.states?.length > 0) {
      if (!rule.states.includes(userContext.region)) {
        return false;
      }
    }

    // City targeting
    if (rule.cities?.length > 0) {
      if (!rule.cities.includes(userContext.city)) {
        return false;
      }
    }

    // Radius targeting (if GPS coordinates available)
    if (rule.latitude && rule.longitude && rule.radius) {
      if (userContext.latitude && userContext.longitude) {
        const distance = this.calculateDistance(
          rule.latitude,
          rule.longitude,
          userContext.latitude,
          userContext.longitude,
        );
        if (distance > rule.radius) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Device targeting evaluation
   *
   * **Why device targeting:**
   * - Mobile-first vs desktop campaigns
   * - App-specific targeting
   * - Performance optimization (slow connections)
   * - User experience considerations
   */
  private async checkDeviceTargeting(
    rules: any[],
    userContext: any,
  ): Promise<boolean> {
    if (!rules || rules.length === 0) return true;

    for (const rule of rules) {
      const isMatch = this.evaluateDeviceRule(rule, userContext);

      if (rule.isInclude && isMatch) {
        return true;
      }
      if (!rule.isInclude && isMatch) {
        return false;
      }
    }

    const hasIncludeRules = rules.some((rule) => rule.isInclude);
    return !hasIncludeRules;
  }

  private evaluateDeviceRule(rule: any, userContext: any): boolean {
    // Device type targeting
    if (rule.deviceTypes?.length > 0) {
      if (!rule.deviceTypes.includes(userContext.deviceType?.toUpperCase())) {
        return false;
      }
    }

    // Operating system targeting
    if (rule.operatingSystems?.length > 0) {
      if (!rule.operatingSystems.includes(userContext.osType?.toUpperCase())) {
        return false;
      }
    }

    // Browser targeting
    if (rule.browsers?.length > 0) {
      if (!rule.browsers.includes(userContext.browserType?.toUpperCase())) {
        return false;
      }
    }

    // Connection type targeting
    if (rule.connectionTypes?.length > 0) {
      if (
        !rule.connectionTypes.includes(
          userContext.connectionType?.toUpperCase(),
        )
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Demographic targeting evaluation
   */
  private async checkDemographicTargeting(
    rules: any[],
    userContext: any,
  ): Promise<boolean> {
    if (!rules || rules.length === 0) return true;

    for (const rule of rules) {
      if (this.evaluateDemographicRule(rule, userContext)) {
        return true;
      }
    }

    return false;
  }

  private evaluateDemographicRule(rule: any, userContext: any): boolean {
    // Age targeting
    if (rule.ageMin !== null || rule.ageMax !== null) {
      const userAge = userContext.age;
      if (!userAge) return false;

      if (rule.ageMin && userAge < rule.ageMin) return false;
      if (rule.ageMax && userAge > rule.ageMax) return false;
    }

    // Gender targeting
    if (rule.genders?.length > 0) {
      if (!rule.genders.includes(userContext.gender)) {
        return false;
      }
    }

    // Language targeting
    if (rule.languages?.length > 0) {
      if (!rule.languages.includes(userContext.language)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Time targeting evaluation
   */
  private async checkTimeTargeting(
    rules: any[],
    userContext: any,
  ): Promise<boolean> {
    if (!rules || rules.length === 0) return true;

    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0 = Sunday

    for (const rule of rules) {
      if (this.evaluateTimeRule(rule, currentHour, currentDay)) {
        return true;
      }
    }

    return false;
  }

  private evaluateTimeRule(
    rule: any,
    currentHour: number,
    currentDay: number,
  ): boolean {
    // Hour targeting
    if (rule.startHour !== null && rule.endHour !== null) {
      if (currentHour < rule.startHour || currentHour > rule.endHour) {
        return false;
      }
    }

    // Day of week targeting
    if (rule.daysOfWeek?.length > 0) {
      const dayNames = [
        'SUNDAY',
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
        'SATURDAY',
      ];
      if (!rule.daysOfWeek.includes(dayNames[currentDay])) {
        return false;
      }
    }

    return true;
  }

  /**
   * Contextual targeting evaluation
   */
  private async checkContextualTargeting(
    rules: any[],
    adSlotContext: any,
  ): Promise<boolean> {
    if (!rules || rules.length === 0) return true;

    for (const rule of rules) {
      const isMatch = this.evaluateContextualRule(rule, adSlotContext);

      if (rule.isInclude && isMatch) {
        return true;
      }
      if (!rule.isInclude && isMatch) {
        return false;
      }
    }

    const hasIncludeRules = rules.some((rule) => rule.isInclude);
    return !hasIncludeRules;
  }

  private evaluateContextualRule(rule: any, adSlotContext: any): boolean {
    // Page category targeting
    if (rule.contentCategories?.length > 0) {
      if (!rule.contentCategories.includes(adSlotContext.pageCategory)) {
        return false;
      }
    }

    // Keyword targeting
    if (rule.keywords?.length > 0) {
      const pageKeywords = adSlotContext.pageKeywords || [];
      const hasMatchingKeyword = rule.keywords.some((keyword) =>
        pageKeywords.some((pageKeyword) =>
          pageKeyword.toLowerCase().includes(keyword.toLowerCase()),
        ),
      );
      if (!hasMatchingKeyword) {
        return false;
      }
    }

    // URL pattern targeting
    if (rule.urlPatterns?.length > 0) {
      const pageUrl = adSlotContext.pageUrl || '';
      const hasMatchingPattern = rule.urlPatterns.some((pattern) =>
        new RegExp(pattern, 'i').test(pageUrl),
      );
      if (!hasMatchingPattern) {
        return false;
      }
    }

    return true;
  }

  /**
   * Behavioral targeting evaluation
   */
  private async checkBehavioralTargeting(
    rules: any[],
    userContext: any,
  ): Promise<boolean> {
    if (!rules || rules.length === 0) return true;

    for (const rule of rules) {
      if (this.evaluateBehavioralRule(rule, userContext)) {
        return true;
      }
    }

    return false;
  }

  private evaluateBehavioralRule(rule: any, userContext: any): boolean {
    // Interest targeting
    if (rule.interests?.length > 0) {
      const userInterests = userContext.interests || [];
      const hasMatchingInterest = rule.interests.some((interest) =>
        userInterests.includes(interest),
      );
      if (!hasMatchingInterest) {
        return false;
      }
    }

    // Purchase intent targeting
    if (rule.purchaseIntent?.length > 0) {
      if (!rule.purchaseIntent.includes(userContext.purchaseIntent)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Frequency targeting evaluation
   *
   * **Why frequency capping:**
   * - Prevents ad fatigue
   * - Optimizes budget allocation
   * - Improves user experience
   * - Industry best practice
   */
  private async checkFrequencyTargeting(
    rules: any[],
    userContext: any,
    campaignId: string,
  ): Promise<boolean> {
    if (!rules || rules.length === 0) return true;

    const userId = userContext.userId;
    if (!userId) return true; // Can't cap frequency without user ID

    for (const rule of rules) {
      const isWithinLimit = await this.checkFrequencyLimit(
        userId,
        campaignId,
        rule.maxImpressions,
        rule.frequencyWindow,
      );

      if (!isWithinLimit) {
        return false;
      }
    }

    return true;
  }

  private async checkFrequencyLimit(
    userId: string,
    campaignId: string,
    maxImpressions: number,
    window: string,
  ): Promise<boolean> {
    try {
      const windowHours = this.getWindowHours(window);
      const key = REDIS_KEYS.USER_CAMPAIGN_FREQUENCY(userId, campaignId);

      const currentCount = parseInt((await this.redis.get<string>(key)) || '0');

      return currentCount < maxImpressions;
    } catch (error) {
      this.logger.error('Frequency check failed', {
        error: error.message,
        userId,
        campaignId,
      });
      return true; // Fail open
    }
  }

  private getWindowHours(window: string): number {
    const windowMap = {
      HOURLY: 1,
      DAILY: 24,
      WEEKLY: 168,
      MONTHLY: 720,
    };
    return windowMap[window] || 24;
  }

  /**
   * Calculate distance between two GPS coordinates
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
