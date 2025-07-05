// src/modules/tracking/tracking.controller.ts - CORRECTED VERSION
import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { TrackingService } from './tracking.service';
import { BudgetValidationService } from './services/budget-validation.service';
import { FraudDetectionService } from './fraud-detection.service';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { ImpressionClickLinkingService } from './services/impression-click-linking.service';
import { v4 as uuidv4 } from 'uuid';

@ApiExcludeController()
@ApiTags('Impression and Click Tracking')
@Controller('track')
export class TrackingController {
  private readonly logger = new Logger(TrackingController.name);

  constructor(
    private readonly trackingService: TrackingService,
    private readonly budgetValidation: BudgetValidationService,
    private readonly fraudDetection: FraudDetectionService,
    private readonly impressionClickLinking: ImpressionClickLinkingService,
  ) {}

  /**
   * High-performance impression tracking endpoint
   * Uses Redis-first approach for immediate budget control
   */
  @Get('impression/:bidResponseId')
  @HttpCode(HttpStatus.OK)
  async trackImpression(
    @Param('bidResponseId') bidResponseId: string,
    @Query() query: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const startTime = Date.now();
      const impressionId = uuidv4();
      const userData = this.extractUserData(req, query);
      const userFingerprint =
        this.impressionClickLinking.generateUserFingerprint(req, userData);

      const slotId = query.slotId;

      this.logger.debug('Prep for impression tracking', {
        startTime,
        impressionId,
        userFingerprint,
        userData,
        slotId,
      });

      // Get impression data from bid response
      const impressionData =
        await this.trackingService.getImpressionData(bidResponseId);

      this.logger.debug('Impression Data by bidResponseId', {
        impressionData,
        bidResponseId,
      });

      if (!impressionData) {
        this.logger.warn(`Invalid bid response: ${bidResponseId}`);
        return this.return1x1Pixel(res);
      }

      // Fraud detection (fast Redis-based checks)
      const isFraud = await this.fraudDetection.checkImpression({
        userAgent: userData.userAgent,
        ipAddress: userData.ipAddress,
        bidResponseId,
        campaignId: impressionData.campaignId,
      });

      this.logger.debug('Fraud & Fraud Score', {
        isFraud,
      });

      if (isFraud.isBot || isFraud.fraudScore > 0.8) {
        this.logger.debug(`Fraudulent impression blocked: ${bidResponseId}`);
        return this.return1x1Pixel(res);
      }

      // Budget validation (Redis-based real-time check)
      const budgetValid = await this.budgetValidation.validateCampaignBudget(
        impressionData.campaignId,
        impressionData.bidPrice,
      );

      if (!budgetValid) {
        this.logger.debug(
          `Campaign ${impressionData.campaignId} budget exhausted`,
        );
        return this.return1x1Pixel(res);
      }

      // 💾 Process impression in Redis with ALL user data
      await this.trackingService.processImpression({
        id: impressionId,
        bidResponseId,
        creativeId: impressionData.creativeId,
        campaignId: impressionData.campaignId,
        advertiserId: impressionData.advertiserId,
        inventoryId: impressionData.inventoryId,
        publisherId: impressionData.publisherId,
        websiteId: impressionData.websiteId,
        templateId: impressionData.templateId, // ← Handle optional fields
        timestamp: new Date(),
        slotId,
        userFingerprint,

        bidPrice: impressionData.bidPrice / 1000 || 0,
        finalPrice: impressionData.finalPrice / 1000 || 0,

        // 🎯 COMPLETE USER DATA:
        userAgent: userData.userAgent,
        ipAddress: userData.ipAddress,
        deviceType: userData.deviceType,
        viewable: userData.viewable,
        viewTime: userData.viewTime,
        isBot: isFraud.isBot,
        fraudScore: isFraud.fraudScore,

        // Additional fields for your Prisma model:
        referrer: userData.referrer,
        country: userData.country,
        region: userData.region,
        city: userData.city,
      });

      this.logger.debug('Before storing impression mappings', {
        slotId,
        bidResponseId,
        userFingerprint,
        impressionId,
      });

      await this.impressionClickLinking.storeImpressionMappings(
        slotId,
        bidResponseId,
        userFingerprint,
        impressionId,
      );

      const processingTime = Date.now() - startTime;
      this.logger.debug(
        `Impression tracked in ${processingTime}ms: ${bidResponseId}`,
      );
      this.logger.debug('Hurrayy!! Impression tracked successfully');

      return this.return1x1Pixel(res);
    } catch (error) {
      this.logger.error('Failed to track impression:', error);
      return this.return1x1Pixel(res);
    }
  }

  /**
   * High-performance click tracking endpoint
   */
  @Get('click/:bidResponseId')
  async trackClick(
    @Param('bidResponseId') bidResponseId: string,
    @Query() query: any,
    @Req() req: Request, // ← ADDED: Need this to get user data
    @Res() res: Response,
  ) {
    try {
      const startTime = Date.now();
      const clickId = this.trackingService.generateId(); // ✅ Generate click ID upfront
      const userData = this.extractUserData(req, query);
      const userFingerprint =
        this.impressionClickLinking.generateUserFingerprint(req, userData);
      const slotId = query.slotId;

      await this.impressionClickLinking.debugLinking(
        bidResponseId,
        slotId,
        userFingerprint,
      );

      // Get click data from bid response
      const clickData = await this.trackingService.getClickData(bidResponseId);
      if (!clickData) {
        this.logger.warn(`Invalid click bid response: ${bidResponseId}`);
        return res.redirect(query.url || 'https://example.com');
      }

      this.logger.debug('Click Data', {
        clickData,
      });

      const impressionResult =
        await this.impressionClickLinking.findImpressionAndRegisterClick(
          bidResponseId,
          userFingerprint,
          clickId,
          slotId,
        );

      this.logger.debug('Impression Result', {
        impressionResult,
      });

      // Fraud detection for clicks
      const isFraud = await this.fraudDetection.checkClick({
        userAgent: userData.userAgent, // ← Use extracted data
        ipAddress: userData.ipAddress, // ← Use extracted data
        bidResponseId,
        campaignId: clickData.campaignId,
        clickX: parseInt(query.x) || 0,
        clickY: parseInt(query.y) || 0,
        impressionId: query.imp_id,
      });

      if (isFraud.isBot || isFraud.fraudScore > 0.9) {
        this.logger.debug(`Fraudulent click blocked: ${bidResponseId}`);
        return res.redirect(
          query.url || clickData.landingUrl || 'https://example.com',
        );
      }

      this.logger.debug('Fraud Result', {
        isFraud,
      });

      // 💾 Process click in Redis with ALL user data
      await this.trackingService.processClick({
        id: this.trackingService.generateId(),
        impressionId: impressionResult?.impressionId || null, // ← Handle optional fields
        bidResponseId,
        creativeId: clickData.creativeId,
        campaignId: clickData.campaignId,
        advertiserId: clickData.advertiserId,
        inventoryId: clickData.inventoryId,
        publisherId: clickData.publisherId,
        websiteId: clickData.websiteId,
        templateId: clickData.templateId || null, // ← Handle optional fields
        timestamp: new Date(),
        slotId,
        userFingerprint,
        userAgent: userData.userAgent,
        ipAddress: userData.ipAddress,
        deviceType: userData.deviceType,
        landingUrl: query.url || clickData.landingUrl,
        isBot: isFraud.isBot,
        fraudScore: isFraud.fraudScore,
        timeFromImpression: impressionResult.timeFromImpression || null,
        // Additional fields:
        referrer: userData.referrer,
        country: userData.country,
        region: userData.region,
        city: userData.city,
      });

      const processingTime = Date.now() - startTime;
      this.logger.debug(
        `Click tracked in ${processingTime}ms: ${bidResponseId}`,
      );

      // Redirect to landing page
      return res.redirect(
        query.url || clickData.landingUrl || 'https://example.com',
      );
    } catch (error) {
      this.logger.error('Failed to track click:', error);
      return res.redirect(query.url || 'https://example.com');
    }
  }

  /**
   * 🎯 EXTRACT ALL USER DATA FROM HTTP REQUEST
   * This ensures no Prisma model fields are null/undefined
   */
  private extractUserData(req: Request, query: any) {
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = this.getClientIP(req);

    const timestamp = new Date();
    const serverTime = timestamp.getTime(); // ms since epoch

    return {
      // From HTTP headers (primary source):
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      referrer: (() => {
        const ref = req.headers.referer || req.headers.referrer || '';
        const refStr = Array.isArray(ref) ? ref.join(', ') : ref;
        return refStr.substring(0, 500) || null;
      })(),

      // Derived from user agent:
      deviceType: this.detectDeviceType(userAgent),
      browser: this.detectBrowser(userAgent),
      os: this.detectOS(userAgent),

      // From URL query parameters or defaults:
      viewable: true,
      viewTime: serverTime,

      // Geolocation (you can enhance this with GeoIP service):
      country: this.detectCountry(ipAddress),
      region: this.detectRegion(ipAddress),
      city: this.detectCity(ipAddress),

      // Timestamps:
      timestamp: new Date(),
      serverTime: Date.now(),
    };
  }

  /**
   * Get real client IP (handles proxies, load balancers)
   */
  private getClientIP(req: Request): string {
    const xForwardedFor = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'] as string | undefined;

    let ip = '';

    if (typeof xForwardedFor === 'string') {
      ip = xForwardedFor.split(',')[0].trim(); // Get first IP from list
    } else if (realIp) {
      ip = realIp;
    } else if (req.connection?.remoteAddress) {
      ip = req.connection.remoteAddress;
    } else if (req.socket?.remoteAddress) {
      ip = req.socket.remoteAddress;
    } else if (req.ip) {
      ip = req.ip;
    } else {
      ip = 'unknown';
    }

    // Normalize localhost IPv6
    if (ip === '::1' || ip === '::ffff:127.0.0.1') ip = '127.0.0.1';

    return ip;
  }

  /**
   * Detect device type from user agent
   */
  private detectDeviceType(userAgent: string): string {
    if (!userAgent) return 'unknown';

    const ua = userAgent.toLowerCase();
    if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
    if (
      /mobile|iphone|ipod|android|blackberry|opera|mini|windows\\sce|palm|smartphone|iemobile/i.test(
        ua,
      )
    )
      return 'mobile';
    return 'desktop';
  }

  /**
   * Detect browser from user agent
   */
  private detectBrowser(userAgent: string): string {
    if (!userAgent) return 'unknown';

    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    return 'unknown';
  }

  /**
   * Detect OS from user agent
   */
  private detectOS(userAgent: string): string {
    if (!userAgent) return 'unknown';

    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac OS')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    return 'unknown';
  }

  /**
   * Detect country from IP (basic implementation)
   * You should integrate with a GeoIP service like MaxMind
   */
  private detectCountry(ipAddress: string): string {
    // Basic implementation - you should use a proper GeoIP service
    if (
      ipAddress.startsWith('192.168.') ||
      ipAddress.startsWith('10.') ||
      ipAddress.startsWith('127.')
    ) {
      return 'unknown'; // Private/local IP
    }

    // For now, return unknown - integrate with GeoIP service
    return 'unknown';
  }

  /**
   * Detect region from IP
   */
  private detectRegion(ipAddress: string): string {
    // Implement with GeoIP service
    return 'unknown';
  }

  /**
   * Detect city from IP
   */
  private detectCity(ipAddress: string): string {
    // Implement with GeoIP service
    return 'unknown';
  }

  /**
   * Return 1x1 transparent pixel image
   */
  private return1x1Pixel(res: Response) {
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64',
    );

    res.set({
      'Content-Type': 'image/gif',
      'Content-Length': pixel.length.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });

    return res.end(pixel);
  }

  //   // /**
  //   //  * Health check endpoint for tracking service
  //   //  */
  //   @Get('health')
  //   async healthCheck() {
  //     try {
  //       const redisHealth = await this.trackingService.checkRedisHealth();
  //       const budgetHealth = await this.budgetValidation.checkHealth();

  //       return {
  //         status: 'healthy',
  //         timestamp: new Date().toISOString(),
  //         redis: redisHealth,
  //         budget: budgetHealth,
  //       };
  //     } catch (error) {
  //       return {
  //         status: 'unhealthy',
  //         timestamp: new Date().toISOString(),
  //         error: error.message,
  //       };
  //     }
  //   }
}
