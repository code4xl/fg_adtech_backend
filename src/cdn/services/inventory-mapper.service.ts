import { Injectable, Logger } from '@nestjs/common';
import { IInventoryConfig } from '../interfaces';
import { PublisherTier, AdPosition, RefreshConfigDto } from '../dto';
import { TIER_FEATURES, POSITION_SELECTOR_MAP } from '../constants/cdn.constants';

/**
 * Service responsible for mapping database inventory records
 * to SDK configuration format
 */
@Injectable()
export class InventoryMapperService {
  private readonly logger = new Logger(InventoryMapperService.name);

  /**
   * Map database inventory records to SDK configuration format
   */
  async mapInventoryToConfig(
    inventoryRecords: any[],
    publisherTier: PublisherTier,
  ): Promise<IInventoryConfig[]> {
    this.logger.debug(`Mapping ${inventoryRecords.length} inventory records for ${publisherTier} tier`);

    const tierFeatures = TIER_FEATURES[publisherTier];
    const mappedInventory: IInventoryConfig[] = [];

    // Apply tier-based inventory limit
    const maxSlots = tierFeatures.maxInventorySlots;
    const recordsToProcess = maxSlots === -1 
      ? inventoryRecords 
      : inventoryRecords.slice(0, maxSlots);

    for (const record of recordsToProcess) {
      const config = this.mapSingleInventory(record, publisherTier);
      if (config) {
        mappedInventory.push(config);
      }
    }

    this.logger.debug(`Mapped ${mappedInventory.length} inventory configurations`);
    return mappedInventory;
  }

  /**
   * Map a single inventory record to configuration
   */
  private mapSingleInventory(record: any, tier: PublisherTier): IInventoryConfig | null {
    try {
      // Skip if no template
      if (!record.adSlotTemplate) {
        this.logger.warn(`Inventory ${record.id} has no ad slot template, skipping`);
        return null;
      }

      // Skip if no floor price (required for any tier)
      const floorPrice = record.floorPrices?.[0];
      if (!floorPrice) {
        this.logger.debug(`Inventory ${record.id} has no active floor price, skipping`);
        return null;
      }

      const template = record.adSlotTemplate;
      // floorPrice already defined above

      // Build base configuration
      const config: IInventoryConfig = {
        selector: '', // Will be set by selector generator
        inventoryId: record.id,
        size: `${template.width}x${template.height}`,
        position: record.position || AdPosition.ABOVE_FOLD,
      };

      // Add refresh configuration based on tier
      config.refresh = this.buildRefreshConfig(record, tier);

      // Add custom targeting for premium/enterprise tiers
      if (tier !== PublisherTier.BASIC && record.customTargeting) {
        config.customTargeting = this.sanitizeCustomTargeting(record.customTargeting);
      }

      return config;
    } catch (error) {
      this.logger.error(`Error mapping inventory ${record.id}: ${error.message}`);
      return null;
    }
  }

  /**
   * Build refresh configuration based on inventory settings and tier
   */
  private buildRefreshConfig(record: any, tier: PublisherTier): RefreshConfigDto {
    const tierFeatures = TIER_FEATURES[tier];
    const defaultInterval = tierFeatures.refreshInterval;

    // Check if refresh is disabled for this inventory
    if (record.refreshSettings?.enabled === false) {
      return { enabled: false };
    }

    // For basic tier, use default settings
    if (tier === PublisherTier.BASIC) {
      return {
        enabled: true,
        interval: defaultInterval,
      };
    }

    // For premium/enterprise, use custom settings if available
    const customInterval = record.refreshSettings?.interval;
    const interval = customInterval && customInterval >= defaultInterval 
      ? customInterval 
      : defaultInterval;

    return {
      enabled: true,
      interval,
    };
  }

  /**
   * Sanitize custom targeting data
   */
  private sanitizeCustomTargeting(targeting: any): Record<string, any> {
    if (!targeting || typeof targeting !== 'object') {
      return {};
    }

    const sanitized: Record<string, any> = {};
    
    // Only include allowed targeting keys
    const allowedKeys = [
      'demographics',
      'interests',
      'geography',
      'device',
      'dayparting',
      'contextual',
    ];

    for (const key of allowedKeys) {
      if (key in targeting) {
        sanitized[key] = this.sanitizeTargetingValue(targeting[key]);
      }
    }

    return sanitized;
  }

  /**
   * Sanitize individual targeting values
   */
  private sanitizeTargetingValue(value: any): any {
    if (Array.isArray(value)) {
      return value.filter(v => typeof v === 'string' || typeof v === 'number');
    }
    
    if (typeof value === 'object' && value !== null) {
      const sanitized: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) {
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
          sanitized[k] = v;
        }
      }
      return sanitized;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    return null;
  }

  /**
   * Group inventory by position for selector generation
   */
  groupInventoryByPosition(inventory: IInventoryConfig[]): Map<string, IInventoryConfig[]> {
    const grouped = new Map<string, IInventoryConfig[]>();

    for (const item of inventory) {
      const position = item.position || AdPosition.ABOVE_FOLD;
      if (!grouped.has(position)) {
        grouped.set(position, []);
      }
      grouped.get(position)!.push(item);
    }

    return grouped;
  }

  /**
   * Calculate inventory statistics
   */
  calculateInventoryStats(inventory: IInventoryConfig[]): {
    total: number;
    byPosition: Record<string, number>;
    bySize: Record<string, number>;
    refreshEnabled: number;
  } {
    const stats = {
      total: inventory.length,
      byPosition: {} as Record<string, number>,
      bySize: {} as Record<string, number>,
      refreshEnabled: 0,
    };

    for (const item of inventory) {
      // Count by position
      const position = item.position || 'unknown';
      stats.byPosition[position] = (stats.byPosition[position] || 0) + 1;

      // Count by size
      const size = item.size || 'unknown';
      stats.bySize[size] = (stats.bySize[size] || 0) + 1;

      // Count refresh enabled
      if (item.refresh?.enabled) {
        stats.refreshEnabled++;
      }
    }

    return stats;
  }
}