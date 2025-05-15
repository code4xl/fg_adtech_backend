// src/rtb/rtb-enrichment.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBidRequestDto } from './dto/create-bid-request.dto';
import { Request } from 'express';

interface EnrichedBidRequest {
  userAgent: string | null;
  ipAddress: string | null;
  deviceType: string | null;
  browserType: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  floor: number | null;
  targeting: any;
}

@Injectable()
export class RtbEnrichmentService {
  constructor(private readonly prisma: PrismaService) {}

  async enrichBidRequest(
    dto: CreateBidRequestDto,
    req: Request,
  ): Promise<EnrichedBidRequest> {
    // 1. Extract IP address (handle proxies)
    const ipAddress = this.extractIpAddress(req);

    // 2. Parse user agent
    const userAgent =
      req.headers['user-agent'] || dto.userContext?.userAgent || null;

    // 3. Get device and browser types
    const { deviceType, browserType } = this.parseUserAgent(userAgent);

    // 4. Get geographic data from IP (you can integrate with a GeoIP service)
    const { country, region, city } = await this.getGeographicData(ipAddress);

    // 5. Get floor price from inventory
    const floor = await this.getFloorPrice(dto.inventoryId);

    // 6. Enrich targeting data
    const targeting = this.enrichTargeting(dto.targeting, {
      country,
      region,
      city,
    });

    return {
      userAgent,
      ipAddress,
      deviceType,
      browserType,
      country,
      region,
      city,
      floor: floor || dto.floor || null,
      targeting,
    };
  }

  private extractIpAddress(req: Request): string | null {
    // Handle various proxy headers
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
      return Array.isArray(xForwardedFor)
        ? xForwardedFor[0].split(',')[0]
        : xForwardedFor.split(',')[0];
    }

    const xRealIp = req.headers['x-real-ip'];
    if (xRealIp) {
      return Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
    }

    return req.ip || req.connection.remoteAddress || null;
  }

  private parseUserAgent(userAgent: string | null): {
    deviceType: string | null;
    browserType: string | null;
  } {
    if (!userAgent) {
      return { deviceType: null, browserType: null };
    }

    // Simple device detection
    let deviceType = 'desktop';
    if (/mobile/i.test(userAgent)) deviceType = 'mobile';
    if (/tablet|ipad/i.test(userAgent)) deviceType = 'tablet';

    // Simple browser detection
    let browserType = 'other';
    if (/chrome/i.test(userAgent)) browserType = 'chrome';
    if (/firefox/i.test(userAgent)) browserType = 'firefox';
    if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent))
      browserType = 'safari';
    if (/edge/i.test(userAgent)) browserType = 'edge';
    if (/msie|trident/i.test(userAgent)) browserType = 'ie';

    return { deviceType, browserType };
  }

  private async getGeographicData(ipAddress: string | null): Promise<{
    country: string | null;
    region: string | null;
    city: string | null;
  }> {
    if (!ipAddress) {
      return { country: null, region: null, city: null };
    }

    // TODO: Integrate with a GeoIP service (e.g., MaxMind, IP2Location)
    // For now, return mock data or null values
    return { country: 'India', region: 'Maharashtra', city: 'Mumbai' };
  }

  private async getFloorPrice(inventoryId: string): Promise<number | null> {
    // Get current active floor price for the inventory
    const activeFloorPrice = await this.prisma.floorPrice.findFirst({
      where: {
        inventoryId,
        startDate: { lte: new Date() },
        OR: [{ endDate: { gte: new Date() } }, { endDate: null }],
      },
      orderBy: { createdAt: 'desc' },
    });

    return activeFloorPrice ? Number(activeFloorPrice.basePrice) : null;
  }

  private enrichTargeting(
    original: any,
    geoData: {
      country: string | null;
      region: string | null;
      city: string | null;
    },
  ): any {
    if (!original) {
      return geoData;
    }

    return {
      ...original,
      ...geoData,
    };
  }
}
