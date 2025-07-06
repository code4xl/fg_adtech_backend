import { Injectable, Logger } from '@nestjs/common';
import { InventoryFormat } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { CampaignWithTargeting } from 'src/rtb/types/campaign.types';
import { BudgetValidationService } from 'src/tracking/services/budget-validation.service';
import { CampaignEligibilityService } from '../../services/campaign-eligibility.service';

@Injectable()
export class CampaignPoolWarmupService {
  private readonly logger = new Logger(CampaignPoolWarmupService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly campaignEligibilityService: CampaignEligibilityService,
  ) {}
  async warmupCaches(): Promise<void> {
    try {
      // this.logger.debug(
      //   'Starting comprehensive cache warmup for all ad formats...',
      // );

      const allPopularSizes = await this.prisma.adSlotTemplate.findMany({
        where: {
          isActive: true,
        },
        select: {
          width: true,
          height: true,
          format: true,
        },
      });

      // this.logger.debug('Warming up campaign pools for all formats', {
      //   totalSizes: allPopularSizes.length,
      // });

      // Process in batches to avoid overwhelming the database
      const batchSize = 5;
      let warmedCount = 0;

      for (let i = 0; i < allPopularSizes.length; i += batchSize) {
        const batch = allPopularSizes.slice(i, i + batchSize);

        // this.logger.debug(
        //   `Warming up batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allPopularSizes.length / batchSize)}`,
        //   {
        //     batchSizes: batch.map((s) => `${s.width}x${s.height}-${s.format}`),
        //   },
        // );

        // Process batch in parallel
        const batchPromises = batch.map((size) =>
          this.campaignEligibilityService
            .getCachedCampaignPool(
              size.width,
              size.height,
              size.format as InventoryFormat,
            )
            .then((campaigns) => {
              warmedCount++;
              // this.logger.debug(
              //   ` Warmed ${size.width}x${size.height}-${size.format}`,
              //   {
              //     campaignCount: campaigns.length,
              //   },
              // );
              return campaigns.length;
            })
            .catch((error) => {
              this.logger.warn(
                `❌ Failed to warm ${size.width}x${size.height}-${size.format}`,
                {
                  error: error.message,
                },
              );
              return 0;
            }),
        );

        await Promise.all(batchPromises);

        // Small delay between batches to avoid database overload
        if (i + batchSize < allPopularSizes.length) {
          await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay
        }
      }

      this.logger.debug('🎯 Comprehensive cache warmup completed!', {
        campaignPoolsWarmed: warmedCount,
        totalSizesAttempted: allPopularSizes.length,
      });
    } catch (error) {
      this.logger.error('❌ Comprehensive cache warmup failed', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}
