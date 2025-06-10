import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { WithRetry } from '../common/resilience/retry.decorator';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private readonly pubClient: Redis;
  private readonly subClient: Redis;

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly configService: ConfigService,
  ) {
    // Create Redis pub/sub clients
    const redisOptions = {
      host: this.configService.get<string>('redis.host', 'localhost'),
      port: this.configService.get<number>('redis.port', 6379),
      password: this.configService.get<string>('redis.password'),
    };

    this.pubClient = new Redis(redisOptions);
    this.subClient = new Redis(redisOptions);

    // Set up error handling
    this.pubClient.on('error', (err) =>
      this.logger.error(`Redis Pub Client Error: ${err.message}`, err.stack),
    );
    this.subClient.on('error', (err) =>
      this.logger.error(`Redis Sub Client Error: ${err.message}`, err.stack),
    );
  }

  // Cache methods
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

  async ttl(key: string): Promise<number> {
    return this.pubClient.ttl(key);
  }

  async incr(key: string): Promise<number> {
    return this.pubClient.incr(key);
  }

  async incrby(key: string, increment: number): Promise<number> {
    return this.pubClient.incrby(key, increment);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.pubClient.expire(key, seconds);
  }

  async incrbyfloat(key: string, increment: number) {
    await this.pubClient.incrbyfloat(key, increment);
  }

  async llen(key: string) {
    return this.pubClient.llen(key);
  }

  async rpush(key: string, value: string) {
    return this.pubClient.rpush(key, value);
  }

  async lpush(key: string, value: string): Promise<number> {
    return this.pubClient.lpush(key, value);
  }

  async ltrim(key: string, start: number, stop: number): Promise<void> {
    await this.pubClient.ltrim(key, start, stop);
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    await this.pubClient.setex(key, seconds, value);
  }

  async setnx(key: string, value: string): Promise<number> {
    return this.pubClient.setnx(key, value);
  }

  async smembers(key: string): Promise<string[]> {
    return this.pubClient.smembers(key);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.pubClient.keys(pattern);
  }


  pipeline() {
    return this.pubClient.pipeline();
  }
  // Pub/Sub methods
  async publish(channel: string, message: any): Promise<number> {
    return this.pubClient.publish(
      channel,
      typeof message === 'object' ? JSON.stringify(message) : message,
    );
  }

  async subscribe(
    channel: string,
    callback: (message: string, channel: string) => void,
  ): Promise<void> {
    await this.subClient.subscribe(channel);
    this.subClient.on('message', (subscribedChannel, message) => {
      if (channel === subscribedChannel) {
        callback(message, channel);
      }
    });

    this.logger.debug(`Subscribed to channel: ${channel}`);
  }

  async unsubscribe(channel: string): Promise<void> {
    await this.subClient.unsubscribe(channel);
    this.logger.debug(`Unsubscribed from channel: ${channel}`);
  }

  // Message queue methods for offline users
  async enqueueNotification(userId: string, notification: any): Promise<void> {
    const queueKey = `notification:queue:${userId}`;
    await this.pubClient.rpush(queueKey, JSON.stringify(notification));
    // Set expiration for the queue (e.g., 30 days)
    await this.pubClient.expire(queueKey, 60 * 60 * 24 * 30);
  }

  async getQueuedNotifications(userId: string): Promise<any[]> {
    const queueKey = `notification:queue:${userId}`;
    const length = await this.pubClient.llen(queueKey);

    if (length === 0) {
      return [];
    }

    // Get all notifications in the queue
    const notifications = await this.pubClient.lrange(queueKey, 0, -1);

    // Parse the JSON strings
    return notifications.map((notification) => JSON.parse(notification));
  }

  async clearQueuedNotifications(userId: string): Promise<void> {
    try {
      const key = `notifications:queue:${userId}`;
      await this.pubClient.del(key);
      this.logger.debug(`Cleared queued notifications for user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Error clearing queued notifications: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Store a broadcast message in the history
   */
  async storeBroadcast(userType: string, message: any): Promise<void> {
    try {
      const key = `notifications:${userType.toLowerCase()}:broadcast:history`;

      // Parse and stringify to ensure consistent format with timestamp
      const messageObj =
        typeof message === 'string' ? JSON.parse(message) : message;
      const messageWithTimestamp = JSON.stringify({
        ...messageObj,
        timestamp: new Date().toISOString(),
      });

      // Add to the beginning of the list (newest first)
      await this.pubClient.lpush(key, messageWithTimestamp);

      // Keep only the most recent 100 broadcasts
      await this.pubClient.ltrim(key, 0, 99);

      // Set TTL to automatically expire after 7 days
      await this.pubClient.expire(key, 60 * 60 * 24 * 7);

      this.logger.debug(`Stored broadcast for ${userType} with key ${key}`);
    } catch (error) {
      this.logger.error(`Error storing broadcast: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get recent broadcast messages for a user type
   */
  async getRecentBroadcasts(
    userType: string,
    count: number = 50,
  ): Promise<any[]> {
    try {
      const key = `notifications:${userType.toLowerCase()}:broadcast:history`;

      // Get the specified number of broadcasts (0 to count-1)
      const results = await this.pubClient.lrange(key, 0, count - 1);

      if (!results || results.length === 0) {
        return [];
      }

      // Parse the JSON strings
      return results
        .map((item) => {
          try {
            return JSON.parse(item);
          } catch (error) {
            this.logger.error(
              `Error parsing broadcast message: ${error.message}`,
            );
            return null;
          }
        })
        .filter((item) => item !== null);
    } catch (error) {
      this.logger.error(`Error getting recent broadcasts: ${error.message}`);
      return [];
    }
  }
}
