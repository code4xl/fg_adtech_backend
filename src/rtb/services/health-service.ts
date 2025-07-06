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
      const [databaseHealth, redisHealth, kafkaHealth] =
        await Promise.allSettled([
          this.checkDatabaseHealth(),
          this.checkRedisHealth(),
          this.checkKafkaHealth(),
          // this.getPerformanceMetrics(),
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

  private getHealthStatus(result: PromiseSettledResult<string>): string {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return 'error';
  }
}
