import { Injectable, Logger } from '@nestjs/common';
import { AdMarkupService } from './ad-markup.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { BadRequestException } from 'src/common/exceptions/custom.exception';

@Injectable()
export class BidResponseService {
  private readonly logger = new Logger(BidResponseService.name);
  private readonly CACHE_TTL = 60 * 5; // 5 minutes
  constructor(
    private readonly adMarkupService: AdMarkupService,
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async getBidResponse(requestId: string) {
    try {
      // try to check in cache first

      const cacheKey = `bid-response:${requestId}`;
      const cachedResponse = await this.redisService.get<string>(cacheKey);
      if (cachedResponse) {
        this.logger.log(`Cache hit for requestId: ${requestId}`);
        return { html: cachedResponse, cached: true };
      }

      // Cache miss, fetch from db

      const bidRequest = await this.prisma.bidRequest.findUnique({
        where: {
          requestId: requestId,
        },
      });

      if (!bidRequest) {
        throw new BadRequestException('Bid request not found');
      }

      const bidResponse = await this.prisma.bidResponse.findUnique({
        where: {
          id: bidRequest.id,
        },
        include: {
          creative: true,
        },
      });

      if (!bidResponse) {
        this.logger.warn(`No winning bid found for request ID: ${requestId}`);
        return { html: this.generateNoBidResponse(bidRequest), cached: false };
      }

      let adMarkup: string;

      if (bidResponse.adMarkup) {
        adMarkup = bidResponse.adMarkup;
      } else if (bidResponse.creative) {
        // Generate markup from creative data
        adMarkup = this.adMarkupService.generateAdMarkup(bidResponse.creative, {
          auctionId: bidResponse.id,
          price: bidResponse.bidPrice,
        });

        // Update the bid response with the generated markup
        await this.prisma.bidResponse.update({
          where: {
            id: bidResponse.id,
          },
          data: {
            adMarkup: adMarkup,
          },
        });
      } else {
        throw new BadRequestException('Creative not found');
      }

      // Cache the response
      await this.redisService.set(cacheKey, adMarkup, this.CACHE_TTL);
      this.logger.log(`Cache set for requestId: ${requestId}`);
      return { html: adMarkup, cached: false };
    } catch (error) {
      this.logger.error(
        `Error fetching bid response for request ID ${requestId}: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException('Error fetching bid response');
    }
  }

  private generateNoBidResponse(bidRequest: any) {
    const width = bidRequest.targetingData?.width || 300;
    const height = bidRequest.targetingData?.height || 250;

    return `
      <div class="ocean-ad ocean-ad-no-bid" style="width:${width}px;height:${height}px;border:1px solid #eee;display:flex;align-items:center;justify-content:center;background:#f9f9f9;color:#999;font-family:sans-serif;font-size:12px;">
        <span>Advertisement</span>
      </div>
    `;
  }

  async recordClick(creativeId, trackingData) {}
  async recordImpression(creativeId, trackingData) {}
}
