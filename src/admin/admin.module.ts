import { Module } from '@nestjs/common';
// import { AdminService } from './admin.service';
// import { AdminController } from './admin.controller';
import { AdminAdvertiserController } from './advertiser/admin-advertiser.controller';
import { AdminAdvertiserService } from './advertiser/admin-advertiser.service';
import { AdminClientController } from './client/admin-client.controller';
import { AdminClientService } from './client/admin-client.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAdSlotTemplateController } from './controllers/admin-adslot-template.controller';
import { AdminContentCategoryController } from './controllers/admin-content-category.controller';
import { AdminAdSlotTemplateService } from './services/admin-adslot-template.service';
import { AdminContentCategoryService } from './services/admin-content-category.service';
import { PublisherSignupTierService } from './publisher/admin.publisher-signup-tier.service';
import { AdminPublisherTierService } from './publisher/admin.publisher-tier.service';
import { AdminPublisherTierController } from './publisher/admin.publisher-tier.controller';

@Module({
  imports: [PrismaModule],
  controllers: [
    // AdminController,
    AdminAdvertiserController,
    AdminClientController,
    AdminAdSlotTemplateController,
    AdminContentCategoryController,
    AdminPublisherTierController,
  ],
  providers: [
    AdminPublisherTierService, 
    PublisherSignupTierService,
    AdminAdvertiserService,
    AdminClientService,
    AdminAdSlotTemplateService,
    AdminContentCategoryService,
  ],
  exports: [
    AdminAdSlotTemplateService,
    AdminContentCategoryService,
    AdminPublisherTierService, 
    PublisherSignupTierService
  ],
})
export class AdminModule {}
