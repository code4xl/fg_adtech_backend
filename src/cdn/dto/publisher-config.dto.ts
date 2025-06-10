import { IsUUID, IsString, IsEnum, IsBoolean, IsNumber, IsArray, ValidateNested, IsOptional, IsUrl, Min, Max, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Publisher tier levels
 */
export enum PublisherTier {
  BASIC = 'basic',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
}

/**
 * Publisher configuration in the SDK
 */
export class PublisherConfigDto {
  @IsUUID()
  id: string;

  @IsEnum(PublisherTier)
  tier: PublisherTier;
}

/**
 * Website configuration in the SDK
 */
export class WebsiteConfigDto {
  @IsUUID()
  id: string;

  @IsString()
  domain: string;
}

/**
 * Refresh configuration for inventory
 */
export class RefreshConfigDto {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsNumber()
  @Min(10000) // Minimum 10 seconds
  @Max(300000) // Maximum 5 minutes
  interval?: number;
}

/**
 * Inventory slot configuration
 */
export class InventoryConfigDto {
  @IsString()
  selector: string;

  @IsUUID()
  inventoryId: string;

  @IsOptional()
  @IsString()
  size?: string; // e.g., "728x90", "300x250"

  @IsOptional()
  @ValidateNested()
  @Type(() => RefreshConfigDto)
  refresh?: RefreshConfigDto;

  @IsOptional()
  @IsString()
  position?: string; // ABOVE_FOLD, BELOW_FOLD, SIDEBAR, IN_ARTICLE

  @IsOptional()
  @IsObject()
  customTargeting?: Record<string, any>;
}

/**
 * SDK settings configuration
 */
export class SettingsConfigDto {
  @IsUrl()
  apiUrl: string;

  @IsNumber()
  @Min(100)
  @Max(5000)
  sseTimeout: number;

  @IsOptional()
  @IsBoolean()
  debug?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  batchDelay?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  maxRetries?: number;

  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(10000)
  fallbackTimeout?: number;
}

/**
 * Complete publisher SDK configuration
 */
export class PublisherSdkConfigDto {
  @ValidateNested()
  @Type(() => PublisherConfigDto)
  publisher: PublisherConfigDto;

  @ValidateNested()
  @Type(() => WebsiteConfigDto)
  website: WebsiteConfigDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InventoryConfigDto)
  inventory: InventoryConfigDto[];

  @ValidateNested()
  @Type(() => SettingsConfigDto)
  settings: SettingsConfigDto;
}