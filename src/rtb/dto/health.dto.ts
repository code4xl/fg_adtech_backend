import {
  IsString,
  IsOptional,
  IsObject,
  IsNumber,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SystemComponentsDto {
  @ApiProperty({
    description: 'Database connection status',
    example: 'connected',
    enum: ['connected', 'disconnected', 'error'],
  })
  @IsEnum(['connected', 'disconnected', 'error'])
  database: string;

  @ApiProperty({
    description: 'Redis connection status',
    example: 'connected',
    enum: ['connected', 'disconnected', 'error'],
  })
  @IsEnum(['connected', 'disconnected', 'error'])
  redis: string;

  @ApiProperty({
    description: 'Kafka connection status',
    example: 'connected',
    enum: ['connected', 'disconnected', 'error'],
  })
  @IsEnum(['connected', 'disconnected', 'error'])
  kafka: string;

  @ApiPropertyOptional({
    description: 'timescale connection status',
    example: 'connected',
    enum: ['connected', 'disconnected', 'error', 'not_configured'],
  })
  @IsOptional()
  @IsEnum(['connected', 'disconnected', 'error', 'not_configured'])
  timescale?: string;
}

export class SystemMetricsDto {
  @ApiProperty({
    description: 'Current requests per second',
    example: 150,
  })
  @IsNumber()
  requestsPerSecond: number;

  @ApiProperty({
    description: 'Average response latency',
    example: '89ms',
  })
  @IsString()
  averageLatency: string;

  @ApiProperty({
    description: 'Cache hit rate percentage',
    example: '82%',
  })
  @IsString()
  cacheHitRate: string;

  @ApiProperty({
    description: 'Error rate percentage',
    example: '0.1%',
  })
  @IsString()
  errorRate: string;

  @ApiPropertyOptional({
    description: 'Active auctions currently processing',
    example: 24,
  })
  @IsOptional()
  @IsNumber()
  activeAuctions?: number;
}

export class HealthCheckDto {
  @ApiProperty({
    description: 'Overall system status',
    example: 'healthy',
    enum: ['healthy', 'degraded', 'unhealthy'],
  })
  @IsEnum(['healthy', 'degraded', 'unhealthy'])
  status: string;

  @ApiProperty({
    description: 'Health check timestamp',
    example: '2025-06-09T12:30:00.000Z',
  })
  @IsString()
  timestamp: string;

  @ApiProperty({
    description: 'System version',
    example: '1.0.0-phase1',
  })
  @IsString()
  version: string;

  @ApiProperty({
    description: 'System component statuses',
    type: SystemComponentsDto,
  })
  @ValidateNested()
  @Type(() => SystemComponentsDto)
  components: SystemComponentsDto;

  @ApiPropertyOptional({
    description: 'Additional system information',
    example: { uptime: '24h 15m', memoryUsage: '2.1GB' },
  })
  @IsOptional()
  @IsObject()
  additionalInfo?: Record<string, any>;
}
