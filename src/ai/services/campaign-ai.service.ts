import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenAIService } from './openai.service';
import { HistoricalDataService } from './historical-data.service';
import { PromptBuilder } from '../utils/prompt-builder';
import {
  CampaignAnalysisRequestDto,
  CampaignAnalysisResponseDto,
  CampaignNameSuggestion,
  BudgetSuggestion
} from '../dto/campaign-analysis.dto';
import {
  CampaignObjective,
  BusinessCategory,
  CampaignInterest,
  BidStrategy,
  CampaignPacing
} from '@prisma/client';
import { CampaignAISuggestion, AIModel } from '../interfaces/ai-response.interface';
import { BadRequestException } from '../../common/exceptions/custom.exception';
import { CampaignTargetingDto } from '../../campaign/dto/targetting-rule.dto';

@Injectable()
export class CampaignAIService {
  private readonly logger = new Logger(CampaignAIService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openAIService: OpenAIService,
    private readonly historicalDataService: HistoricalDataService,
    private readonly promptBuilder: PromptBuilder
  ) {}

  async analyzeCampaign(
    advertiserId: string,
    request: CampaignAnalysisRequestDto
  ): Promise<CampaignAnalysisResponseDto> {
    const startTime = Date.now();

    const historicalData = request.advertiserContext?.previousCampaigns
      ? await this.historicalDataService.getAdvertiserInsights(advertiserId)
      : null;

    const marketData = await this.historicalDataService.getMarketBenchmarks(
      this.extractBusinessCategory(request.description)
    );

    const systemPrompt = this.promptBuilder.buildCampaignAnalysisPrompt(
      historicalData,
      marketData
    );

    const userPrompt = this.promptBuilder.buildUserPrompt(request);

    const aiSuggestion = await this.openAIService.generateStructuredResponse<CampaignAISuggestion>(
      systemPrompt,
      userPrompt,
      AIModel.GPT35_TURBO
    );

    const processingTime = Date.now() - startTime;
    this.logger.log(`Campaign analysis completed in ${processingTime}ms`);

    return this.transformAIResponse(aiSuggestion, request);
  }

  async regenerateCampaignNames(
    campaignId: string,
    advertiserId: string,
    criteria?: string,
    count: number = 3
  ): Promise<CampaignNameSuggestion[]> {
        const campaign = await this.prisma.campaign.findFirst({      where: { id: campaignId, advertiserId },      select: {        name: true,        objective: true,        businessCategory: true,        websiteUrl: true      }    });

    if (!campaign) {
      throw new BadRequestException('Campaign not found');
    }

    const prompt = this.promptBuilder.buildNameRegenerationPrompt(campaign, criteria, count);

    const response = await this.openAIService.generateStructuredResponse<{
      suggestions: CampaignNameSuggestion[]
    }>(
      'You are a creative marketing expert specializing in campaign naming.',
      prompt,
      AIModel.GPT35_TURBO
    );

    return response.suggestions;
  }
  async getSuggestionHistory(
    campaignId: string,
    advertiserId: string
  ): Promise<any> {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, advertiserId },
      select: {
        id: true,
        name: true,
        createdAt: true
      }
    });

    if (!campaign) {
      throw new BadRequestException('Campaign not found');
    }

    // In a production system, you would store AI suggestions in a separate table
    // For now, we'll return a mock history
    return {
      campaignId,
      campaignName: campaign.name,
      suggestions: [
        {
          id: `${campaignId}-001`,
          type: 'campaign_analysis',
          timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          summary: 'Initial campaign analysis and setup',
          confidence: 0.85
        },
        {
          id: `${campaignId}-002`,
          type: 'budget_optimization',
          timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          summary: 'Budget increased by 15% based on performance',
          confidence: 0.78
        },
        {
          id: `${campaignId}-003`,
          type: 'targeting_refinement',
          timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          summary: 'Added 3 new geographic targets',
          confidence: 0.82
        }
      ],
      totalSuggestions: 3
    };
  }
  private transformAIResponse(
    aiSuggestion: CampaignAISuggestion,
    request: CampaignAnalysisRequestDto
  ): CampaignAnalysisResponseDto {
    const primaryName = aiSuggestion.names[0];

    const namesSuggestions: CampaignNameSuggestion[] = aiSuggestion.names.map(n => ({
      name: n.value,
      rationale: n.rationale
    }));

    const budgetSuggestion: BudgetSuggestion = {
      budget: aiSuggestion.budget.total,
      dailyBudget: aiSuggestion.budget.daily,
      bidStrategy: this.validateEnum(aiSuggestion.budget.strategy, BidStrategy, BidStrategy.LOWEST_COST),
      bidAmount: aiSuggestion.budget.bidAmount,
      rationale: `Optimized for ${aiSuggestion.objective.toLowerCase()} campaigns in selected markets`
    };

    const targeting = this.buildTargeting(aiSuggestion.targeting);

    return {
      confidence: aiSuggestion.metadata.confidence,
      namesSuggestions,
      name: primaryName.value,
      budgetSuggestion,
      objective: this.validateEnum(aiSuggestion.objective, CampaignObjective, CampaignObjective.AWARENESS),
      businessCategory: this.validateEnum(aiSuggestion.businessCategory, BusinessCategory, BusinessCategory.TECHNOLOGY),
      interests: this.validateInterests(aiSuggestion.interests),
      pacing: CampaignPacing.STANDARD,
      websiteUrl: request.advertiserContext?.targetRegions?.[0]
        ? `https://example.com/${request.advertiserContext.targetRegions[0].toLowerCase()}`
        : 'https://example.com',
      startDate: aiSuggestion.duration.startDate,
      endDate: aiSuggestion.duration.endDate,
      targeting,
      analysisSummary: this.generateAnalysisSummary(aiSuggestion, request)
    };
  }

  private validateEnum<T>(value: string, enumType: any, defaultValue: T): T {
    const upperValue = value.toUpperCase().replace(/\s+/g, '_');
    return Object.values(enumType).includes(upperValue as any)
      ? upperValue as T
      : defaultValue;
  }

  private validateInterests(interests: string[]): CampaignInterest[] {
    return interests
      .map(interest => {
        const normalized = interest.toUpperCase().replace(/\s+/g, '_');
        return Object.values(CampaignInterest).includes(normalized as any)
          ? normalized as CampaignInterest
          : null;
      })
      .filter((interest): interest is CampaignInterest => interest !== null)
      .slice(0, 5);
  }

  private buildTargeting(aiTargeting: any): CampaignTargetingDto {
    const targeting: CampaignTargetingDto = {};

    if (aiTargeting.demographics) {
      targeting.demographic = {
        ageRanges: aiTargeting.demographics.ageRanges,
        genders: aiTargeting.demographics.genders,
        incomes: aiTargeting.demographics.incomes,
        educationLevels: aiTargeting.demographics.educationLevels,
        parentalStatus: aiTargeting.demographics.parentalStatus
      };
    }

    if (aiTargeting.geo) {
      targeting.geo = {
        countries: aiTargeting.geo.countries || [],
        regions: aiTargeting.geo.regions || [],
        cities: aiTargeting.geo.cities || [],
        postalCodes: aiTargeting.geo.postalCodes || [],
        radiusTargets: aiTargeting.geo.radiusTargets || [],
        excludedCountries: aiTargeting.geo.excludedCountries || []
      };
    }

    if (aiTargeting.device) {
      targeting.device = {
        deviceTypes: aiTargeting.device.deviceTypes || [],
        operatingSystems: aiTargeting.device.operatingSystems || [],
        browsers: aiTargeting.device.browsers || [],
        connectionTypes: aiTargeting.device.connectionTypes || [],
        carriers: aiTargeting.device.carriers || []
      };
    }

    if (aiTargeting.behavioral) {
      targeting.behavioral = {
        interests: aiTargeting.behavioral.interests || [],
        purchaseIntents: aiTargeting.behavioral.purchaseIntents || [],
        customAudiences: aiTargeting.behavioral.customAudiences || []
      };
    }

    if (aiTargeting.time) {
      targeting.time = {
        daysOfWeek: aiTargeting.time.daysOfWeek || [],
        hoursOfDay: aiTargeting.time.hoursOfDay || [],
        timezone: aiTargeting.time.timezone || 'Asia/Kolkata'
      };
    }

    if (aiTargeting.frequencyCap) {
      targeting.frequencyCap = {
        impressionsPerUser: aiTargeting.frequencyCap.impressionsPerUser || 3,
        timeUnit: aiTargeting.frequencyCap.timeUnit || 'DAY'
      };
    }

    return targeting;
  }

  private extractBusinessCategory(description: string): string {
    const categoryKeywords = {
      [BusinessCategory.TECHNOLOGY]: ['app', 'software', 'tech', 'digital', 'platform'],
      [BusinessCategory.HEALTH_AND_FITNESS]: ['fitness', 'health', 'wellness', 'gym', 'exercise'],
      [BusinessCategory.RETAIL]: ['shop', 'store', 'buy', 'sell', 'retail'],
      [BusinessCategory.FOOD_AND_BEVERAGE]: ['food', 'restaurant', 'drink', 'beverage', 'dining'],
      [BusinessCategory.FINANCE]: ['finance', 'bank', 'investment', 'money', 'loan'],
      [BusinessCategory.EDUCATION]: ['education', 'learn', 'course', 'school', 'training']
    };

    const lowerDescription = description.toLowerCase();

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => lowerDescription.includes(keyword))) {
        return category;
      }
    }

    return BusinessCategory.BUSINESS_SERVICES;
  }

  private generateAnalysisSummary(
    aiSuggestion: CampaignAISuggestion,
    request: CampaignAnalysisRequestDto
  ): string {
    const targetMarkets = aiSuggestion.targeting.geo?.cities?.join(', ') || 'selected markets';
    const duration = aiSuggestion.duration.days;

    return `Campaign optimized for ${aiSuggestion.objective.toLowerCase()} targeting ${targetMarkets} over ${duration} days. ` +
           `Budget allocation considers market benchmarks and historical performance data.`;
  }
}
