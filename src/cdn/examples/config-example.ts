/**
 * Example usage of the Configuration Builder Service
 * This demonstrates how the services work together to build SDK configurations
 */

import { PublisherTier, AdPosition } from '../dto';
import { IOceanConfig } from '../interfaces';

/**
 * Example database data structure (as returned by Prisma)
 */
const examplePublisherData = {
  id: '8e29ce27-a54f-4b90-9216-82ef72a9f22b',
  name: 'TechBlog Publishers',
  status: 'ACTIVE',
  tier: 'premium',
  websites: [
    {
      id: '37d16797-d706-4eef-a3eb-a0aed5f3a567',
      domain: 'techblog.com',
      status: 'VERIFIED',
      adInventory: [
        {
          id: 'af8fabe5-3f73-4a3b-a6df-26aebfe41d28',
          name: 'Header Banner',
          position: 'ABOVE_FOLD',
          isActive: true,
          adSlotTemplate: {
            id: 'tpl-728x90',
            name: 'Leaderboard',
            width: 728,
            height: 90,
            format: 'BANNER',
          },
          floorPrice: [
            {
              basePrice: 1.50,
              currency: 'USD',
              endDate: null,
            },
          ],
          campaign: [
            { id: 'camp-1', status: 'ACTIVE', startDate: new Date('2024-01-01') },
          ],
          refreshSettings: {
            enabled: true,
            interval: 30000,
          },
        },
        {
          id: 'bf9fabe5-4f83-5a4b-b7ef-37bfcfe52d39',
          name: 'Sidebar Ad',
          position: 'SIDEBAR',
          isActive: true,
          adSlotTemplate: {
            id: 'tpl-300x250',
            name: 'Medium Rectangle',
            width: 300,
            height: 250,
            format: 'BANNER',
          },
          floorPrice: [
            {
              basePrice: 0.75,
              currency: 'USD',
              endDate: null,
            },
          ],
          campaign: [
            { id: 'camp-2', status: 'ACTIVE', startDate: new Date('2024-01-01') },
          ],
        },
        {
          id: 'cf0fbce6-5g94-6b5c-c8fg-48cgdgf63e4a',
          name: 'Footer Banner',
          position: 'BELOW_FOLD',
          isActive: true,
          adSlotTemplate: {
            id: 'tpl-728x90',
            name: 'Leaderboard',
            width: 728,
            height: 90,
            format: 'BANNER',
          },
          floorPrice: [
            {
              basePrice: 0.50,
              currency: 'USD',
              endDate: null,
            },
          ],
          campaign: [],
          customTargeting: {
            demographics: {
              ageGroups: ['25-34', '35-44'],
              interests: ['technology', 'gaming'],
            },
          },
        },
      ],
    },
  ],
};

/**
 * Example output configuration after processing
 */
const exampleOutputConfig: IOceanConfig = {
  publisher: {
    id: '8e29ce27-a54f-4b90-9216-82ef72a9f22b',
    tier: PublisherTier.PREMIUM,
  },
  website: {
    id: '37d16797-d706-4eef-a3eb-a0aed5f3a567',
    domain: 'techblog.com',
  },
  inventory: [
    {
      selector: '.ocean-ad-header',
      inventoryId: 'af8fabe5-3f73-4a3b-a6df-26aebfe41d28',
      size: '728x90',
      position: 'ABOVE_FOLD',
      refresh: {
        enabled: true,
        interval: 30000,
      },
    },
    {
      selector: '.ocean-ad-sidebar',
      inventoryId: 'bf9fabe5-4f83-5a4b-b7ef-37bfcfe52d39',
      size: '300x250',
      position: 'SIDEBAR',
      refresh: {
        enabled: true,
        interval: 30000, // Premium tier default
      },
    },
    {
      selector: '.ocean-ad-footer',
      inventoryId: 'cf0fbce6-5g94-6b5c-c8fg-48cgdgf63e4a',
      size: '728x90',
      position: 'BELOW_FOLD',
      refresh: {
        enabled: true,
        interval: 30000,
      },
      customTargeting: {
        demographics: {
          ageGroups: ['25-34', '35-44'],
          interests: ['technology', 'gaming'],
        },
      },
    },
  ],
  settings: {
    apiUrl: 'https://rtb.oceanads.com',
    sseTimeout: 200, // Premium tier setting
    debug: false,
    batchDelay: 35,
    maxRetries: 3,
    fallbackTimeout: 500,
  },
};

/**
 * Example with multiple same-position inventory
 */
const exampleMultiplePositions = {
  inventory: [
    {
      selector: '.ocean-ad-header',
      inventoryId: 'inv-1',
      size: '728x90',
      position: 'ABOVE_FOLD',
    },
    {
      selector: '.ocean-ad-header-2',
      inventoryId: 'inv-2',
      size: '728x90',
      position: 'ABOVE_FOLD',
    },
    {
      selector: '.ocean-ad-header-3',
      inventoryId: 'inv-3',
      size: '468x60',
      position: 'ABOVE_FOLD',
    },
  ],
};

/**
 * Example enterprise configuration with all features
 */
const exampleEnterpriseConfig: Partial<IOceanConfig> = {
  publisher: {
    id: 'enterprise-publisher-id',
    tier: PublisherTier.ENTERPRISE,
  },
  settings: {
    apiUrl: 'https://rtb.oceanads.com',
    sseTimeout: 150, // Fastest for enterprise
    debug: false,
    batchDelay: 25,
    maxRetries: 3,
    fallbackTimeout: 500,
  },
};

/**
 * Example validation result
 */
const exampleValidationResult = {
  isValid: true,
  errors: [],
  // Or with errors:
  // isValid: false,
  // errors: [
  //   'Inventory count (25) exceeds tier limit (20)',
  //   'Duplicate selector found: .ocean-ad-header',
  //   'Refresh interval 10000ms is below tier minimum 30000ms',
  // ],
};

export {
  examplePublisherData,
  exampleOutputConfig,
  exampleMultiplePositions,
  exampleEnterpriseConfig,
  exampleValidationResult,
};