// src/notification/inventory-notification.service.ts

import { Injectable } from '@nestjs/common';
import { NotificationService } from '../notification.service';
import { UserType } from '../dto/create-notification.dto';


@Injectable()
export class InventoryNotificationService {
    constructor(private readonly notificationService: NotificationService) { }

    /**
     * Notify when inventory is assigned to a campaign
     */
    async notifyInventoryAssigned(
        campaign: any,
        inventory: any,
        advertiserId: string,
        maxBid: number,
        isUpdate: boolean = false
    ) {
        const publisherName = inventory.publisher
            ? `${inventory.publisher.firstName} ${inventory.publisher.lastName}`
            : 'Unknown Publisher';
        const inventoryName = inventory.name || 'Unknown Inventory';
        const action = isUpdate ? 'update' : 'assign';
        const message = isUpdate
            ? `Inventory ${inventoryName} from ${publisherName} settings updated for campaign "${campaign.name}"`
            : `Inventory ${inventoryName} from ${publisherName} assigned to campaign "${campaign.name}"`;

        // Notify advertiser
        await this.notificationService.createNotification({
            userId: advertiserId,
            userType: UserType.ADVERTISER,
            title: 'Inventory Assignment',
            message,
            data: {
                campaignId: campaign.id,
                campaignName: campaign.name,
                inventoryId: inventory.id,
                inventoryName,
                publisherId: inventory.publisher?.id,
                publisherName,
                maxBid,
                action
            }
        });

        // Notify client if exists
        if (campaign.client) {
            await this.notificationService.createNotification({
                userId: campaign.client.id,
                userType: UserType.CLIENT,
                title: 'Inventory Assignment',
                message,
                data: {
                    campaignId: campaign.id,
                    campaignName: campaign.name,
                    inventoryId: inventory.id,
                    inventoryName,
                    publisherId: inventory.publisher?.id,
                    publisherName,
                    maxBid,
                    action
                }
            });
        }

        // Notify admins (broadcast)
        await this.notificationService.createBroadcastNotification({
            userType: UserType.ADMIN,
            title: 'Inventory Assignment',
            message,
            data: {
                campaignId: campaign.id,
                campaignName: campaign.name,
                inventoryId: inventory.id,
                inventoryName,
                publisherId: inventory.publisher?.id,
                publisherName,
                maxBid,
                action
            }
        });
    }

    /**
     * Notify when inventory is removed from a campaign
     */
    async notifyInventoryRemoved(
        campaign: any,
        inventoryId: string,
        inventoryName: string,
        publisherId: string,
        publisherName: string,
        advertiserId: string
    ) {
        const message = `Inventory ${inventoryName} from ${publisherName} removed from campaign "${campaign.name}"`;

        // Notify advertiser
        await this.notificationService.createNotification({
            userId: advertiserId,
            userType: UserType.ADVERTISER,
            title: 'Inventory Removed',
            message,
            data: {
                campaignId: campaign.id,
                campaignName: campaign.name,
                inventoryId,
                inventoryName,
                publisherId,
                publisherName,
                action: 'remove'
            }
        });

        // Notify client if exists
        if (campaign.client) {
            await this.notificationService.createNotification({
                userId: campaign.client.id,
                userType: UserType.CLIENT,
                title: 'Inventory Removed',
                message,
                data: {
                    campaignId: campaign.id,
                    campaignName: campaign.name,
                    inventoryId,
                    inventoryName,
                    publisherId,
                    publisherName,
                    action: 'remove'
                }
            });
        }

        // Notify admins (broadcast)
        await this.notificationService.createBroadcastNotification({
            userType: UserType.ADMIN,
            title: 'Inventory Removed',
            message,
            data: {
                campaignId: campaign.id,
                campaignName: campaign.name,
                inventoryId,
                inventoryName,
                publisherId,
                publisherName,
                action: 'remove'
            }
        });
    }

    /**
     * Notify when inventory bid is updated
     */
    async notifyInventoryBidUpdated(
        campaign: any,
        inventory: any,
        advertiserId: string,
        previousBid: number,
        newBid: number
    ) {
        const publisherName = `${inventory.publisher.firstName} ${inventory.publisher.lastName}`;
        const inventoryName = inventory.name;
        const message = `Max bid for inventory ${inventoryName} updated from ${previousBid} to ${newBid} in campaign "${campaign.name}"`;

        // Notify advertiser
        await this.notificationService.createNotification({
            userId: advertiserId,
            userType: UserType.ADVERTISER,
            title: 'Inventory Bid Updated',
            message,
            data: {
                campaignId: campaign.id,
                campaignName: campaign.name,
                inventoryId: inventory.id,
                inventoryName,
                publisherId: inventory.publisher.id,
                publisherName,
                previousBid,
                newBid,
                action: 'update_bid'
            }
        });

        // Notify client if exists
        if (campaign.client) {
            await this.notificationService.createNotification({
                userId: campaign.client.id,
                userType: UserType.CLIENT,
                title: 'Inventory Bid Updated',
                message,
                data: {
                    campaignId: campaign.id,
                    campaignName: campaign.name,
                    inventoryId: inventory.id,
                    inventoryName,
                    publisherId: inventory.publisher.id,
                    publisherName,
                    previousBid,
                    newBid,
                    action: 'update_bid'
                }
            });
        }

        // Notify admins (broadcast)
        await this.notificationService.createBroadcastNotification({
            userType: UserType.ADMIN,
            title: 'Inventory Bid Updated',
            message,
            data: {
                campaignId: campaign.id,
                campaignName: campaign.name,
                inventoryId: inventory.id,
                inventoryName,
                publisherId: inventory.publisher.id,
                publisherName,
                previousBid,
                newBid,
                action: 'update_bid'
            }
        });
    }

    /**
     * Notify publisher when their inventory is used in a campaign
     */
    async notifyPublisherInventoryUsed(
        campaign: any,
        inventory: any,
        maxBid: number,
        isUpdate: boolean = false
    ) {
        if (!inventory.publisher?.id) {
            return;
        }

        const action = isUpdate ? 'updated' : 'included';
        const message = isUpdate
            ? `Your inventory "${inventory.name}" settings have been updated in campaign "${campaign.name}"`
            : `Your inventory "${inventory.name}" has been included in campaign "${campaign.name}"`;

        await this.notificationService.createNotification({
            userId: inventory.publisher.id,
            userType: UserType.PUBLISHER,
            title: 'Inventory Used in Campaign',
            message,
            data: {
                campaignId: campaign.id,
                campaignName: campaign.name,
                inventoryId: inventory.id,
                inventoryName: inventory.name,
                advertiserName: campaign.advertiser?.name || 'Unknown Advertiser',
                advertiserId: campaign.advertiserId,
                maxBid,
                action: isUpdate ? 'update' : 'used'
            }
        });
    }

    /**
     * Notify publisher when their inventory is removed from a campaign
     */
    async notifyPublisherInventoryRemoved(
        campaignName: string,
        campaignId: string,
        advertiserId: string,
        advertiserName: string,
        inventoryName: string,
        publisherId: string
    ) {
        await this.notificationService.createNotification({
            userId: publisherId,
            userType: UserType.PUBLISHER,
            title: 'Inventory Removed from Campaign',
            message: `Your inventory "${inventoryName}" has been removed from campaign "${campaignName}"`,
            data: {
                campaignId,
                campaignName,
                inventoryName,
                advertiserId,
                advertiserName,
                action: 'removed'
            }
        });
    }

    /**
     * Notify publisher when inventory performance metrics are updated
     */
    async notifyInventoryPerformanceUpdated(
        publisherId: string,
        inventoryId: string,
        inventoryName: string,
        metrics: any
    ) {
        await this.notificationService.createNotification({
            userId: publisherId,
            userType: UserType.PUBLISHER,
            title: 'Inventory Performance Update',
            message: `Performance metrics for your inventory "${inventoryName}" have been updated`,
            data: {
                inventoryId,
                inventoryName,
                metrics,
                action: 'performance_update'
            }
        });
    }
}