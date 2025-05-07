import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  onModuleInit() {
    this.client = new Redis({
      host: 'redis',
      port: 6379,
    });
  }
  onModuleDestroy() {
    this.client.quit();
  }

  async set(key: string, value: string, ttl: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttl);
  }
  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }
  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }
}
