// src/notification/services/creative.notification.service.ts
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
    ) {
        // Notify advertiser
        await this.notificationService.createNotification({
            userId: advertiserId,
            userType: UserType.ADVERTISER,
            title: 'Creative uploaded successfully',
            message: `Your creative "${creative.name}" has been uploaded to campaign "${campaign.name}" and is pending review.`,
            data: {
                creativeId: creative.id,
                campaignId: campaign.id,
                templateId: creative.templateId,
                action: 'uploaded',
                status: creative.status,
            },
        });

        // Notify client if exists
        if (clientId) {
            await this.notificationService.createNotification({
                userId: clientId,
                userType: UserType.CLIENT,
                title: 'Creative uploaded',
                message: `A new creative "${creative.name}" has been uploaded to campaign "${campaign.name}" and is pending review.`,
                data: {
                    creativeId: creative.id,
                    campaignId: campaign.id,
                    templateId: creative.templateId,
                    action: 'uploaded',
                    status: creative.status,
                },
            });
        }

        // Notify admin about new creative for review
        await this.notificationService.createBroadcastNotification({
            userType: UserType.ADMIN,
            title: 'New creative pending review',
            message: `A new creative "${creative.name}" for campaign "${campaign.name}" requires review.`,
            data: {
                creativeId: creative.id,
                campaignId: campaign.id,
                templateId: creative.templateId,
                advertiserName: campaign.advertiser?.name,
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
        fileUpdated: boolean = false
    ) {
        const fileUpdateMessage = fileUpdated ? ' The creative file has been updated and' : ' The creative details have been updated and';

        // Notify advertiser
        await this.notificationService.createNotification({
            userId: advertiserId,
            userType: UserType.ADVERTISER,
            title: 'Creative updated',
            message: `Your creative "${creative.name}" in campaign "${campaign.name}" has been updated.${fileUpdated ? ' The updated file is pending review.' : ''}`,
            data: {
                creativeId: creative.id,
                campaignId: campaign.id,
                templateId: creative.templateId,
                action: 'updated',
                status: creative.status,
                fileUpdated,
            },
        });

        // Notify client if exists
        if (clientId) {
            await this.notificationService.createNotification({
                userId: clientId,
                userType: UserType.CLIENT,
                title: 'Creative updated',
                message: `Creative "${creative.name}" in campaign "${campaign.name}" has been updated.${fileUpdated ? ' The updated file is pending review.' : ''}`,
                data: {
                    creativeId: creative.id,
                    campaignId: campaign.id,
                    templateId: creative.templateId,
                    action: 'updated',
                    status: creative.status,
                    fileUpdated,
                },
            });
        }

        // Notify admin if file was updated (requires review)
        if (fileUpdated) {
            await this.notificationService.createBroadcastNotification({
                userType: UserType.ADMIN,
                title: 'Updated creative pending review',
                message: `Creative "${creative.name}" for campaign "${campaign.name}" has been updated with a new file and requires review.`,
                data: {
                    creativeId: creative.id,
                    campaignId: campaign.id,
                    templateId: creative.templateId,
                    advertiserName: campaign.advertiser?.name,
                    action: 'review_required',
                    status: creative.status,
                },
            });
        }
    }

    /**
     * Notify when a creative is removed from a campaign
     */
    async notifyCreativeRemoved(
        creativeName: string,
        campaignName: string,
        creativeId: string,
        campaignId: string,
        templateId: string,
        advertiserId: string,
        clientId?: string
    ) {
        // Notify advertiser
        await this.notificationService.createNotification({
            userId: advertiserId,
            userType: UserType.ADVERTISER,
            title: 'Creative deleted',
            message: `Creative "${creativeName}" has been deleted from campaign "${campaignName}".`,
            data: {
                creativeId,
                campaignId,
                templateId,
                action: 'deleted',
            },
        });

        // Notify client if exists
        if (clientId) {
            await this.notificationService.createNotification({
                userId: clientId,
                userType: UserType.CLIENT,
                title: 'Creative deleted',
                message: `Creative "${creativeName}" has been deleted from campaign "${campaignName}".`,
                data: {
                    creativeId,
                    campaignId,
                    templateId,
                    action: 'deleted',
                },
            });
        }

        // Notify admin
        await this.notificationService.createBroadcastNotification({
            userType: UserType.ADMIN,
            title: 'Creative deleted',
            message: `Creative "${creativeName}" has been deleted from campaign "${campaignName}".`,
            data: {
                creativeId,
                campaignId,
                templateId,
                action: 'deleted',
            },
        });
    }

    /**
     * Notify when a creative is approved (Admin action)
     */
    async notifyCreativeApproved(
        creative: any,
        campaign: any,
        advertiserId: string,
        clientId?: string,
        notes?: string
    ) {
        // Notify advertiser
        await this.notificationService.createNotification({
            userId: advertiserId,
            userType: UserType.ADVERTISER,
            title: 'Creative approved!',
            message: `Great news! Your creative "${creative.name}" for campaign "${campaign.name}" has been approved and is now live.${notes ? ` Admin note: ${notes}` : ''}`,
            data: {
                creativeId: creative.id,
                campaignId: campaign.id,
                templateId: creative.templateId,
                action: 'approved',
                notes,
            },
        });

        // Notify client if exists
        if (clientId) {
            await this.notificationService.createNotification({
                userId: clientId,
                userType: UserType.CLIENT,
                title: 'Creative approved! 🎉',
                message: `Creative "${creative.name}" for campaign "${campaign.name}" has been approved and is now live.${notes ? ` Admin note: ${notes}` : ''}`,
                data: {
                    creativeId: creative.id,
                    campaignId: campaign.id,
                    templateId: creative.templateId,
                    action: 'approved',
                    notes,
                },
            });
        }
    }

    /**
     * Notify when a creative is rejected (Admin action)
     */
    async notifyCreativeRejected(
        creative: any,
        campaign: any,
        advertiserId: string,
        clientId?: string,
        reason: string = 'No reason provided'
    ) {
        // Notify advertiser
        await this.notificationService.createNotification({
            userId: advertiserId,
            userType: UserType.ADVERTISER,
            title: 'Creative rejected',
            message: `Your creative "${creative.name}" for campaign "${campaign.name}" has been rejected. Reason: ${reason}. Please update and resubmit.`,
            data: {
                creativeId: creative.id,
                campaignId: campaign.id,
                templateId: creative.templateId,
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
                message: `Creative "${creative.name}" for campaign "${campaign.name}" has been rejected. Reason: ${reason}. Please coordinate with your advertiser to update and resubmit.`,
                data: {
                    creativeId: creative.id,
                    campaignId: campaign.id,
                    templateId: creative.templateId,
                    action: 'rejected',
                    reason,
                },
            });
        }
    }

    /**
     * Notify when creative file size is optimized
     */
    async notifyCreativeOptimized(
        creative: any,
        campaign: any,
        advertiserId: string,
        originalSize: number,
        optimizedSize: number,
        clientId?: string
    ) {
        const savedPercentage = Math.round(((originalSize - optimizedSize) / originalSize) * 100);

        // Notify advertiser
        await this.notificationService.createNotification({
            userId: advertiserId,
            userType: UserType.ADVERTISER,
            title: 'Creative optimized',
            message: `Your creative "${creative.name}" has been automatically optimized, reducing file size by ${savedPercentage}% while maintaining quality.`,
            data: {
                creativeId: creative.id,
                campaignId: campaign.id,
                templateId: creative.templateId,
                action: 'optimized',
                originalSize,
                optimizedSize,
                savedPercentage,
            },
        });

        // Notify client if exists
        if (clientId) {
            await this.notificationService.createNotification({
                userId: clientId,
                userType: UserType.CLIENT,
                title: 'Creative optimized',
                message: `Creative "${creative.name}" has been automatically optimized, reducing file size by ${savedPercentage}% for better performance.`,
                data: {
                    creativeId: creative.id,
                    campaignId: campaign.id,
                    templateId: creative.templateId,
                    action: 'optimized',
                    originalSize,
                    optimizedSize,
                    savedPercentage,
                },
            });
        }
    }

    /**
     * Notify when creative dimensions don't match template
     */
    async notifyDimensionMismatch(
        creative: any,
        campaign: any,
        advertiserId: string,
        expectedDimensions: { width: number; height: number },
        actualDimensions: { width: number; height: number },
        clientId?: string
    ) {
        // Notify advertiser
        await this.notificationService.createNotification({
            userId: advertiserId,
            userType: UserType.ADVERTISER,
            title: 'Creative dimension warning',
            message: `Your creative "${creative.name}" dimensions (${actualDimensions.width}x${actualDimensions.height}) don't match the expected template size (${expectedDimensions.width}x${expectedDimensions.height}). This may affect ad performance.`,
            data: {
                creativeId: creative.id,
                campaignId: campaign.id,
                templateId: creative.templateId,
                action: 'dimension_warning',
                expectedDimensions,
                actualDimensions,
            },
        });

        // Notify client if exists
        if (clientId) {
            await this.notificationService.createNotification({
                userId: clientId,
                userType: UserType.CLIENT,
                title: 'Creative dimension warning',
                message: `Creative "${creative.name}" dimensions don't match the expected template size. Please review with your advertiser.`,
                data: {
                    creativeId: creative.id,
                    campaignId: campaign.id,
                    templateId: creative.templateId,
                    action: 'dimension_warning',
                    expectedDimensions,
                    actualDimensions,
                },
            });
        }
    }
}