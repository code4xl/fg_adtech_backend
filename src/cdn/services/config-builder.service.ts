import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryMapperService } from './inventory-mapper.service';
import { SelectorGeneratorService } from './selector-generator.service';
import {
  IOceanConfig,
  ITierFeatures,
  IInventoryConfig,
  ISdkSettings,
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
    
    this.defaultSseTimeout = this.configService.get<number>('CDN_SSE_TIMEOUT', 250);
  }

  /**
   * Build complete SDK configuration for a publisher and website
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
      settings.sseTimeout = 150;
    } else if (tier === PublisherTier.PREMIUM) {
      settings.batchDelay = 35;
      settings.sseTimeout = 200;
    }

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
}