// src/timescale/timescale.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TimescaleService } from './timescale.service';
import { KafkaModule } from '../kafka/kafka.module';
import { TimescaleDBConnection } from './timescale-connection.service';

/**
 * TimescaleDB Module - Phase 6 Implementation
 * 
 * **Why this module exists:**
 * - Provides dedicated connection pool for TimescaleDB operations
 * - Separates time-series operations from relational database operations
 * - Enables optimized configurations for analytical workloads
 * - Facilitates monitoring and scaling of time-series operations
 */
@Module({
  imports: [
    ConfigModule,
    KafkaModule,
  ],
  providers: [
    TimescaleDBConnection,
    TimescaleService,
  ],
  exports: [
    TimescaleService,
    TimescaleDBConnection,
  ],
})
export class TimescaleModule { }