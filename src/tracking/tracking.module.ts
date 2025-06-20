import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RedisPostgresSyncService } from './services/redis-postgres-sync.service';
import { TimescaleService } from '../timescale/timescale.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { TimescaleSyncService } from './services/timescale-sync.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
  ],
  // controllers: [BatchSyncController],
  providers: [
    RedisPostgresSyncService,
    TimescaleSyncService,
    TimescaleService,
  ],
  exports: [
    RedisPostgresSyncService,
    TimescaleSyncService,
    TimescaleService,
  ],
})
export class TrackingModule { }