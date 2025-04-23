
export default () => ({
  port: process.env.PORT==undefined ? 3000 : parseInt(process.env.PORT, 10),
  database: {
    url: process.env.DATABASE_URL,
  },
  nodeEnv: process.env.NODE_ENV || 'development',
   jwt: {
    secret: process.env.JWT_SECRET || 'hard-to-guess-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '60m',
  },
  throttle: {
    ttl: process.env.THROTTLE_TTL ? parseInt(process.env.THROTTLE_TTL, 10) : 60,
    limit: process.env.THROTTLE_LIMIT ? parseInt(process.env.THROTTLE_LIMIT, 10) : 100,
  },
});
