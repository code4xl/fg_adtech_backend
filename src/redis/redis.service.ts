import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { WithRetry } from 'src/common/resilience/retry.decorator';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}
  @WithRetry(3, 100, 2, [Error])
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const result = await this.cache.get<T>(key);
      return result === null ? undefined : result;
    } catch (error) {
      this.logger.error(
        `Error getting value from Redis for key ${key}: ${error.message}`,
      );
      throw error;
    }
  }

  @WithRetry(3, 100, 2, [Error])
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      await this.cache.set(key, value, ttl);
    } catch (error) {
      this.logger.error(
        `Error setting value in Redis for key ${key}: ${error.message}`,
      );
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    await this.cache.del(key);
  }

  async reset(): Promise<void> {
    await this.cache.clear();
  }
}
