import { IsBoolean, IsNumber, IsOptional, IsString, IsUrl, IsArray, IsEnum, Min, Max, IsObject } from 'class-validator';

/**
 * SDK feature flags
 */
export enum SdkFeature {
  LAZY_LOADING = 'lazyLoading',
  VIEWABILITY_TRACKING = 'viewabilityTracking',
  REFRESH_OPTIMIZATION = 'refreshOptimization',
  HEADER_BIDDING = 'headerBidding',
  CONSENT_MANAGEMENT = 'consentManagement',
  AD_BLOCKER_DETECTION = 'adBlockerDetection',
  PERFORMANCE_ANALYTICS = 'performanceAnalytics',
}

/**
 * SDK performance settings
 */
export class SdkPerformanceSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5000)
  renderDelay?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxConcurrentRequests?: number;

  @IsOptional()
  @IsBoolean()
  enableBatching?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(1000)
  batchTimeout?: number;

  @IsOptional()
  @IsBoolean()
  enableCaching?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(3600)
  cacheTimeout?: number;
}

/**
 * SDK error handling settings
 */
export class SdkErrorHandlingDto {
  @IsOptional()
  @IsBoolean()
  enableErrorReporting?: boolean;

  @IsOptional()
  @IsUrl()
  errorReportingUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  maxRetries?: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  retryDelays?: number[];

  @IsOptional()
  @IsBoolean()
  enableFallback?: boolean;
}

/**
 * SDK analytics settings
 */
export class SdkAnalyticsSettingsDto {
  @IsOptional()
  @IsBoolean()
  enableAnalytics?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(60000)
  analyticsInterval?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  trackedEvents?: string[];

  @IsOptional()
  @IsBoolean()
  enableHeatmaps?: boolean;
}

/**
 * Advanced SDK settings
 */
export class AdvancedSdkSettingsDto {
  @IsOptional()
  @IsArray()
  @IsEnum(SdkFeature, { each: true })
  enabledFeatures?: SdkFeature[];

  @IsOptional()
  @IsObject()
  performance?: SdkPerformanceSettingsDto;

  @IsOptional()
  @IsObject()
  errorHandling?: SdkErrorHandlingDto;

  @IsOptional()
  @IsObject()
  analytics?: SdkAnalyticsSettingsDto;

  @IsOptional()
  @IsObject()
  customSettings?: Record<string, any>;
}

/**
 * SDK initialization options
 */
export class SdkInitOptionsDto {
  @IsOptional()
  @IsBoolean()
  autoInit?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000)
  initDelay?: number;

  @IsOptional()
  @IsBoolean()
  waitForDom?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredElements?: string[];

  @IsOptional()
  @IsBoolean()
  enablePreloading?: boolean;
}

/**
 * Complete SDK settings for CDN
 */
export class CompleteSdkSettingsDto {
  @IsUrl()
  apiUrl: string;

  @IsOptional()
  @IsUrl()
  sseUrl?: string;

  @IsNumber()
  @Min(100)
  @Max(5000)
  sseTimeout: number;

  @IsBoolean()
  debug: boolean;

  @IsOptional()
  @IsObject()
  advanced?: AdvancedSdkSettingsDto;

  @IsOptional()
  @IsObject()
  initOptions?: SdkInitOptionsDto;
}