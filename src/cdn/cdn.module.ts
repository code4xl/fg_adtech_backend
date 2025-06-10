import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

// Services
import { ConfigBuilderService } from './services/config-builder.service';
import { InventoryMapperService } from './services/inventory-mapper.service';
import { SelectorGeneratorService } from './services/selector-generator.service';

/**
 * CDN Module
 * 
 * Handles the generation, storage, and serving of publisher-specific
 * SDK configurations for Ocean Ads platform.
 * 
 * Features:
 * - Publisher configuration generation
 * - CDN file building and storage
 * - Configuration caching
 * - Version management
 * - Multi-website support
 */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
  ],
  controllers: [
    // CdnController will be added in Part 4
  ],
  providers: [
    // Part 2 Services - Configuration Building
    ConfigBuilderService,
    InventoryMapperService,
    SelectorGeneratorService,
    
    // Part 3 Services - CDN Generation & Storage (to be added):
    // - CdnGeneratorService
    // - CdnStorageService
    // - CdnCacheService
  ],
  exports: [
    ConfigBuilderService,
    InventoryMapperService,
    SelectorGeneratorService,
  ],
})
export class CdnModule {}