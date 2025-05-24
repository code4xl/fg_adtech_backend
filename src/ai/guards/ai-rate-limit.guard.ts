import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';
import { RateLimitedException } from '../../common/exceptions/custom.exception';

@Injectable()
export class AIRateLimitGuard implements CanActivate {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly keyPrefix = 'ai_rate_limit:';

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService
  ) {
    this.windowMs = this.configService.get<number>('ai.rateLimitWindow', 60000);
    this.maxRequests = this.configService.get<number>('ai.maxRequestsPerWindow', 10);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user) {
      return false;
    }

    const key = `${this.keyPrefix}${user.id}`;
    const current = await this.redisService.get(key);
    const currentCount = current ? parseInt(current, 10) : 0;

    if (currentCount >= this.maxRequests) {
      const ttl = await this.redisService.ttl(key);
      throw new RateLimitedException(
        `AI rate limit exceeded. Please wait ${Math.ceil(ttl / 60)} minutes before trying again.`
      );
    }

    const newCount = currentCount + 1;
    
    if (currentCount === 0) {
      await this.redisService.set(
        key,
        newCount.toString(),
        Math.floor(this.windowMs / 1000)
      );
    } else {
      await this.redisService.incr(key);
    }

    request.aiRequestCount = newCount;
    request.aiRequestsRemaining = this.maxRequests - newCount;

    return true;
  }
}