import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { CampaignWithTargeting } from '../types/campaign.types';
import { REDIS_KEYS } from '../constants/cache-keys';
import {
  GeographicTargeting,
  DeviceTargeting,
  DemographicTargeting,
  TimeTargeting,
  ContextualTargeting,
  BehavioralTargeting,
  FrequencyTargeting,
} from '@prisma/client';

@Injectable()
export class CampaignTargetingService {
  private readonly logger = new Logger(CampaignTargetingService.name);

  constructor(private readonly redis: RedisService) {}

  public hasTargetingRules(campaign: CampaignWithTargeting): boolean {
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

  public async checkGeographicTargeting(
    rules: GeographicTargeting[],
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

  public evaluateGeographicRule(
    rule: GeographicTargeting,
    userContext: any,
  ): boolean {
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

  public async checkDeviceTargeting(
    rules: DeviceTargeting[],
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

  public evaluateDeviceRule(rule: DeviceTargeting, userContext: any): boolean {
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

  public async checkDemographicTargeting(
    rules: DemographicTargeting[],
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

  public evaluateDemographicRule(
    rule: DemographicTargeting,
    userContext: any,
  ): boolean {
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

  public async checkTimeTargeting(
    rules: TimeTargeting[],
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

  public evaluateTimeRule(
    rule: TimeTargeting,
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
      if (!rule.daysOfWeek.includes(dayNames[currentDay] as any)) {
        return false;
      }
    }

    return true;
  }

  public async checkContextualTargeting(
    rules: ContextualTargeting[],
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

  public evaluateContextualRule(
    rule: ContextualTargeting,
    adSlotContext: any,
  ): boolean {
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

  public async checkBehavioralTargeting(
    rules: BehavioralTargeting[],
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

  public evaluateBehavioralRule(
    rule: BehavioralTargeting,
    userContext: any,
  ): boolean {
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

  public async checkFrequencyTargeting(
    rules: FrequencyTargeting[],
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
      );

      if (!isWithinLimit) {
        return false;
      }
    }

    return true;
  }

  public async checkFrequencyLimit(
    userId: string,
    campaignId: string,
    maxImpressions: number,
  ): Promise<boolean> {
    try {
      const key = REDIS_KEYS.USER_CAMPAIGN_FREQUENCY(userId, campaignId);

      const currentCount = parseInt((await this.redis.get<string>(key)) || '0');

      return currentCount < maxImpressions;
    } catch (error) {
      this.logger.error('Frequency check failed', {
        error: error.message,
        userId,
        campaignId,
      });
      return true;
    }
  }

  public calculateDistance(
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

  public toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
