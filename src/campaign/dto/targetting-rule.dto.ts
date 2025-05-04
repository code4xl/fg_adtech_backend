// src/campaign/dto/targetting-rule.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsInt,
    IsISO8601,
    IsNumber,
    IsObject,
    IsOptional,
    IsString,
    Max,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Demographic Targeting
export class AgeRangeDto {
    @ApiProperty({ description: 'Minimum age', example: 18 })
    @IsInt()
    @Min(13)
    @Max(100)
    @Type(() => Number)
    min: number;

    @ApiProperty({ description: 'Maximum age', example: 34 })
    @IsInt()
    @Min(13)
    @Max(100)
    @Type(() => Number)
    max: number;
}

export class DemographicTargetingDto {
    @ApiProperty({
        description: 'Age ranges to target',
        example: [{ min: 18, max: 24 }, { min: 25, max: 34 }],
        required: false
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AgeRangeDto)
    ageRanges?: AgeRangeDto[];

    @ApiProperty({
        description: 'Genders to target',
        example: ['MALE', 'FEMALE'],
        enum: ['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'],
        required: false
    })
    @IsOptional()
    @IsArray()
    @IsEnum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'], { each: true })
    genders?: string[];

    @ApiProperty({
        description: 'Income levels to target',
        example: ['LOW', 'MEDIUM', 'HIGH'],
        enum: ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'],
        required: false
    })
    @IsOptional()
    @IsArray()
    @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'], { each: true })
    incomes?: string[];

    @ApiProperty({
        description: 'Education levels to target',
        example: ['HIGH_SCHOOL', 'COLLEGE'],
        enum: ['HIGH_SCHOOL', 'COLLEGE', 'GRADUATE', 'POST_GRADUATE'],
        required: false
    })
    @IsOptional()
    @IsArray()
    @IsEnum(['HIGH_SCHOOL', 'COLLEGE', 'GRADUATE', 'POST_GRADUATE'], { each: true })
    educationLevels?: string[];

    @ApiProperty({
        description: 'Parental status to target',
        example: ['PARENT', 'NOT_PARENT'],
        enum: ['PARENT', 'NOT_PARENT'],
        required: false
    })
    @IsOptional()
    @IsArray()
    @IsEnum(['PARENT', 'NOT_PARENT'], { each: true })
    parentalStatus?: string[];
}

export class RadiusTargetDto {
    @ApiProperty({ description: 'Latitude', example: 40.7128 })
    @IsNumber()
    @Min(-90)
    @Max(90)
    @Type(() => Number)
    latitude: number;

    @ApiProperty({ description: 'Longitude', example: -74.0060 })
    @IsNumber()
    @Min(-180)
    @Max(180)
    @Type(() => Number)
    longitude: number;

    @ApiProperty({ description: 'Radius in kilometers', example: 10 })
    @IsNumber()
    @Min(0)
    @Max(500)
    @Type(() => Number)
    radius: number;

    @ApiProperty({ description: 'Location name (optional)', example: 'Manhattan', required: false })
    @IsOptional()
    @IsString()
    name?: string;
}

// Geographic Targeting
export class GeoTargetingDto {
    @ApiProperty({
        description: 'Countries to include (ISO 3166-1 alpha-2)',
        example: ['US', 'CA', 'MX'],
        required: false
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    countries?: string[];

    @ApiProperty({
        description: 'Regions/States to include',
        example: ['CA', 'NY', 'TX'],
        required: false
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    regions?: string[];

    @ApiProperty({
        description: 'Cities to include',
        example: ['New York', 'Los Angeles', 'Chicago'],
        required: false
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    cities?: string[];

    @ApiProperty({
        description: 'ZIP/Postal codes to include',
        example: ['10001', '90210', '60601'],
        required: false
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    postalCodes?: string[];

    @ApiProperty({
        description: 'Radius targeting (in km)',
        required: false,
        type: [RadiusTargetDto]
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => RadiusTargetDto)
    radiusTargets?: RadiusTargetDto[];

    @ApiProperty({
        description: 'Countries to exclude (ISO 3166-1 alpha-2)',
        example: ['RU', 'CN'],
        required: false
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    excludedCountries?: string[];
}

// Device Targeting
export class DeviceTargetingDto {
    @ApiProperty({
        description: 'Device types to include',
        example: ['DESKTOP', 'MOBILE', 'TABLET'],
        enum: ['DESKTOP', 'MOBILE', 'TABLET', 'CONNECTED_TV', 'GAME_CONSOLE'],
        required: false
    })
    @IsOptional()
    @IsArray()
    @IsEnum(['DESKTOP', 'MOBILE', 'TABLET', 'CONNECTED_TV', 'GAME_CONSOLE'], { each: true })
    deviceTypes?: string[];

    @ApiProperty({
        description: 'Operating systems to include',
        example: ['IOS', 'ANDROID', 'WINDOWS'],
        enum: ['IOS', 'ANDROID', 'WINDOWS', 'MACOS', 'LINUX', 'OTHER'],
        required: false
    })
    @IsOptional()
    @IsArray()
    @IsEnum(['IOS', 'ANDROID', 'WINDOWS', 'MACOS', 'LINUX', 'OTHER'], { each: true })
    operatingSystems?: string[];

    @ApiProperty({
        description: 'Browsers to include',
        example: ['CHROME', 'SAFARI', 'FIREFOX'],
        enum: ['CHROME', 'SAFARI', 'FIREFOX', 'EDGE', 'OPERA', 'OTHER'],
        required: false
    })
    @IsOptional()
    @IsArray()
    @IsEnum(['CHROME', 'SAFARI', 'FIREFOX', 'EDGE', 'OPERA', 'OTHER'], { each: true })
    browsers?: string[];

    @ApiProperty({
        description: 'Connection types to include',
        example: ['WIFI', 'CELLULAR'],
        enum: ['WIFI', 'CELLULAR', 'ETHERNET', 'OTHER'],
        required: false
    })
    @IsOptional()
    @IsArray()
    @IsEnum(['WIFI', 'CELLULAR', 'ETHERNET', 'OTHER'], { each: true })
    connectionTypes?: string[];

    @ApiProperty({
        description: 'Mobile carriers to include',
        example: ['VERIZON', 'AT&T', 'T-MOBILE'],
        required: false
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    carriers?: string[];
}

// Contextual Targeting
export class ContextualTargetingDto {
    @ApiProperty({
        description: 'Website categories to include',
        example: ['NEWS', 'SPORTS', 'ENTERTAINMENT'],
        required: false
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    siteCategories?: string[];

    @ApiProperty({
        description: 'Content keywords to target',
        example: ['football', 'sports', 'nfl'],
        required: false
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    keywords?: string[];

    @ApiProperty({
        description: 'Website categories to exclude',
        example: ['ADULT', 'GAMBLING'],
        required: false
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    excludedSiteCategories?: string[];
}

// Behavioral Targeting
export class BehavioralTargetingDto {
    @ApiProperty({
        description: 'Interest categories to target',
        example: ['SPORTS_ENTHUSIASTS', 'TRAVELERS', 'FOODIES'],
        required: false
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    interests?: string[];

    @ApiProperty({
        description: 'Purchase intent categories',
        example: ['AUTO_INTENDERS', 'HOME_BUYERS'],
        required: false
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    purchaseIntents?: string[];

    @ApiProperty({
        description: 'Custom audience segments (typically from first-party data)',
        example: ['REPEAT_CUSTOMERS', 'CART_ABANDONERS', 'LOYALTY_MEMBERS'],
        required: false
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    customAudiences?: string[];
}

// Time Targeting
export class TimeTargetingDto {
    @ApiProperty({
        description: 'Days of week to include (0=Sunday, 6=Saturday)',
        example: [1, 2, 3, 4, 5],
        required: false
    })
    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    @Min(0, { each: true })
    @Max(6, { each: true })
    @Type(() => Number)
    daysOfWeek?: number[];

    @ApiProperty({
        description: 'Hours of day to include (0-23)',
        example: [9, 10, 11, 12, 13, 14, 15, 16, 17],
        required: false
    })
    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    @Min(0, { each: true })
    @Max(23, { each: true })
    @Type(() => Number)
    hoursOfDay?: number[];

    @ApiProperty({
        description: 'Time zone for hour targeting',
        example: 'America/New_York',
        required: false
    })
    @IsOptional()
    @IsString()
    timezone?: string;
}

// Frequency & Recency
export class FrequencyCapDto {
    @ApiProperty({
        description: 'Maximum impressions per user',
        example: 3,
        required: false
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Type(() => Number)
    impressionsPerUser?: number;

    @ApiProperty({
        description: 'Time period for frequency cap',
        example: 'DAY',
        enum: ['HOUR', 'DAY', 'WEEK', 'MONTH', 'CAMPAIGN'],
        required: false
    })
    @IsOptional()
    @IsEnum(['HOUR', 'DAY', 'WEEK', 'MONTH', 'CAMPAIGN'])
    timeUnit?: string;
}

// Main campaign targeting DTO that combines all targeting options
export class CampaignTargetingDto {
    @ApiProperty({
        description: 'Demographic targeting options',
        required: false,
        type: DemographicTargetingDto
    })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => DemographicTargetingDto)
    demographic?: DemographicTargetingDto;

    @ApiProperty({
        description: 'Geographic targeting options',
        required: false,
        type: GeoTargetingDto
    })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => GeoTargetingDto)
    geo?: GeoTargetingDto;

    @ApiProperty({
        description: 'Device targeting options',
        required: false,
        type: DeviceTargetingDto
    })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => DeviceTargetingDto)
    device?: DeviceTargetingDto;

    @ApiProperty({
        description: 'Contextual targeting options',
        required: false,
        type: ContextualTargetingDto
    })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => ContextualTargetingDto)
    contextual?: ContextualTargetingDto;

    @ApiProperty({
        description: 'Behavioral targeting options',
        required: false,
        type: BehavioralTargetingDto
    })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => BehavioralTargetingDto)
    behavioral?: BehavioralTargetingDto;

    @ApiProperty({
        description: 'Time targeting options',
        required: false,
        type: TimeTargetingDto
    })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => TimeTargetingDto)
    time?: TimeTargetingDto;

    @ApiProperty({
        description: 'Frequency capping options',
        required: false,
        type: FrequencyCapDto
    })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => FrequencyCapDto)
    frequencyCap?: FrequencyCapDto;
}