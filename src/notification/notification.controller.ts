import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Query,
  Post,
  Request,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { UserType } from './dto/create-notification.dto';
import { ApiBearerAuth, ApiExcludeController, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdvertiserGuard, AdminGuard, ClientGuard, PublisherGuard } from '../common/guards/authorization.guard';

@ApiExcludeController()
@ApiTags('notifications')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) { }

  @Post('test')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'test notif' })
  testNotification(@Request() req) {
    return this.notificationService.createNotification({
      userId: req.user.id,
      userType: UserType.ADMIN,
      title: 'Test Notification',
      message: 'This is a test notification',
      data: { test: 'data' },
    });
  }

  /**
   * Get notifications for the authenticated user
   */
  @Get('advertiser')
  @ApiBearerAuth()
  @UseGuards(AdvertiserGuard)
  @ApiOperation({ summary: 'Get notifications for advertiser' })
  getAdvertiserNotifications(
    @Request() req,
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ) {
    return this.notificationService.getNotifications(
      req.user.id,
      UserType.ADVERTISER,
      limit,
      offset,
    );
  }



  /**
   * Get notifications for the authenticated publisher
   */
  @Get('publisher')
  @ApiBearerAuth()
  @UseGuards(PublisherGuard)
  @ApiOperation({ summary: 'Get notifications for publisher' })
  getPublisherNotifications(
    @Request() req,
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ) {
    return this.notificationService.getNotifications(
      req.user.id,
      UserType.PUBLISHER,
      limit,
      offset,
    );
  }

  /**
   * Get notifications for the authenticated client
   */
  @Get('client')
  @ApiBearerAuth()
  @UseGuards(ClientGuard)
  @ApiOperation({ summary: 'Get notifications for client' })
  getClientNotifications(
    @Request() req,
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ) {
    return this.notificationService.getNotifications(
      req.user.id,
      UserType.CLIENT,
      limit,
      offset,
    );
  }

  /**
   * Get notifications for the authenticated admin
   */
  @Get('admin')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get notifications for admin' })
  getAdminNotifications(
    @Request() req,
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ) {
    return this.notificationService.getNotifications(
      req.user.id,
      UserType.ADMIN,
      limit,
      offset,
    );
  }

  /**
   * Get unread count for the authenticated user
   */
  @Get('advertiser/unread')
  @ApiBearerAuth()
  @UseGuards(AdvertiserGuard)
  @ApiOperation({ summary: 'Get unread count for advertiser' })
  getAdvertiserUnreadCount(@Request() req) {
    return this.notificationService.getUnreadCount(req.user.id, UserType.ADVERTISER);
  }

  /**
   * Get unread count for the authenticated publisher
   */
  @Get('publisher/unread')
  @ApiBearerAuth()
  @UseGuards(PublisherGuard)
  @ApiOperation({ summary: 'Get unread count for publisher' })
  getPublisherUnreadCount(@Request() req) {
    return this.notificationService.getUnreadCount(req.user.id, UserType.PUBLISHER);
  }

  /**
   * Get unread count for the authenticated client
   */
  @Get('client/unread')
  @ApiBearerAuth()
  @UseGuards(ClientGuard)
  @ApiOperation({ summary: 'Get unread count for client' })
  getClientUnreadCount(@Request() req) {
    return this.notificationService.getUnreadCount(req.user.id, UserType.CLIENT);
  }

  /**
   * Get unread count for the authenticated admin
   */
  @Get('admin/unread')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get unread count for admin' })
  getAdminUnreadCount(@Request() req) {
    return this.notificationService.getUnreadCount(req.user.id, UserType.ADMIN);
  }

  /**
   * Mark a notification as read for the authenticated user
   */
  @Patch(':id/read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark notification as read' })
  markAsRead(@Param('id') id: string, @Request() req) {
    return this.notificationService.markAsRead(id, req.user.id);
  }

  /**
   * Mark all notifications as read for the authenticated advertiser
   */
  @Post('advertiser/mark-all-read')
  @ApiBearerAuth()
  @UseGuards(AdvertiserGuard)
  @ApiOperation({ summary: 'Mark all notifications as read for advertiser' })
  markAllReadAdvertiser(@Request() req) {
    return this.notificationService.markAllAsRead(req.user.id, UserType.ADVERTISER);
  }

  /**
   * Mark all notifications as read for the authenticated publisher
   */
  @Post('publisher/mark-all-read')
  @ApiBearerAuth()
  @UseGuards(PublisherGuard)
  @ApiOperation({ summary: 'Mark all notifications as read for publisher' })
  markAllReadPublisher(@Request() req) {
    return this.notificationService.markAllAsRead(req.user.id, UserType.PUBLISHER);
  }

  /**
   * Mark all notifications as read for the authenticated client
   */
  @Post('client/mark-all-read')
  @ApiBearerAuth()
  @UseGuards(ClientGuard)
  @ApiOperation({ summary: 'Mark all notifications as read for client' })
  markAllReadClient(@Request() req) {
    return this.notificationService.markAllAsRead(req.user.id, UserType.CLIENT);
  }

  /**
   * Mark all notifications as read for the authenticated admin
   */
  @Post('admin/mark-all-read')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Mark all notifications as read for admin' })
  markAllReadAdmin(@Request() req) {
    return this.notificationService.markAllAsRead(req.user.id, UserType.ADMIN);
  }
}