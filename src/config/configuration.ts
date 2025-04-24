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
});
