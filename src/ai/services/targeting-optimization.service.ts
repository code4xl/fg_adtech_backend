import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenAIService } from './openai.service';
import { HistoricalDataService } from './historical-data.service';
import { BadRequestException } from '../../common/exceptions/custom.exception';
import { CampaignTargetingDto } from '../../campaign/dto/targetting-rule.dto';
import { AIModel } from '../interfaces/ai-response.interface';

// Create local enum since it was commented out in Prisma
enum TargetingRuleType {
  DEMOGRAPHIC = 'DEMOGRAPHIC',
  GEOGRAPHIC = 'GEOGRAPHIC',
  DEVICE = 'DEVICE',
  CONTEXTUAL = 'CONTEXTUAL',
  BEHAVIORAL = 'BEHAVIORAL',
  TIME = 'TIME',
  FREQUENCY = 'FREQUENCY',
}

interface TargetingOptimizationResult {
  enhancedTargeting: CampaignTargetingDto;
  additions: {
    category: string;
    suggestions: string[];
    rationale: string;
  }[];
  removals: {
    category: string;
    suggestions: string[];
    rationale: string;
  }[];
  lookalike?: {
    segments: string[];
    confidence: number;
  };
  expectedImpact: {
    reachChange: string;
    qualityImprovement: string;
    costEfficiency: string;
  };
  confidence: number;
}

@Injectable()
export class TargetingOptimizationService {
  private readonly logger = new Logger(TargetingOptimizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openAIService: OpenAIService,
    private readonly historicalDataService: HistoricalDataService,
  ) {}

  async refineTargeting(
    campaignId: string,
    advertiserId: string,
    refinementGoals?: string,
    focusAreas?: string[],
    includeLookalike?: boolean,
  ) {
    const campaign = await this.validateAndFetchCampaign(
      campaignId,
      advertiserId,
    );

    const currentTargeting = this.extractCurrentTargeting(campaign);
    const performanceBySegment =
      await this.analyzeSegmentPerformance(campaignId);
    const marketOpportunities = await this.identifyMarketOpportunities(
      campaign.businessCategory,
      currentTargeting,
    );
    const competitorTargeting = await this.analyzeCompetitorTargeting(
      campaign.businessCategory,
    );

    const prompt = this.buildTargetingOptimizationPrompt(
      campaign,
      currentTargeting,
      performanceBySegment,
      marketOpportunities,
      competitorTargeting,
      refinementGoals,
      focusAreas,
      includeLookalike,
    );

    const aiResult =
      await this.openAIService.generateStructuredResponse<TargetingOptimizationResult>(
        'You are a digital advertising targeting specialist with expertise in audience segmentation and performance optimization.',
        prompt,
        AIModel.GPT4_TURBO,
      );

    return this.applyTargetingRefinements(
      campaignId,
      currentTargeting,
      aiResult,
    );
  }

  private async validateAndFetchCampaign(
    campaignId: string,
    advertiserId: string,
  ) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, advertiserId },
      include: {
        demographicTargeting: true,
        geographicTargeting: true,
        deviceTargeting: true,
        contextualTargeting: true,
        behavioralTargeting: true,
        timeTargeting: true,
        frequencyTargeting: true,
        campaignBudgetTracker: {
          orderBy: { date: 'desc' },
          take: 1,
        },
        statistics: {
          orderBy: { date: 'desc' },
          take: 14,
        },
      },
    });

    if (!campaign) {
      throw new BadRequestException('Campaign not found or access denied');
    }

    return campaign;
  }

  private extractCurrentTargeting(campaign: any): CampaignTargetingDto {
    const targeting: CampaignTargetingDto = {};

    // Extract demographic targeting
    if (campaign.demographicTargeting?.length > 0) {
      const demo = campaign.demographicTargeting[0];
      targeting.demographic = {
        ageRanges: demo.ageMin && demo.ageMax ? [{ min: demo.ageMin, max: demo.ageMax }] : undefined,
        genders: demo.genders,
        incomes: demo.incomeRange,
        educationLevels: demo.education,
        parentalStatus: [], // Not available in current schema
      };
    }

    // Extract geographic targeting
    if (campaign.geographicTargeting?.length > 0) {
      const geo = campaign.geographicTargeting[0];
      targeting.geo = {
        countries: geo.countries,
        regions: geo.states, // Map states to regions
        cities: geo.cities,
        postalCodes: geo.postalCodes,
        radiusTargets: geo.radius ? [{ 
          latitude: geo.latitude || 0, 
          longitude: geo.longitude || 0, 
          radius: geo.radius 
        }] : [],
        excludedCountries: geo.isInclude ? [] : geo.countries,
      };
    }

    // Extract device targeting
    if (campaign.deviceTargeting?.length > 0) {
      const device = campaign.deviceTargeting[0];
      targeting.device = {
        deviceTypes: device.deviceTypes,
        operatingSystems: device.operatingSystems,
        browsers: device.browsers,
        connectionTypes: device.connectionTypes,
        carriers: [], // Not available in current schema
      };
    }

    // Extract contextual targeting
    if (campaign.contextualTargeting?.length > 0) {
      const contextual = campaign.contextualTargeting[0];
      targeting.contextual = {
        siteCategories: contextual.contentCategories,
        keywords: contextual.keywords,
        excludedSiteCategories: contextual.blockedKeywords,
      };
    }

    // Extract behavioral targeting
    if (campaign.behavioralTargeting?.length > 0) {
      const behavioral = campaign.behavioralTargeting[0];
      targeting.behavioral = {
        interests: behavioral.interests,
        purchaseIntents: behavioral.purchaseIntent,
        customAudiences: [], // Not directly available, could map from userSegments
      };
    }

    // Extract time targeting
    if (campaign.timeTargeting?.length > 0) {
      const time = campaign.timeTargeting[0];
      targeting.time = {
        timezone: time.timezone,
        hoursOfDay: time.startHour && time.endHour ? 
          Array.from({length: time.endHour - time.startHour + 1}, (_, i) => time.startHour + i) : [],
        daysOfWeek: time.daysOfWeek?.map((day: any) => {
          // Convert enum values to numbers if needed
          if (typeof day === 'string') {
            const dayMap = { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 };
            return dayMap[day as keyof typeof dayMap] || 0;
          }
          return day;
        }),
      };
    }

    // Extract frequency targeting
    if (campaign.frequencyTargeting?.length > 0) {
      const frequency = campaign.frequencyTargeting[0];
      targeting.frequencyCap = {
        impressionsPerUser: frequency.maxImpressions,
        timeUnit: frequency.frequencyWindow,
      };
    }

    return targeting;
  }

  private async analyzeSegmentPerformance(campaignId: string) {
    // Use ImpressionEvent instead of ImpressionTrack
    const impressions = await this.prisma.impressionEvent.findMany({
      where: { campaignId },
      select: {
        deviceType: true,
        country: true,
        city: true,
        viewable: true,
      },
      take: 1000,
    });

    const segments = new Map<string, any>();

    impressions.forEach((imp) => {
      const deviceKey = `device_${imp.deviceType || 'unknown'}`;
      const geoKey = `geo_${imp.country || 'unknown'}_${imp.city || 'unknown'}`;

      [deviceKey, geoKey].forEach((key) => {
        if (!segments.has(key)) {
          segments.set(key, {
            impressions: 0,
            clicks: 0,
            viewable: 0,
          });
        }

        const segment = segments.get(key);
        segment.impressions++;
        // Note: clicks would need to be calculated from ClickEvent table
        segment.viewable += imp.viewable ? 1 : 0;
      });
    });

    const performanceData = Array.from(segments.entries()).map(
      ([segment, data]) => ({
        segment,
        ctr: data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0,
        viewabilityRate:
          data.impressions > 0 ? (data.viewable / data.impressions) * 100 : 0,
        volume: data.impressions,
      }),
    );

    return performanceData.sort((a, b) => b.ctr - a.ctr);
  }

  private async identifyMarketOpportunities(
    businessCategory: string,
    currentTargeting: CampaignTargetingDto,
  ) {
    const successfulCampaigns = await this.prisma.campaign.findMany({
      where: {
        businessCategory: businessCategory as any,
        status: 'COMPLETED',
        statistics: { some: { ctr: { gte: 2.0 } } },
      },
      include: { 
        geographicTargeting: true,
        timeTargeting: true,
      },
      take: 20,
    });

    const opportunities = {
      untappedGeos: [] as string[],
      highPerformingDemographics: [] as any[],
      effectiveTimeSlots: [] as number[],
      recommendedInterests: [] as string[],
    };

    successfulCampaigns.forEach((campaign) => {
      const targeting = this.extractCurrentTargeting(campaign);

      if (targeting.geo?.cities) {
        targeting.geo.cities.forEach((city) => {
          if (!currentTargeting.geo?.cities?.includes(city)) {
            opportunities.untappedGeos.push(city);
          }
        });
      }

      if (targeting.time?.hoursOfDay) {
        targeting.time.hoursOfDay.forEach((hour) => {
          if (!currentTargeting.time?.hoursOfDay?.includes(hour)) {
            opportunities.effectiveTimeSlots.push(hour);
          }
        });
      }
    });

    return opportunities;
  }

  private async analyzeCompetitorTargeting(businessCategory: string) {
    const recentCampaigns = await this.prisma.campaign.findMany({
      where: {
        businessCategory: businessCategory as any,
        status: 'ACTIVE',
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      include: { 
        geographicTargeting: true,
        deviceTargeting: true,
        campaignBudgetTracker: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
      take: 10,
    });

    const targetingPatterns = {
      commonGeos: new Map<string, number>(),
      commonDevices: new Map<string, number>(),
      commonInterests: new Map<string, number>(),
      avgBudget: 0,
    };

    recentCampaigns.forEach((campaign) => {
      // Get budget from budget tracker
      const latestBudgetTracker = campaign.campaignBudgetTracker?.[0];
      targetingPatterns.avgBudget += Number(latestBudgetTracker?.totalBudget || 5000);
      
      const targeting = this.extractCurrentTargeting(campaign);

      if (targeting.geo?.cities) {
        targeting.geo.cities.forEach((city) => {
          targetingPatterns.commonGeos.set(
            city,
            (targetingPatterns.commonGeos.get(city) || 0) + 1,
          );
        });
      }

      if (targeting.device?.deviceTypes) {
        targeting.device.deviceTypes.forEach((device) => {
          targetingPatterns.commonDevices.set(
            device,
            (targetingPatterns.commonDevices.get(device) || 0) + 1,
          );
        });
      }
    });

    targetingPatterns.avgBudget /= recentCampaigns.length || 1;

    return {
      topGeos: Array.from(targetingPatterns.commonGeos.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([geo]) => geo),
      topDevices: Array.from(targetingPatterns.commonDevices.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([device]) => device),
      averageBudget: targetingPatterns.avgBudget,
    };
  }

  private buildTargetingOptimizationPrompt(
    campaign: any,
    currentTargeting: CampaignTargetingDto,
    performanceData: any[],
    opportunities: any,
    competitorData: any,
    goals?: string,
    focusAreas?: string[],
    includeLookalike?: boolean,
  ): string {
    // Get budget from budget tracker
    const latestBudgetTracker = campaign.campaignBudgetTracker?.[0];
    const currentBudget = Number(latestBudgetTracker?.totalBudget || 5000);

    return `Optimize targeting for campaign:

Campaign Context:
- Objective: ${campaign.objective}
- Category: ${campaign.businessCategory}
- Budget: $${currentBudget}
- Current Performance: ${campaign.statistics.length} days of data

Current Targeting:
${JSON.stringify(currentTargeting, null, 2)}

Performance by Segment (Top 10):
${performanceData
  .slice(0, 10)
  .map(
    (seg) =>
      `- ${seg.segment}: CTR ${seg.ctr.toFixed(2)}%, Volume: ${seg.volume}`,
  )
  .join('\n')}

Market Opportunities:
- Untapped Geos: ${opportunities.untappedGeos.slice(0, 5).join(', ')}
- High-Performing Time Slots: ${opportunities.effectiveTimeSlots.slice(0, 5).join(', ')}

Competitor Insights:
- Popular Geos: ${competitorData.topGeos.join(', ')}
- Common Devices: ${competitorData.topDevices.join(', ')}
- Avg Budget: $${competitorData.averageBudget.toFixed(0)}

Refinement Goals: ${goals || 'Improve CTR while maintaining reach'}
Focus Areas: ${focusAreas?.join(', ') || 'All targeting dimensions'}
Include Lookalike: ${includeLookalike ? 'Yes' : 'No'}

Provide enhanced targeting with specific additions/removals and expected impact.`;
  }

  private async applyTargetingRefinements(
    campaignId: string,
    currentTargeting: CampaignTargetingDto,
    aiResult: TargetingOptimizationResult,
  ) {
    const refinedTargeting = this.mergeTargeting(
      currentTargeting,
      aiResult.enhancedTargeting,
    );

    const summary = {
      currentTargeting,
      refinedTargeting,
      additions: aiResult.additions,
      removals: aiResult.removals,
      lookalikeSuggestions: aiResult.lookalike,
      expectedImpact: aiResult.expectedImpact,
      confidence: aiResult.confidence,
      implementationSteps: this.generateImplementationSteps(
        aiResult.additions,
        aiResult.removals,
      ),
    };

    await this.saveTargetingAnalysis(campaignId, summary);

    return summary;
  }

  private mergeTargeting(
    current: CampaignTargetingDto,
    enhanced: CampaignTargetingDto,
  ): CampaignTargetingDto {
    const merged: CampaignTargetingDto = {};

    if (enhanced.demographic || current.demographic) {
      merged.demographic = {
        ...current.demographic,
        ...enhanced.demographic,
      };
    }

    if (enhanced.geo || current.geo) {
      merged.geo = {
        countries: this.mergeArrays(
          current.geo?.countries,
          enhanced.geo?.countries,
        ),
        regions: this.mergeArrays(current.geo?.regions, enhanced.geo?.regions),
        cities: this.mergeArrays(current.geo?.cities, enhanced.geo?.cities),
        postalCodes: this.mergeArrays(
          current.geo?.postalCodes,
          enhanced.geo?.postalCodes,
        ),
        radiusTargets:
          enhanced.geo?.radiusTargets || current.geo?.radiusTargets || [],
        excludedCountries: this.mergeArrays(
          current.geo?.excludedCountries,
          enhanced.geo?.excludedCountries,
        ),
      };
    }

    if (enhanced.device || current.device) {
      merged.device = {
        ...current.device,
        ...enhanced.device,
        deviceTypes: this.mergeArrays(
          current.device?.deviceTypes,
          enhanced.device?.deviceTypes,
        ),
      };
    }

    if (enhanced.behavioral || current.behavioral) {
      merged.behavioral = {
        ...current.behavioral,
        ...enhanced.behavioral,
        interests: this.mergeArrays(
          current.behavioral?.interests,
          enhanced.behavioral?.interests,
        ),
      };
    }

    if (enhanced.time || current.time) {
      merged.time = {
        ...current.time,
        ...enhanced.time,
      };
    }

    if (enhanced.frequencyCap || current.frequencyCap) {
      merged.frequencyCap = enhanced.frequencyCap || current.frequencyCap;
    }

    return merged;
  }

  private mergeArrays<T>(current?: T[], enhanced?: T[]): T[] {
    if (!current && !enhanced) return [];
    if (!current) return enhanced!;
    if (!enhanced) return current;

    return [...new Set([...current, ...enhanced])];
  }

  private generateImplementationSteps(
    additions: any[],
    removals: any[],
  ): string[] {
    const steps = [];

    if (additions.length > 0) {
      steps.push('1. Add new targeting parameters via Campaign Targeting API');
      additions.forEach((add, index) => {
        steps.push(
          `   ${index + 1}.${index + 1} Add ${add.category}: ${add.suggestions.slice(0, 3).join(', ')}`,
        );
      });
    }

    if (removals.length > 0) {
      steps.push(
        `${additions.length > 0 ? '2' : '1'}. Remove underperforming segments`,
      );
      removals.forEach((rem, index) => {
        steps.push(
          `   ${index + 1} Remove ${rem.category}: ${rem.suggestions.slice(0, 3).join(', ')}`,
        );
      });
    }

    steps.push(`${steps.length + 1}. Monitor performance for 48 hours`);
    steps.push(`${steps.length + 2}. Fine-tune based on initial results`);

    return steps;
  }

  private async saveTargetingAnalysis(campaignId: string, analysis: any) {
    this.logger.log(`Saving targeting analysis for campaign ${campaignId}`);
  }
}
