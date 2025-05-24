import { Injectable } from '@nestjs/common';
import { CampaignAnalysisRequestDto } from '../dto/campaign-analysis.dto';
import { AdvertiserInsights, MarketBenchmarks } from '../services/historical-data.service';
import {
  BusinessCategory,
  CampaignObjective,
  CampaignInterest,
  BidStrategy
} from '@prisma/client';

@Injectable()
export class PromptBuilder {
  buildCampaignAnalysisPrompt(
    historicalData: AdvertiserInsights | null,
    marketData: MarketBenchmarks
  ): string {
    const businessCategories = Object.values(BusinessCategory).join(', ');
    const objectives = Object.values(CampaignObjective).join(', ');
    const interests = Object.values(CampaignInterest).join(', ');
    const bidStrategies = Object.values(BidStrategy).join(', ');

    let prompt = `You are an expert digital marketing strategist analyzing campaign requirements.
Generate optimized campaign suggestions based on the provided description.

AVAILABLE ENUMS (use exact values):
- Business Categories: ${businessCategories}
- Campaign Objectives: ${objectives}
- Interests: ${interests}
- Bid Strategies: ${bidStrategies}

MARKET BENCHMARKS for ${marketData.category}:
- Average CPM: $${marketData.averageCPM}
- Average CTR: ${marketData.averageCTR}%
- Average CPC: $${marketData.averageCPC}
- Competitive Intensity: ${marketData.competitiveIntensity}`;

    if (historicalData && historicalData.campaignCount > 0) {
      prompt += `

ADVERTISER HISTORICAL PERFORMANCE:
- Previous Campaigns: ${historicalData.campaignCount}
- Average Budget: $${historicalData.averageBudget.toFixed(0)}
- Average Duration: ${historicalData.averageDuration} days
- Effective Bid Strategies: ${historicalData.effectiveBidStrategies.join(', ')}
- Top Markets: ${historicalData.targetingPatterns.geo.join(', ')}
- Performance Metrics:
  - CTR: ${historicalData.performanceMetrics.averageCTR.toFixed(2)}%
  - CPC: $${historicalData.performanceMetrics.averageCPC.toFixed(2)}`;
    }

    prompt += `

RESPONSE FORMAT: Return a JSON object with the following structure:
{
  "names": [
    {
      "value": "Campaign Name",
      "score": 0.9,
      "rationale": "Why this name works"
    }
  ],
  "budget": {
    "total": 5000,
    "daily": 200,
    "strategy": "LOWEST_COST",
    "bidAmount": null
  },
  "targeting": {
    "demographics": {
      "ageRanges": [{"min": 18, "max": 34}],
      "genders": ["MALE", "FEMALE"],
      "incomes": ["MEDIUM", "HIGH"]
    },
    "geo": {
      "countries": ["IN"],
      "cities": ["Mumbai", "Delhi"],
      "regions": ["Maharashtra", "Delhi"]
    },
    "device": {
      "deviceTypes": ["MOBILE", "DESKTOP"],
      "operatingSystems": ["IOS", "ANDROID"]
    },
    "behavioral": {
      "interests": ["fitness", "health"],
      "purchaseIntents": ["fitness_equipment"]
    },
    "time": {
      "daysOfWeek": [1, 2, 3, 4, 5],
      "hoursOfDay": [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
      "timezone": "Asia/Kolkata"
    },
    "frequencyCap": {
      "impressionsPerUser": 3,
      "timeUnit": "DAY"
    }
  },
  "objective": "AWARENESS",
  "interests": ["HEALTH_AND_FITNESS", "TECHNOLOGY"],
  "businessCategory": "HEALTH_AND_FITNESS",
  "duration": {
    "startDate": "2025-06-01T00:00:00Z",
    "endDate": "2025-06-30T23:59:59Z",
    "days": 30
  },
  "metadata": {
    "confidence": 0.85,
    "processingTime": 0,
    "model": "gpt-4-turbo"
  }
}`;

    return prompt;
  }

  buildUserPrompt(request: CampaignAnalysisRequestDto): string {
    let prompt = `Campaign Description: ${request.description}`;

    if (request.advertiserContext) {
      const ctx = request.advertiserContext;
      
      if (ctx.budgetRange) {
        prompt += `\nBudget Constraints: $${ctx.budgetRange.min} - $${ctx.budgetRange.max}`;
      }
      
      if (ctx.targetRegions && ctx.targetRegions.length > 0) {
        prompt += `\nTarget Regions: ${ctx.targetRegions.join(', ')}`;
      }
      
      if (ctx.preferredDuration) {
        prompt += `\nPreferred Duration: ${ctx.preferredDuration} days`;
      }
    }

    const currentDate = new Date();
    const startDate = new Date(currentDate);
    startDate.setDate(startDate.getDate() + 7);
    
    prompt += `\nCurrent Date: ${currentDate.toISOString()}`;
    prompt += `\nSuggested Start Date: At least ${startDate.toISOString()}`;

    return prompt;
  }

  buildNameRegenerationPrompt(
    campaign: any,
    criteria?: string,
    count: number = 3
  ): string {
    return `Generate ${count} creative campaign names for:
- Current Name: ${campaign.name}
- Objective: ${campaign.objective}
- Category: ${campaign.businessCategory}
- Website: ${campaign.websiteUrl}
${criteria ? `- Additional Criteria: ${criteria}` : ''}

Return JSON: {
  "suggestions": [
    {
      "name": "Creative Campaign Name",
      "rationale": "Why this name is effective"
    }
  ]
}`;
  }

  buildBudgetOptimizationPrompt(
    campaign: any,
    constraints: any,
    performanceData: any
  ): string {
    return `Optimize budget allocation for campaign:
- Current Budget: $${campaign.budget}
- Daily Budget: $${campaign.dailyBudget || 'Not set'}
- Objective: ${campaign.objective}
- Duration: ${campaign.startDate} to ${campaign.endDate}

Constraints:
${JSON.stringify(constraints, null, 2)}

Performance Data:
${JSON.stringify(performanceData, null, 2)}

Return optimized budget allocation with rationale.`;
  }

  buildTargetingRefinementPrompt(
    currentTargeting: any,
    performanceInsights: any,
    refinementGoals: string
  ): string {
    return `Refine targeting rules based on:

Current Targeting:
${JSON.stringify(currentTargeting, null, 2)}

Performance Insights:
${JSON.stringify(performanceInsights, null, 2)}

Refinement Goals: ${refinementGoals}

Provide enhanced targeting recommendations.`;
  }
}