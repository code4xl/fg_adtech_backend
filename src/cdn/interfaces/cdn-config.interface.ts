import { PublisherTier, AdPosition, AdFormat, SdkFeature } from '../dto';

/**
 * Publisher configuration interface
 */
export interface IPublisherConfig {
  id: string;
  tier: PublisherTier;
}

/**
 * Website configuration interface for multi-website support
 */
export interface IWebsiteConfig {
  id: string;
  isActive: boolean;
}

/**
 * Refresh configuration interface
 */
export interface IRefreshConfig {
  enabled: boolean;
  interval?: number;
}

/**
 * Inventory configuration interface
 */
export interface IInventoryConfig {
  selector: string;
  inventoryId: string;
  size?: string;
  refresh?: IRefreshConfig;
  position?: string;
  customTargeting?: Record<string, any>;
}

/**
 * SDK settings interface
 */
export interface ISdkSettings {
  apiUrl: string;
  endpoints?: {
    bid: string;
    track: string;
    sse?: string;
  };
  sseTimeout: number;
  debug?: boolean;
  batchDelay?: number;
  maxRetries?: number;
  fallbackTimeout?: number;
}

/**
 * V2 Ocean SDK configuration interface - Multi-Website Support
 * This is what gets embedded as window.__OCEAN_CONFIG__
 */
export interface IOceanConfigV2 {
  publisher: {
    id: string;
    tier: PublisherTier;
  };
  websites: {
    [domain: string]: {
      id: string;
      inventory: IInventoryConfig[];
      isActive: boolean;
    };
  };
  settings: ISdkSettings;
  meta: {
    version: string;
    buildId: string;
    generatedAt: number;
  };
}

/**
 * Legacy Ocean SDK configuration interface - Single Website
 * Maintained for backward compatibility
 */
export interface IOceanConfig {
  publisher: IPublisherConfig;
  website: {
    id: string;
    domain: string;
  };
  inventory: IInventoryConfig[];
  settings: ISdkSettings;
}

/**
 * CDN file metadata interface - Updated for multi-website support
 */
export interface ICdnFileMetadata {
  publisherId: string;
  websiteIds: string[]; // Changed from single websiteId to array
  websiteId?: string; // Legacy support for single website - deprecated
  domains: string[]; // Track all domains in this CDN
  version: string;
  buildId: string;
  integrity: string;
  createdAt: Date;
  expiresAt?: Date;
  environment: string;
  fileSize: number;
  inventoryCount: number;
  websiteCount: number; // New field
}

/**
 * CDN storage options interface
 */
export interface ICdnStorageOptions {
  type: 'local' | 's3';
  basePath: string;
  bucket?: string;
  region?: string;
  accessKey?: string;
  secretKey?: string;
}

/**
 * CDN cache options interface
 */
export interface ICdnCacheOptions {
  enabled: boolean;
  ttl: number;
  keyPrefix: string;
  invalidateOnUpdate: boolean;
}

/**
 * Publisher tier features interface
 */
export interface ITierFeatures {
  tier: PublisherTier;
  features: SdkFeature[];
  maxInventorySlots: number;
  refreshInterval: number;
  analyticsEnabled: boolean;
  customTargetingEnabled: boolean;
  headerBiddingEnabled: boolean;
}

/**
 * Inventory mapping result interface
 */
export interface IInventoryMapping {
  inventoryId: string;
  selector: string;
  position: AdPosition;
  instanceNumber?: number;
  customSelector?: string;
  websiteId: string; // New field to track which website this inventory belongs to
}

/**
 * CDN build context interface - Updated for multi-website
 */
export interface ICdnBuildContext {
  publisherId: string;
  websiteIds?: string[]; // Optional - if not provided, include all active websites
  websiteId?: string; // Legacy support for single website - deprecated
  environment: string;
  forceRebuild: boolean;
  includeDebug: boolean;
  timestamp: Date;
  requestId: string;
}

/**
 * CDN build result interface - Updated for multi-website
 */
export interface ICdnBuildResult {
  success: boolean;
  cdnUrl?: string;
  integrity?: string;
  version?: string;
  buildId?: string;
  error?: string;
  metadata?: ICdnFileMetadata;
  websiteCount?: number; // New field
  domains?: string[]; // New field
}

/**
 * Domain detection result interface
 */
export interface IDomainDetectionResult {
  websiteId: string | null;
  domain: string;
  matchType: 'direct' | 'subdomain' | 'wildcard' | 'none';
  confidence: number; // 0-1 scale
}

/**
 * Configuration validation result interface
 */
export interface IConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  websiteCount: number;
  inventoryCount: number;
}

/**
 * Migration helper interface for v1 to v2 config
 */
export interface IConfigMigrationResult {
  success: boolean;
  v2Config?: IOceanConfigV2;
  errors?: string[];
  warnings?: string[];
  migrationNotes?: string[];
}