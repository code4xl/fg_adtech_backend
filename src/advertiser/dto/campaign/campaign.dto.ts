import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsOptional,
  IsDateString,
  ValidateIf,
  IsUrl,
  IsArray,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CampaignObjective,
  BidStrategy,
  CampaignPacing,
  BusinessCategory,
  CampaignInterest,
  CampaignStatus,
} from '@prisma/client';

export class CreateCampaignDto {
  @ApiProperty({
    description: 'Campaign name',
    example: 'Summer Sale 2025',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Client ID for the campaign',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({
    description: 'Campaign start date (ISO format)',
    example: '2025-05-01T00:00:00Z',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'Campaign end date (ISO format)',
    example: '2025-05-31T23:59:59Z',
  })
  @IsDateString()
  endDate: string;

  @ApiProperty({
    description: 'Campaign objective',
    enum: CampaignObjective,
    example: CampaignObjective.AWARENESS,
  })
  @IsEnum(CampaignObjective)
  objective: CampaignObjective;

  @ApiPropertyOptional({
    description: 'Bid strategy',
    enum: BidStrategy,
    example: BidStrategy.LOWEST_COST,
    default: BidStrategy.LOWEST_COST,
  })
  @IsOptional()
  @IsEnum(BidStrategy)
  bidStrategy?: BidStrategy;

  @ApiPropertyOptional({
    description: 'Bid amount in INR (required for TARGET_CPM, optional for others as minimum bid)',
    example: 25,
    type: 'number',
    minimum: 1,
    maximum: 5000,
  })
  @ValidateIf((o) => o.bidStrategy === BidStrategy.TARGET_CPM)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(5000)
  @Type(() => Number)
  bidAmount?: number;

  @ApiPropertyOptional({
    description: 'Campaign pacing',
    enum: CampaignPacing,
    example: CampaignPacing.STANDARD,
    default: CampaignPacing.STANDARD,
  })
  @IsOptional()
  @IsEnum(CampaignPacing)
  pacing?: CampaignPacing;

  @ApiProperty({
    description: 'Business category',
    enum: BusinessCategory,
    example: BusinessCategory.RETAIL,
  })
  @IsNotEmpty()
  @IsEnum(BusinessCategory)
  businessCategory: BusinessCategory;

  @ApiProperty({
    description: 'Campaign website URL',
    example: 'https://example.com/summer-sale',
  })
  @IsNotEmpty()
  @IsUrl()
  websiteUrl: string;

  @ApiProperty({
    description: 'Campaign interest targeting',
    enum: CampaignInterest,
    isArray: true,
    example: [CampaignInterest.TECHNOLOGY, CampaignInterest.FOOD_AND_DRINK],
  })
  @IsNotEmpty()
  @IsArray()
  @IsEnum(CampaignInterest, { each: true })
  interests: CampaignInterest[];
}

export class UpdateCampaignDto {
  @ApiPropertyOptional({
    description: 'Campaign name',
    example: 'Updated Summer Sale 2025',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({
    description: 'Campaign end date (ISO format) - only if campaign is not active',
    example: '2025-05-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Campaign objective - only if campaign is not active',
    enum: CampaignObjective,
    example: CampaignObjective.CONVERSION,
  })
  @IsOptional()
  @IsEnum(CampaignObjective)
  objective?: CampaignObjective;

  @ApiPropertyOptional({
    description: 'Bid strategy - only if campaign is not active',
    enum: BidStrategy,
    example: BidStrategy.LOWEST_COST,
  })
  @IsOptional()
  @IsEnum(BidStrategy)
  bidStrategy?: BidStrategy;

  @ApiPropertyOptional({
    description: 'Bid amount - only if campaign is not active',
    example: 3.0,
    type: 'number',
  })
  @IsOptional()
  @ValidateIf((o) =>
    ['BID_CAP', 'COST_CAP', 'TARGET_COST'].includes(o.bidStrategy),
  )
  @Type(() => Number)
  bidAmount?: number;

  @ApiPropertyOptional({
    description: 'Campaign pacing - only if campaign is not active',
    enum: CampaignPacing,
    example: CampaignPacing.ACCELERATED,
  })
  @IsOptional()
  @IsEnum(CampaignPacing)
  pacing?: CampaignPacing;

  @ApiPropertyOptional({
    description: 'Business category',
    enum: BusinessCategory,
    example: BusinessCategory.TECHNOLOGY,
  })
  @IsOptional()
  @IsEnum(BusinessCategory)
  businessCategory?: BusinessCategory;

  @ApiPropertyOptional({
    description: 'Campaign website URL',
    example: 'https://example.com/updated-summer-sale',
  })
  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

  @ApiPropertyOptional({
    description: 'Campaign interest targeting',
    enum: CampaignInterest,
    isArray: true,
    example: [CampaignInterest.TECHNOLOGY, CampaignInterest.SPORTS],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(CampaignInterest, { each: true })
  interests?: CampaignInterest[];
}

export class CampaignResponseDto {
  @ApiProperty({
    description: 'Campaign ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Campaign name',
    example: 'Summer Sale 2025',
  })
  name: string;

  @ApiProperty({
    description: 'Advertiser ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  advertiserId: string;

  @ApiProperty({
    description: 'Client ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  clientId: string;

  @ApiProperty({
    description: 'Campaign start date',
    example: '2025-05-01T00:00:00Z',
  })
  startDate: Date;

  @ApiProperty({
    description: 'Campaign end date',
    example: '2025-05-31T23:59:59Z',
  })
  endDate: Date;

  @ApiProperty({
    description: 'Campaign status',
    enum: CampaignStatus,
    example: CampaignStatus.ACTIVE,
  })
  status: CampaignStatus;

  @ApiProperty({
    description: 'Campaign objective',
    enum: CampaignObjective,
    example: CampaignObjective.AWARENESS,
  })
  objective: CampaignObjective;

  @ApiPropertyOptional({
    description: 'Bid strategy',
    enum: BidStrategy,
    example: BidStrategy.LOWEST_COST,
    default: BidStrategy.LOWEST_COST,
  })
  @IsOptional()
  @IsEnum(BidStrategy)
  bidStrategy?: BidStrategy;

  @ApiPropertyOptional({
    description: 'Bid amount in INR (required for TARGET_CPM, optional for others as minimum bid)',
    example: 25,
    type: 'number',
    minimum: 1,
    maximum: 5000,
  })
  @ValidateIf((o) => o.bidStrategy === BidStrategy.TARGET_CPM)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(5000)
  @Type(() => Number)
  bidAmount?: number;

  @ApiProperty({
    description: 'Campaign pacing',
    enum: CampaignPacing,
    example: CampaignPacing.STANDARD,
  })
  pacing: CampaignPacing;

  @ApiProperty({
    description: 'Business category',
    enum: BusinessCategory,
    example: BusinessCategory.RETAIL,
  })
  businessCategory: BusinessCategory;

  @ApiProperty({
    description: 'Website URL',
    example: 'https://example.com/summer-sale',
  })
  websiteUrl: string;

  @ApiProperty({
    description: 'Campaign interests',
    enum: CampaignInterest,
    isArray: true,
    example: [CampaignInterest.TECHNOLOGY, CampaignInterest.FOOD_AND_DRINK],
  })
  interests: CampaignInterest[];

  @ApiProperty({
    description: 'Created at timestamp',
    example: '2025-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Updated at timestamp',
    example: '2025-01-01T00:00:00Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Client information',
  })
  client?: {
    id: string;
    name: string;
    companyName: string;
  };

  @ApiPropertyOptional({
    description: 'Campaign counts',
  })
  _count?: {
    creatives: number;
  };

  @ApiProperty({
    description: 'Has budget allocated',
    example: false,
  })
  hasBudget: boolean;
}