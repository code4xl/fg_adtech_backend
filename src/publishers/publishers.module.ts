import { Module } from '@nestjs/common';
// import { PublishersService } from './publishers.service';
import { PublisherService } from './publisher.service'; // Add this import
import { AdminPublisherController } from './admin.publisher.controller';
import { PublisherController } from './publisher.controller';
import { PublisherWebsiteController } from './publisher.website.controller';

@Module({
  controllers: [
    AdminPublisherController,
    PublisherController,
    PublisherWebsiteController,
  ],
  providers: [PublisherService],
  exports: [PublisherService],
})
export class PublishersModule {}
