import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RedisPostgresSyncService } from './services/redis-postgres-sync.service';
import { TimescaleService } from '../timescale/timescale.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { PostgresTimescaleSyncService } from './services/postgre-timescale-sync.service';
import { TrackingController } from './tracking.controller';
// import { BatchSyncController } from './batch-sync.controller';
import { TrackingService } from './tracking.service';

// ADD THESE IMPORTS:
import { BudgetValidationService } from './services/budget-validation.service';
import { FraudDetectionService } from './fraud-detection.service';
import { BudgetInitializationService } from './services/budget-initialization.service';
import { ImpressionClickLinkingService } from './services/impression-click-linking.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
  ],
  controllers: [
    TrackingController,
    //  BatchSyncController
  ],
  providers: [
    RedisPostgresSyncService,
    TimescaleService,
    TrackingService,

    // ADD THESE MISSING PROVIDERS:
    BudgetValidationService,
    FraudDetectionService,
    BudgetInitializationService,
    ImpressionClickLinkingService,


    PostgresTimescaleSyncService,  // Add this
  ],
  exports: [
    TrackingService,
    RedisPostgresSyncService,
    TimescaleService,
    PostgresTimescaleSyncService,

    // OPTIONALLY EXPORT THESE TOO:
    BudgetValidationService,
    FraudDetectionService,
    BudgetInitializationService,
    ImpressionClickLinkingService,
  ],
})
export class TrackingModule { }