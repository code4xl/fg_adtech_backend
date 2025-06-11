import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CampaignStatus, BusinessCategory } from '@prisma/client';

export interface AdvertiserInsights {
  campaignCount: number;
  averageBudget: number;
  averageDuration: number;
  topPerformingCategories: string[];
  effectiveBidStrategies: string[];
  targetingPatterns: {
    geo: string[];
    interests: string[];
    demographics: any;
  };
  performanceMetrics: {
    averageCTR: number;
    averageCPC: number;
    averageConversionRate: number;
  };
}

export interface MarketBenchmarks {
  category: string;
  averageCPM: number;
  averageCTR: number;
  averageCPC: number;
  seasonalTrends: {
    month: string;
    performanceIndex: number;
  }[];
  competitiveIntensity: 'low' | 'medium' | 'high';
}

@Injectable()
export class HistoricalDataService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdvertiserInsights(
    advertiserId: string,
  ): Promise<AdvertiserInsights> {
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        advertiserId,
        status: {
          in: [CampaignStatus.COMPLETED, CampaignStatus.ACTIVE],
        },
      },
      include: {
        statistics: true,
        campaignBudgetTracker: true,
        // targetingRules: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });

    if (campaigns.length === 0) {
      return this.getDefaultInsights();
    }

    // Get budgets from budget trackers
    const budgets = campaigns.map((c) => {
      const latestBudgetTracker = c.campaignBudgetTracker?.[0];
      return Number(latestBudgetTracker?.totalBudget || 5000);
    });
    
    const durations = campaigns.map((c) => {
      const start = new Date(c.startDate);
      const end = new Date(c.endDate);
      return Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );
    });

    const categories = new Map<string, number>();
    const geoTargets = new Set<string>();
    const interests = new Set<string>();

    campaigns.forEach((campaign) => {
      campaign.interests.forEach((interest) => interests.add(interest));

      // campaign.targetingRules.forEach((rule) => {
      //   if (rule.ruleType === 'GEOGRAPHIC' && rule.ruleData) {
      //     const geoData = rule.ruleData as any;
      //     geoData.cities?.forEach((city: string) => geoTargets.add(city));
      //     geoData.countries?.forEach((country: string) =>
      //       geoTargets.add(country),
      //     );
      //   }
      // });

      // campaign.campaignInventories.forEach((ci) => {
      //   ci.inventory.categories.forEach((cat) => {
      //     const name = cat.category.name;
      //     categories.set(name, (categories.get(name) || 0) + 1);
      //   });
      // });
    });

    const performanceMetrics = this.calculatePerformanceMetrics(campaigns);

    return {
      campaignCount: campaigns.length,
      averageBudget: budgets.reduce((a, b) => a + b, 0) / budgets.length,
      averageDuration: Math.round(
        durations.reduce((a, b) => a + b, 0) / durations.length,
      ),
      topPerformingCategories: Array.from(categories.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat]) => cat),
      effectiveBidStrategies: this.getTopBidStrategies(campaigns),
      targetingPatterns: {
        geo: Array.from(geoTargets).slice(0, 5),
        interests: Array.from(interests).slice(0, 5),
        demographics: this.extractDemographicPatterns(campaigns),
      },
      performanceMetrics,
    };
  }

  async getMarketBenchmarks(category: string): Promise<MarketBenchmarks> {
    const recentCampaigns = await this.prisma.campaign.findMany({
      where: {
        businessCategory: category as BusinessCategory,
        status: CampaignStatus.COMPLETED,
        endDate: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        statistics: true,
      },
      take: 100,
    });

    if (recentCampaigns.length < 10) {
      return this.getDefaultBenchmarks(category);
    }

    const metrics = this.calculateMarketMetrics(recentCampaigns);
    const seasonalTrends = this.calculateSeasonalTrends(recentCampaigns);
    const competitiveIntensity = this.assessCompetitiveIntensity(
      recentCampaigns.length,
    );

    return {
      category,
      averageCPM: metrics.cpm,
      averageCTR: metrics.ctr,
      averageCPC: metrics.cpc,
      seasonalTrends,
      competitiveIntensity,
    };
  }

  private calculatePerformanceMetrics(campaigns: any[]): any {
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalSpend = 0;
    let totalConversions = 0;

    campaigns.forEach((campaign) => {
      campaign.statistics.forEach((stat: any) => {
        totalImpressions += stat.impressions;
        totalClicks += stat.clicks;
        totalSpend += Number(stat.spend);
        totalConversions += stat.conversions;
      });
    });

    return {
      averageCTR:
        totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0.5,
      averageCPC: totalClicks > 0 ? totalSpend / totalClicks : 1.5,
      averageConversionRate:
        totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 2.0,
    };
  }

  private calculateMarketMetrics(campaigns: any[]): any {
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalSpend = 0;

    campaigns.forEach((campaign) => {
      campaign.statistics.forEach((stat: any) => {
        totalImpressions += stat.impressions;
        totalClicks += stat.clicks;
        totalSpend += Number(stat.spend);
      });
    });

    return {
      cpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 10,
      ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 1.5,
      cpc: totalClicks > 0 ? totalSpend / totalClicks : 2.0,
    };
  }

  private calculateSeasonalTrends(campaigns: any[]): any[] {
    const monthlyPerformance = new Map<
      string,
      { impressions: number; clicks: number }
    >();

    campaigns.forEach((campaign) => {
      campaign.statistics.forEach((stat: any) => {
        const month = new Date(stat.date).toLocaleString('default', {
          month: 'short',
        });
        const current = monthlyPerformance.get(month) || {
          impressions: 0,
          clicks: 0,
        };
        current.impressions += stat.impressions;
        current.clicks += stat.clicks;
        monthlyPerformance.set(month, current);
      });
    });

    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return months.map((month) => {
      const data = monthlyPerformance.get(month);
      const performanceIndex = data
        ? ((data.clicks / data.impressions) * 100) / 1.5
        : 1.0;

      return {
        month,
        performanceIndex: Math.min(Math.max(performanceIndex, 0.5), 2.0),
      };
    });
  }

  private getTopBidStrategies(campaigns: any[]): string[] {
    const strategies = new Map<string, number>();

    campaigns.forEach((campaign) => {
      const totalPerformance = campaign.statistics.reduce(
        (sum: number, stat: any) => {
          return sum + (stat.clicks / Math.max(stat.impressions, 1)) * 100;
        },
        0,
      );

      const strategy = campaign.bidStrategy;
      strategies.set(
        strategy,
        (strategies.get(strategy) || 0) + totalPerformance,
      );
    });

    return Array.from(strategies.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([strategy]) => strategy);
  }

  private extractDemographicPatterns(campaigns: any[]): any {
    const patterns = {
      ageRanges: [] as any[],
      genders: [] as string[],
      incomes: [] as string[],
    };

    campaigns.forEach((campaign) => {
      campaign.targetingRules.forEach((rule: any) => {
        if (rule.ruleType === 'DEMOGRAPHIC' && rule.ruleData) {
          const demo = rule.ruleData as any;
          if (demo.ageRanges) patterns.ageRanges.push(...demo.ageRanges);
          if (demo.genders) patterns.genders.push(...demo.genders);
          if (demo.incomes) patterns.incomes.push(...demo.incomes);
        }
      });
    });

    return {
      ageRanges: patterns.ageRanges.slice(0, 2),
      genders: [...new Set(patterns.genders)].slice(0, 2),
      incomes: [...new Set(patterns.incomes)].slice(0, 2),
    };
  }

  private assessCompetitiveIntensity(
    campaignCount: number,
  ): 'low' | 'medium' | 'high' {
    if (campaignCount < 20) return 'low';
    if (campaignCount < 50) return 'medium';
    return 'high';
  }

  private getDefaultInsights(): AdvertiserInsights {
    return {
      campaignCount: 0,
      averageBudget: 5000,
      averageDuration: 30,
      topPerformingCategories: [],
      effectiveBidStrategies: ['LOWEST_COST'],
      targetingPatterns: {
        geo: ['Mumbai', 'Delhi', 'Bangalore'],
        interests: [],
        demographics: {},
      },
      performanceMetrics: {
        averageCTR: 1.5,
        averageCPC: 2.0,
        averageConversionRate: 2.5,
      },
    };
  }

  private getDefaultBenchmarks(category: string): MarketBenchmarks {
    return {
      category,
      averageCPM: 10,
      averageCTR: 1.5,
      averageCPC: 2.0,
      seasonalTrends: this.getDefaultSeasonalTrends(),
      competitiveIntensity: 'medium',
    };
  }

  private getDefaultSeasonalTrends(): any[] {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return months.map((month) => ({
      month,
      performanceIndex: 1.0,
    }));
  }
}
