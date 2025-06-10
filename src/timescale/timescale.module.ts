import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TimescaleService } from './timescale.service';
import { KafkaModule } from '../kafka/kafka.module';
import { TimescaleDBConnection } from './timescale-connection.service';

@Module({
  imports: [ConfigModule, KafkaModule],
  providers: [TimescaleDBConnection, TimescaleService],
  exports: [TimescaleService, TimescaleDBConnection],
})
export class TimescaleModule {}
