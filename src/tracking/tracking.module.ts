import { Logger, Module } from '@nestjs/common';
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
import { BudgetRedisSyncService } from './services/budget-redis-sync.service';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, RedisModule],
  controllers: [
    TrackingController,
    //  BatchSyncController
  ],
  providers: [
    RedisPostgresSyncService,
    TimescaleService,
    TrackingService,
    BudgetValidationService,
    FraudDetectionService,
    BudgetInitializationService,
    ImpressionClickLinkingService,
    BudgetRedisSyncService,
    PostgresTimescaleSyncService,
  ],
  exports: [
    TrackingService,
    RedisPostgresSyncService,
    TimescaleService,
    PostgresTimescaleSyncService,
    BudgetRedisSyncService,
    BudgetValidationService,
    FraudDetectionService,
    BudgetInitializationService,
    ImpressionClickLinkingService,
  ],
})
export class TrackingModule {
  private readonly logger = new Logger(TrackingModule.name);
  constructor(
    private readonly budgetRedisSyncService: BudgetRedisSyncService,
    private readonly trackingService: TrackingService,
  ) {}
  async onModuleInit() {
    try {
      this.logger.log('🚀 Starting application initialization...');

      // Sync all campaign budgets to Redis on startup
      await this.budgetRedisSyncService.syncAllActiveCampaigns();
      await this.trackingService.syncPublisherRevenueTiers();

      this.logger.log('✅ Application initialization completed');
    } catch (error) {
      this.logger.error('❌ Application initialization failed:', error);
      // Don't throw - let app start but log the error
    }
  }
}
