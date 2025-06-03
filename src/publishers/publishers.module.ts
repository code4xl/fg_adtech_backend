import { Module } from '@nestjs/common';
// import { PublishersService } from './publishers.service';
import { PublisherService } from './publisher.service'; // Add this import
// import { AdminPublisherController } from './admin.publisher.controller';
import { PublisherController } from './publisher.controller';
import { PublisherWebsiteController } from './publisher.website.controller';
import { PublisherFloorPriceController } from './publisher.floorprice.controller';
import { PublisherTargetingController } from './publisher.targeting.controller';

@Module({
  controllers: [
    // AdminPublisherController,
    PublisherController,
    PublisherWebsiteController,
    PublisherFloorPriceController,
    PublisherTargetingController,
  ],
  providers: [PublisherService],
  exports: [PublisherService],
})
export class PublishersModule {}
