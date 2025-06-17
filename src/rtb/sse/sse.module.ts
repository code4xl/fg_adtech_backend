import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '../../redis/redis.module';
import { PrismaModule } from '../../prisma/prisma.module';

// Controllers
import { SSEController } from './controllers/sse.controller';

// Services  
import { SSEService } from './services/sse.service';
import { SSETrackerService } from './services/sse-tracker.service';
import { SSEEventFormatterService } from './services/sse-event-formatter.service';
import { SSEStreamManagerService } from './services/sse-stream-manager.service';

// Guards
import { SSETimeoutGuard } from './guards/sse-timeout.guard';

/**
 * SSE Module - Real-time Server-Sent Events for RTB
 * 
 * Provides real-time streaming of auction updates to SDK clients
 * without disrupting the existing RTB flow.
 * 
 * Features:
 * - Redis-based request tracking
 * - Real-time event streaming
 * - Connection lifecycle management
 * - Graceful timeout handling (250ms initial, 5-6s RTB processing)
 * - Error recovery and partial results
 */
@Module({
  imports: [
    ConfigModule,
    RedisModule,
    PrismaModule,
  ],
  controllers: [
    SSEController,
  ],
  providers: [
    // Core Services
    SSEService,
    SSETrackerService,
    SSEEventFormatterService,
    SSEStreamManagerService,
    
    // Guards
    SSETimeoutGuard,
  ],
  exports: [
    SSEService,
    SSETrackerService,
  ],
})
export class SSEModule {}