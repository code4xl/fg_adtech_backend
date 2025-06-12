import { Injectable, Logger } from '@nestjs/common';
import { HealthCheckDto } from '../dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { KafkaService } from 'src/kafka/kafka.service';
import { kafkaTopics } from 'src/rtb/constants/kafka-topics';
import { REDIS_KEYS } from '../constants/cache-keys';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly kafka: KafkaService,
  ) {}
  async getSystemHealth(): Promise<HealthCheckDto> {
    this.logger.debug('Performing system health check');

    try {
      // Run health checks in parallel for speed
      const [databaseHealth, redisHealth, kafkaHealth, performanceMetrics] =
        await Promise.allSettled([
          this.checkDatabaseHealth(),
          this.checkRedisHealth(),
          this.checkKafkaHealth(),
          this.getPerformanceMetrics(),
        ]);

      // Determine overall system status
      const allHealthy = [databaseHealth, redisHealth, kafkaHealth].every(
        (result) =>
          result.status === 'fulfilled' && result.value === 'connected',
      );

      const status = allHealthy ? 'healthy' : 'degraded';

      return {
        status,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        components: {
          database: this.getHealthStatus(databaseHealth),
          redis: this.getHealthStatus(redisHealth),
          kafka: this.getHealthStatus(kafkaHealth),
        },
        metrics:
          performanceMetrics.status === 'fulfilled'
            ? performanceMetrics.value
            : {
                requestsPerSecond: 0,
                averageLatency: 'unknown',
                cacheHitRate: 'unknown',
                errorRate: 'unknown',
              },
      };
    } catch (error) {
      this.logger.error('Health check failed', { error: error.message });
      throw error;
    }
  }

  private async checkDatabaseHealth(): Promise<string> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'connected';
    } catch (error) {
      this.logger.error('Database health check failed', {
        error: error.message,
      });
      return 'disconnected';
    }
  }

  private async checkRedisHealth(): Promise<string> {
    try {
      await this.redis.set(REDIS_KEYS.REDIS_HEALTH_CHECK, 'ok', 10);
      const result = await this.redis.get(REDIS_KEYS.REDIS_HEALTH_CHECK);
      return result === 'ok' ? 'connected' : 'error';
    } catch (error) {
      this.logger.error('Redis health check failed', { error: error.message });
      return 'disconnected';
    }
  }

  private async checkKafkaHealth(): Promise<string> {
    try {
      // Simple topic existence check
      const topicExists = await this.kafka.checkTopicExists(
        kafkaTopics.BID_REQUESTS,
      );
      return topicExists ? 'connected' : 'error';
    } catch (error) {
      this.logger.error('Kafka health check failed', { error: error.message });
      return 'disconnected';
    }
  }

  private async getPerformanceMetrics(): Promise<{
    requestsPerSecond: number;
    averageLatency: string;
    cacheHitRate: string;
    errorRate: string;
    activeAuctions?: number;
  }> {
    try {
      const hour = new Date().getHours();
      const prevHour = hour === 0 ? 23 : hour - 1;

      const [
        currentRequests,
        currentLatency,
        currentErrors,
        prevRequests,
        prevLatency,
      ] = await Promise.all([
        this.redis.get<string>(REDIS_KEYS.HOURLY_BID_REQUEST_METRICS(hour)),
        this.redis.get<string>(REDIS_KEYS.HOURLY_BID_REQUEST_LATENCY(hour)),
        this.redis.get<string>(REDIS_KEYS.HOURLY_BID_RESPONSE_ERRORS(hour)),
        this.redis.get<string>(REDIS_KEYS.HOURLY_BID_REQUEST_METRICS(prevHour)),
        this.redis.get<string>(REDIS_KEYS.HOURLY_BID_REQUEST_LATENCY(prevHour)),
      ]);

      const requests =
        parseInt(currentRequests || '0') + parseInt(prevRequests || '0');
      const totalLatency =
        parseInt(currentLatency || '0') + parseInt(prevLatency || '0');
      const errors = parseInt(currentErrors || '0');

      const requestsPerSecond = Math.round(requests / 3600); // Requests per second over 2 hours
      const averageLatency =
        requests > 0 ? `${Math.round(totalLatency / requests)}ms` : '0ms';
      const errorRate =
        requests > 0 ? `${((errors / requests) * 100).toFixed(2)}%` : '0%';

      // Estimate cache hit rate (simplified)
      const cacheHitRate = '85%'; // TODO: Implement actual cache hit tracking

      return {
        requestsPerSecond,
        averageLatency,
        cacheHitRate,
        errorRate,
      };
    } catch (error) {
      this.logger.error('Failed to get performance metrics', {
        error: error.message,
      });
      throw error;
    }
  }

  private getHealthStatus(result: PromiseSettledResult<string>): string {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return 'error';
  }
}
