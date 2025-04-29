import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { FloorPriceController } from './floor-price.controller';
import { FloorPriceService } from './floor-price.service';
import { InventoryOwnerGuard } from './guards/inventory-owner.guard';
import { InventoryAdminController } from './admin.controller';
import { AdvertiserInventoryController } from './advertiser-inventory.controller';
import { CategoryService } from './category.service';

@Module({
  controllers: [
    InventoryController,
    FloorPriceController,
    AdvertiserInventoryController,
    InventoryAdminController
  ],
  providers: [
    InventoryService,
    FloorPriceService,
    InventoryOwnerGuard,
    CategoryService
  ],
  exports: [
    InventoryService,
    FloorPriceService,
    CategoryService
  ]
})
export class InventoryModule {}