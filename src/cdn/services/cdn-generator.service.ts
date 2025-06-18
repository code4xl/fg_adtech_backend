import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IOceanConfig, ICdnBuildResult, ICdnBuildContext } from '../interfaces';
import { BuildEnvironment } from '../dto';
import { VERSION_FORMAT, CDN_ERROR_CODES } from '../constants/cdn.constants';

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
    this.sdkBuildPath = this.configService.get<string>(
      'cdn.sdkBuildPath',
      './dist/sdk/ocean-ads.min.js',
    );
  }

  /**
   * Generate CDN build for a publisher configuration
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
    const baseUrl = this.configService.get<string>(
      'CDN_BASE_URL',
      'https://cdn.oceanads.com',
    );

    const envPrefix = environment === BuildEnvironment.PRODUCTION ? '' : `${environment}/`;
    
    return `${baseUrl}/${envPrefix}p/${publisherId}/init.js`;
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