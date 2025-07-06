import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';

@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get<string>('REDIS_HOST'),
        port: configService.get<number>('REDIS_PORT'),
        password: configService.get<string>('REDIS_PASSWORD'),
        ttl: 60 * 60 * 24,
        // Optimized connection pool
        max: 100, // Increase max connections
        min: 20, // Increase min connections
        acquireTimeoutMillis: 2000, // Reduce timeout
        createTimeoutMillis: 2000,
        idleTimeoutMillis: 60000,
        reapIntervalMillis: 500,
        maxUses: 100000,
        // Redis-specific optimizations
        lazyConnect: true,
        keepAlive: true,
        connectTimeout: 2000,
        commandTimeout: 2000,
      }),
    }),
  ],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
