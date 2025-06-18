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
   * Generate and deploy CDN for a publisher website
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
}