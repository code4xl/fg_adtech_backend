/**
 * CDN-related constants
 */

/**
 * SDK Configuration
 */
export const SDK_CONFIG = {
  // Default paths for different environments
  DEFAULT_PATHS: {
    // Docker development paths (when backend runs in Docker)
    DOCKER_DEV: '/usr/src/sdk-project/dist/ocean-ads.min.js',
    DOCKER_FALLBACK: '/usr/src/app/sdk/ocean-ads.min.js',
    
    // Local development - adjust this path to match your setup
    LOCAL_WINDOWS: 'C:\\Users\\Shaikh Asif\\OneDrive\\Desktop\\PaidProjects\\ocean-ads-sdk-v2\\dist\\ocean-ads.min.js',
    LOCAL_RELATIVE: '../ocean-ads-sdk-v2/dist/ocean-ads.min.js',
    LOCAL_FALLBACK: './dist/sdk/ocean-ads.min.js',
    
    // Production paths
    PRODUCTION: '/app/sdk/ocean-ads.min.js',
    DOCKER: '/app/sdk/ocean-ads.min.js',
    NPM_PACKAGE: './node_modules/@ocean-ads/sdk/dist/ocean-ads.min.js',
  },
  
  // SDK validation
  MIN_FILE_SIZE: 1024, // 1KB minimum
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB maximum
  CACHE_DURATION: 300000, // 5 minutes
} as const;

/**
 * CDN URL Configuration
 */
export const CDN_URL_CONFIG = {
  // Local development URLs
  LOCAL: {
    BASE_URL: 'http://localhost:3001', // Your backend port (fixed from 3000)
    PATH_PREFIX: '/cdn',
  },
  
  // Production URLs
  PRODUCTION: {
    BASE_URL: 'https://cdn.oceanads.com',
    PATH_PREFIX: '',
  },
} as const;

/**
 * Default CDN configuration values
 */
export const CDN_DEFAULTS = {
    CACHE_TTL: 3600, // 1 hour in seconds
    MAX_FILE_SIZE: 1024 * 1024, // 1MB
    BUILD_TIMEOUT: 30000, // 30 seconds
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000, // 1 second
  } as const;
  
  /**
   * CDN file paths
   */
  export const CDN_PATHS = {
    BASE_PATH: '/cdn',
    PUBLISHER_PATH: '/p',
    INIT_SCRIPT: 'init.js',
    CONFIG_FILE: 'config.json',
    METADATA_FILE: 'metadata.json',
  } as const;
  
  /**
   * CDN content types
   */
  export const CDN_CONTENT_TYPES = {
    JAVASCRIPT: 'application/javascript',
    JSON: 'application/json',
    TEXT: 'text/plain',
  } as const;
  
  /**
   * CDN cache keys
   */
  export const CDN_CACHE_KEYS = {
    PREFIX: 'cdn:',
    CONFIG: 'config:',
    BUILD: 'build:',
    METADATA: 'metadata:',
    INVALIDATION: 'invalidation:',
  } as const;
  
  /**
   * CDN headers
   */
  export const CDN_HEADERS = {
    CACHE_CONTROL: {
      PUBLIC: 'public, max-age=3600',
      PRIVATE: 'private, no-cache',
      IMMUTABLE: 'public, max-age=31536000, immutable',
    },
    CORS: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
    SECURITY: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy': "default-src 'self'",
    },
  } as const;
  
  /**
   * Inventory position to selector mapping
   */
  export const POSITION_SELECTOR_MAP = {
    ABOVE_FOLD: '.ocean-ad-header',
    BELOW_FOLD: '.ocean-ad-footer',
    SIDEBAR: '.ocean-ad-sidebar',
    IN_ARTICLE: '.ocean-ad-content',
    STICKY: '.ocean-ad-sticky',
    INTERSTITIAL: '.ocean-ad-interstitial',
  } as const;
  
  /**
   * Publisher tier feature mapping
   */
  export const TIER_FEATURES = {
    basic: {
      maxInventorySlots: 5,
      refreshInterval: 60000, // 1 minute
      features: ['lazyLoading', 'viewabilityTracking'],
    },
    premium: {
      maxInventorySlots: 20,
      refreshInterval: 30000, // 30 seconds
      features: [
        'lazyLoading',
        'viewabilityTracking',
        'refreshOptimization',
        'consentManagement',
        'performanceAnalytics',
      ],
    },
    enterprise: {
      maxInventorySlots: -1, // unlimited
      refreshInterval: 15000, // 15 seconds
      features: [
        'lazyLoading',
        'viewabilityTracking',
        'refreshOptimization',
        'headerBidding',
        'consentManagement',
        'adBlockerDetection',
        'performanceAnalytics',
      ],
    },
  } as const;
  
  /**
   * Build version format
   */
  export const VERSION_FORMAT = {
    PATTERN: /^\d+\.\d+\.\d+$/,
    SEPARATOR: '.',
    DEFAULT: '1.0.0',
  } as const;
  
  /**
   * Error codes
   */
  export const CDN_ERROR_CODES = {
    PUBLISHER_NOT_FOUND: 'CDN001',
    WEBSITE_NOT_FOUND: 'CDN002',
    INVENTORY_NOT_FOUND: 'CDN003',
    BUILD_FAILED: 'CDN004',
    STORAGE_ERROR: 'CDN005',
    CACHE_ERROR: 'CDN006',
    VALIDATION_ERROR: 'CDN007',
    PERMISSION_DENIED: 'CDN008',
    RATE_LIMIT_EXCEEDED: 'CDN009',
    INVALID_CONFIGURATION: 'CDN010',
  } as const;
  
  /**
   * CDN event names for logging/monitoring
   */
  export const CDN_EVENTS = {
    BUILD_STARTED: 'cdn.build.started',
    BUILD_COMPLETED: 'cdn.build.completed',
    BUILD_FAILED: 'cdn.build.failed',
    CACHE_HIT: 'cdn.cache.hit',
    CACHE_MISS: 'cdn.cache.miss',
    INVALIDATION_REQUESTED: 'cdn.invalidation.requested',
    FILE_SERVED: 'cdn.file.served',
    ERROR_OCCURRED: 'cdn.error.occurred',
  } as const;