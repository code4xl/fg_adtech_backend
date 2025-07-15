// src/tracking/tracking.controller.ts - FIXED VERSION WITH DEDUPLICATION
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
  Header,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { TrackingService } from './tracking.service';
import { BudgetValidationService } from './services/budget-validation.service';
import { FraudDetectionService } from './fraud-detection.service';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { ImpressionClickLinkingService } from './services/impression-click-linking.service';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from 'src/redis/redis.service';
import { RTB_CACHE_TTL, RTB_KEYS } from 'src/rtb/constants/cache-keys';

@ApiExcludeController()
@ApiTags('Impression and Click Tracking')
@Controller('api')
export class TrackingController {
  private readonly logger = new Logger(TrackingController.name);

  constructor(
    private readonly trackingService: TrackingService,
    private readonly budgetValidation: BudgetValidationService,
    private readonly fraudDetection: FraudDetectionService,
    private readonly impressionClickLinking: ImpressionClickLinkingService,
    private readonly redis: RedisService,
  ) { }

  /**
   * High-performance impression tracking endpoint
   * Uses Redis-first approach for immediate budget control
   */
  @Get('pixel/:bidResponseId')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'image/gif')
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @Header('Access-Control-Allow-Origin', '*')
  @Header('Access-Control-Allow-Methods', 'GET, OPTIONS')
  @Header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With')
  @Header('Access-Control-Allow-Credentials', 'false')
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

      // ✅ RACE CONDITION FIX: Use atomic Redis SET NX to prevent duplicate impressions
      const dedupeKey = RTB_KEYS.IMP_DEDUPLICATION(
        bidResponseId,
        slotId,
        userFingerprint,
      );
      
      // Use atomic SET NX operation via Redis client to prevent race conditions
      const setResult = await this.redis
        .getClient()
        .set(dedupeKey, impressionId, 'EX', RTB_CACHE_TTL.IMP_DEDUPLICATION, 'NX');
      
      if (!setResult) {
        // Key already exists - this is a duplicate impression
        const existingImpressionId = await this.redis.get(dedupeKey);
        this.logger.debug(`✅ Duplicate impression blocked: ${bidResponseId}`, {
          slotId,
          userFingerprint,
          dedupeKey,
          existingImpressionId,
          blockedImpressionId: impressionId,
        });
        return this.return1x1Pixel(res);
      }

      this.logger.debug(`✅ First impression allowed: ${bidResponseId}`, {
        slotId,
        userFingerprint,
        dedupeKey,
        impressionId,
      });

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
        impressionData.bidPrice / 1000,
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
        templateId: impressionData.templateId, 
        timestamp: new Date(),
        slotId,
        userFingerprint,

        bidPrice: impressionData.bidPrice / 1000 || 0,
        finalPrice: impressionData.finalPrice / 1000 || 0,

        // Complete user data:
        userAgent: userData.userAgent,
        ipAddress: userData.ipAddress,
        deviceType: userData.deviceType,
        viewable: userData.viewable,
        viewTime: userData.viewTime,
        isBot: isFraud.isBot,
        fraudScore: isFraud.fraudScore,

        // Additional fields:
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
        `✅ Impression tracked in ${processingTime}ms: ${bidResponseId}`,
      );
      this.logger.debug('✅ Impression tracked successfully (deduplication enabled)');

      return this.return1x1Pixel(res);
    } catch (error) {
      this.logger.error('Failed to track impression:', error);
      return this.return1x1Pixel(res);
    }
  }

  /**
   * High-performance click tracking endpoint
   */
  @Get('redirect/:bidResponseId')
  @Header('Access-Control-Allow-Origin', '*')
  @Header('Access-Control-Allow-Methods', 'GET, OPTIONS')
  @Header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With')
  @Header('Access-Control-Allow-Credentials', 'false')
  async trackClick(
    @Param('bidResponseId') bidResponseId: string,
    @Query() query: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const startTime = Date.now();
      const clickId = this.trackingService.generateId();
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
        userAgent: userData.userAgent,
        ipAddress: userData.ipAddress,
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

      // Process click in Redis with ALL user data
      await this.trackingService.processClick({
        id: this.trackingService.generateId(),
        impressionId: impressionResult?.impressionId || null,
        bidResponseId,
        creativeId: clickData.creativeId,
        campaignId: clickData.campaignId,
        advertiserId: clickData.advertiserId,
        inventoryId: clickData.inventoryId,
        publisherId: clickData.publisherId,
        websiteId: clickData.websiteId,
        templateId: clickData.templateId || null,
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

  // Rest of the helper methods remain the same...
  
  /**
   * Extract ALL user data from HTTP request
   */
  private extractUserData(req: Request, query: any) {
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = this.getClientIP(req);

    const timestamp = new Date();
    const serverTime = timestamp.getTime();

    return {
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      referrer: (() => {
        const ref = req.headers.referer || req.headers.referrer || '';
        const refStr = Array.isArray(ref) ? ref.join(', ') : ref;
        return refStr.substring(0, 500) || null;
      })(),

      deviceType: this.detectDeviceType(userAgent),
      browser: this.detectBrowser(userAgent),
      os: this.detectOS(userAgent),

      viewable: true,
      viewTime: serverTime,

      country: this.detectCountry(ipAddress),
      region: this.detectRegion(ipAddress),
      city: this.detectCity(ipAddress),

      timestamp: new Date(),
      serverTime: Date.now(),
    };
  }

  private getClientIP(req: Request): string {
    const xForwardedFor = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'] as string | undefined;

    let ip = '';

    if (typeof xForwardedFor === 'string') {
      ip = xForwardedFor.split(',')[0].trim();
    } else if (Array.isArray(xForwardedFor)) {
      ip = xForwardedFor[0].trim();
    } else if (realIp) {
      ip = realIp;
    } else {
      ip = req.socket.remoteAddress || req.ip || '';
    }

    return ip;
  }

  private detectDeviceType(userAgent: string): string {
    const ua = userAgent.toLowerCase();

    if (/mobile|android|iphone|ipod|blackberry|windows phone/.test(ua)) {
      return 'mobile';
    }

    if (/tablet|ipad/.test(ua)) {
      return 'tablet';
    }

    return 'desktop';
  }

  private detectBrowser(userAgent: string): string {
    const ua = userAgent.toLowerCase();

    if (ua.includes('chrome')) return 'Chrome';
    if (ua.includes('firefox')) return 'Firefox';
    if (ua.includes('safari')) return 'Safari';
    if (ua.includes('edge')) return 'Edge';
    if (ua.includes('opera')) return 'Opera';

    return 'Unknown';
  }

  private detectOS(userAgent: string): string {
    const ua = userAgent.toLowerCase();

    if (ua.includes('windows')) return 'Windows';
    if (ua.includes('mac')) return 'macOS';
    if (ua.includes('linux')) return 'Linux';
    if (ua.includes('android')) return 'Android';
    if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) {
      return 'iOS';
    }

    return 'Unknown';
  }

  private detectCountry(ipAddress: string): string {
    if (
      ipAddress.startsWith('192.168.') ||
      ipAddress.startsWith('10.') ||
      ipAddress.startsWith('127.')
    ) {
      return 'unknown';
    }

    return 'unknown';
  }

  private detectRegion(ipAddress: string): string {
    return 'unknown';
  }

  private detectCity(ipAddress: string): string {
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
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Origin, X-Requested-With',
      'Access-Control-Allow-Credentials': 'false',
    });

    return res.end(pixel);
  }
}