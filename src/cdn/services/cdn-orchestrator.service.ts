import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigBuilderService } from './config-builder.service';
import { CdnGeneratorService } from './cdn-generator.service';
import { CdnStorageService } from './cdn-storage.service';
import { CdnCacheService } from './cdn-cache.service';
import {
  ICdnBuildContext,
  ICdnBuildResult,
  IOceanConfig,
  IOceanConfigV2,
} from '../interfaces';
import { GenerateCdnDto, BuildEnvironment } from '../dto';

/**
 * Orchestrator service that coordinates the entire CDN build process
 * Combines configuration building, file generation, storage, and caching
 */
@Injectable()
export class CdnOrchestratorService {
  private readonly logger = new Logger(CdnOrchestratorService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly configBuilder: ConfigBuilderService,
    private readonly cdnGenerator: CdnGeneratorService,
    private readonly cdnStorage: CdnStorageService,
    private readonly cdnCache: CdnCacheService,
  ) {}

  /**
   * Generate and deploy V2 CDN for entire publisher (all websites)
   * This is the main method for Phase 2 multi-website support
   */
  async generatePublisherCdn(
    publisherId: string,
    options?: {
      environment?: BuildEnvironment;
      includeDebug?: boolean;
      forceRebuild?: boolean;
      websiteIds?: string[]; // Optional filter for specific websites
    },
  ): Promise<ICdnBuildResult> {
    const startTime = Date.now();
    
    this.logger.log(
      `Starting V2 CDN generation for publisher ${publisherId}`,
    );

    try {
      // Check cache first (unless force rebuild)
      if (!options?.forceRebuild) {
        const cached = await this.cdnCache.getBuild(publisherId);
        if (cached) {
          this.logger.log('Serving publisher CDN from cache');
          return {
            success: true,
            cdnUrl: this.buildCdnUrl(publisherId, options?.environment),
            integrity: cached.metadata.integrity,
            version: cached.metadata.version,
            buildId: cached.metadata.buildId,
            metadata: cached.metadata,
            websiteCount: cached.metadata.websiteCount,
            domains: cached.metadata.domains,
          };
        }
      }

      // Build V2 configuration for publisher
      const config = await this.buildV2Configuration(publisherId, options);

      // Validate configuration
      const validation = this.configBuilder.validatePublisherConfiguration(config);
      if (!validation.isValid) {
        throw new Error(`V2 Configuration validation failed: ${validation.errors.join(', ')}`);
      }

      this.logger.log(
        `V2 Configuration validated: ${validation.websiteCount} websites, ${validation.inventoryCount} total inventory slots`,
      );

      // Generate CDN content
      const buildContext = this.createV2BuildContext(publisherId, options);
      const cdnContent = await this.cdnGenerator.generateV2CdnContent(config, buildContext);
      const buildResult = await this.cdnGenerator.generateV2Build(config, buildContext);

      if (!buildResult.success) {
        throw new Error(buildResult.error || 'V2 CDN generation failed');
      }

      // Store CDN file with V2 metadata
      const storageMetadata = await this.cdnStorage.storeFile(
        publisherId,
        cdnContent,
        buildResult.metadata!,
        {
          environment: options?.environment || BuildEnvironment.PRODUCTION,
          overwrite: true,
        },
      );

      // Store V2 metadata
      await this.cdnStorage.storeMetadata(
        publisherId,
        buildResult.metadata!,
        options?.environment || BuildEnvironment.PRODUCTION,
      );

      // Update cache with V2 configuration
      await Promise.all([
        this.cdnCache.cacheBuild(publisherId, cdnContent, buildResult.metadata!),
        // Cache each website individually for backward compatibility
        ...Object.entries(config.websites).map(([domain, website]) => 
          this.cdnCache.cacheConfiguration(publisherId, website.id, {
            publisher: config.publisher,
            website: { id: website.id, domain },
            inventory: website.inventory,
            settings: config.settings,
          }),
        ),
      ]);

      const duration = Date.now() - startTime;
      this.logger.log(
        `V2 CDN generation completed in ${duration}ms for publisher ${publisherId}: ${buildResult.websiteCount} websites`,
      );

      return buildResult;
    } catch (error) {
      this.logger.error(`V2 CDN generation failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Add single website to existing publisher CDN
   */
  async addWebsiteToPublisherCdn(
    publisherId: string,
    websiteId: string,
    options?: {
      environment?: BuildEnvironment;
      includeDebug?: boolean;
    },
  ): Promise<ICdnBuildResult> {
    this.logger.log(`Adding website ${websiteId} to publisher ${publisherId} CDN`);

    // Regenerate entire publisher CDN to include new website
    return this.generatePublisherCdn(publisherId, {
      ...options,
      forceRebuild: true,
    });
  }

  /**
   * Remove website from publisher CDN
   */
  async removeWebsiteFromPublisherCdn(
    publisherId: string,
    websiteId: string,
    options?: {
      environment?: BuildEnvironment;
      includeDebug?: boolean;
    },
  ): Promise<ICdnBuildResult> {
    this.logger.log(`Removing website ${websiteId} from publisher ${publisherId} CDN`);

    // Invalidate caches
    await this.cdnCache.invalidateConfiguration(publisherId, websiteId);
    await this.cdnCache.invalidateBuild(publisherId);

    // Regenerate CDN without the removed website
    return this.generatePublisherCdn(publisherId, {
      ...options,
      forceRebuild: true,
    });
  }

  /**
   * Legacy method: Generate and deploy CDN for a publisher website
   * Maintained for backward compatibility
   */
  async generateAndDeployDN(dto: GenerateCdnDto): Promise<ICdnBuildResult> {
    const startTime = Date.now();
    
    this.logger.log(
      `Starting CDN generation for publisher ${dto.publisherId}, website ${dto.websiteId}`,
    );

    try {
      // Step 1: Check cache first (unless force rebuild)
      if (!dto.forceRebuild) {
        const cached = await this.cdnCache.getBuild(dto.publisherId);
        if (cached) {
          this.logger.log('Serving CDN from cache');
          return {
            success: true,
            cdnUrl: this.buildCdnUrl(dto.publisherId, dto.environment),
            integrity: cached.metadata.integrity,
            version: cached.metadata.version,
            buildId: cached.metadata.buildId,
            metadata: cached.metadata,
          };
        }
      }

      // Step 2: Build configuration
      const config = await this.buildConfiguration(dto);

      // Step 3: Validate configuration
      const validation = this.configBuilder.validateConfiguration(config);
      if (!validation.isValid) {
        throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
      }

      // Step 4: Generate CDN content
      const buildContext = this.createBuildContext(dto);
      const cdnContent = await this.cdnGenerator.generateCdnContent(config, buildContext);
      const buildResult = await this.cdnGenerator.generateBuild(config, buildContext);

      if (!buildResult.success) {
        throw new Error(buildResult.error || 'CDN generation failed');
      }

      // Step 5: Store CDN file
      const storageMetadata = await this.cdnStorage.storeFile(
        dto.publisherId,
        cdnContent,
        buildResult.metadata!,
        {
          environment: dto.environment,
          overwrite: true,
        },
      );

      // Step 6: Store metadata
      await this.cdnStorage.storeMetadata(
        dto.publisherId,
        buildResult.metadata!,
        dto.environment,
      );

      // Step 7: Update cache
      await Promise.all([
        this.cdnCache.cacheConfiguration(dto.publisherId, dto.websiteId, config),
        this.cdnCache.cacheBuild(dto.publisherId, cdnContent, buildResult.metadata!),
      ]);

      const duration = Date.now() - startTime;
      this.logger.log(
        `CDN generation completed in ${duration}ms for publisher ${dto.publisherId}`,
      );

      return buildResult;
    } catch (error) {
      this.logger.error(`CDN generation failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Regenerate CDN for all websites of a publisher
   */
  async regenerateAllPublisherCdn(
    publisherId: string,
    options?: {
      environment?: BuildEnvironment;
      includeDebug?: boolean;
    },
  ): Promise<Map<string, ICdnBuildResult>> {
    this.logger.log(`Regenerating CDN for all websites of publisher ${publisherId}`);

    const results = new Map<string, ICdnBuildResult>();

    try {
      // Get all configurations
      const configs = await this.configBuilder.buildAllConfigurations(publisherId, {
        includeDebug: options?.includeDebug,
        environment: options?.environment,
      });

      // Generate CDN for each website
      for (const [websiteId, config] of configs) {
        const dto: GenerateCdnDto = {
          publisherId,
          websiteId,
          environment: options?.environment,
          forceRebuild: true,
          includeDebug: options?.includeDebug,
        };

        const result = await this.generateAndDeployDN(dto);
        results.set(websiteId, result);
      }

      // Warm cache with all configurations
      await this.cdnCache.warmCache(publisherId, configs);

      return results;
    } catch (error) {
      this.logger.error(`Failed to regenerate all CDN: ${error.message}`);
      throw error;
    }
  }

  /**
   * Invalidate CDN cache and optionally regenerate
   */
  async invalidateAndRegenerate(
    publisherId: string,
    websiteId?: string,
    regenerate = true,
  ): Promise<void> {
    this.logger.log(
      `Invalidating CDN for publisher ${publisherId}${websiteId ? `, website ${websiteId}` : ''}`,
    );

    // Invalidate cache
    if (websiteId) {
      await this.cdnCache.invalidateConfiguration(publisherId, websiteId);
      await this.cdnCache.invalidateBuild(publisherId);
    } else {
      await this.cdnCache.invalidateAll(publisherId);
    }

    // Regenerate if requested
    if (regenerate) {
      if (websiteId) {
        await this.generateAndDeployDN({
          publisherId,
          websiteId,
          forceRebuild: true,
        });
      } else {
        await this.regenerateAllPublisherCdn(publisherId);
      }
    }
  }

  /**
   * Get CDN status for a publisher
   */
  async getCdnStatus(
    publisherId: string,
    websiteId?: string,
  ): Promise<{
    hasCache: boolean;
    hasStorage: boolean;
    metadata?: any;
    cacheStats?: any;
  }> {
    const hasCache = websiteId
      ? (await this.cdnCache.getConfiguration(publisherId, websiteId)) !== null
      : (await this.cdnCache.getBuild(publisherId)) !== null;

    const hasStorage = await this.cdnStorage.fileExists(publisherId);
    
    const metadata = await this.cdnStorage.retrieveMetadata(publisherId);
    
    const cacheStats = await this.cdnCache.getCacheStats();

    return {
      hasCache,
      hasStorage,
      metadata,
      cacheStats,
    };
  }

  /**
   * Serve CDN content
   */
  async serveCdnContent(
    publisherId: string,
    environment?: string,
  ): Promise<{ content: string; headers: Record<string, string> } | null> {
    try {
      // Try cache first
      const cached = await this.cdnCache.getBuild(publisherId);
      if (cached) {
        this.logger.debug(`Serving CDN from cache for ${publisherId}`);
        return {
          content: cached.content,
          headers: this.generateCdnHeaders(cached.metadata),
        };
      }

      // Fallback to storage
      const stored = await this.cdnStorage.retrieveFile(publisherId, environment);
      if (stored) {
        this.logger.debug(`Serving CDN from storage for ${publisherId}`);
        
        // Update cache for next time
        const metadata = await this.cdnStorage.retrieveMetadata(publisherId, environment);
        if (metadata) {
          await this.cdnCache.cacheBuild(publisherId, stored.content, metadata);
        }

        return {
          content: stored.content,
          headers: this.generateCdnHeaders(stored.metadata),
        };
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to serve CDN content: ${error.message}`);
      return null;
    }
  }

  /**
   * Build configuration using config builder
   */
  private async buildConfiguration(dto: GenerateCdnDto): Promise<IOceanConfig> {
    // Check cache first
    if (!dto.forceRebuild) {
      const cached = await this.cdnCache.getConfiguration(dto.publisherId, dto.websiteId);
      if (cached) {
        return cached;
      }
    }

    // Build fresh configuration
    return this.configBuilder.buildConfiguration(dto.publisherId, dto.websiteId, {
      includeDebug: dto.includeDebug,
      environment: dto.environment,
    });
  }

  /**
   * Create build context from DTO
   */
  private createBuildContext(dto: GenerateCdnDto): ICdnBuildContext {
    return {
      publisherId: dto.publisherId,
      websiteId: dto.websiteId,
      environment: dto.environment || BuildEnvironment.PRODUCTION,
      forceRebuild: dto.forceRebuild || false,
      includeDebug: dto.includeDebug || false,
      timestamp: new Date(),
      requestId: `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    };
  }

  /**
   * Build CDN URL
   */
  private buildCdnUrl(publisherId: string, environment?: string): string {
    const baseUrl = this.configService.get<string>('cdn.baseUrl', 'http://localhost:3000/cdn');
    const envPath = environment && environment !== BuildEnvironment.PRODUCTION 
      ? `${environment}/` 
      : '';
    
    return `${baseUrl}/${envPath}p/${publisherId}/init.js`;
  }

  /**
   * Generate CDN headers
   */
  private generateCdnHeaders(metadata: any): Record<string, string> {
    return {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Origin, X-Requested-With',
      'Access-Control-Max-Age': '86400',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'ETag': metadata.integrity || metadata.etag || '',
      'Last-Modified': metadata.lastModified || new Date().toUTCString(),
    };
  }

  /**
   * Build V2 configuration using config builder
   */
  private async buildV2Configuration(
    publisherId: string,
    options?: {
      includeDebug?: boolean;
      environment?: string;
      websiteIds?: string[];
    },
  ): Promise<IOceanConfigV2> {
    // Check cache first
    if (!options?.websiteIds) {
      // Only use cache if not filtering specific websites
      const cached = await this.cdnCache.getBuild(publisherId);
      if (cached && cached.metadata.version?.startsWith('2.')) {
        // Parse the cached V2 configuration from the content
        try {
          const configMatch = cached.content.match(/window\.__OCEAN_CONFIG__\s*=\s*({[\s\S]*?});/);
          if (configMatch) {
            const config = JSON.parse(configMatch[1]);
            if (config.websites && config.meta) {
              return config as IOceanConfigV2;
            }
          }
        } catch (error) {
          this.logger.warn('Failed to parse cached V2 configuration, rebuilding');
        }
      }
    }

    // Build fresh V2 configuration
    return this.configBuilder.buildPublisherConfiguration(publisherId, {
      includeDebug: options?.includeDebug,
      environment: options?.environment,
      websiteIds: options?.websiteIds,
    });
  }

  /**
   * Create V2 build context
   */
  private createV2BuildContext(
    publisherId: string,
    options?: {
      environment?: BuildEnvironment;
      includeDebug?: boolean;
    },
  ): ICdnBuildContext {
    return {
      publisherId,
      websiteIds: undefined, // V2 context includes all websites
      environment: options?.environment || BuildEnvironment.PRODUCTION,
      forceRebuild: true, // Always force rebuild for V2
      includeDebug: options?.includeDebug || false,
      timestamp: new Date(),
      requestId: `v2-req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    };
  }
}