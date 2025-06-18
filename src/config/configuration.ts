export default () => ({
  port: process.env.PORT == undefined ? 3000 : parseInt(process.env.PORT, 10),
  database: {
    url: process.env.DATABASE_URL,
  },
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'hard-to-guess-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '60m',
  },
  throttle: {
    ttl: process.env.THROTTLE_TTL
      ? parseInt(process.env.THROTTLE_TTL, 10)
      : 60000,
    limit: process.env.THROTTLE_LIMIT
      ? parseInt(process.env.THROTTLE_LIMIT, 10)
      : 10000,
  },
  auth: {
    verificationTokenExpiry: process.env.VERIFICATION_TOKEN_EXPIRY,
  },
  mail: {
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT ? parseInt(process.env.MAIL_PORT, 10) : 587,
    secure: process.env.MAIL_SECURE === 'true',
    user: process.env.MAIL_USER,
    password: process.env.MAIL_PASSWORD,
    from: process.env.MAIL_FROM,
  },
  error: {
    prefix: process.env.ERROR_PREFIX || 'Error',
  },
  template: {
    url: process.env.APP_URL,
  },
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
  },
  kafka: {
    brokers: process.env.KAFKA_BROKERS,
    topic: process.env.KAFKA_TOPIC,
  },
  AWS: {
    AWS_BUCKET_REGION: process.env.AWS_S3_BUCKET_REGION,
    AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  ai: {
    rateLimitWindow: process.env.AI_RATE_LIMIT_WINDOW
      ? parseInt(process.env.AI_RATE_LIMIT_WINDOW, 10)
      : 60000,
    maxRequestsPerWindow: process.env.AI_MAX_REQUESTS
      ? parseInt(process.env.AI_MAX_REQUESTS, 10)
      : 10,
  },
  // CDN Configuration
  cdn: {
    // SDK Build Path - where to find the compiled SDK file
    sdkBuildPath: process.env.SDK_BUILD_PATH || './dist/sdk/ocean-ads.min.js',
    // CDN Storage Path - where to store generated CDN files
    storagePath: process.env.CDN_STORAGE_PATH || './cdn-files',
    // CDN Base URL - for generating public CDN URLs
    baseUrl: process.env.CDN_BASE_URL || 'https://cdn.oceanads.com',
    // SDK Version for cache busting
    sdkVersion: process.env.SDK_VERSION || '1.0.0',
    // Development settings
    includeDebug: process.env.CDN_INCLUDE_DEBUG === 'true',
    minify: process.env.CDN_MINIFY === 'true',
    compression: process.env.CDN_COMPRESSION !== 'false',
    watchMode: process.env.SDK_WATCH_MODE === 'true',
    verboseLogging: process.env.CDN_VERBOSE_LOGGING === 'true',
    hotReload: process.env.CDN_HOT_RELOAD === 'true',
    forceRefresh: process.env.SDK_FORCE_REFRESH === 'true',
  },
  timescale: {
    // Primary configuration - use the cloud URL if provided
    databaseUrl: process.env.TIMESCALE_DATABASE_URL,
    // Individual settings for Docker/local development
    host: process.env.TIMESCALEDB_HOST || 'localhost',
    port: process.env.TIMESCALEDB_PORT
      ? parseInt(process.env.TIMESCALEDB_PORT, 10)
      : 5432,
    database: process.env.TIMESCALEDB_DATABASE || 'rtb_timeseries',
    user: process.env.TIMESCALEDB_USER || 'timescale_user',
    password: process.env.TIMESCALEDB_PASSWORD || 'timescale_pass',
    // Connection pool settings
    poolSize: process.env.TIMESCALEDB_POOL_SIZE
      ? parseInt(process.env.TIMESCALEDB_POOL_SIZE, 10)
      : 20,
    poolTimeout: process.env.TIMESCALEDB_POOL_TIMEOUT
      ? parseInt(process.env.TIMESCALEDB_POOL_TIMEOUT, 10)
      : 5000,
    // SSL settings
    ssl:
      process.env.NODE_ENV === 'production' ||
      process.env.TIMESCALE_DATABASE_URL?.includes('sslmode=require'),
  },
});
