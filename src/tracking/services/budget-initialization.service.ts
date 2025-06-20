import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CLICK_AND_IMPRESSION_KEYS } from 'src/rtb/constants/cache-keys';
import { CampaignBudgetInfo, CampaignBudgetStatus, BudgetInitializationStats } from '../interfaces/budget.interface';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

@Injectable()
export class BudgetInitializationService implements OnModuleInit {
    private readonly logger = new Logger(BudgetInitializationService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
    ) { }

    async onModuleInit() {
        // Initialize budgets when service starts
        await this.initializeAllCampaignBudgets();
    }

    async initializeAllCampaignBudgets(): Promise<void> {
        this.logger.log('🚀 Initializing all campaign budgets into Redis...');

        try {
            const startTime = Date.now();

            // Get all active campaigns with their budget info
            const activeCampaigns = await this.prisma.campaign.findMany({
                where: {
                    status: 'ACTIVE',
                    startDate: { lte: new Date() },
                    endDate: { gte: new Date() }, // Campaign should not be expired
                },
                select: {
                    id: true,
                    campaignBudgetTracker: {
                        where: {
                            date: new Date().toISOString(),
                        },
                        select: {
                            dailyBudget: true,
                            totalBudget: true,
                        },
                        take: 1
                    },
                    status: true,
                    createdAt: true,
                }
            });

            if (activeCampaigns.length === 0) {
                this.logger.warn('No active campaigns found for budget initialization');
                return;
            }

            this.logger.log(`Found ${activeCampaigns.length} active campaigns to initialize`);

            // Process campaigns in batches to avoid overwhelming Redis
            const batchSize = 50;
            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < activeCampaigns.length; i += batchSize) {
                const batch = activeCampaigns.slice(i, i + batchSize);

                const batchPromises = batch.map(async (campaign) => {
                    try {
                        // Check if campaign has budget tracker for today
                        if (!campaign.campaignBudgetTracker || campaign.campaignBudgetTracker.length === 0) {
                            this.logger.warn(`No budget tracker found for campaign ${campaign.id}`);
                            return;
                        }

                        const budgetTracker = campaign.campaignBudgetTracker[0];

                        // Map campaign to CampaignBudgetInfo
                        const budgetInfo: CampaignBudgetInfo = {
                            id: campaign.id,
                            dailyBudget: Number(budgetTracker.dailyBudget),
                            totalBudget: Number(budgetTracker.totalBudget),
                            bidPrice: 0, // Not needed for initialization, will be set during auction
                            status: campaign.status,
                        };

                        await this.initializeCampaignBudget(budgetInfo);
                        successCount++;
                    } catch (error) {
                        this.logger.error(`Failed to initialize budget for campaign ${campaign.id}:`, error);
                        errorCount++;
                    }
                });

                await Promise.all(batchPromises);

                // Small delay between batches to prevent overwhelming Redis
                if (i + batchSize < activeCampaigns.length) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }

            const duration = Date.now() - startTime;

            this.logger.log('✅ Campaign budget initialization completed', {
                totalCampaigns: activeCampaigns.length,
                successful: successCount,
                errors: errorCount,
                durationMs: duration,
                averageTimePerCampaign: Math.round(duration / activeCampaigns.length)
            });

        } catch (error) {
            this.logger.error('❌ Failed to initialize campaign budgets:', error);
            throw error;
        }
    }

    private async initializeCampaignBudget(campaign: CampaignBudgetInfo): Promise<void> {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        try {
            // Use raw Redis client for pipeline operations
            const redisClient = this.redis.getClient();
            const pipeline = redisClient.pipeline();

            // 1. Set daily budget limit
            pipeline.set(
                CLICK_AND_IMPRESSION_KEYS.DAILY_BUDGET_LIMIT(campaign.id),
                campaign.dailyBudget.toString()
            );

            // 2. Initialize daily spend to 0 if not exists
            const spendKey = CLICK_AND_IMPRESSION_KEYS.DAILY_BUDGET_SPEND(campaign.id, today);
            pipeline.setnx(spendKey, '0');

            // 3. Set campaign status
            pipeline.set(
                CLICK_AND_IMPRESSION_KEYS.CAMPAIGN_STATUS(campaign.id),
                campaign.status
            );

            // 4. Initialize metrics counters for today
            pipeline.setnx(CLICK_AND_IMPRESSION_KEYS.CAMPAIGN_IMPRESSIONS(campaign.id, today), '0');
            pipeline.setnx(CLICK_AND_IMPRESSION_KEYS.CAMPAIGN_CLICKS(campaign.id, today), '0');

            // 5. Set expiration for daily metrics (expire at midnight + 1 day)
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            const secondsUntilMidnight = Math.floor((tomorrow.getTime() - Date.now()) / 1000);

            pipeline.expire(spendKey, secondsUntilMidnight + 86400); // +24 hours for safety
            pipeline.expire(CLICK_AND_IMPRESSION_KEYS.CAMPAIGN_IMPRESSIONS(campaign.id, today), secondsUntilMidnight + 86400);
            pipeline.expire(CLICK_AND_IMPRESSION_KEYS.CAMPAIGN_CLICKS(campaign.id, today), secondsUntilMidnight + 86400);

            // Execute all Redis operations atomically
            await pipeline.exec();

            this.logger.debug(`✅ Budget initialized for campaign ${campaign.id}`, {
                campaignId: campaign.id,
                dailyBudget: campaign.dailyBudget,
                status: campaign.status,
                spendKey,
            });

        } catch (error) {
            this.logger.error(`Failed to initialize budget for campaign ${campaign.id}:`, error);
            throw error;
        }
    }

    @Cron('*/5 * * * *') // Every 5 minutes
    async syncCampaignBudgetUpdates(): Promise<void> {
        this.logger.debug('🔄 Syncing campaign budget updates from database...');

        try {
            const startTime = Date.now();
            const today = new Date().toISOString().split('T')[0];

            // Get campaigns updated in last 10 minutes (with buffer)
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

            const updatedCampaigns = await this.prisma.campaign.findMany({
                where: {
                    updatedAt: {
                        gte: tenMinutesAgo
                    },
                    status: {
                        in: ['ACTIVE', 'PAUSED']
                    }
                },
                select: {
                    id: true,
                    campaignBudgetTracker: {
                        where: {
                            date: new Date().toISOString(), // Use today in YYYY-MM-DD format
                        },
                        select: {
                            dailyBudget: true,
                            totalBudget: true,
                        },
                        take: 1
                    },
                    status: true,
                    updatedAt: true,
                }
            });

            if (updatedCampaigns.length === 0) {
                this.logger.debug('No campaign budget updates to sync');
                return;
            }

            this.logger.log(`Syncing ${updatedCampaigns.length} updated campaigns to Redis`);

            let syncedCount = 0;
            const syncPromises = updatedCampaigns.map(async (campaign) => {
                try {
                    if (campaign.campaignBudgetTracker && campaign.campaignBudgetTracker.length > 0) {
                        const budgetTracker = campaign.campaignBudgetTracker[0];
                        const campaignData = {
                            id: campaign.id,
                            dailyBudget: Number(budgetTracker.dailyBudget),
                            status: campaign.status,
                            updatedAt: campaign.updatedAt,
                        };
                        await this.updateCampaignBudgetInRedis(campaignData);
                        syncedCount++;
                    }
                } catch (error) {
                    this.logger.error(`Failed to sync campaign ${campaign.id}:`, error);
                }
            });

            await Promise.all(syncPromises);

            const duration = Date.now() - startTime;

            this.logger.log('✅ Campaign budget sync completed', {
                updatedCampaigns: updatedCampaigns.length,
                syncedSuccessfully: syncedCount,
                durationMs: duration,
            });

        } catch (error) {
            this.logger.error('❌ Campaign budget sync failed:', error);
        }
    }

    private async updateCampaignBudgetInRedis(campaign: any): Promise<void> {
        try {
            // Use raw Redis client for pipeline operations
            const redisClient = this.redis.getClient();
            const pipeline = redisClient.pipeline();

            // 1. Update daily budget limit
            pipeline.set(
                CLICK_AND_IMPRESSION_KEYS.DAILY_BUDGET_LIMIT(campaign.id),
                campaign.dailyBudget.toString()
            );

            // 2. Update campaign status
            pipeline.set(
                CLICK_AND_IMPRESSION_KEYS.CAMPAIGN_STATUS(campaign.id),
                campaign.status
            );

            await pipeline.exec();

            this.logger.debug(`Updated campaign budget in Redis: ${campaign.id}`, {
                campaignId: campaign.id,
                dailyBudget: campaign.dailyBudget,
                status: campaign.status,
                updatedAt: campaign.updatedAt,
            });

        } catch (error) {
            this.logger.error(`Failed to update campaign ${campaign.id} in Redis:`, error);
            throw error;
        }
    }

    async getCampaignBudgetStatus(campaignId: string): Promise<CampaignBudgetStatus | null> {
        try {
            const today = new Date().toISOString().split('T')[0];

            // Use raw Redis client to avoid JSON parsing issues
            const redisClient = this.redis.getClient();

            const [dailyLimit, dailySpend, status] = await Promise.all([
                redisClient.get(CLICK_AND_IMPRESSION_KEYS.DAILY_BUDGET_LIMIT(campaignId)),
                redisClient.get(CLICK_AND_IMPRESSION_KEYS.DAILY_BUDGET_SPEND(campaignId, today)),
                redisClient.get(CLICK_AND_IMPRESSION_KEYS.CAMPAIGN_STATUS(campaignId)),
            ]);

            if (!dailyLimit) {
                // Budget not initialized, try to initialize it
                const campaign = await this.prisma.campaign.findUnique({
                    where: { id: campaignId },
                    select: {
                        id: true,
                        campaignBudgetTracker: {
                            where: {
                                date: today
                            },
                            select: {
                                dailyBudget: true,
                                totalBudget: true,
                            },
                            take: 1
                        },
                        status: true,
                    }
                });

                if (campaign && campaign.status === 'ACTIVE' && campaign.campaignBudgetTracker.length > 0) {
                    const budgetTracker = campaign.campaignBudgetTracker[0];
                    const budgetInfo: CampaignBudgetInfo = {
                        id: campaign.id,
                        dailyBudget: Number(budgetTracker.dailyBudget),
                        totalBudget: Number(budgetTracker.totalBudget),
                        bidPrice: 0,
                        status: campaign.status,
                    };

                    await this.initializeCampaignBudget(budgetInfo);
                    return this.getCampaignBudgetStatus(campaignId); // Recursive call after initialization
                }

                return null;
            }

            const limit = parseFloat(dailyLimit);
            const spend = parseFloat(dailySpend || '0');
            const remaining = Math.max(0, limit - spend);
            const canSpend = remaining > 0 && status === 'ACTIVE';

            return {
                dailyLimit: limit,
                dailySpend: spend,
                remaining,
                status: status || 'UNKNOWN',
                canSpend,
            };

        } catch (error) {
            this.logger.error(`Failed to get budget status for campaign ${campaignId}:`, error);
            return null;
        }
    }

    async canCampaignSpend(campaignId: string, amount: number): Promise<boolean> {
        const budgetStatus = await this.getCampaignBudgetStatus(campaignId);
        if (!budgetStatus) return false;

        return budgetStatus.canSpend && budgetStatus.remaining >= amount;
    }

    async getBatchCampaignBudgetStatus(campaignIds: string[]): Promise<Map<string, boolean>> {
        const results = new Map<string, boolean>();

        if (campaignIds.length === 0) return results;

        try {
            const today = new Date().toISOString().split('T')[0];

            // Use raw Redis client for batch operations
            const redisClient = this.redis.getClient();
            const pipeline = redisClient.pipeline();

            campaignIds.forEach(campaignId => {
                pipeline.get(CLICK_AND_IMPRESSION_KEYS.DAILY_BUDGET_LIMIT(campaignId));
                pipeline.get(CLICK_AND_IMPRESSION_KEYS.DAILY_BUDGET_SPEND(campaignId, today));
                pipeline.get(CLICK_AND_IMPRESSION_KEYS.CAMPAIGN_STATUS(campaignId));
            });

            const redisResults = await pipeline.exec();

            // Process results in groups of 3 (limit, spend, status)
            for (let i = 0; i < campaignIds.length; i++) {
                const campaignId = campaignIds[i];
                const baseIndex = i * 3;

                const dailyLimit = redisResults[baseIndex]?.[1] as string;
                const dailySpend = redisResults[baseIndex + 1]?.[1] as string;
                const status = redisResults[baseIndex + 2]?.[1] as string;

                if (dailyLimit && status === 'ACTIVE') {
                    const limit = parseFloat(dailyLimit);
                    const spend = parseFloat(dailySpend || '0');
                    const canSpend = (limit - spend) > 0;
                    results.set(campaignId, canSpend);
                } else {
                    results.set(campaignId, false);
                }
            }

        } catch (error) {
            this.logger.error('Failed to get batch budget status:', error);
            // Return all false in case of error
            campaignIds.forEach(campaignId => {
                results.set(campaignId, false);
            });
        }

        return results;
    }

    async refreshCampaignBudget(campaignId: string): Promise<void> {
        this.logger.log(`Manually refreshing budget for campaign: ${campaignId}`);
        const today = new Date().toISOString().split('T')[0];

        const campaign = await this.prisma.campaign.findUnique({
            where: { id: campaignId },
            select: {
                id: true,
                campaignBudgetTracker: {
                    where: {
                        date: today
                    },
                    select: {
                        dailyBudget: true,
                        totalBudget: true,
                    },
                    take: 1
                },
                status: true,
            }
        });

        if (campaign && campaign.campaignBudgetTracker.length > 0) {
            const budgetTracker = campaign.campaignBudgetTracker[0];
            const budgetInfo: CampaignBudgetInfo = {
                id: campaign.id,
                dailyBudget: Number(budgetTracker.dailyBudget),
                totalBudget: Number(budgetTracker.totalBudget),
                bidPrice: 0,
                status: campaign.status,
            };

            await this.initializeCampaignBudget(budgetInfo);
            this.logger.log(`✅ Budget refreshed for campaign: ${campaignId}`);
        } else {
            this.logger.warn(`Campaign not found or no budget tracker: ${campaignId}`);
        }
    }

    async getBudgetInitializationStats(): Promise<BudgetInitializationStats> {
        try {
            const [activeCampaignsCount, redisInfo] = await Promise.all([
                this.prisma.campaign.count({
                    where: { status: 'ACTIVE' }
                }),
                this.redis.getClient().info('memory')
            ]);

            // Use raw Redis client to get keys
            const budgetKeys = await this.redis.getClient().keys('budget:limit:*');

            return {
                activeCampaigns: activeCampaignsCount,
                budgetsInRedis: budgetKeys.length,
                redisMemoryUsage: this.extractMemoryUsage(redisInfo),
            };

        } catch (error) {
            this.logger.error('Failed to get budget initialization stats:', error);
            return {
                activeCampaigns: 0,
                budgetsInRedis: 0,
                redisMemoryUsage: 'unknown',
            };
        }
    }

    private extractMemoryUsage(redisInfo: string): string {
        const lines = redisInfo.split('\r\n');
        const usedMemoryLine = lines.find(line => line.startsWith('used_memory_human:'));
        return usedMemoryLine ? usedMemoryLine.split(':')[1] : 'unknown';
    }
}