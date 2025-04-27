import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { FloorPriceController } from './floor-price.controller';
import { FloorPriceService } from './floor-price.service';
import { InventoryOwnerGuard } from './guards/inventory-owner.guard';

@Module({
  controllers: [
    InventoryController,
    FloorPriceController
  ],
  providers: [
    InventoryService,
    FloorPriceService,
    InventoryOwnerGuard
  ],
  exports: [
    InventoryService,
    FloorPriceService
  ]
})
export class InventoryModule {}