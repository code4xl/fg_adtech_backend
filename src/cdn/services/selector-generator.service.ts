import { Injectable, Logger } from '@nestjs/common';
import { IInventoryConfig, IInventoryMapping } from '../interfaces';
import { AdPosition } from '../dto';
import { POSITION_SELECTOR_MAP } from '../constants/cdn.constants';

/**
 * Service responsible for generating CSS selectors for inventory items
 * based on their positions and handling conflicts
 */
@Injectable()
export class SelectorGeneratorService {
  private readonly logger = new Logger(SelectorGeneratorService.name);

  /**
   * Generate selectors for all inventory items
   */
  generateSelectors(
    inventory: IInventoryConfig[],
    websiteDomain: string,
    options?: {
      prefix?: string;
      useCustomSelectors?: boolean;
    },
  ): IInventoryConfig[] {
    this.logger.log(`Generating selectors for ${inventory.length} inventory items on ${websiteDomain}`);

    const positionCounts = new Map<string, number>();
    const inventoryWithSelectors: IInventoryConfig[] = [];

    // Sort inventory by position to ensure consistent ordering
    const sortedInventory = [...inventory].sort((a, b) => {
      const posA = a.position || AdPosition.ABOVE_FOLD;
      const posB = b.position || AdPosition.ABOVE_FOLD;
      return posA.localeCompare(posB);
    });

    for (const item of sortedInventory) {
      const selector = this.generateSelector(
        item,
        positionCounts,
        options?.prefix,
        options?.useCustomSelectors,
      );

      inventoryWithSelectors.push({
        ...item,
        selector,
      });
    }

    this.logger.log(`Generated selectors for ${inventoryWithSelectors.length} items`);
    return inventoryWithSelectors;
  }

  /**
   * Generate selector mappings for inventory
   */
  generateSelectorMappings(
    inventory: IInventoryConfig[],
    options?: {
      prefix?: string;
      groupByPosition?: boolean;
    },
  ): IInventoryMapping[] {
    const mappings: IInventoryMapping[] = [];
    const positionCounts = new Map<string, number>();

    for (const item of inventory) {
      const position = item.position as AdPosition || AdPosition.ABOVE_FOLD;
      const count = positionCounts.get(position) || 0;
      positionCounts.set(position, count + 1);

      const mapping: IInventoryMapping = {
        inventoryId: item.inventoryId,
        selector: this.buildSelector(position, count + 1, options?.prefix),
        position,
      };

      if (count > 0) {
        mapping.instanceNumber = count + 1;
      }

      if (item.customTargeting?.customSelector) {
        mapping.customSelector = item.customTargeting.customSelector;
      }

      mappings.push(mapping);
    }

    return mappings;
  }

  /**
   * Generate a single selector for an inventory item
   */
  private generateSelector(
    item: IInventoryConfig,
    positionCounts: Map<string, number>,
    prefix?: string,
    useCustom?: boolean,
  ): string {
    // Check for custom selector first
    if (useCustom && item.customTargeting?.customSelector) {
      return this.validateSelector(item.customTargeting.customSelector);
    }

    const position = item.position as AdPosition || AdPosition.ABOVE_FOLD;
    const count = positionCounts.get(position) || 0;
    positionCounts.set(position, count + 1);

    return this.buildSelector(position, count + 1, prefix);
  }

  /**
   * Build a selector based on position and instance number
   */
  private buildSelector(
    position: AdPosition,
    instanceNumber: number,
    prefix?: string,
  ): string {
    const baseSelector = POSITION_SELECTOR_MAP[position] || '.ocean-ad';
    const prefixedSelector = prefix ? `${prefix}-${baseSelector.substring(1)}` : baseSelector;

    // Add instance number if not the first instance
    if (instanceNumber > 1) {
      return `${prefixedSelector}-${instanceNumber}`;
    }

    return prefixedSelector;
  }

  /**
   * Validate a custom selector
   */
  private validateSelector(selector: string): string {
    // Remove any potentially dangerous characters
    const cleaned = selector
      .trim()
      .replace(/[<>\"\']/g, '')
      .replace(/\s+/g, ' ');

    // Ensure it starts with a valid CSS selector character
    if (!/^[.#\[\w]/.test(cleaned)) {
      return `.ocean-ad-${this.generateSafeId(cleaned)}`;
    }

    return cleaned;
  }

  /**
   * Generate a safe ID from a string
   */
  private generateSafeId(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Generate HTML snippet for publisher integration guide
   */
  generateIntegrationSnippet(
    selectors: string[],
    websiteDomain: string,
  ): string {
    const uniqueSelectors = [...new Set(selectors)];
    const snippets: string[] = [];

    for (const selector of uniqueSelectors) {
      if (selector.startsWith('.')) {
        snippets.push(`<div class="${selector.substring(1)}"></div>`);
      } else if (selector.startsWith('#')) {
        snippets.push(`<div id="${selector.substring(1)}"></div>`);
      } else {
        snippets.push(`<!-- Custom selector: ${selector} -->`);
      }
    }

    return `<!-- Ocean Ads integration for ${websiteDomain} -->
${snippets.join('\n')}

<!-- Load Ocean Ads SDK -->
<script src="https://cdn.oceanads.com/p/{publisherId}/init.js"></script>`;
  }

  /**
   * Check for selector conflicts
   */
  detectSelectorConflicts(inventory: IInventoryConfig[]): {
    hasConflicts: boolean;
    conflicts: Array<{ selector: string; inventoryIds: string[] }>;
  } {
    const selectorMap = new Map<string, string[]>();
    
    for (const item of inventory) {
      if (!selectorMap.has(item.selector)) {
        selectorMap.set(item.selector, []);
      }
      selectorMap.get(item.selector)!.push(item.inventoryId);
    }

    const conflicts: Array<{ selector: string; inventoryIds: string[] }> = [];
    
    for (const [selector, inventoryIds] of selectorMap.entries()) {
      if (inventoryIds.length > 1) {
        conflicts.push({ selector, inventoryIds });
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
    };
  }

  /**
   * Generate position-based statistics
   */
  generatePositionStats(inventory: IInventoryConfig[]): Record<string, {
    count: number;
    selectors: string[];
    averageRefreshInterval?: number;
  }> {
    const stats: Record<string, any> = {};

    for (const item of inventory) {
      const position = item.position || 'unknown';
      
      if (!stats[position]) {
        stats[position] = {
          count: 0,
          selectors: [],
          refreshIntervals: [],
        };
      }

      stats[position].count++;
      stats[position].selectors.push(item.selector);
      
      if (item.refresh?.interval) {
        stats[position].refreshIntervals.push(item.refresh.interval);
      }
    }

    // Calculate averages and clean up
    for (const position of Object.keys(stats)) {
      const intervals = stats[position].refreshIntervals;
      
      if (intervals.length > 0) {
        stats[position].averageRefreshInterval = 
          Math.round(intervals.reduce((a: number, b: number) => a + b, 0) / intervals.length);
      }
      
      delete stats[position].refreshIntervals;
    }

    return stats;
  }
}