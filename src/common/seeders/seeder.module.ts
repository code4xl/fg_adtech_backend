// src/common/seeders/seeder.module.ts - Fixed version
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';

import { MainSeederService } from './main.seeder';
import { AdInventorySeeder } from './modules/ad-inventory.seeder';
import { AdSlotTemplateSeeder } from './modules/ad-slot-template.seeder';
import { AdminSeeder } from './modules/admin.seeder';
import { AdvertiserSeeder } from './modules/advertiser.seeder';
import { CampaignSeeder } from './modules/campaign.seeder';

import { ContentCategorySeeder } from './modules/content-category.seeder';
import { CreativeSeeder } from './modules/creative.seeder';
import { FloorPriceSeeder } from './modules/floor-price.seeder';
import { NotificationSeeder } from './modules/notification.seeder';
import { PublisherSeeder } from './modules/publisher.seeder';
import { TargetingRuleSeeder } from './modules/targeting-rule.seeder';
import { WebsiteSeeder } from './modules/website.seeder';
import { DependencyResolver } from './tools/dependency.resolver';
import { SeederRegistry } from './tools/seeders.registry';
import { ClientSeeder } from './modules/client.seeder';
import { CreativeCampaignSeeder } from './modules/one.seeder';

@Module({
  imports: [PrismaModule],
  providers: [
    // Utility services
    SeederRegistry,
    DependencyResolver,
    MainSeederService,

    // All seeders
    AdminSeeder,
    AdvertiserSeeder,
    PublisherSeeder,
    ContentCategorySeeder,
    AdSlotTemplateSeeder,
    ClientSeeder,
    WebsiteSeeder,
    AdInventorySeeder,
    CampaignSeeder,
    CreativeSeeder,
    FloorPriceSeeder,
    TargetingRuleSeeder,
    NotificationSeeder,
    CreativeCampaignSeeder,
  ],
  exports: [MainSeederService, SeederRegistry, DependencyResolver],
})
export class SeederModule {
  constructor(private readonly seederRegistry: SeederRegistry) {
    console.log('SeederModule constructor called');

    // Register all seeders
    const seeders = [
      AdminSeeder,
      AdvertiserSeeder,
      PublisherSeeder,
      ContentCategorySeeder,
      AdSlotTemplateSeeder,
      ClientSeeder,
      WebsiteSeeder,
      AdInventorySeeder,
      CampaignSeeder,
      CreativeSeeder,
      FloorPriceSeeder,
      TargetingRuleSeeder,
      NotificationSeeder,
    ];

    console.log(`Registering ${seeders.length} seeders`);
    this.seederRegistry.registerSeeders(seeders);
    console.log('All seeders registered successfully');
  }
}
