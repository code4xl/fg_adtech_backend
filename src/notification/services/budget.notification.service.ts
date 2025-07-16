import { Injectable, Logger } from '@nestjs/common';
import { NotificationService } from '../notification.service';
import { UserType } from '../dto/create-notification.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class BudgetNotificationService {
    private readonly logger = new Logger(BudgetNotificationService.name);

    constructor(
        private readonly notificationService: NotificationService,
        private readonly prisma: PrismaService,
        private readonly redis: RedisService, // Add Redis service
    ) { }

    /**
     * Notify when daily budget reaches 90% exhaustion
     * Get campaign data with caching to avoid repeated DB calls
     */
    async notifyDailyBudget90Exhausted(
        campaignId: string,
        dailyBudget: number,
        spentAmount: number,
        spentPercentage: number
    ) {
        this.logger.debug(`Notifying 90% daily budget exhaustion for campaign ${campaignId}`);

        // 🚀 OPTIMIZATION: Get campaign data from cache or database
        const campaign = await this.getCampaignDataCached(campaignId);
        if (!campaign) {
            this.logger.error(`Campaign not found: ${campaignId}`);
            return;
        }

        // Format amounts for display
        const formattedBudget = new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(dailyBudget);

        const formattedSpent = new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(spentAmount);

        const remaining = dailyBudget - spentAmount;
        const formattedRemaining = new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(remaining);

        const message = `⚠️ Daily budget alert: Your campaign "${campaign.name}" has spent ${formattedSpent} (${spentPercentage.toFixed(1)}%) of its daily budget of ${formattedBudget}. Only ${formattedRemaining} remaining for today.`;

        // Notify advertiser
        await this.notificationService.createNotification({
            userId: campaign.advertiserId,
            userType: UserType.ADVERTISER,
            title: 'Daily Budget 90% Exhausted',
            message,
            data: {
                campaignId: campaign.id,
                campaignName: campaign.name,
                dailyBudget,
                spentAmount,
                spentPercentage,
                remaining,
                alertType: 'daily_budget_90_exhausted',
                date: new Date().toISOString().split('T')[0]
            },
        });

        // Notify client if exists
        if (campaign.clientId) {
            await this.notificationService.createNotification({
                userId: campaign.clientId,
                userType: UserType.CLIENT,
                title: 'Daily Budget 90% Exhausted',
                message,
                data: {
                    campaignId: campaign.id,
                    campaignName: campaign.name,
                    dailyBudget,
                    spentAmount,
                    spentPercentage,
                    remaining,
                    alertType: 'daily_budget_90_exhausted',
                    date: new Date().toISOString().split('T')[0]
                },
            });
        }
    }

    /**
     * Notify when total campaign budget reaches 90% exhaustion
     * Get campaign data with caching to avoid repeated DB calls
     */
    async notifyTotalBudget90Exhausted(
        campaignId: string,
        totalBudget: number,
        spentAmount: number,
        spentPercentage: number
    ) {
        this.logger.debug(`Notifying 90% total budget exhaustion for campaign ${campaignId}`);

        // 🚀 OPTIMIZATION: Get campaign data from cache or database
        const campaign = await this.getCampaignDataCached(campaignId);
        if (!campaign) {
            this.logger.error(`Campaign not found: ${campaignId}`);
            return;
        }

        // Format amounts for display
        const formattedBudget = new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(totalBudget);

        const formattedSpent = new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(spentAmount);

        const remaining = totalBudget - spentAmount;
        const formattedRemaining = new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(remaining);

        // Calculate remaining days
        const now = new Date();
        const endDate = new Date(campaign.endDate);
        const remainingDays = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

        const message = `🚨 Total budget alert: Your campaign "${campaign.name}" has spent ${formattedSpent} (${spentPercentage.toFixed(1)}%) of its total budget of ${formattedBudget}. Only ${formattedRemaining} remaining with ${remainingDays} days left in the campaign.`;

        // Notify advertiser
        await this.notificationService.createNotification({
            userId: campaign.advertiserId,
            userType: UserType.ADVERTISER,
            title: 'Total Budget 90% Exhausted',
            message,
            data: {
                campaignId: campaign.id,
                campaignName: campaign.name,
                totalBudget,
                spentAmount,
                spentPercentage,
                remaining,
                remainingDays,
                alertType: 'total_budget_90_exhausted',
                date: new Date().toISOString().split('T')[0]
            },
        });

        // Notify client if exists
        if (campaign.clientId) {
            await this.notificationService.createNotification({
                userId: campaign.clientId,
                userType: UserType.CLIENT,
                title: 'Total Budget 90% Exhausted',
                message,
                data: {
                    campaignId: campaign.id,
                    campaignName: campaign.name,
                    totalBudget,
                    spentAmount,
                    spentPercentage,
                    remaining,
                    remainingDays,
                    alertType: 'total_budget_90_exhausted',
                    date: new Date().toISOString().split('T')[0]
                },
            });
        }
    }

    /**
     * Get campaign data with caching to avoid repeated DB calls
     */
    private async getCampaignDataCached(campaignId: string) {
        const cacheKey = `campaign:notification:${campaignId}`;
        
        try {
            // Check cache first (5 minute TTL)
            const cached: string = await this.redis.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }

            // Fetch from database
            const campaign = await this.prisma.campaign.findUnique({
                where: { id: campaignId },
                include: {
                    advertiser: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    },
                    client: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                }
            });

            if (campaign) {
                // Cache for 5 minutes
                await this.redis.set(
                    cacheKey, 
                    JSON.stringify(campaign), 
                    300 // 5 minutes TTL
                );
            }

            return campaign;
        } catch (error) {
            this.logger.error(`Error fetching campaign data: ${error.message}`);
            return null;
        }
    }

    /**
     * Send daily spending notifications to advertisers using database data -- Done
     */
    public async sendAdvertiserSpendingNotifications(date: string): Promise<number> {
        const advertisersWithSpending = await this.prisma.advertiser.findMany({
            where: {
                Campaign: {
                    some: {
                        status: 'ACTIVE',
                        AdvertiserDailySpending: {
                            some: {
                                date: new Date(date),
                                totalSpend: { gt: 0 }
                            }
                        }
                    }
                }
            },
            select: {
                id: true,
                name: true,
                email: true,
                Campaign: {
                    where: {
                        status: 'ACTIVE',
                        AdvertiserDailySpending: {
                            some: {
                                date: new Date(date),
                                totalSpend: { gt: 0 }
                            }
                        }
                    },
                    select: {
                        id: true,
                        name: true,
                        AdvertiserDailySpending: {
                            where: {
                                date: new Date(date)
                            },
                            select: {
                                totalSpend: true
                            }
                        }
                    }
                }
            }
        });

        let notificationCount = 0;

        for (const advertiser of advertisersWithSpending) {
            try {
                // Calculate total spending across all campaigns
                let totalSpending = 0;
                const campaignSpending = [];

                for (const campaign of advertiser.Campaign) {
                    const campaignSpend = campaign.AdvertiserDailySpending.length > 0
                        ? Number(campaign.AdvertiserDailySpending[0].totalSpend)
                        : 0;
                    
                    if (campaignSpend > 0) {
                        totalSpending += campaignSpend;
                        campaignSpending.push({
                            name: campaign.name,
                            spending: campaignSpend
                        });
                    }
                }

                if (totalSpending > 0) {
                    const formattedTotal = new Intl.NumberFormat('en-IN', {
                        style: 'currency',
                        currency: 'INR'
                    }).format(totalSpending);

                    const campaignDetails = campaignSpending
                        .sort((a, b) => b.spending - a.spending)
                        .slice(0, 3) // Top 3 spending campaigns
                        .map(c => `${c.name}: ${new Intl.NumberFormat('en-IN', {
                            style: 'currency',
                            currency: 'INR'
                        }).format(c.spending)}`)
                        .join(', ');

                    await this.notificationService.createNotification({
                        userId: advertiser.id,
                        userType: UserType.ADVERTISER,
                        title: 'Daily Spending Report',
                        message: `Your total spending yesterday (${date}) was ${formattedTotal} across ${campaignSpending.length} active campaign${campaignSpending.length > 1 ? 's' : ''}. Top campaigns: ${campaignDetails}`,
                        data: {
                            date,
                            totalSpending,
                            campaignCount: campaignSpending.length,
                            campaignSpending,
                            reportType: 'daily_spending'
                        }
                    });

                    notificationCount++;
                }
            } catch (error) {
                this.logger.error(`Error sending notification to advertiser ${advertiser.id}:`, error);
            }
        }

        return notificationCount;
    }

    /**
     * Send daily revenue notifications to publishers using database data -- Done
     */
    public async sendPublisherRevenueNotifications(date: string): Promise<number> {
        const publishersWithRevenue = await this.prisma.publisher.findMany({
            where: {
                PublisherDailyRevenue: {
                    some: {
                        date: new Date(date),
                        grossRevenue: { gt: 0 }
                    }
                }
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                inventories: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                PublisherDailyRevenue: {
                    where: {
                        date: new Date(date)
                    },
                    select: {
                        grossRevenue: true,
                        netRevenue: true,
                        totalImpressions: true
                    }
                }
            }
        });

        let notificationCount = 0;

        for (const publisher of publishersWithRevenue) {
            try {
                const dailyRevenue = publisher.PublisherDailyRevenue[0];
                if (!dailyRevenue) continue;

                const totalRevenue = Number(dailyRevenue.netRevenue);
                const totalImpressions = dailyRevenue.totalImpressions;

                if (totalRevenue > 0) {
                    const formattedRevenue = new Intl.NumberFormat('en-IN', {
                        style: 'currency',
                        currency: 'INR'
                    }).format(totalRevenue);

                    await this.notificationService.createNotification({
                        userId: publisher.id,
                        userType: UserType.PUBLISHER,
                        title: 'Daily Revenue Report',
                        message: `Your total revenue yesterday (${date}) was ${formattedRevenue} from ${totalImpressions.toLocaleString()} impressions across ${publisher.inventories.length} active inventor${publisher.inventories.length > 1 ? 'ies' : 'y'}. Keep up the great work!`,
                        data: {
                            date,
                            totalRevenue,
                            totalImpressions,
                            inventoryCount: publisher.inventories.length,
                            reportType: 'daily_revenue'
                        }
                    });

                    notificationCount++;
                }
            } catch (error) {
                this.logger.error(`Error sending notification to publisher ${publisher.id}:`, error);
            }
        }

        return notificationCount;
    }

    /**
     * Send daily system revenue notifications to admins using database data -- Done
     */
    public async sendSystemRevenueNotifications(date: string): Promise<number> {
        try {
            const [systemDailyRevenue, metrics] = await Promise.all([
                this.prisma.systemDailyRevenue.findUnique({
                    where: {
                        date: new Date(date)
                    },
                    select: {
                        totalGrossRevenue: true,
                        totalCommissionEarned: true,
                        totalPublisherPayout: true,
                        totalImpressions: true,
                        totalClicks: true,
                        activeCampaigns: true,
                        activePublishers: true,
                        activeAdvertisers: true
                    }
                }),
                // Get current totals for context
                Promise.all([
                    this.prisma.campaign.count(),
                    this.prisma.campaign.count({ where: { status: 'ACTIVE' } }),
                    this.prisma.publisher.count({ where: { status: 'ACTIVE' } }),
                    this.prisma.advertiser.count({ where: { status: 'ACTIVE' } })
                ])
            ]);

            if (!systemDailyRevenue) {
                this.logger.warn(`No system revenue data found for ${date}`);
                return 0;
            }

            const [totalCampaigns, activeCampaigns, totalPublishers, totalAdvertisers] = metrics;
            const systemRevenue = Number(systemDailyRevenue.totalCommissionEarned);
            const totalImpressions = systemDailyRevenue.totalImpressions;
            const totalClicks = systemDailyRevenue.totalClicks;
            const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0';

            const formattedRevenue = new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR'
            }).format(systemRevenue);

            // Send to all admins
            await this.notificationService.createBroadcastNotification({
                userType: UserType.ADMIN,
                title: 'Daily System Revenue Report',
                message: `System revenue for ${date}: ${formattedRevenue}. Impressions: ${totalImpressions.toLocaleString()}, Clicks: ${totalClicks.toLocaleString()} (${ctr}% CTR). Active: ${activeCampaigns}/${totalCampaigns} campaigns, ${totalPublishers} publishers, ${totalAdvertisers} advertisers`,
                data: {
                    date,
                    systemRevenue,
                    totalImpressions,
                    totalClicks,
                    ctr: parseFloat(ctr),
                    activeCampaigns,
                    totalCampaigns,
                    totalPublishers,
                    totalAdvertisers,
                    reportType: 'daily_system_revenue'
                }
            });

            return 1; // Broadcast counts as 1 notification
        } catch (error) {
            this.logger.error('Error sending system revenue notification:', error);
            return 0;
        }
    }
}