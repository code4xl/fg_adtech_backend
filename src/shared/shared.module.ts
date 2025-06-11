import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdSlotTemplatePublicController, AdSlotTemplateProtectedController } from './controllers/adslot-template-public.controller';
import { ContentCategoryPublicController, ContentCategoryProtectedController } from './controllers/content-category-public.controller';

@Module({
  imports: [PrismaModule],
  controllers: [
    AdSlotTemplatePublicController,
    AdSlotTemplateProtectedController,
    ContentCategoryPublicController,
    ContentCategoryProtectedController,
  ],
  providers: [],
  exports: [],
})
export class SharedModule {} 