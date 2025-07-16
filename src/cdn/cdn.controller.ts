import {
  Controller,
  Get,
  Post,
  Options,
  Param,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
  Res,
  Query,
  Logger,
  Delete,
} from '@nestjs/common';
  import { Response } from 'express';
  import { AuthGuard } from '@nestjs/passport';
  import { RoleGuard } from '../common/guards/role.guard';
  import { Roles } from '../common/decorators/roles.decorator';
  import { CdnAccessGuard } from './guards/cdn-access.guard';
  import { CdnOrchestratorService } from './services/cdn-orchestrator.service';
  import { ConfigBuilderService } from './services/config-builder.service';
  import { CdnCacheService } from './services/cdn-cache.service';
  import { PrismaService } from '../prisma/prisma.service';
  import {
    GenerateCdnDto,
    InvalidateCdnDto,
    CdnBuildResponseDto,
    CdnStatusDto,
    PublisherSdkConfigDto,
    BuildEnvironment,
  } from './dto';
  import { CDN_HEADERS } from './constants/cdn.constants';
import { ApiTags } from '@nestjs/swagger';

/**
 * V2 Publisher CDN DTO for multi-website requests
 */
export class GeneratePublisherCdnDto {
  environment?: BuildEnvironment;
  includeDebug?: boolean;
  forceRebuild?: boolean;
  websiteIds?: string[]; // Optional filter for specific websites
}
  
  /**
   * Preview SDK configuration for a publisher website
   * GET /api/publishers/:publisherId/websites/:websiteId/sdk-config
   */
  @ApiTags("CDN")
  @Controller()
  export class CdnController {
    private readonly logger = new Logger(CdnController.name);
  
    constructor(
      private readonly cdnOrchestrator: CdnOrchestratorService,
      private readonly configBuilder: ConfigBuilderService,
      private readonly cdnCache: CdnCacheService,
      private readonly prisma: PrismaService,
    ) {}
  
    /**
     * Preview SDK configuration for a publisher website
     * GET /api/publishers/:publisherId/websites/:websiteId/sdk-config
     */
    @Get('api/publishers/:publisherId/websites/:websiteId/sdk-config')
    @UseGuards(AuthGuard('jwt'), RoleGuard, CdnAccessGuard)
    @Roles('PUBLISHER', 'ADMIN')
    async previewSdkConfig(
      @Param('publisherId') publisherId: string,
      @Param('websiteId') websiteId: string,
      @Query('includeDebug') includeDebug?: boolean,
    ): Promise<PublisherSdkConfigDto> {
      this.logger.debug(`Preview SDK config for publisher ${publisherId}, website ${websiteId}`);
  
      try {
        const config = await this.configBuilder.buildConfiguration(publisherId, websiteId, {
          includeDebug: includeDebug === true,
        });
  
        const validation = this.configBuilder.validateConfiguration(config);
        
        if (!validation.isValid) {
          throw new HttpException(
            {
              statusCode: HttpStatus.BAD_REQUEST,
              message: 'Configuration validation failed',
              errors: validation.errors,
            },
            HttpStatus.BAD_REQUEST,
          );
        }
  
        return config as PublisherSdkConfigDto;
      } catch (error) {
        if (error instanceof HttpException) {
          throw error;
        }
        
        throw new HttpException(
          {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Failed to generate SDK configuration',
            error: error.message,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  
    /**
     * Debug endpoint to check if publisher and website data exists
     * GET /api/publishers/:publisherId/websites/:websiteId/debug
     */
    @Get('api/publishers/:publisherId/websites/:websiteId/debug')
    @UseGuards(AuthGuard('jwt'), RoleGuard, CdnAccessGuard)
    @Roles('PUBLISHER', 'ADMIN')
    async debugPublisherWebsite(
      @Param('publisherId') publisherId: string,
      @Param('websiteId') websiteId: string,
    ): Promise<any> {
      this.logger.debug(`Debug check for publisher ${publisherId}, website ${websiteId}`);
  
      try {
        // Check if publisher exists
        const publisher = await this.prisma.publisher.findUnique({
          where: { id: publisherId },
        });
  
        if (!publisher) {
          return {
            status: 'error',
            message: 'Publisher not found',
            publisherId,
            websiteId,
          };
        }
  
        // Check if website exists
        const website = await this.prisma.website.findUnique({
          where: { 
            id: websiteId,
            publisherId: publisherId 
          },
          include: {
            inventories: {
              where: { isActive: true },
            },
          },
        });
  
        if (!website) {
          return {
            status: 'error',
            message: 'Website not found or does not belong to publisher',
            publisherId,
            websiteId,
            publisherExists: true,
          };
        }
  
        return {
          status: 'success',
          message: 'Publisher and website found',
          data: {
            publisher: {
              id: publisher.id,
              email: publisher.email,
              status: publisher.status,
            },
            website: {
              id: website.id,
              name: website.name,
              domain: website.domain,
              url: website.url,
              isActive: website.isActive,
              inventoriesCount: website.inventories.length,
            },
          },
        };
      } catch (error) {
        return {
          status: 'error',
          message: 'Database error',
          error: error.message,
          publisherId,
          websiteId,
        };
      }
    }
  
    /**
     * Generate CDN for a publisher website
     * POST /api/publishers/:publisherId/websites/:websiteId/generate-cdn
     */
    @Post('api/publishers/:publisherId/websites/:websiteId/generate-cdn')
    @UseGuards(AuthGuard('jwt'), RoleGuard, CdnAccessGuard)
    @Roles('PUBLISHER', 'ADMIN')
    async generateCdn(
      @Param('publisherId') publisherId: string,
      @Param('websiteId') websiteId: string,
      @Body() dto: Partial<GenerateCdnDto>,
    ): Promise<CdnBuildResponseDto> {
      this.logger.debug(`Generate CDN for publisher ${publisherId}, website ${websiteId}`);
  
      // Ensure dto is not undefined by providing default empty object
      const requestDto = dto || {};
  
      const generateDto: GenerateCdnDto = {
        publisherId,
        websiteId,
        environment: requestDto.environment,
        forceRebuild: requestDto.forceRebuild || false,
        includeDebug: requestDto.includeDebug || false,
      };
  
      try {
        const result = await this.cdnOrchestrator.generateAndDeployDN(generateDto);
  
        if (!result.success) {
          throw new HttpException(
            {
              statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
              message: 'CDN generation failed',
              error: result.error,
            },
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
  
        return {
          cdnUrl: result.cdnUrl!,
          integrity: result.integrity!,
          version: result.version!,
          publisherId,
          websiteId,
          buildId: result.buildId!,
          environment: generateDto.environment || 'production',
          createdAt: new Date().toISOString(),
        } as CdnBuildResponseDto;
      } catch (error) {
        if (error instanceof HttpException) {
          throw error;
        }
  
        throw new HttpException(
          {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'CDN generation failed',
            error: error.message,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

       
    }
  
    /**
     * Regenerate CDN for all websites of a publisher
     * POST /api/publishers/:publisherId/regenerate-cdn
     */
    @Post('api/publishers/:publisherId/regenerate-cdn')
    @UseGuards(AuthGuard('jwt'), RoleGuard, CdnAccessGuard)
    @Roles('PUBLISHER', 'ADMIN')
    async regenerateAllCdn(
      @Param('publisherId') publisherId: string,
      @Body() dto: { environment?: BuildEnvironment; includeDebug?: boolean },
    ): Promise<{ websiteId: string; result: CdnBuildResponseDto }[]> {
      this.logger.debug(`Regenerate all CDN for publisher ${publisherId}`);
  
      try {
        const results = await this.cdnOrchestrator.regenerateAllPublisherCdn(
          publisherId,
          dto,
        );
  
        const response: { websiteId: string; result: CdnBuildResponseDto }[] = [];
  
        for (const [websiteId, result] of results) {
          if (result.success) {
            response.push({
              websiteId,
              result: {
                cdnUrl: result.cdnUrl!,
                integrity: result.integrity!,
                version: result.version!,
                publisherId,
                websiteId,
                buildId: result.buildId!,
                environment: dto.environment || 'production',
                createdAt: new Date().toISOString(),
              } as CdnBuildResponseDto,
            });
          }
        }
  
        return response;
      } catch (error) {
        throw new HttpException(
          {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Failed to regenerate CDN',
            error: error.message,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  
    /**
     * Get CDN status for a publisher
     * GET /api/publishers/:publisherId/cdn-status
     */
    @Get('api/publishers/:publisherId/cdn-status')
    @UseGuards(AuthGuard('jwt'), RoleGuard, CdnAccessGuard)
    @Roles('PUBLISHER', 'ADMIN')
    async getCdnStatus(
      @Param('publisherId') publisherId: string,
      @Query('websiteId') websiteId?: string,
    ): Promise<CdnStatusDto> {
      this.logger.debug(`Get CDN status for publisher ${publisherId}`);
  
      try {
        const status = await this.cdnOrchestrator.getCdnStatus(publisherId, websiteId);
        
        return {
          isBuilt: status.hasStorage,
          lastBuildDate: status.metadata?.createdAt,
          cdnUrl: status.metadata 
            ? `${process.env.CDN_BASE_URL}/cdn/p/${publisherId}/init.js`
            : undefined,
          version: status.metadata?.version,
          environment: status.metadata?.environment || 'production',
          isCached: status.hasCache,
          cacheExpiresAt: status.cacheStats?.ttl 
            ? new Date(Date.now() + status.cacheStats.ttl * 1000).toISOString()
            : undefined,
        } as CdnStatusDto;
      } catch (error) {
        throw new HttpException(
          {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Failed to get CDN status',
            error: error.message,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  
    /**
     * Invalidate CDN cache
     * POST /api/publishers/:publisherId/invalidate-cdn
     */
    @Post('api/publishers/:publisherId/invalidate-cdn')
    @UseGuards(AuthGuard('jwt'), RoleGuard, CdnAccessGuard)
    @Roles('PUBLISHER', 'ADMIN')
    async invalidateCdn(
      @Param('publisherId') publisherId: string,
      @Body() dto: InvalidateCdnDto,
    ): Promise<{ message: string }> {
      this.logger.debug(`Invalidate CDN for publisher ${publisherId}`);
  
      try {
        await this.cdnOrchestrator.invalidateAndRegenerate(
          publisherId,
          dto.websiteId,
          true, // Always regenerate after invalidation
        );
  
        return {
          message: `CDN cache invalidated and regenerated for publisher ${publisherId}`,
        };
      } catch (error) {
        throw new HttpException(
          {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Failed to invalidate CDN',
            error: error.message,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  
        /**
     * Handle OPTIONS preflight for CDN file
     * OPTIONS /cdn/p/:publisherId/init.js
     */
    @Options('cdn/p/:publisherId/init.js')
    async serveCdnOptions(@Res() res: Response): Promise<void> {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
      res.setHeader('Access-Control-Max-Age', '86400');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.status(204).send();
    }

    /**
     * Serve CDN file with content validation
     * GET /cdn/p/:publisherId/init.js
     * 
     * This endpoint is public and does not require authentication
     */
    @Get('cdn/p/:publisherId/init.js')
    async serveCdn(
      @Param('publisherId') publisherId: string,
      @Query('env') environment: string,
      @Res() res: Response,
    ): Promise<void> {
      this.logger.debug(`Serve CDN for publisher ${publisherId}`);

      try {
        const content = await this.cdnOrchestrator.serveCdnContent(
          publisherId,
          environment,
        );

        if (!content) {
          // Set CORS headers even for 404 responses
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
          res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
          
          res.status(404).json({
            statusCode: 404,
            message: 'CDN file not found',
          });
        }

        // Validate content before serving
        if (!content.content || content.content.length === 0) {
          this.logger.error(`Empty CDN content for publisher ${publisherId}`);
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
          res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
          
          res.status(500).json({
            statusCode: 500,
            message: 'CDN content is empty',
          });
          return;
        }

        // Validate JavaScript syntax before serving
        try {
          new Function(content.content);
        } catch (syntaxError) {
          this.logger.error(`CDN content has syntax errors for publisher ${publisherId}: ${syntaxError.message}`);
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
          res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
          
          res.status(500).json({
            statusCode: 500,
            message: 'CDN content is corrupted',
            error: 'JavaScript syntax error detected'
          });
          return;
        }

        // Check for minimum content size
        if (content.content.length < 1000) {
          this.logger.warn(`CDN content seems unusually small for publisher ${publisherId}: ${content.content.length} bytes`);
        }

        // Set all CDN headers (including CORS headers)
        Object.entries(content.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });

        // Additional security headers (these might override some from content.headers)
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        
        // Set content length explicitly
        res.setHeader('Content-Length', Buffer.byteLength(content.content, 'utf8'));

        // Send content
        res.status(200).send(content.content);
        
        this.logger.debug(`CDN served successfully for publisher ${publisherId} (${content.content.length} bytes)`);
        
      } catch (error) {
        this.logger.error(`Failed to serve CDN: ${error.message}`);
        
        // Set CORS headers even for error responses
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        
        res.status(500).json({
          statusCode: 500,
          message: 'Failed to serve CDN file',
          error: error.message
        });
        return;
      }

      // Set headers
    //   Object.entries(content.headers).forEach(([key, value]) => {
    //     res.setHeader(key, value);
    //   });

    //   // Additional security headers
    //   res.setHeader('X-Content-Type-Options', 'nosniff');
    //   res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    //   // Send content
    //   res.status(200).send(content.content);
    // } catch (error) {
    //   this.logger.error(`Failed to serve CDN: ${error.message}`);
    //   res.status(500).json({
    //     statusCode: 500,
    //     message: 'Failed to serve CDN file',
    //   });
    }
  
    /**
     * Get cache statistics
     * GET /api/cdn/cache/stats
     */
    @Get('api/cdn/cache/stats')
    @UseGuards(AuthGuard('jwt'), RoleGuard)
    @Roles('PUBLISHER', 'ADMIN')
    async getCacheStats(): Promise<any> {
      this.logger.debug('Get CDN cache statistics');
  
      try {
        return await this.cdnCache.getCacheStats();
      } catch (error) {
        throw new HttpException(
          {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Failed to get cache statistics',
            error: error.message,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  
    /**
     * Clear all CDN caches
     * DELETE /api/cdn/cache/clear
     */
    @Delete('api/cdn/cache/clear')
    @UseGuards(AuthGuard('jwt'), RoleGuard)
    @Roles('PUBLISHER', 'ADMIN')
    async clearCache(): Promise<{ message: string }> {
      this.logger.debug('Clear all CDN caches');
  
      try {
        await this.cdnCache.clearAll();
        return { message: 'All CDN caches cleared successfully' };
      } catch (error) {
        throw new HttpException(
          {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Failed to clear caches',
            error: error.message,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    /**
     * Force regenerate CDN with complete cleanup
     * POST /api/publishers/:publisherId/websites/:websiteId/force-regenerate-cdn
     */
    @Post('api/publishers/:publisherId/websites/:websiteId/force-regenerate-cdn')
    @UseGuards(AuthGuard('jwt'), RoleGuard, CdnAccessGuard)
    @Roles('PUBLISHER', 'ADMIN')
    async forceRegenerateCdn(
      @Param('publisherId') publisherId: string,
      @Param('websiteId') websiteId: string,
      @Body() dto: Partial<GenerateCdnDto>,
    ): Promise<CdnBuildResponseDto> {
      this.logger.debug(`Force regenerating CDN for publisher ${publisherId}, website ${websiteId}`);

      try {
        const result = await this.cdnOrchestrator.forceRegenerateCdn(
          publisherId,
          websiteId,
          {
            environment: dto?.environment,
            includeDebug: dto?.includeDebug,
          },
        );

        if (!result.success) {
          throw new HttpException(
            {
              statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
              message: 'Force CDN regeneration failed',
              error: result.error,
            },
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

        return {
          cdnUrl: result.cdnUrl!,
          integrity: result.integrity!,
          version: result.version!,
          publisherId,
          websiteId,
          buildId: result.buildId!,
          environment: dto?.environment || 'production',
          createdAt: new Date().toISOString(),
          message: 'CDN force regenerated successfully with complete cleanup',
        } as CdnBuildResponseDto;
      } catch (error) {
        if (error instanceof HttpException) {
          throw error;
        }

        throw new HttpException(
          {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Failed to force regenerate CDN',
            error: error.message,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    /**
     * Complete CDN cleanup
     * DELETE /api/publishers/:publisherId/cdn-cleanup
     */
    @Delete('api/publishers/:publisherId/cdn-cleanup')
    @UseGuards(AuthGuard('jwt'), RoleGuard, CdnAccessGuard)
    @Roles('PUBLISHER', 'ADMIN')
    async cleanupCdn(
      @Param('publisherId') publisherId: string,
      @Body() dto: { 
        websiteId?: string; 
        environment?: BuildEnvironment; 
        cleanupDatabase?: boolean; 
      },
    ): Promise<{ message: string }> {
      this.logger.debug(`CDN cleanup for publisher ${publisherId}`);

      try {
        await this.cdnOrchestrator.cleanupCdn(publisherId, {
          websiteId: dto?.websiteId,
          environment: dto?.environment,
          cleanupDatabase: dto?.cleanupDatabase,
        });

        return {
          message: `CDN cleanup completed successfully for publisher ${publisherId}`,
        };
      } catch (error) {
        throw new HttpException(
          {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Failed to cleanup CDN',
            error: error.message,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    /**
     * Clear SDK cache (debug endpoint)
     * DELETE /api/cdn/sdk-cache/clear
     */
    @Delete('api/cdn/sdk-cache/clear')
    @UseGuards(AuthGuard('jwt'), RoleGuard)
    @Roles('PUBLISHER', 'ADMIN')
    async clearSdkCache(): Promise<{ message: string }> {
      this.logger.debug('Clearing SDK cache');
      
      try {
        this.cdnOrchestrator.clearSdkCache();
        return { message: 'SDK cache cleared successfully' };
      } catch (error) {
        throw new HttpException(
          {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Failed to clear SDK cache',
            error: error.message,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    // ===== V2 PUBLISHER-FOCUSED ENDPOINTS =====

    /**
     * Generate V2 CDN for entire publisher (all websites)
     * POST /api/publishers/:publisherId/generate-cdn
     */
    @Post('api/publishers/:publisherId/generate-cdn')
    @UseGuards(AuthGuard('jwt'), RoleGuard)
    @Roles('PUBLISHER', 'ADMIN')
    async generatePublisherCdn(
      @Param('publisherId') publisherId: string,
      @Body() dto: GeneratePublisherCdnDto,
    ): Promise<CdnBuildResponseDto> {
      this.logger.debug(`V2 CDN generation request for publisher ${publisherId}`);

      try {
        const result = await this.cdnOrchestrator.generatePublisherCdn(
          publisherId,
          dto,
        );

        if (!result.success) {
          throw new HttpException(
            {
              statusCode: HttpStatus.BAD_REQUEST,
              message: 'V2 CDN generation failed',
              error: result.error,
            },
            HttpStatus.BAD_REQUEST,
          );
        }

        return {
          success: true,
          cdnUrl: result.cdnUrl!,
          version: result.version!,
          buildId: result.buildId!,
          integrity: result.integrity!,
          publisherId,
          websiteId: result.metadata?.websiteIds?.[0] || '',
          environment: dto.environment || BuildEnvironment.PRODUCTION,
          createdAt: new Date().toISOString(),
          websiteCount: result.websiteCount!,
          domains: result.domains!,
          metadata: result.metadata!,
          message: `V2 CDN generated successfully for ${result.websiteCount} websites`,
        };
      } catch (error) {
        this.logger.error(`V2 CDN generation failed: ${error.message}`);
        throw new HttpException(
          {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'V2 CDN generation failed',
            error: error.message,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    /**
     * Add website to existing publisher CDN
     * POST /api/publishers/:publisherId/websites/:websiteId/add-to-cdn
     */
    @Post('api/publishers/:publisherId/websites/:websiteId/add-to-cdn')
    @UseGuards(AuthGuard('jwt'), RoleGuard)
    @Roles('PUBLISHER', 'ADMIN')
    async addWebsiteToPublisherCdn(
      @Param('publisherId') publisherId: string,
      @Param('websiteId') websiteId: string,
      @Body() dto: { environment?: BuildEnvironment; includeDebug?: boolean },
    ): Promise<CdnBuildResponseDto> {
      this.logger.debug(
        `Adding website ${websiteId} to publisher ${publisherId} CDN`,
      );

      try {
        const result = await this.cdnOrchestrator.addWebsiteToPublisherCdn(
          publisherId,
          websiteId,
          dto,
        );

        if (!result.success) {
          throw new HttpException(
            {
              statusCode: HttpStatus.BAD_REQUEST,
              message: 'Failed to add website to CDN',
              error: result.error,
            },
            HttpStatus.BAD_REQUEST,
          );
        }

        return {
          success: true,
          cdnUrl: result.cdnUrl!,
          version: result.version!,
          buildId: result.buildId!,
          integrity: result.integrity!,
          publisherId,
          websiteId,
          environment: dto.environment || BuildEnvironment.PRODUCTION,
          createdAt: new Date().toISOString(),
          websiteCount: result.websiteCount!,
          domains: result.domains!,
          metadata: result.metadata!,
          message: `Website ${websiteId} added to publisher CDN successfully`,
        };
      } catch (error) {
        this.logger.error(`Failed to add website to CDN: ${error.message}`);
        throw new HttpException(
          {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Failed to add website to CDN',
            error: error.message,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    /**
     * Remove website from publisher CDN
     * DELETE /api/publishers/:publisherId/websites/:websiteId/remove-from-cdn
     */
    @Delete('api/publishers/:publisherId/websites/:websiteId/remove-from-cdn')
    @UseGuards(AuthGuard('jwt'), RoleGuard)
    @Roles('PUBLISHER', 'ADMIN')
    async removeWebsiteFromPublisherCdn(
      @Param('publisherId') publisherId: string,
      @Param('websiteId') websiteId: string,
      @Body() dto: { environment?: BuildEnvironment; includeDebug?: boolean },
    ): Promise<CdnBuildResponseDto> {
      this.logger.debug(
        `Removing website ${websiteId} from publisher ${publisherId} CDN`,
      );

      try {
        const result = await this.cdnOrchestrator.removeWebsiteFromPublisherCdn(
          publisherId,
          websiteId,
          dto,
        );

        if (!result.success) {
          throw new HttpException(
            {
              statusCode: HttpStatus.BAD_REQUEST,
              message: 'Failed to remove website from CDN',
              error: result.error,
            },
            HttpStatus.BAD_REQUEST,
          );
        }

        return {
          success: true,
          cdnUrl: result.cdnUrl!,
          version: result.version!,
          buildId: result.buildId!,
          integrity: result.integrity!,
          publisherId,
          websiteId,
          environment: dto.environment || BuildEnvironment.PRODUCTION,
          createdAt: new Date().toISOString(),
          websiteCount: result.websiteCount!,
          domains: result.domains!,
          metadata: result.metadata!,
          message: `Website ${websiteId} removed from publisher CDN successfully`,
        };
      } catch (error) {
        this.logger.error(
          `Failed to remove website from CDN: ${error.message}`,
        );
        throw new HttpException(
          {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Failed to remove website from CDN',
            error: error.message,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    /**
     * Get V2 configuration preview for publisher
     * GET /api/publishers/:publisherId/config/preview
     */
    @Get('api/publishers/:publisherId/config/preview')
    @UseGuards(AuthGuard('jwt'), RoleGuard)
    @Roles('PUBLISHER', 'ADMIN')
    async getPublisherConfigPreview(
      @Param('publisherId') publisherId: string,
      @Query('includeDebug') includeDebug?: boolean,
      @Query('websiteIds') websiteIds?: string,
    ): Promise<any> {
      this.logger.debug(`V2 config preview for publisher ${publisherId}`);

      try {
        const websiteIdArray = websiteIds
          ? websiteIds.split(',').map((id) => id.trim())
          : undefined;

        const config = await this.configBuilder.buildPublisherConfiguration(
          publisherId,
          {
            includeDebug: includeDebug || false,
            websiteIds: websiteIdArray,
          },
        );

        // Validate the configuration
        const validation = this.configBuilder.validatePublisherConfiguration(config);

        return {
          config,
          validation,
          summary: {
            publisherId: config.publisher.id,
            publisherTier: config.publisher.tier,
            websiteCount: Object.keys(config.websites).length,
            totalInventorySlots: Object.values(config.websites).reduce(
              (total, website) => total + website.inventory.length,
              0,
            ),
            domains: Object.keys(config.websites),
            version: config.meta.version,
            buildId: config.meta.buildId,
          },
        };
      } catch (error) {
        this.logger.error(
          `Failed to get V2 config preview: ${error.message}`,
        );
        throw new HttpException(
          {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Failed to get V2 configuration preview',
            error: error.message,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    /**
     * Migrate V1 configuration to V2 format
     * POST /api/publishers/:publisherId/migrate-to-v2
     */
    @Post('api/publishers/:publisherId/migrate-to-v2')
    @UseGuards(AuthGuard('jwt'), RoleGuard)
    @Roles('PUBLISHER', 'ADMIN')
    async migratePublisherToV2(
      @Param('publisherId') publisherId: string,
      @Body() dto: { websiteId: string; generateCdn?: boolean },
    ): Promise<any> {
      this.logger.debug(
        `Migrating publisher ${publisherId} from V1 to V2 configuration`,
      );

      try {
        // Get V1 configuration
        const v1Config = await this.configBuilder.buildConfiguration(
          publisherId,
          dto.websiteId,
        );

        // Migrate to V2
        const migrationResult = await this.configBuilder.migrateV1ToV2(v1Config);

        if (!migrationResult.success) {
          throw new HttpException(
            {
              statusCode: HttpStatus.BAD_REQUEST,
              message: 'V1 to V2 migration failed',
              errors: migrationResult.errors,
            },
            HttpStatus.BAD_REQUEST,
          );
        }

        // Optionally generate CDN with new V2 configuration
        let cdnResult = null;
        if (dto.generateCdn) {
          cdnResult = await this.cdnOrchestrator.generatePublisherCdn(
            publisherId,
            { forceRebuild: true },
          );
        }

        return {
          success: true,
          migration: migrationResult,
          cdn: cdnResult,
          message: 'Successfully migrated to V2 configuration',
        };
      } catch (error) {
        this.logger.error(`V1 to V2 migration failed: ${error.message}`);
        throw new HttpException(
          {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'V1 to V2 migration failed',
            error: error.message,
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }
