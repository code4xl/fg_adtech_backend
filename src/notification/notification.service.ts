import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { BroadcastNotificationDto, CreateNotificationDto, UserType } from './dto/create-notification.dto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) { }

  // Done -> TODO: Clean up notification of last 30 days
  async createNotification(
    createNotificationDto: CreateNotificationDto,
    shouldPublish = true,
  ) {
    this.logger.debug(`Creating notification: ${JSON.stringify(createNotificationDto)}`);

    // Save to database
    const notification = await this.prisma.notification.create({
      data: {
        userId: createNotificationDto.userId,
        userType: createNotificationDto.userType,
        title: createNotificationDto.title,
        message: createNotificationDto.message,
        data: createNotificationDto.data || {},
        isRead: false,
      },
    });

    this.logger.debug(`Notification created with ID: ${notification.id}`);

    // If we should publish (triggering real-time notification)
    if (shouldPublish) {
      await this.publishNotificationSmart(
        {
          ...notification,
          timestamp: new Date().toISOString(),
        },
        createNotificationDto.userType,
        createNotificationDto.userId
      );
    }

    return notification;
  }

  /**
   * Smart notification publishing - checks if user is online before publishing
   */
  private async publishNotificationSmart(notification: any, userType: UserType, userId: string) {
    try {
      // Check if user is currently online
      const isUserOnline = await this.isUserOnline(userId);
      
      if (!isUserOnline) {
        // User is offline - directly enqueue the notification
        this.logger.debug(`User ${userId} is offline, enqueuing notification directly`);
        await this.enqueueNotification(userId, notification);
        return;
      }
      
      // User is online - publish to Redis channel
      const channel = `notification:${userType.toLowerCase()}:${userId}`;
      await this.redisService.publish(channel, notification);
      this.logger.debug(`Published notification to channel: ${channel}`);
      
    } catch (error) {
      this.logger.error(`Error in smart notification publishing: ${error.message}`);
      // Fallback: enqueue notification if publishing fails
      try {
        await this.enqueueNotification(userId, notification);
        this.logger.debug(`Fallback: Enqueued notification for user ${userId}`);
      } catch (enqueueError) {
        this.logger.error(`Failed to enqueue notification as fallback: ${enqueueError.message}`);
      }
    }
  }

  /**
   * Check if user is currently online (has active WebSocket connections)
   */
  private async isUserOnline(userId: string): Promise<boolean> {
    try {
      // Check if user has any active WebSocket connections
      const onlineStatus = await this.redisService.get(`user:online:${userId}`);
      return onlineStatus === 'true';
    } catch (error) {
      this.logger.error(`Error checking user online status: ${error.message}`);
      return false; // Assume offline if we can't determine
    }
  }

  /**
   * Send a notification to all users of a specific type (e.g., all advertisers)
   */
  async createBroadcastNotification(notif: BroadcastNotificationDto) {
    // Get all users of this type
    let users: any = [];

    switch (notif.userType) {
      case UserType.ADVERTISER:
        users = await this.prisma.advertiser.findMany({
          select: { id: true },
        });
        break;
      case UserType.PUBLISHER:
        users = await this.prisma.publisher.findMany({
          select: { id: true },
        });
        break;
      case UserType.CLIENT:
        users = await this.prisma.client.findMany({
          select: { id: true },
        });
        break;
      case UserType.ADMIN:
        users = await this.prisma.admin.findMany({
          select: { id: true },
        });
        break;
    }

    // Create a notification for each user and publish to the broadcast channel
    const broadcastChannel = `notification:${notif.userType.toLowerCase()}:broadcast`;

    const broadcastMessage = {
      title: notif.title,
      message: notif.message,
      data: notif.data,
      timestamp: new Date().toISOString(),
    };

    // Publish to the broadcast channel
    await this.redisService.publish(broadcastChannel, broadcastMessage);

    // Store individual notifications for each user
    for (const user of users) {
      await this.createNotification(
        {
          userId: user.id,
          title: notif.title,
          message: notif.message,
          data: notif.data,
          userType: notif.userType,
        },
        false, // Don't publish individual notifications since we're broadcasting
      );
    }

    return { success: true, count: users.length };
  }

  /**
   * Send campaign end notification to related users
   */
  async notifyCampaignEnd(campaignId: string) {
    // Get campaign with advertiser and client
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        advertiser: true,
        client: true,
      },
    });

    if (!campaign) {
      throw new Error(`Campaign with ID ${campaignId} not found`);
    }

    // Create notification for advertiser
    await this.createNotification({
      userId: campaign.advertiserId,
      userType: UserType.ADVERTISER,
      title: 'Campaign Ended',
      message: `Your campaign "${campaign.name}" has ended.`,
      data: { campaignId: campaign.id },
    });

    // Create notification for client if exists
    if (campaign.clientId) {
      await this.createNotification({
        userId: campaign.clientId,
        userType: UserType.CLIENT,
        title: 'Campaign Ended',
        message: `The campaign "${campaign.name}" has ended.`,
        data: { campaignId: campaign.id },
      });
    }

    return { success: true };
  }

  /**
   * Get notifications for a specific user
   */
  async getNotifications(userId: string, userType: UserType, limit = 50, offset = 0) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        userType,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get unread notifications count for a specific user
   */
  async getUnreadCount(userId: string, userType: UserType) {
    return this.prisma.notification.count({
      where: {
        userId,
        userType,
        isRead: false,
      },
    });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        id,
        userId,
      },
      data: {
        isRead: true,
      },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string, userType: UserType) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        userType,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });
  }

  /**
   * Enqueue notification for offline user
   */
  async enqueueNotification(userId: string, notification: any) {
    return this.redisService.enqueueNotification(userId, notification);
  }

  /**
   * Get queued notifications for a user
   */
  async getQueuedNotifications(userId: string) {
    return this.redisService.getQueuedNotifications(userId);
  }
}