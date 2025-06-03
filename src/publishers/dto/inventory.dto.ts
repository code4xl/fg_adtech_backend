import {
  IsString,
  IsUUID,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEnum,
  Min,
  Max,
  IsArray,
  ValidateNested,
  IsDateString,
  IsDecimal,
  IsObject,
  IsNotEmpty,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

// ============================================
// ENUMS
// ============================================

export enum InventoryFormat {
  BANNER = 'BANNER',
  NATIVE = 'NATIVE',
  VIDEO = 'VIDEO',
  INTERSTITIAL = 'INTERSTITIAL',
  REWARDED = 'REWARDED',
}

export enum InventoryPosition {
  ABOVE_FOLD = 'ABOVE_FOLD',
  BELOW_FOLD = 'BELOW_FOLD',
  SIDEBAR = 'SIDEBAR',
  FOOTER = 'FOOTER',
  HEADER = 'HEADER',
  IN_CONTENT = 'IN_CONTENT',
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum TargetingRuleType {
  DEMOGRAPHIC = 'DEMOGRAPHIC',
  GEOGRAPHIC = 'GEOGRAPHIC',
  DEVICE = 'DEVICE',
  CONTEXTUAL = 'CONTEXTUAL',
  BEHAVIORAL = 'BEHAVIORAL',
  TIME = 'TIME',
  FREQUENCY = 'FREQUENCY',
}

// ============================================
// CREATE AD INVENTORY DTOs
// ============================================

export class CreateAdInventoryDto {
  @ApiProperty({
    description: 'Name of the ad inventory',
    example: 'Homepage Banner Slot',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'UUID of the ad slot template',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4')
  adSlotTemplateId: string;
  @ApiProperty({
    description: 'UUID of the publisher',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4')
  publisherId: string;

  @ApiProperty({
    description: 'UUID of the website',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID('4')
  websiteId: string;

  @ApiPropertyOptional({
    description: 'Viewability score between 0 and 1',
    example: 0.85,
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @IsDecimal()
  @Min(0)
  @Max(1)
  viewabilityScore?: number;
}

// ============================================
// UPDATE AD INVENTORY DTOs
// ============================================

export class UpdateAdInventoryDto extends PartialType(CreateAdInventoryDto) {
  @ApiPropertyOptional({
    description: 'Whether the inventory is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ============================================
// RESPONSE DTOs
// ============================================

export class AdSlotTemplateDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  width: number;

  @ApiProperty()
  height: number;

  @ApiProperty({ enum: InventoryFormat })
  format: InventoryFormat;

  @ApiProperty({ enum: InventoryPosition })
  position: InventoryPosition;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class WebsiteDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  domain?: string;

  @ApiPropertyOptional()
  url?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  publisherId: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class FloorPriceDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  inventoryId: string;

  @ApiProperty()
  basePrice: string; // Decimal as string

  @ApiProperty()
  currency: string;

  @ApiProperty()
  startDate: string;

  @ApiPropertyOptional()
  endDate?: string;

  @ApiPropertyOptional()
  timeTargeting?: any;

  @ApiPropertyOptional()
  buyerTargeting?: any;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class InventoryTargetingRuleDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  inventoryId: string;

  @ApiProperty({ enum: TargetingRuleType })
  ruleType: TargetingRuleType;

  @ApiProperty()
  ruleData: any; // JSON data

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class AdInventoryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  publisherId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  adSlotTemplateId: string;

  @ApiPropertyOptional()
  viewabilityScore?: number;

  @ApiProperty({ enum: ApprovalStatus })
  approvalStatus: ApprovalStatus;

  @ApiProperty()
  websiteId: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;

  @ApiPropertyOptional({ type: AdSlotTemplateDto })
  adSlotTemplate?: AdSlotTemplateDto;

  @ApiPropertyOptional({ type: WebsiteDto })
  website?: WebsiteDto;

  @ApiPropertyOptional({ type: [FloorPriceDto] })
  floorPrices?: FloorPriceDto[];

  @ApiPropertyOptional({ type: [InventoryTargetingRuleDto] })
  targetingRules?: InventoryTargetingRuleDto[];

  @ApiPropertyOptional()
  _count?: {
    bidRequests: number;
    hourlyMetrics: number;
    floorPrices: number;
    targetingRules: number;
  };
}

// ============================================
// QUERY DTOs
// ============================================

export class GetInventoryQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by approval status',
    enum: ApprovalStatus,
  })
  @IsOptional()
  @IsEnum(ApprovalStatus)
  approvalStatus?: ApprovalStatus;

  @ApiPropertyOptional({
    description: 'Filter by website ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  websiteId?: string;

  @ApiPropertyOptional({
    description: 'Search by inventory name',
    example: 'banner',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Sort field',
    example: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

// ============================================
// ACTIVATE/DEACTIVATE DTOs
// ============================================

export class ActivateInventoryDto {
  @ApiProperty({
    description: 'Activation status',
    example: true,
  })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({
    description: 'UUID of the ad inventory to activate/deactivate',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsString()
  @IsUUID('4')
  inventoryId: string;
  @ApiProperty({
    description: 'UUID of the publisher',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsString()
  @IsUUID('4')
  publisherId: string;
  @ApiProperty({
    description: 'UUID of the website',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsString()
  @IsUUID('4')
  websiteId: string;
}

// ============================================
// RESPONSE WRAPPER DTOs
// ============================================

export class AdInventoryResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty({ type: AdInventoryDto })
  data: AdInventoryDto;

  @ApiProperty()
  message: string;
}

export class AdInventoryListResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty({ type: [AdInventoryDto] })
  data: AdInventoryDto[];

  @ApiProperty()
  message: string;

  @ApiProperty()
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class DeleteInventoryResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;
}

// ============================================
// FLOOR PRICE DTOs
// ============================================

export class CreateFloorPriceDto {
  @ApiProperty({
    description: 'Base price for the floor',
    example: '2.50',
  })
  @IsString()
  basePrice: string; // Decimal as string

  @ApiPropertyOptional({
    description: 'Currency code',
    example: 'USD',
    default: 'USD',
  })
  @IsOptional()
  @IsString()
  currency?: string = 'USD';

  @ApiProperty({
    description: 'Start date for the floor price',
    example: '2024-01-01T00:00:00Z',
  })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({
    description: 'End date for the floor price',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Time-based targeting rules',
  })
  @IsOptional()
  @IsObject()
  timeTargeting?: any;

  @ApiPropertyOptional({
    description: 'Buyer-based targeting rules',
  })
  @IsOptional()
  @IsObject()
  buyerTargeting?: any;
}

export class UpdateFloorPriceDto extends PartialType(CreateFloorPriceDto) {}

// ============================================
// TARGETING RULE DTOs
// ============================================

export class CreateTargetingRuleDto {
  @ApiProperty({
    description: 'Type of targeting rule',
    enum: TargetingRuleType,
  })
  @IsEnum(TargetingRuleType)
  ruleType: TargetingRuleType;

  @ApiProperty({
    description: 'Rule configuration data',
    example: { countries: ['US', 'CA'], devices: ['mobile', 'desktop'] },
  })
  @IsObject()
  ruleData: any;
}

export class UpdateTargetingRuleDto extends PartialType(
  CreateTargetingRuleDto,
) {}

// ============================================
// BLOCKED ADVERTISERS DTOs
// ============================================

export class BlockAdvertiserDto {
  @ApiProperty({
    description: 'UUID of the advertiser to block',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  advertiserId: string;

  @ApiPropertyOptional({
    description: 'Reason for blocking',
    example: 'Policy violation',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
