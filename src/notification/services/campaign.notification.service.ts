
import { Injectable } from '@nestjs/common';
import { NotificationService } from '../notification.service';
import { UserType } from '../dto/create-notification.dto';
import { PrismaService } from 'src/prisma/prisma.service';


@Injectable()
export class CampaignNotificationService {
    constructor(public readonly notificationService: NotificationService,
        private readonly prisma: PrismaService,
    ) { }

    // Done
    async notifyCampaignCreated(
        campaign: any,
        advertiserId: string,
        clientId?: string,
    ) {
        const isScheduled = new Date(campaign.startDate) > new Date();
        const status = isScheduled ? 'scheduled' : 'started';

        // Notify advertiser
        await this.notificationService.createNotification({
            userId: advertiserId,
            userType: UserType.ADVERTISER,
            title: `Campaign ${status}`,
            message: `Your campaign "${campaign.name}" has been ${status}.`,
            data: {
                campaignId: campaign.id,
                action: 'created',
                status: campaign.status,
            },
        });

        // Notify client if exists
        if (clientId) {
            await this.notificationService.createNotification({
                userId: clientId,
                userType: UserType.CLIENT,
                title: `Campaign ${status}`,
                message: `A new campaign "${campaign.name}" has been ${status}.`,
                data: {
                    campaignId: campaign.id,
                    action: 'created',
                    status: campaign.status,
                },
            });
        }
    }

    // Done
    async notifyCampaignUpdated(
        campaign: any,
        advertiserId: string,
        clientId?: string,
    ) {
        // Notify advertiser
        await this.notificationService.createNotification({
            userId: advertiserId,
            userType: UserType.ADVERTISER,
            title: 'Campaign updated',
            message: `Your campaign "${campaign.name}" has been updated.`,
            data: {
                campaignId: campaign.id,
                action: 'updated',
                status: campaign.status,
            },
        });

        // Notify client if exists
        if (clientId) {
            await this.notificationService.createNotification({
                userId: clientId,
                userType: UserType.CLIENT,
                title: 'Campaign updated',
                message: `The campaign "${campaign.name}" has been updated.`,
                data: {
                    campaignId: campaign.id,
                    action: 'updated',
                    status: campaign.status,
                },
            });
        }
    }

    /**
     * Notify when campaign targeting is updated
     */
    async notifyCampaignTargetingUpdated(
        campaign: any,
        advertiserId: string,
        clientId?: string,
    ) {
        // Notify advertiser
        await this.notificationService.createNotification({
            userId: advertiserId,
            userType: UserType.ADVERTISER,
            title: 'Campaign targeting updated',
            message: `Targeting rules for "${campaign.name}" have been updated.`,
            data: {
                campaignId: campaign.id,
                action: 'targeting_updated',
            },
        });

        // Notify client if exists
        if (clientId) {
            await this.notificationService.createNotification({
                userId: clientId,
                userType: UserType.CLIENT,
                title: 'Campaign targeting updated',
                message: `Targeting rules for "${campaign.name}" have been updated.`,
                data: {
                    campaignId: campaign.id,
                    action: 'targeting_updated',
                },
            });
        }
    }

    // Done
    async notifyCampaignDeleted(
        campaignName: string,
        advertiserId: string,
        clientId?: string,
    ) {
        // Notify advertiser
        await this.notificationService.createNotification({
            userId: advertiserId,
            userType: UserType.ADVERTISER,
            title: 'Campaign deleted',
            message: `Your campaign "${campaignName}" has been deleted.`,
            data: {
                action: 'deleted',
            },
        });

        // Notify client if exists
        if (clientId) {
            await this.notificationService.createNotification({
                userId: clientId,
                userType: UserType.CLIENT,
                title: 'Campaign deleted',
                message: `The campaign "${campaignName}" has been deleted.`,
                data: {
                    action: 'deleted',
                },
            });
        }
    }

    // ! Campaign Status Notifications
    /**
     * Notify when a campaign is activated
     */
    async notifyCampaignActivated(campaign: any) {
        const fullCampaign = await this.prisma.campaign.findUnique({
            where: { id: campaign.id },
            include: {
                statistics: {
                    orderBy: { date: 'desc' },
                    take: 1
                }
            }
        });

        // Format start date
        const startDate = new Date(campaign.startDate);
        const formattedDate = startDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Create custom notification with detailed message
        await this.notificationService.createNotification({
            userId: campaign.advertiserId,
            userType: UserType.ADVERTISER,
            title: 'Campaign Activated',
            message: `Your campaign "${campaign.name}" has been automatically activated as scheduled for ${formattedDate}.`,
            data: {
                campaignId: campaign.id,
                action: 'activated',
                status: 'ACTIVE',
                previousStatus: 'SCHEDULED'
            },
        });

        // Notify client if exists
        if (campaign.clientId) {
            await this.notificationService.createNotification({
                userId: campaign.clientId,
                userType: UserType.CLIENT,
                title: 'Campaign Activated',
                message: `The campaign "${campaign.name}" has been automatically activated as scheduled for ${formattedDate}.`,
                data: {
                    campaignId: campaign.id,
                    action: 'activated',
                    status: 'ACTIVE',
                    previousStatus: 'SCHEDULED'
                },
            });
        }
    }

    /**
     * Notify when a campaign activation failed
     */
    async notifyCampaignActivationFailed(campaign: any) {
        const reason = campaign._count.campaignInventories === 0
            ? 'no inventory assigned'
            : 'no creatives uploaded';

        await this.notificationService.createNotification({
            userId: campaign.advertiserId,
            userType: UserType.ADVERTISER,
            title: 'Campaign Activation Failed',
            message: `Your campaign "${campaign.name}" could not be activated because there is ${reason}. Please update your campaign.`,
            data: {
                campaignId: campaign.id,
                action: 'activation_failed',
                status: 'SCHEDULED',
                reason: reason
            },
        });

        // Notify client if exists
        if (campaign.clientId) {
            await this.notificationService.createNotification({
                userId: campaign.clientId,
                userType: UserType.CLIENT,
                title: 'Campaign Activation Failed',
                message: `The campaign "${campaign.name}" could not be activated because there is ${reason}. Please contact your advertiser.`,
                data: {
                    campaignId: campaign.id,
                    action: 'activation_failed',
                    status: 'SCHEDULED',
                    reason: reason
                },
            });
        }
    }

    /**
     * Notify when a campaign is completed
     */
    async notifyCampaignCompleted(campaign: any) {
        // Get campaign duration
        const startDate = new Date(campaign.startDate);
        const endDate = new Date(campaign.endDate);
        const durationDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

        // Format end date
        const formattedDate = endDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Get campaign statistics summary if available
        const stats = await this.prisma.campaignStatistics.aggregate({
            where: { campaignId: campaign.id },
            _sum: {
                impressions: true,
                clicks: true,
                conversions: true,
                spend: true
            }
        });

        const impressions = stats._sum.impressions || 0;
        const clicks = stats._sum.clicks || 0;
        const ctr = impressions > 0 ? (clicks / impressions * 100).toFixed(2) + '%' : '0%';

        // Create custom notification with detailed message
        await this.notificationService.createNotification({
            userId: campaign.advertiserId,
            userType: UserType.ADVERTISER,
            title: 'Campaign Completed',
            message: `Your campaign "${campaign.name}" has completed its scheduled run as of ${formattedDate}. It ran for ${durationDays} days with ${impressions} impressions, ${clicks} clicks (${ctr} CTR).`,
            data: {
                campaignId: campaign.id,
                action: 'completed',
                status: 'COMPLETED',
                previousStatus: 'ACTIVE',
                stats: {
                    impressions,
                    clicks,
                    ctr,
                    durationDays
                }
            },
        });

        // Notify client if exists
        if (campaign.clientId) {
            await this.notificationService.createNotification({
                userId: campaign.clientId,
                userType: UserType.CLIENT,
                title: 'Campaign Completed',
                message: `The campaign "${campaign.name}" has completed its scheduled run as of ${formattedDate}. It ran for ${durationDays} days with ${impressions} impressions, ${clicks} clicks (${ctr} CTR).`,
                data: {
                    campaignId: campaign.id,
                    action: 'completed',
                    status: 'COMPLETED',
                    previousStatus: 'ACTIVE',
                    stats: {
                        impressions,
                        clicks,
                        ctr,
                        durationDays
                    }
                },
            });
        }
    }

    /**
     * Notify when a campaign budget is exhausted
     */
    async notifyCampaignBudgetExhausted(campaign: any) {
        const { budget, totalSpend } = campaign;
        const spendPercentage = ((totalSpend / Number(budget)) * 100).toFixed(1);

        // Format budget values
        const formattedBudget = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(Number(budget));

        const formattedSpend = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(totalSpend);

        // Get remaining campaign days
        const now = new Date();
        const endDate = new Date(campaign.endDate);
        const remainingDays = Math.max(0, Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

        // Create custom notification with detailed message
        await this.notificationService.createNotification({
            userId: campaign.advertiserId,
            userType: UserType.ADVERTISER,
            title: 'Campaign Budget Exhausted',
            message: `Your campaign "${campaign.name}" has reached its budget limit of ${formattedBudget} (${spendPercentage}% spent). The campaign has been paused with ${remainingDays} days remaining in the schedule. To resume, please increase the budget.`,
            data: {
                campaignId: campaign.id,
                action: 'budget_exhausted',
                status: 'BUDGET_EXHAUSTED',
                previousStatus: 'ACTIVE',
                budget: Number(budget),
                spent: totalSpend,
                spendPercentage,
                remainingDays
            },
        });

        // Notify client if exists
        if (campaign.clientId) {
            await this.notificationService.createNotification({
                userId: campaign.clientId,
                userType: UserType.CLIENT,
                title: 'Campaign Budget Exhausted',
                message: `The campaign "${campaign.name}" has reached its budget limit of ${formattedBudget} (${spendPercentage}% spent). The campaign has been paused with ${remainingDays} days remaining in the schedule. Please contact your advertiser to increase the budget.`,
                data: {
                    campaignId: campaign.id,
                    action: 'budget_exhausted',
                    status: 'BUDGET_EXHAUSTED',
                    previousStatus: 'ACTIVE',
                    budget: Number(budget),
                    spent: totalSpend,
                    spendPercentage,
                    remainingDays
                },
            });
        }
    }
}