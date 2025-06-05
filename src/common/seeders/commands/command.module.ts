import { Module } from '@nestjs/common';

import { SeederModule } from '../seeder.module';
import { SeedCommand } from './seed.command';
import { CommandModule } from 'nestjs-command';

@Module({
  imports: [CommandModule, SeederModule],
  providers: [SeedCommand],
  exports: [SeedCommand],
})
export class AppCommandModule {}
