import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

// Controllers
import { CdnController } from './cdn.controller';

// Services
import { ConfigBuilderService } from './services/config-builder.service';
import { InventoryMapperService } from './services/inventory-mapper.service';
import { SelectorGeneratorService } from './services/selector-generator.service';
import { CdnGeneratorService } from './services/cdn-generator.service';
import { CdnStorageService } from './services/cdn-storage.service';
import { CdnCacheService } from './services/cdn-cache.service';
import { CdnOrchestratorService } from './services/cdn-orchestrator.service';

// Guards
import { CdnAccessGuard } from './guards/cdn-access.guard';
import { RoleGuard } from '../common/guards/role.guard';

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
    CdnController,
  ],
  providers: [
    // Guards
    CdnAccessGuard,
    RoleGuard,
    
    // Part 2 Services - Configuration Building
    ConfigBuilderService,
    InventoryMapperService,
    SelectorGeneratorService,
    
    // Part 3 Services - CDN Generation & Storage
    CdnGeneratorService,
    CdnStorageService,
    CdnCacheService,
    CdnOrchestratorService,
  ],
  exports: [
    CdnOrchestratorService,
    ConfigBuilderService,
    CdnCacheService,
  ],
})
export class CdnModule {}