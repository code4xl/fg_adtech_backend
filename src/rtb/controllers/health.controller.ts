import { Get, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthCheckDto } from '../dto';
import { HealthService } from '../../rtb/services/health-service';
import { RtbHelper } from '../utils/helpers';
@ApiTags('RTB')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  constructor(
    private readonly healthService: HealthService,
    private readonly rtbHelper: RtbHelper,
  ) {}
  @Get('health')
  @ApiOperation({
    summary: 'RTB system health check',
    description:
      'Returns comprehensive system health including component status and performance metrics',
  })
  @ApiResponse({
    status: 200,
    description: 'System health retrieved successfully',
    type: HealthCheckDto,
  })
  async getHealth(): Promise<HealthCheckDto> {
    this.logger.debug('Health check requested');

    try {
      const healthStatus = await this.healthService.getSystemHealth();

      return healthStatus;
    } catch (error) {
      this.logger.error('Health check failed', { error: error.message });

      // Return degraded status instead of throwing error
      return {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        version: '1.0.0-phase3',
        components: {
          database: 'error',
          redis: 'error',
          kafka: 'error',
        },
        metrics: {
          requestsPerSecond: 0,
          averageLatency: 'unknown',
          cacheHitRate: 'unknown',
          errorRate: 'high',
        },
        additionalInfo: {
          error: error.message,
        },
      };
    }
  }
}
