import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { BidResponseService } from './bid-response.service';

@ApiTags('RTB')
@Controller('track')
export class TrackingController {
  private readonly logger = new Logger(TrackingController.name);

  constructor(private readonly bidResponseService: BidResponseService) {}

  @Get('impression/:creativeId')
  @ApiOperation({ summary: 'Track impression for a creative' })
  @ApiParam({ name: 'creativeId', description: 'Creative ID' })
  async trackImpression(
    @Param('creativeId') creativeId: string,
    @Query() query: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      // Extract tracking data
      const trackingData = {
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        referrer: req.headers.referer || req.headers.referrer,
        ...query,
      };

      // Process impression asynchronously (don't block response)
      this.bidResponseService
        .recordImpression(creativeId, trackingData)
        .catch((error) => {
          this.logger.error(
            `Error recording impression: ${error.message}`,
            error.stack,
          );
        });

      // Return a 1x1 transparent GIF
      const transparentGif = Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64',
      );

      return res
        .status(HttpStatus.OK)
        .header('Content-Type', 'image/gif')
        .header('Cache-Control', 'no-cache, no-store, must-revalidate')
        .send(transparentGif);
    } catch (error) {
      this.logger.error(
        `Error in impression tracking: ${error.message}`,
        error.stack,
      );

      // Still return a 1x1 GIF even on error
      const transparentGif = Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64',
      );

      return res
        .status(HttpStatus.OK)
        .header('Content-Type', 'image/gif')
        .send(transparentGif);
    }
  }

  @Get('click/:creativeId')
  @ApiOperation({ summary: 'Track click and redirect for a creative' })
  @ApiParam({ name: 'creativeId', description: 'Creative ID' })
  async trackClick(
    @Param('creativeId') creativeId: string,
    @Query('redirect') redirectUrl: string,
    @Query() query: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      // Extract tracking data
      const trackingData = {
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        referrer: req.headers.referer || req.headers.referrer,
        redirect: redirectUrl,
        ...query,
      };

      // Record the click and get the destination URL
      const destinationUrl: any = await this.bidResponseService.recordClick(
        creativeId,
        trackingData,
      );

      // Redirect to the landing page
      return res.redirect(HttpStatus.FOUND, destinationUrl);
    } catch (error) {
      this.logger.error(
        `Error in click tracking: ${error.message}`,
        error.stack,
      );

      // On error, redirect to the provided URL or home
      return res.redirect(HttpStatus.FOUND, redirectUrl || '/');
    }
  }
}
