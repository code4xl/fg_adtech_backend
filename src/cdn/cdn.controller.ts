import {
    Controller,
    Get,
    Post,
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
  import {
    GenerateCdnDto,
    InvalidateCdnDto,
    CdnBuildResponseDto,
    CdnStatusDto,
    PublisherSdkConfigDto,
    BuildEnvironment,
  } from './dto';
  import { CDN_HEADERS } from './constants/cdn.constants';
  
  /**
   * CDN Controller
   * 
   * Handles all CDN-related endpoints for:
   * - SDK configuration preview
   * - CDN generation
   * - CDN serving
   * - Cache management
   */
  @Controller()
  export class CdnController {
    private readonly logger = new Logger(CdnController.name);
  
    constructor(
      private readonly cdnOrchestrator: CdnOrchestratorService,
      private readonly configBuilder: ConfigBuilderService,
      private readonly cdnCache: CdnCacheService,
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
      this.logger.log(`Preview SDK config for publisher ${publisherId}, website ${websiteId}`);
  
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
      this.logger.log(`Generate CDN for publisher ${publisherId}, website ${websiteId}`);
  
      const generateDto: GenerateCdnDto = {
        publisherId,
        websiteId,
        environment: dto.environment,
        forceRebuild: dto.forceRebuild || false,
        includeDebug: dto.includeDebug || false,
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
            message: 'Failed to generate CDN',
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
      this.logger.log(`Regenerate all CDN for publisher ${publisherId}`);
  
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
      this.logger.log(`Get CDN status for publisher ${publisherId}`);
  
      try {
        const status = await this.cdnOrchestrator.getCdnStatus(publisherId, websiteId);
        
        return {
          isBuilt: status.hasStorage,
          lastBuildDate: status.metadata?.createdAt,
          cdnUrl: status.metadata 
            ? `${process.env.CDN_BASE_URL}/p/${publisherId}/init.js`
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
      this.logger.log(`Invalidate CDN for publisher ${publisherId}`);
  
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
     * Serve CDN file
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
      this.logger.log(`Serve CDN for publisher ${publisherId}`);
  
      try {
        const content = await this.cdnOrchestrator.serveCdnContent(
          publisherId,
          environment,
        );
  
        if (!content) {
          res.status(404).json({
            statusCode: 404,
            message: 'CDN file not found',
          });
          return;
        }
  
        // Set headers
        Object.entries(content.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
  
        // Additional security headers
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
        // Send content
        res.status(200).send(content.content);
      } catch (error) {
        this.logger.error(`Failed to serve CDN: ${error.message}`);
        res.status(500).json({
          statusCode: 500,
          message: 'Failed to serve CDN file',
        });
      }
    }
  
    /**
     * Get cache statistics
     * GET /api/cdn/cache/stats
     */
    @Get('api/cdn/cache/stats')
    @UseGuards(AuthGuard('jwt'), RoleGuard)
    @Roles('PUBLISHER', 'ADMIN')
    async getCacheStats(): Promise<any> {
      this.logger.log('Get CDN cache statistics');
  
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
      this.logger.log('Clear all CDN caches');
  
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
  }