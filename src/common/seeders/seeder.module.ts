import { Module, Type } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminSeeder } from './modules/admin.seeder';
import { AdvertiserSeeder } from './modules/advertiser.seeder';
import { PublisherSeeder } from './modules/publisher.seeder';
import { MainSeederService } from './main.seeder';
import { DependencyResolver } from './tools/dependency.resolver';
import { SeederRegistry } from './tools/seeders.registry';
import { ISeeder } from './interfaces/seeder.interface';
import { CampaignSeeder } from './modules/campaign.seeder';

// Add new seeders to this array
const SEEDERS: Type<ISeeder>[] = [
  AdminSeeder,
  AdvertiserSeeder,
  PublisherSeeder,
  CampaignSeeder,
];

@Module({
  imports: [PrismaModule],
  providers: [
    MainSeederService,
    DependencyResolver,
    SeederRegistry,
    ...SEEDERS,
    {
      provide: 'SEEDERS',
      useFactory: (...seeders: ISeeder[]) => seeders,
      inject: SEEDERS,
    },
  ],
  exports: [MainSeederService],
})
export class SeederModule {
  constructor(private seederRegistry: SeederRegistry) {
    // Register all seeders to the registry
    this.seederRegistry.registerSeeders(SEEDERS);
  }
}
