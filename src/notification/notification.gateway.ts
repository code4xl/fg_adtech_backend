// src/notification/notification.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { NotificationService } from './notification.service';
import { JwtService } from '@nestjs/jwt';
import { UserType } from './dto/create-notification.dto';
import { WsJwtGuard } from './guards/ws-jwt.guard';

interface AuthenticatedSocket extends Socket {
  user: {
    id: string;
    email: string;
    role: string;
  };
  // channelSubscriptions: Set<string>; // Track subscriptions per socket
}

@WebSocketGateway({
  cors: {
    origin: '*', // In production, specify your front-end domain
  },
  namespace: 'notifications',
})
export class NotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(NotificationGateway.name);
  private readonly userSockets = new Map<string, AuthenticatedSocket[]>(); // userId -> Socket[]
  private readonly subscribedChannels = new Set<string>(); // Track all subscribed channels

  constructor(
    private readonly redisService: RedisService,
    private readonly notificationService: NotificationService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Initialize the gateway
   */
  afterInit(server: Server) {
    try {
      this.logger.debug('WebSocket Gateway initialized');

      // Subscribe to broadcast channels - do this only once on gateway init
      this.subscribeToBroadcastChannels();
    } catch (error) {
      this.logger.error(
        `Failed to initialize WebSocket Gateway: ${error.message}`,
      );
    }
  }

  /**
   * Handle client connection
   */
  async handleConnection(client: Socket) {
    try {
      this.logger.debug(`New client connecting: ${client.id}`);

      // Get token from handshake auth
      const token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        this.logger.warn(
          `Client ${client.id} attempted to connect without authentication`,
        );
        client.disconnect();
        return;
      }

      // Verify token
      const payload = this.jwtService.verify(token);

      if (!payload || !payload.sub || !payload.role) {
        this.logger.warn(`Client ${client.id} provided invalid token`);
        client.disconnect();
        return;
      }

      // Store user info in socket
      const authClient = client as AuthenticatedSocket;
      authClient.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      // authClient.channelSubscriptions = new Set(); // Initialize empty subscriptions set

      // Save socket in users map
      const userId = payload.sub;
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, []);
      }
      this.userSockets.get(userId)!.push(authClient);

      this.logger.debug(
        `Client connected: ${client.id} (User: ${userId}, Role: ${payload.role})`,
      );

      // Join appropriate room based on role
      client.join(`${payload.role.toLowerCase()}:${userId}`);
      client.join(`${payload.role.toLowerCase()}:broadcast`);

      // Subscribe to user-specific Redis channel - only if not already subscribed
      this.subscribeToUserChannel(userId, payload.role);

      // Send any queued notifications
      await this.sendQueuedNotifications(userId, client);

      // Send historical broadcasts
      await this.sendHistoricalBroadcasts(client, payload.role);
    } catch (error) {
      this.logger.error(`Error during client connection: ${error.message}`);
      client.disconnect();
    }
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: Socket) {
    try {
      const authClient = client as AuthenticatedSocket;
      const user = authClient.user;

      if (user) {
        const userId = user.id;
        // Remove socket from user's sockets list
        const userSockets = this.userSockets.get(userId) || [];
        const updatedSockets = userSockets.filter(
          (socket) => socket.id !== client.id,
        );

        if (updatedSockets.length === 0) {
          // User has no more active connections
          this.userSockets.delete(userId);
          this.logger.debug(`User ${userId} is now completely offline`);
        } else {
          this.userSockets.set(userId, updatedSockets);
        }
      }

      this.logger.debug(`Client disconnected: ${client.id}`);
    } catch (error) {
      this.logger.error(`Error during client disconnection: ${error.message}`);
    }
  }

  /**
   * Subscribe to user-specific notification channel
   */
  private subscribeToUserChannel(userId: string, role: string) {
    const channel = `notification:${role.toLowerCase()}:${userId}`;

    // Only subscribe if we haven't already subscribed to this channel
    if (!this.subscribedChannels.has(channel)) {
      this.redisService.subscribe(channel, (messageStr) => {
        try {
          this.logger.debug(`Received message on channel ${channel}`);
          const message = JSON.parse(messageStr);

          // Get all active sockets for this user
          const userSockets = this.userSockets.get(userId) || [];

          if (userSockets.length > 0) {
            // User is online - send notification to all their connected sockets
            this.logger.debug(
              `User ${userId} is online with ${userSockets.length} connections, sending notification directly`,
            );
            userSockets.forEach((socket) => {
              try {
                socket.emit('notification', message);
              } catch (socketError) {
                this.logger.error(
                  `Error sending to socket ${socket.id}: ${socketError.message}`,
                );
              }
            });
          } else {
            // User is offline - enqueue notification
            this.logger.debug(
              `User ${userId} is offline, enqueuing notification`,
            );
            this.notificationService
              .enqueueNotification(userId, message)
              .catch((error) =>
                this.logger.error(
                  `Failed to enqueue notification: ${error.message}`,
                ),
              );
          }
        } catch (error) {
          this.logger.error(
            `Error processing message from channel ${channel}: ${error.message}`,
          );
        }
      });

      // Track this subscription
      this.subscribedChannels.add(channel);
      this.logger.debug(`Subscribed to channel: ${channel}`);
    } else {
      this.logger.debug(`Channel ${channel} already subscribed, skipping`);
    }
  }

  /**
   * Subscribe to broadcast channels for all user types
   */
  private subscribeToBroadcastChannels() {
    const userTypes = Object.values(UserType);

    for (const type of userTypes) {
      const channel = `notification:${type.toLowerCase()}:broadcast`;

      // Only subscribe if not already subscribed
      if (!this.subscribedChannels.has(channel)) {
        this.redisService.subscribe(channel, (messageStr) => {
          try {
            const message = JSON.parse(messageStr);

            // Store broadcast message for later retrieval
            this.redisService
              .storeBroadcast(type.toLowerCase(), message)
              .catch((err) =>
                this.logger.error(`Failed to store broadcast: ${err.message}`),
              );

            // Safe broadcast
            if (this.server) {
              this.server
                .to(`${type.toLowerCase()}:broadcast`)
                .emit('broadcast', message);
            }
          } catch (error) {
            this.logger.error(
              `Error processing broadcast message: ${error.message}`,
            );
          }
        });

        // Track this subscription
        this.subscribedChannels.add(channel);
        this.logger.debug(`Subscribed to broadcast channel: ${channel}`);
      }
    }
  }

  /**
   * Send queued notifications to a newly connected client
   */
  private async sendQueuedNotifications(userId: string, client: Socket) {
    try {
      this.logger.debug(`Getting queued notifications for user ${userId}`);
      const queuedNotifications =
        await this.notificationService.getQueuedNotifications(userId);

      if (queuedNotifications && queuedNotifications.length > 0) {
        this.logger.debug(
          `Sending ${queuedNotifications.length} queued notifications to user ${userId}`,
        );

        // Send each notification
        for (const notification of queuedNotifications) {
          client.emit('notification', notification);
        }

        // Clear the queue after sending all notifications
        await this.redisService.clearQueuedNotifications(userId);
        this.logger.debug(`Cleared notification queue for user ${userId}`);
      } else {
        this.logger.debug(`No queued notifications for user ${userId}`);
      }
    } catch (error) {
      this.logger.error(`Error sending queued notifications: ${error.message}`);
    }
  }

  /**
   * Send historical broadcast messages to a newly connected client
   */
  private async sendHistoricalBroadcasts(client: Socket, role: string) {
    try {
      const userType = this.mapRoleToUserType(role);
      this.logger.debug(`Getting historical broadcasts for ${userType}`);

      const recentBroadcasts = await this.redisService.getRecentBroadcasts(
        userType.toLowerCase(),
      );

      if (recentBroadcasts && recentBroadcasts.length > 0) {
        this.logger.debug(
          `Sending ${recentBroadcasts.length} historical broadcasts to ${role} user`,
        );

        // Send all broadcasts in a single event for efficiency
        client.emit('historical_broadcasts', recentBroadcasts);
      } else {
        this.logger.debug(`No historical broadcasts for ${role} users`);
      }
    } catch (error) {
      this.logger.error(
        `Error sending historical broadcasts: ${error.message}`,
      );
    }
  }

  /**
   * Mark a notification as read
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(client: AuthenticatedSocket, payload: { id: string }) {
    try {
      await this.notificationService.markAsRead(payload.id, client.user.id);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error marking notification as read: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mark all notifications as read
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('markAllAsRead')
  async handleMarkAllAsRead(client: AuthenticatedSocket) {
    try {
      const userType = this.mapRoleToUserType(client.user.role);
      await this.notificationService.markAllAsRead(client.user.id, userType);
      return { success: true };
    } catch (error) {
      this.logger.error(
        `Error marking all notifications as read: ${error.message}`,
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Get unread notifications count
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('getUnreadCount')
  async handleGetUnreadCount(client: AuthenticatedSocket) {
    try {
      const userType = this.mapRoleToUserType(client.user.role);
      const count = await this.notificationService.getUnreadCount(
        client.user.id,
        userType,
      );
      return { success: true, count };
    } catch (error) {
      this.logger.error(`Error getting unread count: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Map role to UserType
   */
  private mapRoleToUserType(role: string): UserType {
    const roleLower = role.toLowerCase();

    if (roleLower === 'advertiser') return UserType.ADVERTISER;
    if (roleLower === 'publisher') return UserType.PUBLISHER;
    if (roleLower === 'client') return UserType.CLIENT;
    if (roleLower === 'admin') return UserType.ADMIN;

    throw new Error(`Invalid role: ${role}`);
  }
}
