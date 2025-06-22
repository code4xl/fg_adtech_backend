import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private readonly pubClient: Redis;
  private readonly subClient: Redis;

  constructor(private readonly configService: ConfigService) {
    // Create Redis pub/sub clients
    const redisOptions = {
      host: this.configService.get<string>('redis.host', 'localhost'),
      port: this.configService.get<number>('redis.port', 6379),
      password: this.configService.get<string>('redis.password'),
      // PERFORMANCE OPTIMIZATIONS
      maxRetriesPerRequest: 2,
      retryDelayOnFailover: 50,
      connectTimeout: 1000,
      commandTimeout: 500, // Very important for RTB - 500ms max
      lazyConnect: true,

      // Connection Pool Settings
      maxmemoryPolicy: 'allkeys-lru',

      // Disable some features for performance
      // enableOfflineQueue: false,
      enableReadyCheck: false,
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
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const result = await this.pubClient.get(key);
      return result ? (JSON.parse(result) as T) : undefined;
    } catch (error) {
      this.logger.error(
        `Error getting value from Redis for key ${key}: ${error.message}`,
      );
      throw error;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const stringValue = JSON.stringify(value);
      if (ttl) {
        // TTL in seconds
        await this.pubClient.set(key, stringValue, 'EX', ttl);
      } else {
        await this.pubClient.set(key, stringValue);
      }
    } catch (error) {
      this.logger.error(
        `Error setting value in Redis for key ${key}: ${error.message}`,
      );
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    await this.pubClient.del(key);
  }

  async reset(): Promise<void> {
    await this.pubClient.reset();
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

  async setWinner(key: string, value: string, ttl: any) {
    return this.pubClient.set(key, value, 'EX', ttl);
  }

  async sadd(key: string, value: string): Promise<number> {
    return this.pubClient.sadd(key, value);
  }

  async sismember(key: string, value: string): Promise<number> {
    return this.pubClient.sismember(key, value);
  }

  async scard(key: string): Promise<number> {
    return this.pubClient.scard(key);
  }

  async ping(): Promise<string> {
    return this.pubClient.ping();
  }

  async lpop(key: string, count: number): Promise<string[] | null> {
    return this.pubClient.lpop(key, count);
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    return this.pubClient.zadd(key, score, member);
  }

  // Get members from sorted set in reverse order (highest score first)
  async zrevrange(key: string, start: number, stop: number, withScores?: string): Promise<string[]> {
    try {
      if (withScores === 'WITHSCORES') {
        return await this.pubClient.zrevrange(key, start, stop, 'WITHSCORES');
      }
      return await this.pubClient.zrevrange(key, start, stop);
    } catch (error) {
      this.logger.error(
        `Error getting reverse range from sorted set ${key}: ${error.message}`,
      );
      throw error;
    }
  }

  // Get members from sorted set by score range in reverse order
  async zrevrangebyscore(
    key: string,
    max: number | string,
    min: number | string,
    withScores?: string,
    limitKeyword?: string,
    offset?: number,
    count?: number
  ): Promise<string[]> {
    try {
      // ✅ CORRECTED: Build command with proper Redis syntax
      if (limitKeyword === 'LIMIT' && offset !== undefined && count !== undefined) {
        if (withScores === 'WITHSCORES') {
          // With scores and limit
          return await this.pubClient.zrevrangebyscore(
            key,
            max,
            min,
            'WITHSCORES',
            'LIMIT',
            offset,
            count
          );
        } else {
          // Without scores but with limit
          return await this.pubClient.zrevrangebyscore(
            key,
            max,
            min,
            'LIMIT',
            offset,
            count
          );
        }
      } else {
        if (withScores === 'WITHSCORES') {
          // With scores, no limit
          return await this.pubClient.zrevrangebyscore(key, max, min, 'WITHSCORES');
        } else {
          // Basic command
          return await this.pubClient.zrevrangebyscore(key, max, min);
        }
      }
    } catch (error) {
      this.logger.error(
        `Error getting reverse range by score from sorted set ${key}: ${error.message}`,
      );
      throw error;
    }
  }

  pipeline() {
    return this.pubClient.pipeline();
  }

  zcard(key: string): Promise<number> {
    return this.pubClient.zcard(key);
  }

  async watch(key: string): Promise<void> {
    this.pubClient.watch(key);
  }

  async unwatch(): Promise<void> {
    this.pubClient.unwatch();
  }

  async exists(key: string): Promise<number> {
    try {
      return await this.pubClient.exists(key);
    } catch (error) {
      this.logger.error(`Error checking existence of key ${key}: ${error.message}`);
      throw error;
    }
  }



  getClient(): Redis {
    return this.pubClient;
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
