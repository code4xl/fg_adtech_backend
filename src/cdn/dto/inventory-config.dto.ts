import { IsUUID, IsString, IsEnum, IsNumber, IsOptional, IsObject, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Ad positions enumeration
 */
export enum AdPosition {
  ABOVE_FOLD = 'ABOVE_FOLD',
  BELOW_FOLD = 'BELOW_FOLD',
  SIDEBAR = 'SIDEBAR',
  IN_ARTICLE = 'IN_ARTICLE',
  STICKY = 'STICKY',
  INTERSTITIAL = 'INTERSTITIAL',
}

/**
 * Ad format types
 */
export enum AdFormat {
  BANNER = 'BANNER',
  NATIVE = 'NATIVE',
  VIDEO = 'VIDEO',
  RICH_MEDIA = 'RICH_MEDIA',
}

/**
 * Floor price configuration
 */
export class FloorPriceConfigDto {
  @IsNumber()
  @Min(0)
  basePrice: number;

  @IsString()
  currency: string;
}

/**
 * Ad slot template info for CDN
 */
export class AdSlotTemplateInfoDto {
  @IsUUID()
  id: string;

  @IsString()
  name: string;

  @IsNumber()
  width: number;

  @IsNumber()
  height: number;

  @IsEnum(AdFormat)
  format: AdFormat;

  @IsString()
  size: string; // e.g., "728x90"
}

/**
 * Inventory selector mapping
 */
export class InventorySelectorDto {
  @IsUUID()
  inventoryId: string;

  @IsString()
  selector: string;

  @IsOptional()
  @IsString()
  customSelector?: string;

  @IsEnum(AdPosition)
  position: AdPosition;

  @IsOptional()
  @IsNumber()
  @Min(1)
  instanceNumber?: number; // For multiple same-position ads
}

/**
 * Inventory mapping request
 */
export class MapInventorySelectorsDto {
  @IsUUID()
  websiteId: string;

  @IsOptional()
  @IsObject()
  selectorPrefix?: {
    prefix: string;
    useCustom: boolean;
  };
}

/**
 * Inventory configuration for CDN build
 */
export class InventoryBuildConfigDto {
  @IsUUID()
  id: string;

  @IsString()
  name: string;

  @ValidateNested()
  @Type(() => AdSlotTemplateInfoDto)
  template: AdSlotTemplateInfoDto;

  @IsEnum(AdPosition)
  position: AdPosition;

  @ValidateNested()
  @Type(() => FloorPriceConfigDto)
  floorPrice: FloorPriceConfigDto;

  @IsString()
  selector: string;

  @IsOptional()
  @IsObject()
  targeting?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  viewabilityScore?: number;
}