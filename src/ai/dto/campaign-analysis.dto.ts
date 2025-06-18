import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CampaignObjective,
  BusinessCategory,
  CampaignInterest,
  BidStrategy,
  CampaignPacing,
} from '@prisma/client';
import { CampaignTargetingDto } from '../../campaign/dto/targetting-rule.dto';
export class BudgetRangeDto {
  @ApiProperty({
    description: 'Minimum budget',
    example: 1000,
  })
  @IsNumber()
  @Min(1)
  min: number;

  @ApiProperty({
    description: 'Maximum budget',
    example: 10000,
  })
  @IsNumber()
  @Min(1)
  max: number;
}
export class AdvertiserContextDto {
  @ApiProperty({
    description: 'Whether to consider previous campaigns for optimization',
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  previousCampaigns?: boolean;

  @ApiProperty({
    description: 'Budget range constraints',
    required: false,
    example: { min: 1000, max: 10000 },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BudgetRangeDto)
  budgetRange?: BudgetRangeDto;

  @ApiProperty({
    description: 'Target regions to consider',
    required: false,
    example: ['US', 'CA', 'UK'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetRegions?: string[];

  @ApiProperty({
    description: 'Preferred campaign duration in days',
    required: false,
    example: 30,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  preferredDuration?: number;
}

export class CampaignAnalysisRequestDto {
  @ApiProperty({
    description: 'Natural language description of the campaign',
    example:
      'Promote our new fitness app to young professionals in Mumbai who are interested in health and wellness',
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Additional context for better AI suggestions',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AdvertiserContextDto)
  advertiserContext?: AdvertiserContextDto;

  @ApiProperty({
    description: 'Client ID if campaign is for a specific client',
    required: false,
  })
  @IsOptional()
  @IsString()
  clientId?: string;
}

export class CampaignNameSuggestion {
  @ApiProperty({
    description: 'Suggested campaign name',
    example: 'FitPro Mumbai Launch - Q2 2025',
  })
  name: string;

  @ApiProperty({
    description: 'Rationale for the suggestion',
    example:
      'Combines product name, target location, and timeframe for clarity',
  })
  rationale: string;
}

export class BudgetSuggestion {
  @ApiProperty({
    description: 'Total campaign budget',
    example: 5000,
  })
  budget: number;

  @ApiProperty({
    description: 'Daily budget',
    example: 200,
  })
  dailyBudget: number;

  @ApiProperty({
    description: 'Bid strategy',
    enum: BidStrategy,
  })
  bidStrategy: BidStrategy;

  @ApiProperty({
    description: 'Bid amount if applicable',
    example: 2.5,
  })
  bidAmount?: number;

  @ApiProperty({
    description: 'Rationale for budget allocation',
    example: 'Based on Mumbai market CPM rates and fitness app benchmarks',
  })
  rationale: string;
}

export class CampaignAnalysisResponseDto {
  @ApiProperty({
    description: 'AI confidence score',
    example: 0.85,
  })
  confidence: number;

  @ApiProperty({
    description: 'Suggested campaign names',
    type: [CampaignNameSuggestion],
  })
  namesSuggestions: CampaignNameSuggestion[];

  @ApiProperty({
    description: 'Selected campaign name',
    example: 'FitPro Mumbai Launch - Q2 2025',
  })
  name: string;

  @ApiProperty({
    description: 'Budget suggestions',
  })
  budgetSuggestion: BudgetSuggestion;

  @ApiProperty({
    description: 'Campaign objective',
    enum: CampaignObjective,
  })
  objective: CampaignObjective;

  @ApiProperty({
    description: 'Business category',
    enum: BusinessCategory,
  })
  businessCategory: BusinessCategory;

  @ApiProperty({
    description: 'Target interests',
    enum: CampaignInterest,
    isArray: true,
  })
  interests: CampaignInterest[];

  @ApiProperty({
    description: 'Campaign pacing',
    enum: CampaignPacing,
  })
  pacing: CampaignPacing;

  @ApiProperty({
    description: 'Website URL',
    example: 'https://fitpro.app/download',
  })
  websiteUrl: string;

  @ApiProperty({
    description: 'Suggested start date',
    example: '2025-06-01T00:00:00Z',
  })
  startDate: string;

  @ApiProperty({
    description: 'Suggested end date',
    example: '2025-06-30T23:59:59Z',
  })
  endDate: string;

  @ApiProperty({
    description: 'Targeting suggestions',
  })
  targeting: CampaignTargetingDto;

  @ApiProperty({
    description: 'AI analysis summary',
    example:
      'Campaign optimized for urban fitness enthusiasts in Mumbai metropolitan area',
  })
  analysisSummary: string;
}

export class RegenerateNamesRequestDto {
  @ApiProperty({
    description: 'Campaign ID to regenerate names for',
    example: 'b169383a-2369-4422-9094-bf0752ceed65',
  })
  @IsNotEmpty()
  @IsString()
  campaignId: string;

  @ApiProperty({
    description: 'Additional criteria for name generation',
    required: false,
    example: 'Include summer season reference',
  })
  @IsOptional()
  @IsString()
  criteria?: string;

  @ApiProperty({
    description: 'Number of suggestions to generate',
    required: false,
    default: 3,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  count?: number;
}
