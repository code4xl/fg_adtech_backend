import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IOceanConfig, IOceanConfigV2, ICdnBuildResult, ICdnBuildContext } from '../interfaces';
import { BuildEnvironment } from '../dto';
import { VERSION_FORMAT, CDN_ERROR_CODES, SDK_CONFIG, CDN_URL_CONFIG } from '../constants/cdn.constants';

/**
 * Service responsible for generating CDN files by wrapping
 * the SDK with publisher-specific configurations
 */
@Injectable()
export class CdnGeneratorService {
  private readonly logger = new Logger(CdnGeneratorService.name);
  private readonly sdkBuildPath: string;
  private readonly sdkCache: Map<string, { content: string; hash: string }> = new Map();

  constructor(private readonly configService: ConfigService) {
    // Try environment variable first, then fallback to default paths
    const envPath = this.configService.get<string>('SDK_BUILD_PATH');
    
    if (envPath) {
      this.sdkBuildPath = envPath;
      this.logger.log(`Using SDK path from environment: ${envPath}`);
    } else {
      // Auto-detect based on platform and existence
      this.sdkBuildPath = this.detectSdkPath();
      this.logger.log(`Auto-detected SDK path: ${this.sdkBuildPath}`);
    }
    
    // Validate SDK path on startup
    this.validateSdkFile().then(result => {
      if (result.isValid) {
        this.logger.log('✅ SDK file validated successfully');
      } else {
        this.logger.error(`❌ SDK file validation failed: ${result.error}`);
        this.logger.error('🔧 Please check your SDK_BUILD_PATH environment variable');
      }
    });
  }

  /**
   * Auto-detect SDK path based on platform and file existence
   */
  private detectSdkPath(): string {
    const isDocker = process.env.DOCKER_ENV === 'true' || 
                     process.cwd().includes('/usr/src/app') ||
                     process.env.HOSTNAME?.includes('nestjs');

    const paths: string[] = [];

    if (isDocker) {
      // Docker environment - prioritize Docker paths
      paths.push(
        SDK_CONFIG.DEFAULT_PATHS.DOCKER_DEV,
        SDK_CONFIG.DEFAULT_PATHS.DOCKER_FALLBACK,
        SDK_CONFIG.DEFAULT_PATHS.PRODUCTION,
      );
      this.logger.log('🐳 Docker environment detected, using Docker SDK paths');
    } else {
      // Local environment - use local paths
      paths.push(
        SDK_CONFIG.DEFAULT_PATHS.LOCAL_WINDOWS,
        SDK_CONFIG.DEFAULT_PATHS.LOCAL_RELATIVE,
        SDK_CONFIG.DEFAULT_PATHS.LOCAL_FALLBACK,
        SDK_CONFIG.DEFAULT_PATHS.NPM_PACKAGE,
      );
      this.logger.log('💻 Local environment detected, using local SDK paths');
    }

    // For production environments
    if (process.env.NODE_ENV === 'production') {
      paths.unshift(SDK_CONFIG.DEFAULT_PATHS.PRODUCTION);
    }

    // Return first path (we'll validate it later in the validation method)
    const selectedPath = paths[0];
    this.logger.log(`🎯 Selected SDK path: ${selectedPath}`);
    
    return selectedPath;
  }

  /**
   * Generate CDN build for V2 publisher configuration (multi-website)
   */
  async generateV2Build(
    config: IOceanConfigV2,
    context: ICdnBuildContext,
  ): Promise<ICdnBuildResult> {
    try {
      this.logger.log(
        `Generating V2 CDN build for publisher ${context.publisherId} with ${Object.keys(config.websites).length} websites`,
      );

      // Read SDK content
      const sdkContent = await this.readSdkContent();

      // Generate V2 configuration script
      const configScript = this.generateV2ConfigScript(config, context);

      // Combine SDK and configuration
      const cdnContent = this.combineSdkAndConfig(sdkContent, configScript, context);

      // Generate version and integrity
      const version = config.meta.version;
      const integrity = this.generateIntegrity(cdnContent);
      const buildId = config.meta.buildId;

      this.logger.log(`V2 CDN build generated successfully: ${buildId}`);

      return {
        success: true,
        cdnUrl: this.generateCdnUrl(context.publisherId, context.environment),
        integrity,
        version,
        buildId,
        websiteCount: Object.keys(config.websites).length,
        domains: Object.keys(config.websites),
        metadata: {
          publisherId: context.publisherId,
          websiteIds: Object.values(config.websites).map(w => w.id),
          domains: Object.keys(config.websites),
          version,
          buildId,
          integrity,
          createdAt: new Date(),
          environment: context.environment,
          fileSize: Buffer.byteLength(cdnContent, 'utf8'),
          inventoryCount: Object.values(config.websites).reduce((total, website) => total + website.inventory.length, 0),
          websiteCount: Object.keys(config.websites).length,
        },
      };
    } catch (error) {
      this.logger.error(`V2 CDN build generation failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate the complete V2 CDN content
   */
  async generateV2CdnContent(
    config: IOceanConfigV2,
    context: ICdnBuildContext,
  ): Promise<string> {
    const sdkContent = await this.readSdkContent();
    const configScript = this.generateV2ConfigScript(config, context);
    return this.combineSdkAndConfig(sdkContent, configScript, context);
  }

  /**
   * Legacy method: Generate CDN build for a publisher configuration
   * Maintained for backward compatibility
   */
  async generateBuild(
    config: IOceanConfig,
    context: ICdnBuildContext,
  ): Promise<ICdnBuildResult> {
    try {
      this.logger.log(
        `Generating CDN build for publisher ${context.publisherId}, website ${context.websiteId}`,
      );

      // Read SDK content
      const sdkContent = await this.readSdkContent();

      // Generate configuration script
      const configScript = this.generateConfigScript(config, context);

      // Combine SDK and configuration
      const cdnContent = this.combineSdkAndConfig(sdkContent, configScript, context);

      // Generate version and integrity
      const version = this.generateVersion(config, context);
      const integrity = this.generateIntegrity(cdnContent);

      // Generate build ID
      const buildId = this.generateBuildId(context);

      this.logger.log(`CDN build generated successfully: ${buildId}`);

      return {
        success: true,
        cdnUrl: this.generateCdnUrl(context.publisherId, context.environment),
        integrity,
        version,
        buildId,
        metadata: {
          publisherId: context.publisherId,
          websiteId: context.websiteId,
          version,
          buildId,
          integrity,
          createdAt: new Date(),
          environment: context.environment,
          fileSize: Buffer.byteLength(cdnContent, 'utf8'),
          inventoryCount: config.inventory.length,
        },
      };
    } catch (error) {
      this.logger.error(`CDN build generation failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate the complete CDN content
   */
  async generateCdnContent(
    config: IOceanConfig,
    context: ICdnBuildContext,
  ): Promise<string> {
    const sdkContent = await this.readSdkContent();
    const configScript = this.generateConfigScript(config, context);
    return this.combineSdkAndConfig(sdkContent, configScript, context);
  }

  /**
   * Read SDK content from build directory
   */
  private async readSdkContent(): Promise<string> {
    // Check cache first
    const cached = this.sdkCache.get(this.sdkBuildPath);
    if (cached) {
      const stats = await fs.stat(this.sdkBuildPath);
      const currentHash = createHash('md5')
        .update(stats.mtime.toISOString())
        .digest('hex');

      if (cached.hash === currentHash) {
        this.logger.debug('Using cached SDK content');
        return cached.content;
      }
    }

    // Read from file
    try {
      const content = await fs.readFile(this.sdkBuildPath, 'utf8');
      const stats = await fs.stat(this.sdkBuildPath);
      const hash = createHash('md5')
        .update(stats.mtime.toISOString())
        .digest('hex');

      // Update cache
      this.sdkCache.set(this.sdkBuildPath, { content, hash });

      return content;
    } catch (error) {
      throw new Error(
        `Failed to read SDK file from ${this.sdkBuildPath}: ${error.message}`,
      );
    }
  }

  /**
   * Generate configuration script to embed in CDN
   */
  private generateConfigScript(
    config: IOceanConfig,
    context: ICdnBuildContext,
  ): string {
    const configJson = JSON.stringify(config, null, context.includeDebug ? 2 : 0);

    const script = `
/*!
 * Ocean Ads SDK Configuration
 * Publisher: ${config.publisher.id}
 * Website: ${config.website.domain}
 * Generated: ${new Date().toISOString()}
 * Version: ${this.generateVersion(config, context)}
 * Environment: ${context.environment}
 */
(function() {
  'use strict';
  
  // Embed configuration
  window.__OCEAN_CONFIG__ = ${configJson};
  
  // Configuration validation
  if (typeof window.__OCEAN_CONFIG__ !== 'object' || !window.__OCEAN_CONFIG__) {
    console.error('[Ocean Ads] Invalid configuration');
    return;
  }
  
  // Debug mode logging
  if (window.__OCEAN_CONFIG__.settings.debug) {
    console.log('[Ocean Ads] Configuration loaded:', window.__OCEAN_CONFIG__);
  }
})();
`;

    return context.includeDebug ? script : this.minifyScript(script);
  }

  /**
   * Generate V2 configuration script to embed in CDN (multi-website)
   */
  private generateV2ConfigScript(
    config: IOceanConfigV2,
    context: ICdnBuildContext,
  ): string {
    const configJson = JSON.stringify(config, null, context.includeDebug ? 2 : 0);
    const websiteCount = Object.keys(config.websites).length;
    const totalInventory = Object.values(config.websites).reduce((total, website) => total + website.inventory.length, 0);

    const script = `
/*!
 * Ocean Ads SDK V2 Configuration
 * Publisher: ${config.publisher.id}
 * Websites: ${websiteCount}
 * Total Inventory: ${totalInventory}
 * Generated: ${new Date().toISOString()}
 * Version: ${config.meta.version}
 * Build ID: ${config.meta.buildId}
 * Environment: ${context.environment}
 */
(function() {
  'use strict';
  
  // Embed V2 configuration
  window.__OCEAN_CONFIG__ = ${configJson};
  
  // Configuration validation
  if (typeof window.__OCEAN_CONFIG__ !== 'object' || !window.__OCEAN_CONFIG__) {
    console.error('[Ocean Ads] Invalid V2 configuration');
    return;
  }
  
  // V2 configuration type validation
  if (!window.__OCEAN_CONFIG__.websites || typeof window.__OCEAN_CONFIG__.websites !== 'object') {
    console.error('[Ocean Ads] Invalid V2 configuration: missing websites');
    return;
  }
  
  if (!window.__OCEAN_CONFIG__.meta || typeof window.__OCEAN_CONFIG__.meta !== 'object') {
    console.error('[Ocean Ads] Invalid V2 configuration: missing meta');
    return;
  }
  
  // Debug mode logging
  if (window.__OCEAN_CONFIG__.settings.debug) {
    console.log('[Ocean Ads V2] Configuration loaded:');
    console.log('  Publisher:', window.__OCEAN_CONFIG__.publisher.id);
    console.log('  Websites:', ${websiteCount});
    console.log('  Total Inventory:', ${totalInventory});
    console.log('  Version:', window.__OCEAN_CONFIG__.meta.version);
    console.log('  Build ID:', window.__OCEAN_CONFIG__.meta.buildId);
    console.log('  Current Domain:', window.location.hostname);
    
    // Log available domains
    const domains = Object.keys(window.__OCEAN_CONFIG__.websites);
    console.log('  Available Domains:', domains);
    
    // Check domain match
    const currentDomain = window.location.hostname;
    const matchedDomain = domains.find(domain => 
      domain === currentDomain || 
      domain.includes('*') && currentDomain.match(domain.replace(/\*/g, '.*'))
    );
    
    if (matchedDomain) {
      console.log('  Domain Match:', matchedDomain);
      console.log('  Website ID:', window.__OCEAN_CONFIG__.websites[matchedDomain].id);
      console.log('  Inventory Count:', window.__OCEAN_CONFIG__.websites[matchedDomain].inventory.length);
    } else {
      console.warn('[Ocean Ads V2] No domain match found for:', currentDomain);
    }
  }
})();
`;

    return context.includeDebug ? script : this.minifyScript(script);
  }

  /**
   * Combine SDK and configuration into final CDN content
   */
  private combineSdkAndConfig(
    sdkContent: string,
    configScript: string,
    context: ICdnBuildContext,
  ): string {
    const header = this.generateHeader(context);
    const footer = this.generateFooter();

    return `${header}\n${configScript}\n${sdkContent}\n${footer}`;
  }

  /**
   * Generate CDN file header
   */
  private generateHeader(context: ICdnBuildContext): string {
    return `/*!
 * Ocean Ads SDK
 * Copyright (c) ${new Date().getFullYear()} Ocean Ads Network
 * Publisher: ${context.publisherId}
 * Build: ${context.environment}
 * Generated: ${new Date().toISOString()}
 */`;
  }

  /**
   * Generate CDN file footer
   */
  private generateFooter(): string {
    return `
// Ocean Ads SDK initialization complete
if (typeof window.__OCEAN_INIT__ === 'function') {
  window.__OCEAN_INIT__();
}`;
  }

  /**
   * Minify JavaScript content
   */
  private minifyScript(script: string): string {
    // Simple minification - in production, use a proper minifier
    return script
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/\s*([{}();,:])\s*/g, '$1') // Remove spaces around syntax
      .trim();
  }

  /**
   * Generate version string
   */
  private generateVersion(
    config: IOceanConfig,
    context: ICdnBuildContext,
  ): string {
    const date = new Date();
    const major = date.getFullYear() - 2024; // Start from 0 in 2024
    const minor = date.getMonth() + 1;
    const patch = date.getDate();

    return `${major}.${minor}.${patch}`;
  }

  /**
   * Generate integrity hash for subresource integrity
   */
  private generateIntegrity(content: string): string {
    const hash = createHash('sha384')
      .update(content, 'utf8')
      .digest('base64');

    return `sha384-${hash}`;
  }

  /**
   * Generate unique build ID
   */
  private generateBuildId(context: ICdnBuildContext): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    
    return `${context.publisherId.substring(0, 8)}-${timestamp}-${random}`;
  }

  /**
   * Generate CDN URL for the build
   */
  private generateCdnUrl(publisherId: string, environment: string): string {
    // Determine if we're in local development
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isLocalDev = nodeEnv === 'development' || environment === BuildEnvironment.DEVELOPMENT;
    
    // Get base URL from environment or use defaults
    let baseUrl: string;
    let pathPrefix: string;
    
    if (isLocalDev) {
      // Local development configuration
      baseUrl = this.configService.get<string>('CDN_BASE_URL', CDN_URL_CONFIG.LOCAL.BASE_URL);
      pathPrefix = this.configService.get<string>('CDN_PATH_PREFIX', CDN_URL_CONFIG.LOCAL.PATH_PREFIX);
      
      this.logger.log(`🔧 Using local CDN URL for development: ${baseUrl}${pathPrefix}`);
    } else {
      // Production configuration
      baseUrl = this.configService.get<string>('CDN_BASE_URL', CDN_URL_CONFIG.PRODUCTION.BASE_URL);
      pathPrefix = this.configService.get<string>('CDN_PATH_PREFIX', CDN_URL_CONFIG.PRODUCTION.PATH_PREFIX);
    }

    // Build the complete URL
    const envPrefix = environment === BuildEnvironment.PRODUCTION ? '' : `${environment}/`;
    const fullPath = pathPrefix ? `${pathPrefix}/p/${publisherId}/init.js` : `p/${publisherId}/init.js`;
    
    return `${baseUrl}/${envPrefix}${fullPath}`.replace(/\/+/g, '/').replace(':/', '://');
  }

  /**
   * Validate SDK file exists and is readable
   */
  async validateSdkFile(): Promise<{ isValid: boolean; error?: string }> {
    try {
      await fs.access(this.sdkBuildPath, fs.constants.R_OK);
      const stats = await fs.stat(this.sdkBuildPath);

      if (!stats.isFile()) {
        return { isValid: false, error: 'SDK path is not a file' };
      }

      if (stats.size === 0) {
        return { isValid: false, error: 'SDK file is empty' };
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: error.message };
    }
  }

  /**
   * Clear SDK cache
   */
  clearSdkCache(): void {
    this.sdkCache.clear();
    this.logger.log('SDK cache cleared');
  }
}