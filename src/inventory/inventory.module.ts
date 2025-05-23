// import { Module } from '@nestjs/common';
// // import { InventoryController } from './inventory.controller'; // Original controller
// import { AdminInventoryController } from './admin-inventory.controller'; // New admin controller
// import { InventoryService } from './inventory.service';
// import { FloorPriceController } from './floor-price.controller';
// import { FloorPriceService } from './floor-price.service';
// import { InventoryOwnerGuard } from './guards/inventory-owner.guard';
// // import { AdvertiserInventoryController } from './admin-inventory.controller';
// import { CategoryService } from './category.service';
// import { AdminCategoryController } from './admin-category.controller';
// import { PublisherService } from '../publishers/publisher.service';
// import { AdminPublisherController } from '../publishers/admin.publisher.controller';

// @Module({
//   controllers: [
//     // Original controllers (may need to be updated/deprecated)
//     // InventoryController,
//     FloorPriceController,
//     // AdvertiserInventoryController,

//     // New admin controllers
//     AdminInventoryController,
//     AdminCategoryController,
//     AdminPublisherController
//   ],
//   providers: [
//     InventoryService,
//     FloorPriceService,
//     InventoryOwnerGuard,
//     CategoryService,
//     PublisherService
//   ],
//   exports: [
//     InventoryService,
//     FloorPriceService,
//     CategoryService,
//     PublisherService
//   ]
// })
// export class InventoryModule {}

import { Module } from '@nestjs/common';
// import { InventoryController } from './inventory.controller'; // Original controller
import { AdminInventoryController } from './admin-inventory.controller'; // New admin controller
import { InventoryService } from './inventory.service';
import { FloorPriceController } from './floor-price.controller';
import { FloorPriceService } from './floor-price.service';
import { InventoryOwnerGuard } from './guards/inventory-owner.guard';
// import { AdvertiserInventoryController } from './admin-inventory.controller';
import { CategoryService } from './category.service';
import { AdminCategoryController } from './admin-category.controller';
import { PublisherService } from '../publishers/publisher.service';
import { AdminPublisherController } from '../publishers/admin.publisher.controller';
import { InventoryCampaignController } from 'src/campaign/campaign.inventory.controller';
import { InventoryCampaignService } from 'src/campaign/campaign.inventory.service';
import { NotificationModule } from 'src/notification/notification.module';
import { CreativeService } from 'src/creative/creative.service';
import { CreativeModule } from 'src/creative/creative.module';

@Module({
  imports: [NotificationModule],
  controllers: [
    // Original controllers (may need to be updated/deprecated)
    // InventoryController,
    FloorPriceController,
    // AdvertiserInventoryController,

    // New admin controllers
    AdminInventoryController,
    AdminCategoryController,
    AdminPublisherController,

    // New campaign inventory controller
    InventoryCampaignController,
  ],
  providers: [
    InventoryService,
    FloorPriceService,
    InventoryOwnerGuard,
    CategoryService,
    PublisherService,
    InventoryCampaignService
  ],
  exports: [
    InventoryService,
    FloorPriceService,
    CategoryService,
    PublisherService,
  ]
})
export class InventoryModule { }