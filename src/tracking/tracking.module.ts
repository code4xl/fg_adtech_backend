import { Module } from '@nestjs/common';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { FraudDetectionService } from './fraud-detection.service';
import { RedisModule } from '../redis/redis.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BudgetValidationService } from './services/budget-validation.service';

@Module({
  imports: [RedisModule, PrismaModule],
  controllers: [TrackingController],
  providers: [
    TrackingService,
    BudgetValidationService,
    FraudDetectionService,
  ],
  exports: [
    TrackingService,
    BudgetValidationService,
    FraudDetectionService,
  ],
})
export class TrackingModule { }