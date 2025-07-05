import { Injectable, Logger } from '@nestjs/common';
import { CREATIVE_KEYS, RTB_CACHE_TTL } from '../constants/cache-keys';
import { CampaignWithTargeting } from '../types/campaign.types';
import { CreativeWithTemplate } from '../types/creative.types';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class CreativeSelectionService {
  private readonly logger = new Logger(CreativeSelectionService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  public async selectCreative(
    campaign: CampaignWithTargeting,
    adSlotContext: any,
  ): Promise<CreativeWithTemplate> {
    try {
      // Get all matching creatives
      const creatives = await this.prisma.creative.findMany({
        where: {
          campaignId: campaign.id,
          status: 'APPROVED',
          adSlotTemplate: {
            width: adSlotContext.width,
            height: adSlotContext.height,
            format: adSlotContext.format,
          },
        },
        include: {
          adSlotTemplate: true,
        },
        orderBy: { id: 'asc' }, // Consistent ordering for round-robin
      });

      if (creatives.length === 0) return null;
      if (creatives.length === 1) return creatives[0];

      // Round-robin selection
      const selectedCreative = await this.roundRobinSelect(
        campaign.id,
        creatives,
      );
      return selectedCreative;
    } catch (error) {
      this.logger.error('Failed to select creative', {
        campaignId: campaign.id,
        error: error.message,
      });
      return null;
    }
  }

  private async roundRobinSelect(
    campaignId: string,
    creatives: CreativeWithTemplate[],
  ): Promise<CreativeWithTemplate> {
    // Redis key for round-robin counter
    const counterKey = CREATIVE_KEYS.CREATIVE_ROUND_ROBIN(campaignId);

    try {
      // Get current counter value and increment atomically
      const currentCount = await this.redis.incr(counterKey);

      // Set expiry on first use (24 hours)
      if (currentCount === 1) {
        await this.redis.expire(counterKey, RTB_CACHE_TTL.CREATIVE_ROUND_ROBIN); // 24 hours
      }

      // Calculate index using modulo
      const selectedIndex = (currentCount - 1) % creatives.length;

      this.logger.debug('Round-robin creative selection', {
        campaignId,
        currentCount,
        totalCreatives: creatives.length,
        selectedIndex,
        selectedCreativeId: creatives[selectedIndex].id,
      });

      return creatives[selectedIndex];
    } catch (error) {
      // Fallback to first creative if Redis fails
      this.logger.warn('Round-robin selection failed, using fallback', {
        campaignId,
        error: error.message,
      });
      return creatives[0];
    }
  }
}
