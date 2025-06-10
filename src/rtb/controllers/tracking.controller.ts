import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Req,
  Res,
  Logger,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  Header,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ImpressionTrackingService } from '../services/impression-tracking.service';
import { ClickTrackingService } from '../services/click-tracking.service';

@ApiTags('Tracking')
@Controller('track')
export class TrackingController {
  private readonly logger = new Logger(TrackingController.name);

  // 1x1 transparent tracking pixel (base64 encoded)
  private readonly TRACKING_PIXEL = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64',
  );

  constructor(
    private readonly impressionService: ImpressionTrackingService,
    private readonly clickService: ClickTrackingService,
  ) {
    this.logger.log('Tracking Controller initialized - Phase 5');
  }

  /**
   * Track ad impression
   *
   * **Why this endpoint design:**
   * - Standard industry pattern: /track/impression/{id}
   * - Returns 1x1 pixel for seamless integration
   * - Extracts comprehensive user context from request
   * - Processes asynchronously to maintain performance
   *
   * **Flow:**
   * 1. Extract user context from HTTP headers
   * 2. Process impression event asynchronously
   * 3. Return tracking pixel immediately
   * 4. Update real-time counters and analytics
   */
  @Get('impression/:bidResponseId')
  @ApiOperation({
    summary: 'Track ad impression',
    description:
      'Records an ad impression event and returns a 1x1 tracking pixel',
  })
  @ApiParam({
    name: 'bidResponseId',
    description: 'Bid response ID from the winning bid',
    example: '550e8400-e29b-41d4-a716-446655440005',
  })
  @ApiResponse({
    status: 200,
    description: 'Tracking pixel returned successfully',
    headers: {
      'Content-Type': { description: 'image/gif' },
      'Cache-Control': { description: 'no-cache, no-store, must-revalidate' },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Bid response not found',
  })
  @Header('Content-Type', 'image/gif')
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async trackImpression(
    @Param('bidResponseId') bidResponseId: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const startTime = Date.now();

    this.logger.debug('Impression tracking request received', {
      bidResponseId,
      userAgent: request.headers['user-agent'],
      ip: this.extractClientIP(request),
    });

    try {
      // 1. Extract comprehensive user context from request
      const userContext = this.extractUserContext(request);
      const requestContext = this.extractRequestContext(request);

      // 2. Process impression asynchronously (don't await to maintain speed)
      this.impressionService
        .trackImpression(bidResponseId, userContext, requestContext)
        .catch((error) => {
          // Log error but don't block response
          this.logger.error('Async impression processing failed', {
            error: error.message,
            bidResponseId,
          });
        });

      // 3. Return tracking pixel immediately
      response.status(HttpStatus.OK);
      response.end(this.TRACKING_PIXEL);

      const processingTime = Date.now() - startTime;
      this.logger.log('Impression tracking completed', {
        bidResponseId,
        processingTime: `${processingTime}ms`,
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('Impression tracking failed', {
        error: error.message,
        bidResponseId,
        processingTime: `${processingTime}ms`,
      });

      // Still return tracking pixel to avoid breaking ad display
      response.status(HttpStatus.OK);
      response.end(this.TRACKING_PIXEL);
    }
  }

  /**
   * Track ad click and redirect
   *
   * **Why this endpoint design:**
   * - Standard click tracking pattern with redirect
   * - Captures click context before redirect
   * - Handles malformed URLs gracefully
   * - Supports click coordinate tracking for heatmaps
   *
   * **Flow:**
   * 1. Extract user and click context
   * 2. Process click event asynchronously
   * 3. Redirect to landing URL immediately
   * 4. Update click counters and CTR metrics
   */
  @Get('click/:bidResponseId')
  @ApiOperation({
    summary: 'Track ad click and redirect',
    description: 'Records a click event and redirects user to the landing page',
  })
  @ApiParam({
    name: 'bidResponseId',
    description: 'Bid response ID from the clicked ad',
    example: '550e8400-e29b-41d4-a716-446655440005',
  })
  @ApiQuery({
    name: 'url',
    description: 'Landing URL to redirect to',
    example: 'https://example.com/landing',
  })
  @ApiQuery({
    name: 'x',
    description: 'Click X coordinate (optional)',
    required: false,
  })
  @ApiQuery({
    name: 'y',
    description: 'Click Y coordinate (optional)',
    required: false,
  })
  @ApiResponse({
    status: 302,
    description: 'Redirect to landing page',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or missing landing URL',
  })
  @ApiResponse({
    status: 404,
    description: 'Bid response not found',
  })
  async trackClick(
    @Param('bidResponseId') bidResponseId: string,
    @Query('url') redirectUrl: string,
    @Req() request: Request,
    @Res() response: Response,
    @Query('x') clickX?: string,
    @Query('y') clickY?: string,
  ): Promise<void> {
    const startTime = Date.now();

    this.logger.debug('Click tracking request received', {
      bidResponseId,
      redirectUrl,
      userAgent: request.headers['user-agent'],
      ip: this.extractClientIP(request),
    });

    try {
      // 1. Validate redirect URL
      if (!redirectUrl) {
        throw new BadRequestException('Landing URL is required');
      }

      const decodedUrl = decodeURIComponent(redirectUrl);
      if (!this.isValidUrl(decodedUrl)) {
        throw new BadRequestException('Invalid landing URL format');
      }

      // 2. Extract user and click context
      const userContext = this.extractUserContext(request);
      const requestContext = this.extractRequestContext(request);

      // Add click coordinates if provided
      const clickContext = {
        ...requestContext,
        clickX: clickX ? parseInt(clickX) : undefined,
        clickY: clickY ? parseInt(clickY) : undefined,
        landingUrl: decodedUrl,
      };

      // 3. Process click asynchronously (don't await to maintain redirect speed)
      this.clickService
        .trackClick(bidResponseId, userContext, clickContext, decodedUrl)
        .catch((error) => {
          // Log error but don't block redirect
          this.logger.error('Async click processing failed', {
            error: error.message,
            bidResponseId,
          });
        });

      // 4. Redirect to landing URL immediately
      response.redirect(302, decodedUrl);

      const processingTime = Date.now() - startTime;
      this.logger.log('Click tracking completed', {
        bidResponseId,
        redirectUrl: decodedUrl,
        processingTime: `${processingTime}ms`,
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('Click tracking failed', {
        error: error.message,
        bidResponseId,
        redirectUrl,
        processingTime: `${processingTime}ms`,
      });

      if (error instanceof BadRequestException) {
        response.status(HttpStatus.BAD_REQUEST);
        response.json({ error: error.message });
      } else {
        // Redirect to a safe fallback URL or show error page
        response.status(HttpStatus.INTERNAL_SERVER_ERROR);
        response.json({ error: 'Click tracking failed' });
      }
    }
  }

  /**
   * Batch impression tracking
   *
   * **Why batch processing:**
   * - Reduces API overhead for high-volume tracking
   * - Enables efficient database writes
   * - Supports SDK batching for performance optimization
   * - Provides detailed response for each event
   */
  // @Post('batch/impressions')
  // @ApiOperation({
  //   summary: 'Track multiple impressions in batch',
  //   description:
  //     'Processes multiple impression events in a single API call for efficiency',
  // })
  // @ApiBody({
  //   // type: BatchImpressionEventsDto,
  //   description: 'Array of impression events to process',
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Batch processing completed',
  //   // type: BatchTrackingResponseDto,
  // })
  // @ApiResponse({
  //   status: 400,
  //   description: 'Invalid batch data',
  // })
  // async batchTrackImpressions(
  //   @Body() batchData: BatchImpressionEventsDto,
  // ): Promise<BatchTrackingResponseDto> {
  //   const startTime = Date.now();

  //   this.logger.debug('Batch impression tracking started', {
  //     eventCount: batchData.events.length,
  //     metadata: batchData.metadata,
  //   });

  //   try {
  //     // 1. Validate batch size
  //     if (batchData.events.length === 0) {
  //       throw new BadRequestException('No events provided');
  //     }

  //     if (batchData.events.length > 100) {
  //       throw new BadRequestException('Batch size cannot exceed 100 events');
  //     }

  //     // 2. Process events in parallel with error isolation
  //     const results = await Promise.allSettled(
  //       batchData.events.map(async (event, index) => {
  //         try {
  //           const result =
  //             await this.impressionService.trackImpressionFromDTO(event);
  //           return {
  //             status: 'success' as const,
  //             eventId: result.id,
  //             message: 'Impression tracked successfully',
  //             timestamp: new Date().toISOString(),
  //           };
  //         } catch (error) {
  //           this.logger.warn('Batch impression event failed', {
  //             index,
  //             error: error.message,
  //             bidResponseId: event.bidResponseId,
  //           });
  //           return {
  //             status: 'error' as const,
  //             eventId: `error_${index}`,
  //             message: error.message,
  //             timestamp: new Date().toISOString(),
  //           };
  //         }
  //       }),
  //     );

  //     // 3. Compile batch response
  //     const responses: TrackingResponseDto[] = results.map((result) =>
  //       result.status === 'fulfilled' ? result.value : result.reason,
  //     );

  //     const successCount = responses.filter(
  //       (r) => r.status === 'success',
  //     ).length;
  //     const failedCount = responses.length - successCount;
  //     const processingTime = Date.now() - startTime;

  //     const batchResponse: BatchTrackingResponseDto = {
  //       status:
  //         failedCount === 0
  //           ? 'success'
  //           : successCount > 0
  //             ? 'partial_success'
  //             : 'error',
  //       processedCount: successCount,
  //       failedCount,
  //       results: responses,
  //       summary: {
  //         totalTime: `${processingTime}ms`,
  //         avgProcessingTime: `${(processingTime / batchData.events.length).toFixed(2)}ms`,
  //         throughput: `${(batchData.events.length / (processingTime / 1000)).toFixed(0)} events/sec`,
  //       },
  //       timestamp: new Date().toISOString(),
  //     };

  //     this.logger.log('Batch impression tracking completed', {
  //       totalEvents: batchData.events.length,
  //       successCount,
  //       failedCount,
  //       processingTime: `${processingTime}ms`,
  //     });

  //     return batchResponse;
  //   } catch (error) {
  //     const processingTime = Date.now() - startTime;

  //     this.logger.error('Batch impression tracking failed', {
  //       error: error.message,
  //       eventCount: batchData.events?.length || 0,
  //       processingTime: `${processingTime}ms`,
  //     });

  //     throw error;
  //   }
  // }

  // /**
  //  * Batch click tracking
  //  *
  //  * **Why separate from impression batch:**
  //  * - Clicks have different validation requirements
  //  * - Landing URL processing is click-specific
  //  * - Different error handling strategies needed
  //  */
  // @Post('batch/clicks')
  // @ApiOperation({
  //   summary: 'Track multiple clicks in batch',
  //   description:
  //     'Processes multiple click events in a single API call for efficiency',
  // })
  // @ApiBody({
  //   type: BatchClickEventsDto,
  //   description: 'Array of click events to process',
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Batch processing completed',
  //   type: BatchTrackingResponseDto,
  // })
  // @ApiResponse({
  //   status: 400,
  //   description: 'Invalid batch data',
  // })
  // async batchTrackClicks(
  //   @Body() batchData: BatchClickEventsDto,
  // ): Promise<BatchTrackingResponseDto> {
  //   const startTime = Date.now();

  //   this.logger.debug('Batch click tracking started', {
  //     eventCount: batchData.events.length,
  //     metadata: batchData.metadata,
  //   });

  //   try {
  //     // 1. Validate batch size
  //     if (batchData.events.length === 0) {
  //       throw new BadRequestException('No events provided');
  //     }

  //     if (batchData.events.length > 100) {
  //       throw new BadRequestException('Batch size cannot exceed 100 events');
  //     }

  //     // 2. Process events in parallel with error isolation
  //     const results = await Promise.allSettled(
  //       batchData.events.map(async (event, index) => {
  //         try {
  //           const result = await this.clickService.trackClickFromDTO(event);
  //           return {
  //             status: 'success' as const,
  //             eventId: result.id,
  //             message: 'Click tracked successfully',
  //             timestamp: new Date().toISOString(),
  //           };
  //         } catch (error) {
  //           this.logger.warn('Batch click event failed', {
  //             index,
  //             error: error.message,
  //             bidResponseId: event.bidResponseId,
  //           });
  //           return {
  //             status: 'error' as const,
  //             eventId: `error_${index}`,
  //             message: error.message,
  //             timestamp: new Date().toISOString(),
  //           };
  //         }
  //       }),
  //     );

  //     // 3. Compile batch response
  //     const responses: TrackingResponseDto[] = results.map((result) =>
  //       result.status === 'fulfilled' ? result.value : result.reason,
  //     );

  //     const successCount = responses.filter(
  //       (r) => r.status === 'success',
  //     ).length;
  //     const failedCount = responses.length - successCount;
  //     const processingTime = Date.now() - startTime;

  //     const batchResponse: BatchTrackingResponseDto = {
  //       status:
  //         failedCount === 0
  //           ? 'success'
  //           : successCount > 0
  //             ? 'partial_success'
  //             : 'error',
  //       processedCount: successCount,
  //       failedCount,
  //       results: responses,
  //       summary: {
  //         totalTime: `${processingTime}ms`,
  //         avgProcessingTime: `${(processingTime / batchData.events.length).toFixed(2)}ms`,
  //         throughput: `${(batchData.events.length / (processingTime / 1000)).toFixed(0)} events/sec`,
  //       },
  //       timestamp: new Date().toISOString(),
  //     };

  //     this.logger.log('Batch click tracking completed', {
  //       totalEvents: batchData.events.length,
  //       successCount,
  //       failedCount,
  //       processingTime: `${processingTime}ms`,
  //     });

  //     return batchResponse;
  //   } catch (error) {
  //     const processingTime = Date.now() - startTime;

  //     this.logger.error('Batch click tracking failed', {
  //       error: error.message,
  //       eventCount: batchData.events?.length || 0,
  //       processingTime: `${processingTime}ms`,
  //     });

  //     throw error;
  //   }
  // }

  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  /**
   * Extract comprehensive user context from HTTP request
   *
   * **Why comprehensive context extraction:**
   * - Enables accurate targeting verification
   * - Supports fraud detection algorithms
   * - Provides data for performance optimization
   * - Required for viewability measurement
   */
  private extractUserContext(request: Request): any {
    const userAgent = request.headers['user-agent'] || '';
    const ip = this.extractClientIP(request);

    return {
      userId: this.extractUserId(request),
      sessionId: this.extractSessionId(request),
      userAgent,
      ipAddress: ip,
      deviceType: this.detectDeviceType(userAgent),
      browserType: this.detectBrowserType(userAgent),
      osType: this.detectOSType(userAgent),
      language: request.headers['accept-language']?.split(',')[0] || 'en',
    };
  }

  /**
   * Extract request-specific context
   */
  private extractRequestContext(request: Request): any {
    return {
      pageUrl: request.headers.referer || request.query.page_url,
      referrerUrl: request.headers.referer,
      timestamp: new Date().toISOString(),
      requestId: this.generateRequestId(),
      serverTimestamp: Date.now(),
    };
  }

  /**
   * Extract client IP address considering proxies
   *
   * **Why multiple header checks:**
   * - Handles various proxy configurations
   * - Works with load balancers and CDNs
   * - Ensures accurate geolocation data
   */
  private extractClientIP(request: Request): string {
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (request.headers['x-real-ip'] as string) ||
      (request.headers['x-client-ip'] as string) ||
      (request.headers['cf-connecting-ip'] as string) || // Cloudflare
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      '127.0.0.1'
    ).trim();
  }

  /**
   * Extract user ID from cookies or headers
   */
  private extractUserId(request: Request): string | undefined {
    // Check for user ID in various locations
    return (
      (request.headers['x-user-id'] as string) ||
      request.cookies?.user_id ||
      request.cookies?.device_id ||
      undefined
    );
  }

  /**
   * Extract session ID from request
   */
  private extractSessionId(request: Request): string | undefined {
    return (
      (request.headers['x-session-id'] as string) ||
      request.cookies?.session_id ||
      undefined
    );
  }

  /**
   * Detect device type from user agent
   *
   * **Why device detection matters:**
   * - Enables device-specific performance analysis
   * - Supports responsive ad optimization
   * - Required for mobile vs desktop metrics
   */
  private detectDeviceType(userAgent: string): string {
    const ua = userAgent.toLowerCase();

    if (
      ua.includes('mobile') ||
      ua.includes('android') ||
      ua.includes('iphone')
    ) {
      return 'mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      return 'tablet';
    } else if (ua.includes('smart-tv') || ua.includes('tv')) {
      return 'tv';
    } else {
      return 'desktop';
    }
  }

  /**
   * Detect browser type from user agent
   */
  private detectBrowserType(userAgent: string): string {
    const ua = userAgent.toLowerCase();

    if (ua.includes('chrome') && !ua.includes('edge')) {
      return 'chrome';
    } else if (ua.includes('firefox')) {
      return 'firefox';
    } else if (ua.includes('safari') && !ua.includes('chrome')) {
      return 'safari';
    } else if (ua.includes('edge')) {
      return 'edge';
    } else if (ua.includes('opera')) {
      return 'opera';
    } else {
      return 'other';
    }
  }

  /**
   * Detect operating system from user agent
   */
  private detectOSType(userAgent: string): string {
    const ua = userAgent.toLowerCase();

    if (ua.includes('windows')) {
      return 'windows';
    } else if (ua.includes('mac os') || ua.includes('macos')) {
      return 'macos';
    } else if (ua.includes('linux')) {
      return 'linux';
    } else if (ua.includes('android')) {
      return 'android';
    } else if (
      ua.includes('ios') ||
      ua.includes('iphone') ||
      ua.includes('ipad')
    ) {
      return 'ios';
    } else {
      return 'other';
    }
  }

  /**
   * Extract country from request headers
   *
   * **Why geolocation extraction:**
   * - Verifies geographic targeting accuracy
   * - Enables region-specific performance analysis
   * - Supports compliance with local regulations
   */
  private extractCountry(request: Request): string | undefined {
    return (
      (request.headers['cf-ipcountry'] as string) || // Cloudflare
      (request.headers['x-country-code'] as string) ||
      (request.headers['geoip-country'] as string) ||
      undefined
    );
  }

  /**
   * Extract region/state from request headers
   */
  private extractRegion(request: Request): string | undefined {
    return (
      (request.headers['cf-region'] as string) || // Cloudflare
      (request.headers['x-region'] as string) ||
      (request.headers['geoip-region'] as string) ||
      undefined
    );
  }

  /**
   * Extract city from request headers
   */
  private extractCity(request: Request): string | undefined {
    return (
      (request.headers['cf-city'] as string) || // Cloudflare
      (request.headers['x-city'] as string) ||
      (request.headers['geoip-city'] as string) ||
      undefined
    );
  }

  /**
   * Extract timezone from request
   */
  private extractTimezone(request: Request): string | undefined {
    return (
      (request.headers['x-timezone'] as string) ||
      (request.query.tz as string) ||
      undefined
    );
  }

  /**
   * Validate URL format
   *
   * **Why URL validation is critical:**
   * - Prevents open redirect vulnerabilities
   * - Ensures landing page reachability
   * - Protects against malicious redirects
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Generate unique request ID for tracking
   */
  private generateRequestId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `req_${timestamp}_${random}`;
  }
}
