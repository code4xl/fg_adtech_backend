import { Module } from '@nestjs/common';
// import { PublishersService } from './publishers.service';
import { PublisherService } from './publisher.service'; // Add this import
// import { AdminPublisherController } from './admin.publisher.controller';
import { PublisherController } from './publisher.controller';
import { PublisherWebsiteController } from './publisher.website.controller';
import { PublisherFloorPriceController } from './publisher.floorprice.controller';
import { PublisherTargetingController } from './publisher.targeting.controller';
import { PublisherAdInventoryController } from './controllers/publisher-adinventory.controller';
import { PublisherAdInventoryService } from './services/publisher-adinventory.service';

@Module({
  controllers: [
    // AdminPublisherController,
    PublisherController,
    PublisherWebsiteController,
    PublisherFloorPriceController,
    PublisherAdInventoryController,
    PublisherTargetingController,
  ],
  providers: [PublisherService,PublisherAdInventoryService],
  exports: [PublisherService, PublisherAdInventoryService],
})
export class PublishersModule {}
