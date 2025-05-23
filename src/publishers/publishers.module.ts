import { Module } from '@nestjs/common';
// import { PublishersService } from './publishers.service';
import { PublisherService } from './publisher.service'; // Add this import
import { AdminPublisherController } from './admin.publisher.controller';
import { PublisherController } from './publisher.controller';

@Module({
  controllers: [
    AdminPublisherController,
    PublisherController
  ],
  providers: [
    // PublishersService,
    PublisherService  
  ],
  exports: [
    PublisherService  
  ]
})
export class PublishersModule {}
