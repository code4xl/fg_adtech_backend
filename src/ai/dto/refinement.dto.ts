import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsObject,
  ValidateNested,
  Min,
  Max,
  IsArray,
  IsEnum
} from 'class-validator';
import { Type } from 'class-transformer';

export class BudgetConstraintsDto {
  @ApiProperty({
    description: 'Minimum allowed budget',
    example: 1000
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minBudget?: number;

  @ApiProperty({
    description: 'Maximum allowed budget',
    example: 50000
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxBudget?: number;

  @ApiProperty({
    description: 'Target ROI percentage',
    example: 150
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  targetROI?: number;

  @ApiProperty({
    description: 'Maximum cost per acquisition',
    example: 25
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxCPA?: number;
}

export class OptimizeBudgetRequestDto {
  @ApiProperty({
    description: 'Campaign ID to optimize budget for',
    example: 'b169383a-2369-4422-9094-bf0752ceed65'
  })
  @IsNotEmpty()
  @IsString()
  campaignId: string;

  @ApiProperty({
    description: 'Budget constraints and goals',
    required: false
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BudgetConstraintsDto)
  constraints?: BudgetConstraintsDto;

  @ApiProperty({
    description: 'Optimization goal',
    example: 'maximize_reach',
    enum: ['maximize_reach', 'minimize_cpc', 'maximize_conversions', 'balanced']
  })
  @IsOptional()
  @IsEnum(['maximize_reach', 'minimize_cpc', 'maximize_conversions', 'balanced'])
  optimizationGoal?: string;
}

export class OptimizeBudgetResponseDto {
  @ApiProperty({
    description: 'Recommended total budget',
    example: 8500
  })
  recommendedBudget: number;

  @ApiProperty({
    description: 'Recommended daily budget',
    example: 280
  })
  recommendedDailyBudget: number;

  @ApiProperty({
    description: 'Recommended bid strategy',
    example: 'COST_CAP'
  })
  recommendedBidStrategy: string;

  @ApiProperty({
    description: 'Recommended bid amount if applicable',
    example: 2.75
  })
  recommendedBidAmount?: number;

  @ApiProperty({
    description: 'Expected performance metrics'
  })
  expectedMetrics: {
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cpc: number;
    cpa: number;
  };

  @ApiProperty({
    description: 'Optimization rationale',
    example: 'Budget increased by 15% to capture peak hours traffic'
  })
  rationale: string;

  @ApiProperty({
    description: 'Confidence score',
    example: 0.82
  })
  confidence: number;
}

export class RefineTargetingRequestDto {
  @ApiProperty({
    description: 'Campaign ID to refine targeting for',
    example: 'b169383a-2369-4422-9094-bf0752ceed65'
  })
  @IsNotEmpty()
  @IsString()
  campaignId: string;

  @ApiProperty({
    description: 'Specific refinement goals',
    example: 'Expand reach while maintaining quality',
    required: false
  })
  @IsOptional()
  @IsString()
  refinementGoals?: string;

  @ApiProperty({
    description: 'Targeting aspects to focus on',
    example: ['demographics', 'geo', 'interests'],
    required: false
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  focusAreas?: string[];

  @ApiProperty({
    description: 'Include lookalike audience suggestions',
    default: true
  })
  @IsOptional()
  includeLookalike?: boolean;
}

export class PerformancePredictionRequestDto {
  @ApiProperty({
    description: 'Campaign ID or campaign configuration to predict',
    example: 'b169383a-2369-4422-9094-bf0752ceed65'
  })
  @IsNotEmpty()
  @IsString()
  campaignId: string;

  @ApiProperty({
    description: 'Prediction timeframe in days',
    example: 30,
    minimum: 1,
    maximum: 365
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  timeframeDays?: number;

  @ApiProperty({
    description: 'Include competitive analysis',
    default: false
  })
  @IsOptional()
  includeCompetitiveAnalysis?: boolean;

  @ApiProperty({
    description: 'Scenario to predict',
    example: 'current',
    enum: ['current', 'optimistic', 'pessimistic']
  })
  @IsOptional()
  @IsEnum(['current', 'optimistic', 'pessimistic'])
  scenario?: string;
}

export class PerformancePredictionResponseDto {
  @ApiProperty({
    description: 'Predicted performance metrics'
  })
  predictions: {
    impressions: {
      expected: number;
      range: { min: number; max: number };
    };
    clicks: {
      expected: number;
      range: { min: number; max: number };
    };
    conversions: {
      expected: number;
      range: { min: number; max: number };
    };
    spend: {
      expected: number;
      range: { min: number; max: number };
    };
    ctr: number;
    cpc: number;
    cpa: number;
    roi: number;
  };

  @ApiProperty({
    description: 'Key performance factors'
  })
  keyFactors: Array<{
    factor: string;
    impact: 'positive' | 'negative' | 'neutral';
    importance: 'high' | 'medium' | 'low';
    recommendation?: string;
  }>;

  @ApiProperty({
    description: 'Competitive landscape insights',
    required: false
  })
  competitiveInsights?: {
    marketShare: number;
    competitorCount: number;
    relativeStrength: 'strong' | 'average' | 'weak';
    recommendations: string[];
  };

  @ApiProperty({
    description: 'Optimization opportunities'
  })
  opportunities: Array<{
    area: string;
    potentialImprovement: number;
    effort: 'low' | 'medium' | 'high';
    recommendation: string;
  }>;

  @ApiProperty({
    description: 'Prediction confidence',
    example: 0.78
  })
  confidence: number;

  @ApiProperty({
    description: 'Analysis timestamp'
  })
  analyzedAt: string;
}

export class AIHealthCheckResponseDto {
  @ApiProperty({
    description: 'AI service status'
  })
  status: 'healthy' | 'degraded' | 'unavailable';

  @ApiProperty({
    description: 'OpenAI API connectivity'
  })
  openAIConnected: boolean;

  @ApiProperty({
    description: 'Available AI models'
  })
  availableModels: string[];

  @ApiProperty({
    description: 'Response time in milliseconds'
  })
  responseTime: number;

  @ApiProperty({
    description: 'Service version'
  })
  version: string;
}