import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenAIService } from './openai.service';
import { HistoricalDataService } from './historical-data.service';
import { PromptBuilder } from '../utils/prompt-builder';
import {
  BudgetConstraintsDto,
  OptimizeBudgetResponseDto,
  PerformancePredictionResponseDto,
} from '../dto/refinement.dto';
import { BadRequestException } from '../../common/exceptions/custom.exception';
import { CampaignStatus } from '@prisma/client';
import { AIModel } from '../interfaces/ai-response.interface';

interface BudgetOptimizationResult {
  budget: number;
  dailyBudget: number;
  bidStrategy: string;
  bidAmount?: number;
  expectedMetrics: {
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cpc: number;
    cpa: number;
  };
  rationale: string;
  confidence: number;
}

interface PerformancePredictionResult {
  metrics: {
    impressions: { expected: number; min: number; max: number };
    clicks: { expected: number; min: number; max: number };
    conversions: { expected: number; min: number; max: number };
    spend: { expected: number; min: number; max: number };
    ctr: number;
    cpc: number;
    cpa: number;
    roi: number;
  };
  factors: Array<{
    factor: string;
    impact: 'positive' | 'negative' | 'neutral';
    importance: 'high' | 'medium' | 'low';
    recommendation?: string;
  }>;
  opportunities: Array<{
    area: string;
    improvement: number;
    effort: 'low' | 'medium' | 'high';
    recommendation: string;
  }>;
  confidence: number;
}

@Injectable()
export class BudgetIntelligenceService {
  private readonly logger = new Logger(BudgetIntelligenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openAIService: OpenAIService,
    private readonly historicalDataService: HistoricalDataService,
    private readonly promptBuilder: PromptBuilder,
  ) {}

  async optimizeBudget(
    campaignId: string,
    advertiserId: string,
    constraints?: BudgetConstraintsDto,
    optimizationGoal?: string,
  ): Promise<OptimizeBudgetResponseDto> {
    const campaign = await this.validateCampaignAccess(
      campaignId,
      advertiserId,
    );

    const historicalPerformance = await this.getCampaignPerformance(campaignId);
    const marketBenchmarks =
      await this.historicalDataService.getMarketBenchmarks(
        campaign.businessCategory,
      );
    const competitorSpend = await this.getCompetitorSpendEstimates(
      campaign.businessCategory,
      campaign.demographicTargeting || [],
    );

    const prompt = this.buildBudgetOptimizationPrompt(
      campaign,
      constraints,
      optimizationGoal,
      historicalPerformance,
      marketBenchmarks,
      competitorSpend,
    );

    const aiResult =
      await this.openAIService.generateStructuredResponse<BudgetOptimizationResult>(
        'You are a digital advertising budget optimization expert with deep knowledge of programmatic advertising.',
        prompt,
        AIModel.GPT4_TURBO,
      );

    return this.validateAndFormatBudgetResponse(aiResult, campaign);
  }

  async predictPerformance(
    campaignId: string,
    advertiserId: string,
    timeframeDays: number,
    scenario: string,
    includeCompetitiveAnalysis: boolean,
  ): Promise<PerformancePredictionResponseDto> {
    const campaign = await this.validateCampaignAccess(
      campaignId,
      advertiserId,
      true,
    );

    const historicalData = await this.getDetailedCampaignHistory(campaignId);
    const marketTrends = await this.getMarketTrends(
      campaign.businessCategory,
      timeframeDays,
    );
    const seasonalFactors = this.calculateSeasonalFactors(
      campaign.startDate,
      campaign.endDate,
      timeframeDays,
    );

    const competitiveInsights = includeCompetitiveAnalysis
      ? await this.getCompetitiveInsights(
          campaign.businessCategory,
          campaign.demographicTargeting || [],
        )
      : null;

    const prompt = this.buildPerformancePredictionPrompt(
      campaign,
      timeframeDays,
      scenario,
      historicalData,
      marketTrends,
      seasonalFactors,
      competitiveInsights,
    );

    const aiResult =
      await this.openAIService.generateStructuredResponse<PerformancePredictionResult>(
        'You are a data scientist specializing in advertising performance prediction and analytics.',
        prompt,
        AIModel.GPT4_TURBO,
      );

    return this.formatPredictionResponse(aiResult, competitiveInsights);
  }

  private async validateCampaignAccess(
    campaignId: string,
    advertiserId: string,
    includeFullDetails: boolean = false,
  ) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, advertiserId },
      include: includeFullDetails
        ? {
            demographicTargeting: true,
            geographicTargeting: true,
            deviceTargeting: true,
            contextualTargeting: true,
            behavioralTargeting: true,
            timeTargeting: true,
            frequencyTargeting: true,
            // campaignBudgetTracker: { // -- ASIF PLS CHECK
            //   orderBy: { date: 'desc' },
            //   take: 1,
            // },
            statistics: {
              orderBy: { date: 'desc' },
              take: 30,
            },
          }
        : {
            demographicTargeting: true,
            geographicTargeting: true,
            deviceTargeting: true,
            contextualTargeting: true,
            behavioralTargeting: true,
            timeTargeting: true,
            frequencyTargeting: true,
            // campaignBudgetTracker: { // -- ASIF PLS CHECK
            //   orderBy: { date: 'desc' },
            //   take: 1,
            // },
          },
    });

    if (!campaign) {
      throw new BadRequestException('Campaign not found or access denied');
    }

    return campaign;
  }

  private async getCampaignPerformance(campaignId: string) {
    const stats = await this.prisma.campaignStatistics.findMany({
      where: { campaignId },
      orderBy: { date: 'desc' },
      take: 30,
    });

    if (stats.length === 0) {
      return null;
    }

    const totals = stats.reduce(
      (acc, stat) => ({
        impressions: acc.impressions + stat.impressions,
        clicks: acc.clicks + stat.clicks,
        conversions: acc.conversions + stat.conversions,
        spend: acc.spend + Number(stat.spend),
      }),
      { impressions: 0, clicks: 0, conversions: 0, spend: 0 },
    );

    return {
      ...totals,
      ctr:
        totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
      cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
      cpa: totals.conversions > 0 ? totals.spend / totals.conversions : 0,
      dailyAverages: {
        impressions: totals.impressions / stats.length,
        clicks: totals.clicks / stats.length,
        spend: totals.spend / stats.length,
      },
    };
  }

  private async getCompetitorSpendEstimates(
    businessCategory: string,
    targetingRules: any[],
  ) {
    const competitorCampaigns = await this.prisma.campaign.count({
      where: {
        businessCategory: businessCategory as any,
        status: CampaignStatus.ACTIVE,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    });

    // Get average budget from campaign budget trackers
    // const avgBudgetData = await this.prisma.campaignBudgetTracker.aggregate({
    //   where: {
    //     campaign: {
    //       businessCategory: businessCategory as any,
    //       status: { in: [CampaignStatus.ACTIVE, CampaignStatus.COMPLETED] },
    //     },
    //   },
    //   _avg: { totalBudget: true, dailyBudget: true },
    // });
    const avgBudgetData = null; // -- ASIF PLS CHECK
    return {
      activeCompetitors: competitorCampaigns,
      averageBudget: Number(avgBudgetData._avg.totalBudget || 5000),
      averageDailyBudget: Number(avgBudgetData._avg.dailyBudget || 200),
    };
  }

  private buildBudgetOptimizationPrompt(
    campaign: any,
    constraints: BudgetConstraintsDto | undefined,
    goal: string | undefined,
    performance: any,
    benchmarks: any,
    competitorData: any,
  ): string {
    // Get current budget from the latest budget tracker
    const currentBudgetTracker = campaign.campaignBudgetTracker?.[0];
    const currentBudget = Number(currentBudgetTracker?.totalBudget || 5000);
    const currentDaily = Number(currentBudgetTracker?.dailyBudget || 200);

    const duration = Math.ceil(
      (new Date(campaign.endDate).getTime() -
        new Date(campaign.startDate).getTime()) /
        (1000 * 60 * 60 * 24),
    );

    let prompt = `Optimize budget for campaign:
- Current Budget: $${currentBudget}
- Daily Budget: $${currentDaily}
- Duration: ${duration} days
- Objective: ${campaign.objective}
- Category: ${campaign.businessCategory}
- Optimization Goal: ${goal || 'balanced'}`;

    if (constraints) {
      prompt += `\n\nConstraints:
- Min Budget: $${constraints.minBudget || 'No minimum'}
- Max Budget: $${constraints.maxBudget || 'No maximum'}
- Target ROI: ${constraints.targetROI || 'Not specified'}%
- Max CPA: $${constraints.maxCPA || 'Not specified'}`;
    }

    if (performance) {
      prompt += `\n\nCurrent Performance:
- CTR: ${performance.ctr.toFixed(2)}%
- CPC: $${performance.cpc.toFixed(2)}
- CPA: $${performance.cpa.toFixed(2)}
- Daily Spend: $${performance.dailyAverages.spend.toFixed(2)}`;
    }

    prompt += `\n\nMarket Benchmarks:
- Average CPM: $${benchmarks.averageCPM}
- Average CTR: ${benchmarks.averageCTR}%
- Average CPC: $${benchmarks.averageCPC}
- Competition: ${benchmarks.competitiveIntensity}

Competitor Analysis:
- Active Competitors: ${competitorData.activeCompetitors}
- Avg Competitor Budget: $${competitorData.averageBudget}
- Avg Daily Spend: $${competitorData.averageDailyBudget}

Return JSON with optimized budget allocation and expected performance metrics.`;

    return prompt;
  }

  private buildPerformancePredictionPrompt(
    campaign: any,
    timeframeDays: number,
    scenario: string,
    historicalData: any,
    marketTrends: any,
    seasonalFactors: any,
    competitiveInsights: any,
  ): string {
    return `Predict campaign performance for ${timeframeDays} days:

Campaign Details:
${JSON.stringify(
  {
    budget: campaign.budget,
    dailyBudget: campaign.dailyBudget,
    objective: campaign.objective,
    businessCategory: campaign.businessCategory,
    inventoryCount: campaign.campaignInventories?.length || 0,
  },
  null,
  2,
)}

Scenario: ${scenario}

Historical Performance:
${JSON.stringify(historicalData, null, 2)}

Market Trends:
${JSON.stringify(marketTrends, null, 2)}

Seasonal Factors:
${JSON.stringify(seasonalFactors, null, 2)}

${
  competitiveInsights
    ? `Competitive Landscape:
${JSON.stringify(competitiveInsights, null, 2)}`
    : ''
}

Provide detailed performance predictions with confidence intervals and key factors.`;
  }

  private validateAndFormatBudgetResponse(
    aiResult: BudgetOptimizationResult,
    campaign: any,
  ): OptimizeBudgetResponseDto {
    const minBudget = 100;
    const maxBudget = 1000000;

    const validatedBudget = Math.max(
      minBudget,
      Math.min(maxBudget, aiResult.budget),
    );
    const validatedDaily = Math.max(
      minBudget / 30,
      Math.min(validatedBudget / 2, aiResult.dailyBudget),
    );

    return {
      recommendedBudget: validatedBudget,
      recommendedDailyBudget: validatedDaily,
      recommendedBidStrategy: aiResult.bidStrategy,
      recommendedBidAmount: aiResult.bidAmount,
      expectedMetrics: aiResult.expectedMetrics,
      rationale: aiResult.rationale,
      confidence: Math.max(0, Math.min(1, aiResult.confidence)),
    };
  }

  private formatPredictionResponse(
    aiResult: PerformancePredictionResult,
    competitiveInsights: any,
  ): PerformancePredictionResponseDto {
    return {
      predictions: {
        impressions: {
          expected: aiResult.metrics.impressions.expected,
          range: {
            min: aiResult.metrics.impressions.min,
            max: aiResult.metrics.impressions.max,
          },
        },
        clicks: {
          expected: aiResult.metrics.clicks.expected,
          range: {
            min: aiResult.metrics.clicks.min,
            max: aiResult.metrics.clicks.max,
          },
        },
        conversions: {
          expected: aiResult.metrics.conversions.expected,
          range: {
            min: aiResult.metrics.conversions.min,
            max: aiResult.metrics.conversions.max,
          },
        },
        spend: {
          expected: aiResult.metrics.spend.expected,
          range: {
            min: aiResult.metrics.spend.min,
            max: aiResult.metrics.spend.max,
          },
        },
        ctr: aiResult.metrics.ctr,
        cpc: aiResult.metrics.cpc,
        cpa: aiResult.metrics.cpa,
        roi: aiResult.metrics.roi,
      },
      keyFactors: aiResult.factors,
      competitiveInsights: competitiveInsights
        ? {
            marketShare: competitiveInsights.estimatedShare,
            competitorCount: competitiveInsights.activeCompetitors,
            relativeStrength: competitiveInsights.strength,
            recommendations: competitiveInsights.recommendations,
          }
        : undefined,
      opportunities: aiResult.opportunities.map((opp) => ({
        area: opp.area,
        potentialImprovement: opp.improvement,
        effort: opp.effort,
        recommendation: opp.recommendation,
      })),
      confidence: aiResult.confidence,
      analyzedAt: new Date().toISOString(),
    };
  }

  private async getDetailedCampaignHistory(campaignId: string) {
    const stats = await this.prisma.campaignStatistics.findMany({
      where: { campaignId },
      orderBy: { date: 'desc' },
    });

    return this.aggregateHistoricalData(stats);
  }

  private async getMarketTrends(category: string, days: number) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const campaigns = await this.prisma.campaign.count({
      where: {
        businessCategory: category as any,
        createdAt: { gte: startDate },
      },
    });

    return {
      newEntrants: campaigns,
      growthRate: campaigns > 10 ? 'high' : campaigns > 5 ? 'medium' : 'low',
      saturation: campaigns > 50 ? 'high' : campaigns > 20 ? 'medium' : 'low',
    };
  }

  private calculateSeasonalFactors(
    startDate: Date,
    endDate: Date,
    forecastDays: number,
  ) {
    const factors = [];
    const currentDate = new Date();

    for (let i = 0; i < forecastDays; i++) {
      const date = new Date(currentDate);
      date.setDate(date.getDate() + i);

      const month = date.getMonth();
      const dayOfWeek = date.getDay();

      const monthlyFactor = this.getMonthlySeasonalFactor(month);
      const weeklyFactor = this.getWeeklyFactor(dayOfWeek);

      factors.push({
        date: date.toISOString().split('T')[0],
        factor: monthlyFactor * weeklyFactor,
      });
    }

    return factors;
  }

  private getMonthlySeasonalFactor(month: number): number {
    const seasonalFactors = [
      0.85, 0.9, 1.0, 1.05, 1.1, 0.95, 0.9, 0.85, 1.05, 1.15, 1.25, 1.2,
    ];
    return seasonalFactors[month];
  }

  private getWeeklyFactor(dayOfWeek: number): number {
    const weeklyFactors = [0.8, 1.1, 1.15, 1.1, 1.05, 0.95, 0.85];
    return weeklyFactors[dayOfWeek];
  }

  private async getCompetitiveInsights(
    category: string,
    targetingRules: any[],
  ) {
    const competitors = await this.prisma.campaign.count({
      where: {
        businessCategory: category as any,
        status: CampaignStatus.ACTIVE,
      },
    });
    const totalSpend = await this.prisma.campaignStatistics.aggregate({
      where: { campaign: { businessCategory: category as any } },
      _sum: { spend: true },
    });

    return {
      activeCompetitors: competitors,
      estimatedShare:
        competitors > 0 ? Math.round(100 / (competitors + 1)) : 50,
      strength:
        competitors < 5 ? 'strong' : competitors < 15 ? 'average' : 'weak',
      totalMarketSpend: Number(totalSpend._sum.spend || 0),
      recommendations: this.generateCompetitiveRecommendations(competitors),
    };
  }

  private generateCompetitiveRecommendations(
    competitorCount: number,
  ): string[] {
    const recommendations = [];

    if (competitorCount < 5) {
      recommendations.push(
        'Low competition presents opportunity for market dominance',
      );
      recommendations.push(
        'Consider aggressive bidding to capture market share',
      );
    } else if (competitorCount < 15) {
      recommendations.push(
        'Moderate competition requires differentiated targeting',
      );
      recommendations.push('Focus on high-quality inventory for better ROI');
    } else {
      recommendations.push('High competition demands precise targeting');
      recommendations.push('Consider niche audience segments to reduce CPC');
      recommendations.push(
        'Implement dayparting to optimize budget efficiency',
      );
    }

    return recommendations;
  }

  private aggregateHistoricalData(stats: any[]) {
    if (stats.length === 0) return null;

    const aggregated = {
      totalDays: stats.length,
      avgDailyMetrics: {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        spend: 0,
      },
      trends: {
        impressions: 'stable',
        ctr: 'stable',
        cpc: 'stable',
      },
    };

    stats.forEach((stat) => {
      aggregated.avgDailyMetrics.impressions += stat.impressions;
      aggregated.avgDailyMetrics.clicks += stat.clicks;
      aggregated.avgDailyMetrics.conversions += stat.conversions;
      aggregated.avgDailyMetrics.spend += Number(stat.spend);
    });

    Object.keys(aggregated.avgDailyMetrics).forEach((key) => {
      aggregated.avgDailyMetrics[key] /= stats.length;
    });

    return aggregated;
  }
}
