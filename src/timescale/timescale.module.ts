import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TimescaleService } from './timescale.service';
import { KafkaModule } from '../kafka/kafka.module';
import { TimescaleDBConnection } from './timescale-connection.service';
import { TimeScaleController } from './timescale.controller';
import { PostgresTimescaleSyncService } from 'src/tracking/services/postgre-timescale-sync.service';
import { RedisService } from 'src/redis/redis.service';

@Module({
    imports: [ConfigModule, KafkaModule],
    controllers: [TimeScaleController],
    providers: [
        TimescaleDBConnection,
        TimescaleService,
        PostgresTimescaleSyncService,
        RedisService,
    ],
    exports: [TimescaleService, TimescaleDBConnection],
})
export class TimescaleModule { }
