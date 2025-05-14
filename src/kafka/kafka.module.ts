import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaService } from './kafka.service';
import { KafkaInitService } from './kafka.init';

@Global()
@Module({
  providers: [KafkaService, KafkaInitService],
  exports: [KafkaService],
})
export class KafkaModule {}
