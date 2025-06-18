import { PublisherTier, AdPosition, AdFormat, SdkFeature } from '../dto';

/**
 * Publisher configuration interface
 */
export interface IPublisherConfig {
  id: string;
  tier: PublisherTier;
}

/**
 * Website configuration interface
 */
export interface IWebsiteConfig {
  id: string;
  domain: string;
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
 * Complete Ocean SDK configuration interface
 * This is what gets embedded as window.__OCEAN_CONFIG__
 */
export interface IOceanConfig {
  publisher: IPublisherConfig;
  website: IWebsiteConfig;
  inventory: IInventoryConfig[];
  settings: ISdkSettings;
}

/**
 * CDN file metadata interface
 */
export interface ICdnFileMetadata {
  publisherId: string;
  websiteId: string;
  version: string;
  buildId: string;
  integrity: string;
  createdAt: Date;
  expiresAt?: Date;
  environment: string;
  fileSize: number;
  inventoryCount: number;
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
}

/**
 * CDN build context interface
 */
export interface ICdnBuildContext {
  publisherId: string;
  websiteId: string;
  environment: string;
  forceRebuild: boolean;
  includeDebug: boolean;
  timestamp: Date;
  requestId: string;
}

/**
 * CDN build result interface
 */
export interface ICdnBuildResult {
  success: boolean;
  cdnUrl?: string;
  integrity?: string;
  version?: string;
  buildId?: string;
  error?: string;
  metadata?: ICdnFileMetadata;
}