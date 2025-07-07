import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryMapperService } from './inventory-mapper.service';
import { SelectorGeneratorService } from './selector-generator.service';
import {
  IOceanConfig,
  IOceanConfigV2,
  ITierFeatures,
  IInventoryConfig,
  ISdkSettings,
  IConfigValidationResult,
  IConfigMigrationResult,
} from '../interfaces';
import {
  PublisherTier,
  PublisherSdkConfigDto,
  SettingsConfigDto,
} from '../dto';
import { TIER_FEATURES, CDN_ERROR_CODES } from '../constants/cdn.constants';

/**
 * Service responsible for building publisher SDK configurations
 * from database data
 */
@Injectable()
export class ConfigBuilderService {
  private readonly logger = new Logger(ConfigBuilderService.name);
  private readonly defaultApiUrl: string;
  private readonly defaultSseTimeout: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly inventoryMapper: InventoryMapperService,
    private readonly selectorGenerator: SelectorGeneratorService,
  ) {
    // Determine if we're in local development
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isLocalDev = nodeEnv === 'development' || nodeEnv !== 'production';
    
    if (isLocalDev) {
      // Use local development URLs - force localhost for development
      this.defaultApiUrl = 'http://localhost:3001';
      this.logger.log('🔧 Using local development API URL: ' + this.defaultApiUrl);
    } else {
      // Use production URLs
      this.defaultApiUrl = this.configService.get<string>('CDN_API_URL', 'http://localhost:3001');
      this.logger.log('🚀 Using production API URL: ' + this.defaultApiUrl);
    }
    
    this.defaultSseTimeout = this.configService.get<number>('CDN_SSE_TIMEOUT', 15000);
  }

  /**
   * Build V2 SDK configuration for a publisher with ALL websites
   * This is the main method for Phase 2 multi-website support
   */
  async buildPublisherConfiguration(
    publisherId: string,
    options?: {
      includeDebug?: boolean;
      environment?: string;
      websiteIds?: string[]; // Optional filter for specific websites
    },
  ): Promise<IOceanConfigV2> {
    this.logger.log(`Building V2 configuration for publisher: ${publisherId}`);

    // Fetch publisher with ALL websites and inventories
    const publisherData = await this.fetchPublisherWithAllWebsites(publisherId, options?.websiteIds);
    
    // Validate publisher status
    this.validatePublisherStatus(publisherData);
    
    // Get publisher tier (default to BASIC if not set)
    // Note: Publisher model might not have tier field yet, so we default to BASIC
    const publisherTier = (publisherData as any).tier || PublisherTier.BASIC;
    
    // Transform websites to V2 configuration format
    const websites: Record<string, {
      id: string;
      inventory: IInventoryConfig[];
      isActive: boolean;
    }> = {};
    
    for (const website of publisherData.websites) {
      // Map inventory to SDK configuration format
      const inventoryConfigs = await this.inventoryMapper.mapInventoryToConfig(
        website.inventories,
        publisherTier,
      );

      // Generate selectors for inventory
      const inventoryWithSelectors = this.selectorGenerator.generateSelectors(
        inventoryConfigs,
        website.domain || website.url || '',
      );

      websites[website.domain || website.url || 'localhost'] = {
        id: website.id,
        inventory: inventoryWithSelectors,
        isActive: website.isActive,
      };
    }

    // Build unified settings
    const settings = this.buildSettings(
      publisherTier,
      options?.includeDebug || false,
    );

    // Generate version and build metadata
    const version = this.generateVersion();
    const buildId = this.generateBuildId(publisherId);

    // Construct V2 configuration
    const configV2: IOceanConfigV2 = {
      publisher: {
        id: publisherData.id,
        tier: publisherTier,
      },
      websites,
      settings,
      meta: {
        version,
        buildId,
        generatedAt: Date.now(),
      },
    };

    // Validate the V2 configuration
    const validation = this.validatePublisherConfiguration(configV2);
    if (!validation.isValid) {
      throw new BadRequestException(
        `V2 Configuration validation failed: ${validation.errors.join(', ')}`,
        CDN_ERROR_CODES.VALIDATION_ERROR,
      );
    }

    this.logger.log(
      `V2 Configuration built successfully for publisher ${publisherId}: ${validation.websiteCount} websites, ${validation.inventoryCount} total inventory slots`,
    );

    return configV2;
  }

  /**
   * Legacy method: Build complete SDK configuration for a publisher and website
   * Maintained for backward compatibility
   */
  async buildConfiguration(
    publisherId: string,
    websiteId: string,
    options?: {
      includeDebug?: boolean;
      environment?: string;
    },
  ): Promise<IOceanConfig> {
    this.logger.log(`Building configuration for publisher: ${publisherId}, website: ${websiteId}`);

    // Fetch publisher with website and inventory data
    const publisherData = await this.fetchPublisherData(publisherId, websiteId);
    
    // Validate publisher and website status
    this.validatePublisherStatus(publisherData);
    
    // Get website from publisher data
    const website = publisherData.website;
    if (!website) {
      throw new NotFoundException(
        `Website ${websiteId} not found for publisher ${publisherId}`,
        CDN_ERROR_CODES.WEBSITE_NOT_FOUND,
      );
    }

    // Map inventory to SDK configuration format  
    // For now, we'll use a default tier since Publisher model doesn't have tier field
    const defaultTier = PublisherTier.BASIC;
    const inventoryConfigs = await this.inventoryMapper.mapInventoryToConfig(
      website.inventories,
      defaultTier,
    );

    // Generate selectors for inventory
    const inventoryWithSelectors = this.selectorGenerator.generateSelectors(
      inventoryConfigs,
      website.domain || website.url || '',
    );

    // Build settings based on tier
    const settings = this.buildSettings(
      defaultTier,
      options?.includeDebug || false,
    );

    // Construct final configuration
    const config: IOceanConfig = {
      publisher: {
        id: publisherData.id,
        tier: defaultTier,
      },
      website: {
        id: website.id,
        domain: website.domain || website.url || '',
      },
      inventory: inventoryWithSelectors,
      settings,
    };

    this.logger.log(`Configuration built successfully for ${publisherId}`);
    return config;
  }

  /**
   * Build configurations for all websites of a publisher
   */
  async buildAllConfigurations(
    publisherId: string,
    options?: {
      includeDebug?: boolean;
      environment?: string;
    },
  ): Promise<Map<string, IOceanConfig>> {
    this.logger.log(`Building all configurations for publisher: ${publisherId}`);

    // First verify publisher exists
    const publisher = await this.prisma.publisher.findUnique({
      where: { id: publisherId },
    });

    if (!publisher) {
      throw new NotFoundException(
        `Publisher ${publisherId} not found`,
        CDN_ERROR_CODES.PUBLISHER_NOT_FOUND,
      );
    }

    // Get all active websites for the publisher
    const websites = await this.prisma.website.findMany({
      where: { 
        publisherId: publisherId,
        isActive: true 
      },
      include: {
        inventories: {
          where: { isActive: true },
          include: {
            adSlotTemplate: true,
            floorPrices: {
              where: {
                OR: [
                  { endDate: null },
                  { endDate: { gte: new Date() } },
                ],
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    const configurations = new Map<string, IOceanConfig>();

    for (const website of websites) {
      const config = await this.buildConfiguration(
        publisherId,
        website.id,
        options,
      );
      configurations.set(website.id, config);
    }

    return configurations;
  }

  /**
   * Validate configuration against tier limits
   */
  validateConfiguration(config: IOceanConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const tierFeatures = TIER_FEATURES[config.publisher.tier];

    // Check inventory slot limit
    if (
      tierFeatures.maxInventorySlots !== -1 &&
      config.inventory.length > tierFeatures.maxInventorySlots
    ) {
      errors.push(
        `Inventory count (${config.inventory.length}) exceeds tier limit (${tierFeatures.maxInventorySlots})`,
      );
    }

    // Validate selectors
    const selectorSet = new Set<string>();
    for (const inv of config.inventory) {
      if (selectorSet.has(inv.selector)) {
        errors.push(`Duplicate selector found: ${inv.selector}`);
      }
      selectorSet.add(inv.selector);
    }

    // Validate refresh intervals
    for (const inv of config.inventory) {
      if (inv.refresh?.enabled && inv.refresh.interval) {
        if (inv.refresh.interval < tierFeatures.refreshInterval) {
          errors.push(
            `Refresh interval ${inv.refresh.interval}ms is below tier minimum ${tierFeatures.refreshInterval}ms`,
          );
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Fetch publisher data with all necessary relations
   */
  private async fetchPublisherData(publisherId: string, websiteId: string) {
    // First verify publisher exists
    const publisher = await this.prisma.publisher.findUnique({
      where: { id: publisherId },
    });

    if (!publisher) {
      throw new NotFoundException(
        `Publisher ${publisherId} not found`,
        CDN_ERROR_CODES.PUBLISHER_NOT_FOUND,
      );
    }

    // Get the specific website with its inventories
    const website = await this.prisma.website.findUnique({
      where: { 
        id: websiteId,
        publisherId: publisherId 
      },
      include: {
        inventories: {
          where: { isActive: true },
          include: {
            adSlotTemplate: true,
            floorPrices: {
              where: {
                AND: [
                  {
                    OR: [
                      { endDate: null },
                      { endDate: { gte: new Date() } },
                    ],
                  },
                  { startDate: { lte: new Date() } }, // Add this line!
                ],
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!website) {
      throw new NotFoundException(
        `Website ${websiteId} not found for publisher ${publisherId}`,
        CDN_ERROR_CODES.WEBSITE_NOT_FOUND,
      );
    }

    // Return combined data
    return {
      ...publisher,
      website,
    };
  }

  /**
   * Validate publisher and website status
   */
  private validatePublisherStatus(publisher: any): void {
    if (publisher.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Publisher is not active. Current status: ${publisher.status}`,
        CDN_ERROR_CODES.PERMISSION_DENIED,
      );
    }

    const website = publisher.website;
    if (website && !website.isActive) {
      throw new BadRequestException(
        `Website is not active. Current status: ${website.isActive ? 'active' : 'inactive'}`,
        CDN_ERROR_CODES.PERMISSION_DENIED,
      );
    }
  }

  /**
   * Build SDK settings based on publisher tier
   */
  private buildSettings(tier: PublisherTier, debug: boolean): ISdkSettings {
    const tierFeatures = TIER_FEATURES[tier];
    
    // Force debug mode in development
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isDevelopment = nodeEnv === 'development' || nodeEnv !== 'production';
    const debugMode = isDevelopment ? true : debug;
    
    const settings: ISdkSettings = {
      apiUrl: this.defaultApiUrl,
      endpoints: {
        bid: `${this.defaultApiUrl}/rtb/bid-request`,
        track: `${this.defaultApiUrl}/rtb/track`,
        sse: `${this.defaultApiUrl}/rtb/stream`,
      },
      sseTimeout: this.defaultSseTimeout,
      debug: debugMode,
      batchDelay: 50,
      maxRetries: tier === PublisherTier.BASIC ? 1 : 3,
      fallbackTimeout: 500,
    };

    // Add tier-specific settings
    if (tier === PublisherTier.ENTERPRISE) {
      settings.batchDelay = 25;
      settings.sseTimeout = 20000; // 20 seconds for enterprise
    } else if (tier === PublisherTier.PREMIUM) {
      settings.batchDelay = 35;
      settings.sseTimeout = 18000; // 18 seconds for premium
    }
    // Basic tier uses default 15000ms

    this.logger.log(`🎯 SDK settings built for ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'}:`, {
      apiUrl: settings.apiUrl,
      bid: settings.endpoints.bid,
      track: settings.endpoints.track,
      sse: settings.endpoints.sse,
      debug: settings.debug,
    });

    return settings;
  }

  /**
   * Get tier features for a publisher
   */
  getTierFeatures(tier: PublisherTier): ITierFeatures {
    const features = TIER_FEATURES[tier];
    
    return {
      tier,
      features: [...features.features] as any[], // Create a copy to avoid readonly issues
      maxInventorySlots: features.maxInventorySlots,
      refreshInterval: features.refreshInterval,
      analyticsEnabled: features.features.includes('performanceAnalytics' as any),
      customTargetingEnabled: tier !== PublisherTier.BASIC,
      headerBiddingEnabled: features.features.includes('headerBidding' as any),
    };
  }

  /**
   * Fetch publisher data with ALL websites for V2 configuration
   */
  private async fetchPublisherWithAllWebsites(
    publisherId: string,
    websiteIds?: string[],
  ) {
    // Fetch publisher with all websites and inventories
    const publisherData = await this.prisma.publisher.findUnique({
      where: { id: publisherId },
      include: {
        websites: {
          where: {
            isActive: true,
            ...(websiteIds ? { id: { in: websiteIds } } : {}),
          },
          include: {
            inventories: {
              where: { isActive: true },
              include: {
                adSlotTemplate: true,
                floorPrices: {
                  where: {
                    AND: [
                      {
                        OR: [
                          { endDate: null },
                          { endDate: { gte: new Date() } },
                        ],
                      },
                      { startDate: { lte: new Date() } },
                    ],
                  },
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!publisherData) {
      throw new NotFoundException(
        `Publisher ${publisherId} not found`,
        CDN_ERROR_CODES.PUBLISHER_NOT_FOUND,
      );
    }

    if (publisherData.websites.length === 0) {
      throw new NotFoundException(
        `No active websites found for publisher ${publisherId}`,
        CDN_ERROR_CODES.WEBSITE_NOT_FOUND,
      );
    }

    return publisherData;
  }

  /**
   * Validate V2 publisher configuration
   */
  validatePublisherConfiguration(config: IOceanConfigV2): IConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let totalInventoryCount = 0;
    const websiteCount = Object.keys(config.websites).length;

    // Get tier features
    const tierFeatures = TIER_FEATURES[config.publisher.tier];

    // Validate each website
    for (const [domain, website] of Object.entries(config.websites)) {
      // Validate domain format
      if (!domain || domain.trim() === '') {
        errors.push(`Invalid domain: '${domain}'`);
      }

      // Count inventory
      totalInventoryCount += website.inventory.length;

      // Check for duplicate selectors within website
      const selectorSet = new Set<string>();
      for (const inv of website.inventory) {
        if (selectorSet.has(inv.selector)) {
          errors.push(`Duplicate selector '${inv.selector}' found in website ${domain}`);
        }
        selectorSet.add(inv.selector);

        // Validate refresh intervals
        if (inv.refresh?.enabled && inv.refresh.interval) {
          if (inv.refresh.interval < tierFeatures.refreshInterval) {
            errors.push(
              `Refresh interval ${inv.refresh.interval}ms in ${domain} is below tier minimum ${tierFeatures.refreshInterval}ms`,
            );
          }
        }
      }
    }

    // Check total inventory limit
    if (
      tierFeatures.maxInventorySlots !== -1 &&
      totalInventoryCount > tierFeatures.maxInventorySlots
    ) {
      errors.push(
        `Total inventory count (${totalInventoryCount}) exceeds tier limit (${tierFeatures.maxInventorySlots})`,
      );
    }

    // Validate publisher configuration
    if (!config.publisher.id || !config.publisher.tier) {
      errors.push('Invalid publisher configuration');
    }

    // Validate settings
    if (!config.settings.apiUrl || !config.settings.sseTimeout) {
      errors.push('Invalid settings configuration');
    }

    // Validate meta
    if (!config.meta.version || !config.meta.buildId) {
      errors.push('Invalid meta configuration');
    }

    // Add warnings for best practices
    if (websiteCount > 50) {
      warnings.push(`Large number of websites (${websiteCount}) may impact performance`);
    }

    if (totalInventoryCount > 100) {
      warnings.push(`Large number of inventory slots (${totalInventoryCount}) may impact performance`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      websiteCount,
      inventoryCount: totalInventoryCount,
    };
  }

  /**
   * Migrate V1 configuration to V2 format
   */
  async migrateV1ToV2(v1Config: IOceanConfig): Promise<IConfigMigrationResult> {
    try {
      const warnings: string[] = [];
      const migrationNotes: string[] = [];

      // Create V2 structure from V1
      const websites: Record<string, {
        id: string;
        inventory: IInventoryConfig[];
        isActive: boolean;
      }> = {};

      // Migrate single website to multi-website format
      websites[v1Config.website.domain] = {
        id: v1Config.website.id,
        inventory: v1Config.inventory,
        isActive: true,
      };

      const v2Config: IOceanConfigV2 = {
        publisher: v1Config.publisher,
        websites,
        settings: v1Config.settings,
        meta: {
          version: this.generateVersion(),
          buildId: this.generateBuildId(v1Config.publisher.id),
          generatedAt: Date.now(),
        },
      };

      migrationNotes.push('Successfully migrated single website to multi-website format');
      migrationNotes.push(`Website domain: ${v1Config.website.domain}`);
      migrationNotes.push(`Inventory slots: ${v1Config.inventory.length}`);

      return {
        success: true,
        v2Config,
        warnings,
        migrationNotes,
      };
    } catch (error) {
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Generate version string
   */
  private generateVersion(): string {
    const date = new Date();
    const major = 2; // V2 configuration
    const minor = date.getMonth() + 1;
    const patch = date.getDate();
    return `${major}.${minor}.${patch}`;
  }

  /**
   * Generate unique build ID
   */
  private generateBuildId(publisherId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${publisherId.substring(0, 8)}-${timestamp}-${random}`;
  }
}