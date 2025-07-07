import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { CampaignWithTargeting } from '../types/campaign.types';
import { InventoryFormat } from '@prisma/client';
import { BudgetValidationService } from 'src/tracking/services/budget-validation.service';

@Injectable()
export class CampaignEligibilityService {
  private readonly logger = new Logger(CampaignEligibilityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly budgetValidation: BudgetValidationService,
  ) {}

  async getEligibleCampaigns(
    inventoryId: string,
    userContext: any,
    adSlotContext: any,
  ): Promise<CampaignWithTargeting[]> {
    const startTime = Date.now();

    // this.logger.debug('Getting eligible campaigns with caching', {
    //   inventoryId,
    //   deviceType: userContext.deviceType,
    //   country: userContext.country,
    //   adSlot: `${adSlotContext.width}x${adSlotContext.height}`,
    // });

    try {
      // 1. Get campaign pool from cache
      const campaignPool = await this.getCachedCampaignPool(
        adSlotContext.width,
        adSlotContext.height,
        adSlotContext.format,
      );

      if (campaignPool.length === 0) {
        this.logger.debug('No campaigns in basic pool', { inventoryId });
        return [];
      }

      // 2. Apply targeting filters in parallel batches
      // const targetingFilteredCampaigns = await this.applyTargetingFiltersOptimized(
      //   campaignPool,
      //   userContext,
      //   adSlotContext,
      // );

      // 3. Batch validate budgets using cache
      const budgetValidatedCampaigns =
        await this.batchValidateBudgets(campaignPool);

      const processingTime = Date.now() - startTime;

      this.logger.debug('Campaign eligibility calculated (CACHED)', {
        inventoryId,
        totalCampaigns: campaignPool.length,
        // targetingFiltered: targetingFilteredCampaigns.length,
        budgetFiltered: budgetValidatedCampaigns.length,
        processingTime: `${processingTime}ms`,
      });

      return budgetValidatedCampaigns;
    } catch (error) {
      this.logger.error('Failed to get eligible campaigns', {
        error: error.message,
        inventoryId,
      });
      return [];
    }
  }
  public async getCachedCampaignPool(
    width: number,
    height: number,
    format: InventoryFormat,
  ): Promise<CampaignWithTargeting[]> {
    const cacheKey = `campaign:pool:${width}x${height}:${format}`;

    // Try cache first
    const cached = await this.redis.get<string>(cacheKey);
    if (cached) {
      this.logger.debug('✅ Campaign pool cache HIT', {
        width,
        height,
        format,
      });
      return JSON.parse(cached);
    }

    this.logger.debug('❌ Campaign pool cache MISS - querying DB', {
      width,
      height,
      format,
    });

    // Fallback to database (expensive)
    const now = new Date();
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        status: 'ACTIVE',
        startDate: { lte: now },
        endDate: { gte: now },
        creatives: {
          some: {
            status: 'APPROVED',
            adSlotTemplate: {
              width: width,
              height: height,
              format: format,
            },
          },
        },
      },
      include: {
        creatives: {
          where: {
            status: 'APPROVED',
            adSlotTemplate: {
              width: width,
              height: height,
              format: format,
            },
          },
          include: {
            adSlotTemplate: true,
          },
        },
        advertiser: {
          select: { id: true, name: true },
        },
        // Include all targeting rules for filtering
        demographicTargeting: true,
        geographicTargeting: true,
        deviceTargeting: true,
        contextualTargeting: true,
        behavioralTargeting: true,
        timeTargeting: true,
        frequencyTargeting: true,
      },
    });

    // Cache for 10 minutes (campaigns don't change frequently)
    await this.redis.set(cacheKey, JSON.stringify(campaigns), 600);

    this.logger.debug('Campaign pool cached', {
      width,
      height,
      format,
      campaignCount: campaigns.length,
      ttl: '10 minutes',
    });

    return campaigns;
  }
  private async batchValidateBudgets(
    campaigns: CampaignWithTargeting[],
  ): Promise<CampaignWithTargeting[]> {
    if (campaigns.length === 0) return [];

    // ✅ RE-ENABLED: Proper budget validation with minBid rough filtering
    const budgetChecks = await Promise.all(
      campaigns.map(async (campaign: CampaignWithTargeting) => {
        try {
          // Use minBid for rough early filtering
          let minBidCPM = 1.0;
          if (campaign.bidAmount) {
            minBidCPM = Number(campaign.bidAmount) || 1.0;
          }

          // Convert CPM to per-impression cost for budget validation
          const minCostPerImpression = minBidCPM / 1000;

          // Rough budget check: If campaign can't afford even minimum bid, exclude
          const hasValidBudget = await this.checkBudgetAvailability(
            campaign.id,
            minCostPerImpression,
          );

          return { campaignId: campaign.id, hasValidBudget };
        } catch (error) {
          this.logger.warn(
            `Budget check failed for campaign ${campaign.id}:`,
            error,
          );
          return { campaignId: campaign.id, hasValidBudget: false };
        }
      }),
    );

    const budgetMap = new Map<string, boolean>();
    budgetChecks.forEach(({ campaignId, hasValidBudget }) => {
      budgetMap.set(campaignId, hasValidBudget);
    });

    const validCampaigns = campaigns.filter(
      (campaign) => budgetMap.get(campaign.id) === true,
    );

    this.logger.debug('Batch budget validation completed', {
      totalCampaigns: campaigns.length,
      validBudgets: validCampaigns.length,
      rejectedBudgets: campaigns.length - validCampaigns.length,
    });

    return validCampaigns;
  }
  async checkBudgetAvailability(
    campaignId: string,
    bidAmount: number,
  ): Promise<boolean> {
    return await this.budgetValidation.validateCampaignBudget(
      campaignId,
      bidAmount,
    );
  }

  async invalidateCampaignPoolCache(
    width?: number,
    height?: number,
    format?: string,
  ): Promise<void> {
    try {
      if (width && height && format) {
        // Invalidate specific ad slot
        const cacheKey = `campaign:pool:${width}x${height}:${format}`;
        await this.redis.del(cacheKey);
        this.logger.debug('Invalidated specific campaign pool cache', {
          width,
          height,
          format,
        });
      } else {
        // Invalidate all campaign pools (when campaign status changes)
        const pattern = 'campaign:pool:*';
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await Promise.all(keys.map((key) => this.redis.del(key)));
          this.logger.debug('Invalidated all campaign pool caches', {
            keysInvalidated: keys.length,
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to invalidate campaign pool cache', {
        error: error.message,
      });
    }
  }

  async invalidateBudgetCache(campaignId: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const cacheKey = `budget:status:${campaignId}:${today}`;
      await this.redis.del(cacheKey);
      this.logger.debug('Invalidated budget cache', { campaignId });
    } catch (error) {
      this.logger.error('Failed to invalidate budget cache', {
        error: error.message,
      });
    }
  }
}
