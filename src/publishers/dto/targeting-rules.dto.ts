import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsEnum,
  IsObject,
  IsOptional,
  ValidateNested,
  IsString,
  IsArray,
  IsNumber,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { TargetingRuleType } from '@prisma/client';

// Base targeting rule data interfaces
export interface DemographicTargeting {
  ageMin?: number;
  ageMax?: number;
  genders?: string[];
  languages?: string[];
  incomeRange?: string;
}

export interface GeographicTargeting {
  countries?: string[];
  regions?: string[];
  cities?: string[];
  postalCodes?: string[];
  radius?: number;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface DeviceTargeting {
  deviceTypes?: string[];
  operatingSystems?: string[];
  browsers?: string[];
  connectionTypes?: string[];
  carriers?: string[];
}

export interface ContextualTargeting {
  keywords?: string[];
  categories?: string[];
  domains?: string[];
  blockedDomains?: string[];
  pageContext?: string[];
}

export interface BehavioralTargeting {
  interests?: string[];
  behaviors?: string[];
  visitFrequency?: string;
  purchaseIntent?: string[];
  lookalikeAudiences?: string[];
}

export interface TimeTargeting {
  daysOfWeek?: string[];
  hoursOfDay?: number[];
  timeZone?: string;
  startDate?: string;
  endDate?: string;
}

export interface FrequencyTargeting {
  maxImpressions?: number;
  timeWindow?: string; // '1h', '24h', '7d', '30d'
  capType?: 'user' | 'device' | 'ip';
}

// Validation classes for each targeting type
export class DemographicTargetingDto {
  @ApiPropertyOptional({ example: 18, minimum: 13, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(13)
  @Max(100)
  ageMin?: number;

  @ApiPropertyOptional({ example: 65, minimum: 13, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(13)
  @Max(100)
  ageMax?: number;

  @ApiPropertyOptional({ example: ['male', 'female'], isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genders?: string[];

  @ApiPropertyOptional({ example: ['en', 'hi', 'es'], isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @ApiPropertyOptional({ example: 'middle' })
  @IsOptional()
  @IsString()
  incomeRange?: string;
}

export class GeographicTargetingDto {
  @ApiPropertyOptional({ example: ['US', 'IN', 'UK'], isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countries?: string[];

  @ApiPropertyOptional({
    example: ['California', 'Maharashtra'],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  regions?: string[];

  @ApiPropertyOptional({ example: ['Mumbai', 'Delhi'], isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cities?: string[];

  @ApiPropertyOptional({ example: ['400001', '110001'], isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  postalCodes?: string[];

  @ApiPropertyOptional({ example: 50, description: 'Radius in kilometers' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  radius?: number;

  @ApiPropertyOptional({
    example: { lat: 19.076, lng: 72.8777 },
    description: 'Geographic coordinates',
  })
  @IsOptional()
  @IsObject()
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export class DeviceTargetingDto {
  @ApiPropertyOptional({
    example: ['mobile', 'desktop', 'tablet'],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deviceTypes?: string[];

  @ApiPropertyOptional({
    example: ['iOS', 'Android', 'Windows'],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  operatingSystems?: string[];

  @ApiPropertyOptional({
    example: ['Chrome', 'Safari', 'Firefox'],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  browsers?: string[];

  @ApiPropertyOptional({ example: ['wifi', '4g', '5g'], isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  connectionTypes?: string[];

  @ApiPropertyOptional({ example: ['Verizon', 'Airtel'], isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  carriers?: string[];
}

export class ContextualTargetingDto {
  @ApiPropertyOptional({ example: ['technology', 'sports'], isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional({ example: ['IAB1', 'IAB17'], isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({ example: ['example.com', 'news.com'], isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  domains?: string[];

  @ApiPropertyOptional({ example: ['spam.com', 'fake.com'], isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blockedDomains?: string[];

  @ApiPropertyOptional({ example: ['article', 'homepage'], isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pageContext?: string[];
}

export class BehavioralTargetingDto {
  @ApiPropertyOptional({ example: ['sports', 'technology'], isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @ApiPropertyOptional({
    example: ['frequent_traveler', 'online_shopper'],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  behaviors?: string[];

  @ApiPropertyOptional({ example: 'high' })
  @IsOptional()
  @IsString()
  visitFrequency?: string;

  @ApiPropertyOptional({ example: ['electronics', 'cars'], isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  purchaseIntent?: string[];

  @ApiPropertyOptional({ example: ['audience_1', 'audience_2'], isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lookalikeAudiences?: string[];
}

export class TimeTargetingDto {
  @ApiPropertyOptional({ example: ['monday', 'tuesday'], isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  daysOfWeek?: string[];

  @ApiPropertyOptional({ example: [9, 10, 11, 17, 18, 19], isArray: true })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  @Max(23, { each: true })
  hoursOfDay?: number[];

  @ApiPropertyOptional({ example: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  timeZone?: string;

  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2024-12-31' })
  @IsOptional()
  @IsString()
  endDate?: string;
}

export class FrequencyTargetingDto {
  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxImpressions?: number;

  @ApiPropertyOptional({ example: '24h' })
  @IsOptional()
  @IsString()
  timeWindow?: string;

  @ApiPropertyOptional({ example: 'user', enum: ['user', 'device', 'ip'] })
  @IsOptional()
  @IsString()
  capType?: 'user' | 'device' | 'ip';
}

export class CreateTargetingRuleDto {
  @ApiProperty({
    enum: TargetingRuleType,
    example: TargetingRuleType.DEMOGRAPHIC,
    description: 'Type of targeting rule',
  })
  @IsEnum(TargetingRuleType)
  ruleType: TargetingRuleType;

  @ApiProperty({
    description: 'Targeting rule data based on rule type',
    oneOf: [
      { $ref: '#/components/schemas/DemographicTargetingDto' },
      { $ref: '#/components/schemas/GeographicTargetingDto' },
      { $ref: '#/components/schemas/DeviceTargetingDto' },
      { $ref: '#/components/schemas/ContextualTargetingDto' },
      { $ref: '#/components/schemas/BehavioralTargetingDto' },
      { $ref: '#/components/schemas/TimeTargetingDto' },
      { $ref: '#/components/schemas/FrequencyTargetingDto' },
    ],
  })
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  @Transform(({ value, obj }) => {
    // Transform based on ruleType for proper validation
    switch (obj.ruleType) {
      case TargetingRuleType.DEMOGRAPHIC:
        return value as DemographicTargeting;
      case TargetingRuleType.GEOGRAPHIC:
        return value as GeographicTargeting;
      case TargetingRuleType.DEVICE:
        return value as DeviceTargeting;
      case TargetingRuleType.CONTEXTUAL:
        return value as ContextualTargeting;
      case TargetingRuleType.BEHAVIORAL:
        return value as BehavioralTargeting;
      case TargetingRuleType.TIME:
        return value as TimeTargeting;
      case TargetingRuleType.FREQUENCY:
        return value as FrequencyTargeting;
      default:
        return value;
    }
  })
  ruleData:
    | DemographicTargeting
    | GeographicTargeting
    | DeviceTargeting
    | ContextualTargeting
    | BehavioralTargeting
    | TimeTargeting
    | FrequencyTargeting;
}

export class UpdateTargetingRuleDto {
  @ApiPropertyOptional({
    enum: TargetingRuleType,
    example: TargetingRuleType.DEMOGRAPHIC,
    description: 'Type of targeting rule',
  })
  @IsOptional()
  @IsEnum(TargetingRuleType)
  ruleType?: TargetingRuleType;

  @ApiPropertyOptional({
    description: 'Targeting rule data based on rule type',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  ruleData?:
    | DemographicTargeting
    | GeographicTargeting
    | DeviceTargeting
    | ContextualTargeting
    | BehavioralTargeting
    | TimeTargeting
    | FrequencyTargeting;
}

export class TargetingRuleResponseDto {
  @ApiProperty({ example: 'uuid-string' })
  id: string;

  @ApiProperty({ example: 'uuid-string' })
  inventoryId: string;

  @ApiProperty({ enum: TargetingRuleType })
  ruleType: TargetingRuleType;

  @ApiProperty({ description: 'Targeting rule configuration data' })
  ruleData: any;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  updatedAt: Date;
}

export class TargetingRulesListResponseDto {
  @ApiProperty({ type: [TargetingRuleResponseDto] })
  targetingRules: TargetingRuleResponseDto[];

  @ApiProperty({ example: 25 })
  total: number;

  @ApiPropertyOptional({ example: 1 })
  page?: number;

  @ApiPropertyOptional({ example: 10 })
  limit?: number;
}
