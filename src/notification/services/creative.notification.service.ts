import { Injectable } from '@nestjs/common';
import { NotificationService } from '../notification.service';
import { UserType } from '../dto/create-notification.dto';


@Injectable()
export class CreativeNotificationService {
    constructor(private readonly notificationService: NotificationService) { }

    /**
     * Notify when a creative is added to a campaign
     */
    async notifyCreativeAdded(
        creative: any,
        campaign: any,
        advertiserId: string,
        clientId?: string,
        publisherId?: string
    ) {
        // Notify advertiser
        await this.notificationService.createNotification({
            userId: advertiserId,
            userType: UserType.ADVERTISER,
            title: 'Creative added',
            message: `A new creative "${creative.name}" has been added to campaign "${campaign.name}".`,
            data: {
                creativeId: creative.id,
                campaignId: campaign.id,
                inventoryId: creative.inventoryId,
                action: 'added',
                status: creative.status,
            },
        });

        // Notify client if exists
        if (clientId) {
            await this.notificationService.createNotification({
                userId: clientId,
                userType: UserType.CLIENT,
                title: 'Creative added',
                message: `A new creative "${creative.name}" has been added to campaign "${campaign.name}".`,
                data: {
                    creativeId: creative.id,
                    campaignId: campaign.id,
                    inventoryId: creative.inventoryId,
                    action: 'added',
                    status: creative.status,
                },
            });
        }

        // Notify publisher if exists
        if (publisherId) {
            await this.notificationService.createNotification({
                userId: publisherId,
                userType: UserType.PUBLISHER,
                title: 'New creative for your inventory',
                message: `A new creative has been submitted for review on your inventory.`,
                data: {
                    creativeId: creative.id,
                    campaignId: campaign.id,
                    inventoryId: creative.inventoryId,
                    action: 'added',
                    status: creative.status,
                },
            });
        }

        // Notify admin about new creative for review
        await this.notificationService.createBroadcastNotification({
            userType: UserType.ADMIN,
            title: 'New creative pending review',
            message: `A new creative "${creative.name}" requires review.`,
            data: {
                creativeId: creative.id,
                campaignId: campaign.id,
                inventoryId: creative.inventoryId,
                action: 'review_required',
                status: creative.status,
            },
        });
    }

    /**
 * Notify when a creative is updated
 */
    async notifyCreativeUpdated(
        creative: any,
        campaign: any,
        advertiserId: string,
        clientId?: string,
        publisherId?: string
    ) {
        // Notify advertiser
        await this.notificationService.createNotification({
            userId: advertiserId,
            userType: UserType.ADVERTISER,
            title: 'Creative updated',
            message: `Your creative "${creative.name}" in campaign "${campaign.name}" has been updated and is pending review.`,
            data: {
                creativeId: creative.id,
                campaignId: campaign.id,
                inventoryId: creative.inventoryId,
                action: 'updated',
                status: creative.status,
            },
        });

        // Notify client if exists
        if (clientId) {
            await this.notificationService.createNotification({
                userId: clientId,
                userType: UserType.CLIENT,
                title: 'Creative updated',
                message: `A creative "${creative.name}" in campaign "${campaign.name}" has been updated and is pending review.`,
                data: {
                    creativeId: creative.id,
                    campaignId: campaign.id,
                    inventoryId: creative.inventoryId,
                    action: 'updated',
                    status: creative.status,
                },
            });
        }

        // Notify publisher if exists
        if (publisherId) {
            await this.notificationService.createNotification({
                userId: publisherId,
                userType: UserType.PUBLISHER,
                title: 'Creative updated for your inventory',
                message: `A creative for your inventory has been updated and requires review.`,
                data: {
                    creativeId: creative.id,
                    campaignId: campaign.id,
                    inventoryId: creative.inventoryId,
                    action: 'updated',
                    status: creative.status,
                },
            });
        }

        // Notify admin about updated creative for review
        await this.notificationService.createBroadcastNotification({
            userType: UserType.ADMIN,
            title: 'Updated creative pending review',
            message: `Creative "${creative.name}" has been updated and requires review.`,
            data: {
                creativeId: creative.id,
                campaignId: campaign.id,
                inventoryId: creative.inventoryId,
                action: 'review_required',
                status: creative.status,
            },
        });
    }

    /**
     * Notify when a creative is removed from a campaign
     */
    async notifyCreativeRemoved(
        creative: any,
        campaign: any,
        advertiserId: string,
        clientId?: string,
        publisherId?: string
    ) {
        // Notify advertiser
        await this.notificationService.createNotification({
            userId: advertiserId,
            userType: UserType.ADVERTISER,
            title: 'Creative removed',
            message: `Creative "${creative.name}" has been removed from campaign "${campaign.name}".`,
            data: {
                creativeId: creative.id,
                campaignId: campaign.id,
                inventoryId: creative.inventoryId,
                action: 'removed',
            },
        });

        // Notify client if exists
        if (clientId) {
            await this.notificationService.createNotification({
                userId: clientId,
                userType: UserType.CLIENT,
                title: 'Creative removed',
                message: `Creative "${creative.name}" has been removed from campaign "${campaign.name}".`,
                data: {
                    creativeId: creative.id,
                    campaignId: campaign.id,
                    inventoryId: creative.inventoryId,
                    action: 'removed',
                },
            });
        }

        // Notify publisher if exists
        if (publisherId) {
            await this.notificationService.createNotification({
                userId: publisherId,
                userType: UserType.PUBLISHER,
                title: 'Creative removed from inventory',
                message: `A creative has been removed from your inventory.`,
                data: {
                    creativeId: creative.id,
                    campaignId: campaign.id,
                    inventoryId: creative.inventoryId,
                    action: 'removed',
                },
            });
        }

        // Notify admin
        await this.notificationService.createBroadcastNotification({
            userType: UserType.ADMIN,
            title: 'Creative removed',
            message: `Creative "${creative.name}" has been removed from campaign "${campaign.name}".`,
            data: {
                creativeId: creative.id,
                campaignId: campaign.id,
                inventoryId: creative.inventoryId,
                action: 'removed',
            },
        });
    }

    /**
     * Notify when a creative is approved
     */
    async notifyCreativeApproved(
        creative: any,
        campaign: any,
        advertiserId: string,
        clientId?: string,
        publisherId?: string,
        notes?: string
    ) {
        // Notify advertiser
        await this.notificationService.createNotification({
            userId: advertiserId,
            userType: UserType.ADVERTISER,
            title: 'Creative approved',
            message: `Your creative "${creative.name}" for campaign "${campaign.name}" has been approved${notes ? `: ${notes}` : '.'}`,
            data: {
                creativeId: creative.id,
                campaignId: campaign.id,
                inventoryId: creative.inventoryId,
                action: 'approved',
                notes,
            },
        });

        // Notify client if exists
        if (clientId) {
            await this.notificationService.createNotification({
                userId: clientId,
                userType: UserType.CLIENT,
                title: 'Creative approved',
                message: `Creative "${creative.name}" for campaign "${campaign.name}" has been approved${notes ? `: ${notes}` : '.'}`,
                data: {
                    creativeId: creative.id,
                    campaignId: campaign.id,
                    inventoryId: creative.inventoryId,
                    action: 'approved',
                    notes,
                },
            });
        }

        // Notify publisher if exists
        if (publisherId) {
            await this.notificationService.createNotification({
                userId: publisherId,
                userType: UserType.PUBLISHER,
                title: 'Creative approved for your inventory',
                message: `A creative has been approved for your inventory.`,
                data: {
                    creativeId: creative.id,
                    campaignId: campaign.id,
                    inventoryId: creative.inventoryId,
                    action: 'approved',
                    notes,
                },
            });
        }
    }

    /**
     * Notify when a creative is rejected
     */
    async notifyCreativeRejected(
        creative: any,
        campaign: any,
        advertiserId: string,
        clientId?: string,
        publisherId?: string,
        reason: string = 'No reason provided'
    ) {
        // Notify advertiser
        await this.notificationService.createNotification({
            userId: advertiserId,
            userType: UserType.ADVERTISER,
            title: 'Creative rejected',
            message: `Your creative "${creative.name}" for campaign "${campaign.name}" has been rejected: ${reason}`,
            data: {
                creativeId: creative.id,
                campaignId: campaign.id,
                inventoryId: creative.inventoryId,
                action: 'rejected',
                reason,
            },
        });

        // Notify client if exists
        if (clientId) {
            await this.notificationService.createNotification({
                userId: clientId,
                userType: UserType.CLIENT,
                title: 'Creative rejected',
                message: `Creative "${creative.name}" for campaign "${campaign.name}" has been rejected: ${reason}`,
                data: {
                    creativeId: creative.id,
                    campaignId: campaign.id,
                    inventoryId: creative.inventoryId,
                    action: 'rejected',
                    reason,
                },
            });
        }

        // Notify publisher if exists
        if (publisherId) {
            await this.notificationService.createNotification({
                userId: publisherId,
                userType: UserType.PUBLISHER,
                title: 'Creative rejected for your inventory',
                message: `A creative has been rejected for your inventory: ${reason}`,
                data: {
                    creativeId: creative.id,
                    campaignId: campaign.id,
                    inventoryId: creative.inventoryId,
                    action: 'rejected',
                    reason,
                },
            });
        }
    }
}