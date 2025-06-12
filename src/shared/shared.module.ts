import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { 
  AdSlotTemplatePublicController, 
  AdSlotTemplatePublisherController, 
  AdSlotTemplateAdvertiserController 
} from './controllers/adslot-template-public.controller';
import { 
  ContentCategoryPublicController, 
  ContentCategoryPublisherController, 
  ContentCategoryAdvertiserController 
} from './controllers/content-category-public.controller';

@Module({
  imports: [PrismaModule],
  controllers: [
    // Ad Slot Template Controllers
    AdSlotTemplatePublicController,
    AdSlotTemplatePublisherController,
    AdSlotTemplateAdvertiserController,
    // Content Category Controllers
    ContentCategoryPublicController,
    ContentCategoryPublisherController,
    ContentCategoryAdvertiserController,
  ],
  providers: [],
  exports: [],
})
export class SharedModule {} 