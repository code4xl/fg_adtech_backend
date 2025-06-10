/**
 * SDK build information
 */
export interface ISdkBuildInfo {
    version: string;
    minified: boolean;
    size: number;
    hash: string;
    buildDate: Date;
  }
  
  /**
   * Publisher build metadata
   */
  export interface IPublisherBuildMetadata {
    publisherId: string;
    publisherName: string;
    tier: string;
    websites: IWebsiteBuildInfo[];
    totalInventorySlots: number;
    lastBuildDate: Date;
    buildsCount: number;
  }
  
  /**
   * Website build information
   */
  export interface IWebsiteBuildInfo {
    websiteId: string;
    domain: string;
    inventoryCount: number;
    lastBuildDate: Date;
    cdnUrl: string;
    version: string;
    status: 'active' | 'inactive' | 'pending';
  }
  
  /**
   * Build version information
   */
  export interface IBuildVersion {
    major: number;
    minor: number;
    patch: number;
    build: number;
    hash: string;
    timestamp: Date;
  }
  
  /**
   * Build statistics
   */
  export interface IBuildStatistics {
    totalBuilds: number;
    successfulBuilds: number;
    failedBuilds: number;
    averageBuildTime: number;
    lastBuildTime: number;
    cacheHitRate: number;
  }
  
  /**
   * Build error information
   */
  export interface IBuildError {
    code: string;
    message: string;
    timestamp: Date;
    publisherId?: string;
    websiteId?: string;
    stackTrace?: string;
    context?: Record<string, any>;
  }
  
  /**
   * Build queue item
   */
  export interface IBuildQueueItem {
    id: string;
    publisherId: string;
    websiteId: string;
    priority: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    attempts: number;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    error?: IBuildError;
  }
  
  /**
   * Build cache entry
   */
  export interface IBuildCacheEntry {
    key: string;
    value: string;
    metadata: ICdnFileMetadata;
    hits: number;
    lastAccessed: Date;
    expiresAt: Date;
  }
  
  /**
   * Build deployment info
   */
  export interface IBuildDeployment {
    deploymentId: string;
    environment: string;
    cdnUrl: string;
    publisherId: string;
    websiteId: string;
    version: string;
    deployedAt: Date;
    deployedBy: string;
    rollbackUrl?: string;
    isActive: boolean;
  }
  
  /**
   * Build validation result
   */
  export interface IBuildValidation {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    publisherId: string;
    websiteId: string;
    checkedAt: Date;
    configHash: string;
  }
  
  /**
   * CDN file storage metadata
   */
  export interface ICdnStorageMetadata {
    path: string;
    size: number;
    contentType: string;
    etag: string;
    lastModified: Date;
    storageClass?: string;
    encryption?: string;
    metadata?: Record<string, string>;
  }