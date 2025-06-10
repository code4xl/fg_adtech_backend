import { Injectable, Logger } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import { UserType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ISeeder } from '../interfaces/seeder.interface';

@Injectable()
export class NotificationSeeder implements ISeeder {
  private readonly logger = new Logger(NotificationSeeder.name);

  constructor(private readonly prisma: PrismaService) {}

  getModuleName(): string {
    return 'Notification';
  }

  getDependencies(): string[] {
    // Depends on all user types
    return ['Admin', 'Advertiser', 'Publisher', 'Client'];
  }

  async seed(count: number = 50): Promise<void> {
    this.logger.log(`Seeding ${count} notifications...`);

    try {
      // Get all users from different tables
      const admins = await this.prisma.admin.findMany({ select: { id: true } });
      const advertisers = await this.prisma.advertiser.findMany({
        select: { id: true },
      });
      const publishers = await this.prisma.publisher.findMany({
        select: { id: true },
      });
      const clients = await this.prisma.client.findMany({
        select: { id: true },
      });

      const notificationData: any = [];

      // Notification templates for different user types
      const notificationTemplates = {
        [UserType.ADMIN]: [
          {
            title: 'New Publisher Registration',
            message: 'A new publisher has registered and requires approval.',
          },
          {
            title: 'Campaign Flagged',
            message:
              'A campaign has been flagged for review due to policy violations.',
          },
          {
            title: 'Revenue Milestone',
            message: 'Platform revenue has reached a new milestone.',
          },
          {
            title: 'System Alert',
            message: 'System maintenance scheduled for this weekend.',
          },
        ],
        [UserType.ADVERTISER]: [
          {
            title: 'Campaign Approved',
            message: 'Your campaign has been approved and is now live.',
          },
          {
            title: 'Budget Alert',
            message: 'Your campaign budget is 80% depleted.',
          },
          {
            title: 'Performance Update',
            message: 'Your campaign performance has improved significantly.',
          },
          {
            title: 'Payment Processed',
            message: 'Your payment has been processed successfully.',
          },
          {
            title: 'Creative Rejected',
            message: 'One of your creatives has been rejected. Please review.',
          },
        ],
        [UserType.PUBLISHER]: [
          {
            title: 'Inventory Approved',
            message: 'Your new ad inventory has been approved.',
          },
          {
            title: 'Payment Due',
            message: 'Your monthly payment is ready for processing.',
          },
          {
            title: 'Performance Report',
            message: 'Your monthly performance report is available.',
          },
          {
            title: 'Policy Update',
            message: 'Important updates to our publisher policies.',
          },
        ],
        [UserType.CLIENT]: [
          {
            title: 'Campaign Update',
            message: 'Your campaign metrics have been updated.',
          },
          {
            title: 'Monthly Report',
            message: 'Your monthly performance report is ready.',
          },
          {
            title: 'Account Access',
            message: 'You have been granted access to new campaign data.',
          },
        ],
      };

      // Generate notifications for each user type
      const userTypes = [
        { type: UserType.ADMIN, users: admins },
        { type: UserType.ADVERTISER, users: advertisers },
        { type: UserType.PUBLISHER, users: publishers },
        { type: UserType.CLIENT, users: clients },
      ];

      for (const userTypeData of userTypes) {
        const { type, users } = userTypeData;
        const templates = notificationTemplates[type];

        if (users.length === 0) continue;

        // Create notifications for this user type
        const notificationsPerUserType = Math.floor(count / userTypes.length);

        for (let i = 0; i < notificationsPerUserType; i++) {
          const user = faker.helpers.arrayElement(users);
          const template = faker.helpers.arrayElement(templates);

          notificationData.push({
            userId: user.id,
            userType: type,
            title: template.title,
            message: template.message,
            isRead: faker.datatype.boolean(0.4), // 40% chance of being read
            data: this.generateNotificationData(type, template.title),
            createdAt: faker.date.past({ refDate: 30 }),
            updatedAt: faker.date.recent(),
          });
        }
      }

      // Create some specific test notifications
      const testAdmin = await this.prisma.admin.findFirst({
        where: { email: 'admin@example.com' },
      });

      const testAdvertiser = await this.prisma.advertiser.findFirst({
        where: { email: 'advertiser@example.com' },
      });

      const testPublisher = await this.prisma.publisher.findFirst({
        where: { email: 'publisher@example.com' },
      });

      if (testAdmin) {
        notificationData.push({
          userId: testAdmin.id,
          userType: UserType.ADMIN,
          title: 'Welcome to Ocean AdTech',
          message:
            'Welcome to the Ocean AdTech admin panel. Your account is now active.',
          isRead: false,
          data: { type: 'welcome', priority: 'high' },
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      if (testAdvertiser) {
        notificationData.push({
          userId: testAdvertiser.id,
          userType: UserType.ADVERTISER,
          title: 'Account Setup Complete',
          message:
            'Your advertiser account setup is complete. You can now create campaigns.',
          isRead: false,
          data: { type: 'account_setup', priority: 'medium' },
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      if (testPublisher) {
        notificationData.push({
          userId: testPublisher.id,
          userType: UserType.PUBLISHER,
          title: 'First Inventory Created',
          message:
            'Congratulations! Your first ad inventory has been created and is pending approval.',
          isRead: false,
          data: { type: 'inventory_created', priority: 'medium' },
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Insert all notifications
      await this.prisma.notification.createMany({
        data: notificationData,
        skipDuplicates: true,
      });

      const notificationCount = await this.prisma.notification.count();
      this.logger.log(`Successfully seeded ${notificationCount} notifications`);
    } catch (error) {
      this.logger.error('Error seeding notifications');
      this.logger.error(error);
      throw error;
    }
  }

  async clean(): Promise<void> {
    this.logger.log('Cleaning notifications table...');

    try {
      const deleted = await this.prisma.notification.deleteMany({});
      this.logger.log(`Deleted ${deleted.count} notifications`);
    } catch (error) {
      this.logger.error('Error cleaning notifications table');
      this.logger.error(error);
      throw error;
    }
  }

  async isSeeded(): Promise<boolean> {
    const count = await this.prisma.notification.count();
    return count > 0;
  }

  /**
   * Generate additional data for notifications based on type and title
   */
  private generateNotificationData(userType: UserType, title: string): any {
    const baseData = {
      timestamp: new Date().toISOString(),
      source: 'system',
    };

    // Add specific data based on notification type
    if (title.includes('Campaign')) {
      return {
        ...baseData,
        campaignId: faker.string.uuid(),
        campaignName: faker.company.catchPhrase(),
      };
    }

    if (title.includes('Payment')) {
      return {
        ...baseData,
        amount: faker.number.float({ min: 100, max: 10000, fractionDigits: 2 }),
        currency: faker.helpers.arrayElement(['INR']),
      };
    }

    if (title.includes('Budget')) {
      return {
        ...baseData,
        budgetRemaining: faker.number.float({
          min: 50,
          max: 1000,
          fractionDigits: 2,
        }),
        totalBudget: faker.number.float({
          min: 1000,
          max: 50000,
          fractionDigits: 2,
        }),
      };
    }

    if (title.includes('Performance')) {
      return {
        ...baseData,
        impressions: faker.number.int({ min: 1000, max: 100000 }),
        clicks: faker.number.int({ min: 10, max: 1000 }),
        ctr: faker.number.float({ min: 0.01, max: 0.05, fractionDigits: 3 }),
      };
    }

    return baseData;
  }
}
