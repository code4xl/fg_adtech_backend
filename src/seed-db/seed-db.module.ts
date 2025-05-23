import { Module } from '@nestjs/common';
import { SeederModule as CoreSeederModule } from '../common/seeders/seeder.module';
import { SeedDbController } from './seed-db.controller';

@Module({
  imports: [CoreSeederModule],
  controllers: [SeedDbController],
})
export class SeedDbModule {}
