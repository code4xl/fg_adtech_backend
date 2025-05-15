import { Injectable, Logger } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import {
  ApprovalStatus,
  InventoryFormat,
  InventoryPosition,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ISeeder } from '../interfaces/seeder.interface';

@Injectable()
export class AdInventorySeeder implements ISeeder {
  private readonly logger = new Logger(AdInventorySeeder.name);

  constructor(private readonly prisma: PrismaService) {}

  getModuleName(): string {
    return 'AdInventory';
  }

  getDependencies(): string[] {
    // Depends on Publisher and ContentCategory
    return ['Publisher', 'ContentCategory'];
  }

  async seed(count: number = 30): Promise<void> {
    this.logger.log(`Seeding ${count} ad inventory slots...`);

    try {
      // Get all publishers to assign inventory to
      const publishers = await this.prisma.publisher.findMany({
        select: { id: true },
      });

      if (publishers.length === 0) {
        throw new Error('No publishers found. Please seed publishers first.');
      }

      // Get all content categories to assign to inventory
      const categories = await this.prisma.contentCategory.findMany({
        select: { id: true },
      });

      if (categories.length === 0) {
        throw new Error(
          'No categories found. Please seed content categories first.',
        );
      }

      const inventoryData = [];

      // Define common ad sizes as [width, height] pairs
      const adSizes = [
        [300, 250], // Medium Rectangle
        [728, 90], // Leaderboard
        [160, 600], // Wide Skyscraper
        [320, 50], // Mobile Banner
        [300, 600], // Large Skyscraper
        [970, 90], // Large Leaderboard
        [300, 50], // Mobile Banner
        [336, 280], // Large Rectangle
        [468, 60], // Banner
        [234, 60], // Half Banner
      ];

      // All possible values for enums
      const formats = Object.values(InventoryFormat);
      const positions = Object.values(InventoryPosition);
      const statuses = Object.values(ApprovalStatus);

      // Generate fake ad inventory
      for (let i = 0; i < count; i++) {
        // Randomly select a publisher
        const publisher = faker.helpers.arrayElement(publishers);

        // Randomly select an ad size
        const [width, height] = faker.helpers.arrayElement(adSizes);

        // Select random format (but exclude VIDEO format 70% of the time as it requires special handling)
        let format;
        if (faker.datatype.boolean(0.3)) {
          format = InventoryFormat.VIDEO;
        } else {
          // Use non-video formats
          const nonVideoFormats = formats.filter(
            (f) => f !== InventoryFormat.VIDEO,
          );
          format = faker.helpers.arrayElement(nonVideoFormats);
        }

        // Create inventory entry
        const inventoryEntry = {
          publisherId: publisher.id,
          name: `${format} ${width}x${height} ${faker.word.adjective()}`,
          width: width,
          height: height,
          format: format,
          position: faker.helpers.arrayElement(positions),
          isActive: faker.datatype.boolean(0.8), // 80% chance of being active
          viewabilityScore: faker.number.float({
            min: 0.4,
            max: 0.95,
          }),
          approvalStatus: faker.helpers.arrayElement(statuses),
          createdAt: faker.date.past(),
          updatedAt: faker.date.recent(),
        };

        const createdInventory = await this.prisma.adInventory.create({
          data: inventoryEntry,
        });

        // Assign 1-3 random categories to this inventory
        const selectedCategories = faker.helpers.arrayElements(categories, {
          min: 1,
          max: 3,
        });

        // Link inventory to categories
        for (const category of selectedCategories) {
          await this.prisma.inventoryCategory.create({
            data: {
              inventoryId: createdInventory.id,
              categoryId: category.id,
            },
          });
        }

        // Create floor price for 80% of inventory
        if (faker.datatype.boolean(0.8)) {
          await this.prisma.floorPrice.create({
            data: {
              inventoryId: createdInventory.id,
              basePrice: faker.number.float({
                min: 0.5,
                max: 10.0,
              }),
              currency: 'USD',
              startDate: faker.date.recent(),
              endDate: faker.date.future(),
            },
          });
        }

        // Create availability data for some inventory (70% chance)
        if (faker.datatype.boolean(0.7)) {
          // Create availability for next 7 days
          for (let day = 0; day < 7; day++) {
            const date = new Date();
            date.setDate(date.getDate() + day);

            const totalImpressions = faker.number.int({
              min: 10000,
              max: 500000,
            });
            const reservedImpressions = faker.number.int({
              min: 0,
              max: totalImpressions * 0.7,
            });

            await this.prisma.inventoryAvailability.create({
              data: {
                inventoryId: createdInventory.id,
                date: date,
                totalImpressions: totalImpressions,
                reservedImpressions: reservedImpressions,
                availableImpressions: totalImpressions - reservedImpressions,
              },
            });
          }
        }
      }

      // Create a special test inventory for the default publisher
      const testPublisher = await this.prisma.publisher.findFirst({
        where: { email: 'publisher@example.com' },
      });

      if (testPublisher) {
        const testInventory = await this.prisma.adInventory.create({
          data: {
            publisherId: testPublisher.id,
            name: 'Test Banner 300x250',
            width: 300,
            height: 250,
            format: InventoryFormat.BANNER,
            position: InventoryPosition.ABOVE_FOLD,
            isActive: true,
            viewabilityScore: 0.85,
            approvalStatus: ApprovalStatus.APPROVED,
          },
        });

        // Assign test inventory to a category
        const testCategory = await this.prisma.contentCategory.findFirst();
        if (testCategory) {
          await this.prisma.inventoryCategory.create({
            data: {
              inventoryId: testInventory.id,
              categoryId: testCategory.id,
            },
          });
        }

        // Set floor price for test inventory
        await this.prisma.floorPrice.create({
          data: {
            inventoryId: testInventory.id,
            basePrice: 1.5,
            currency: 'USD',
            startDate: new Date(),
            endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
          },
        });
      }

      const inventoryCount = await this.prisma.adInventory.count();
      this.logger.log(
        `Successfully seeded ${inventoryCount} ad inventory slots`,
      );
    } catch (error) {
      this.logger.error('Error seeding ad inventory');
      this.logger.error(error);
      throw error;
    }
  }

  async clean(): Promise<void> {
    this.logger.log('Cleaning ad inventory tables...');

    try {
      // Clean related tables first (respecting foreign key constraints)
      await this.prisma.inventoryCategory.deleteMany({});
      await this.prisma.floorPrice.deleteMany({});
      await this.prisma.inventoryAvailability.deleteMany({});
      await this.prisma.inventoryTargetingRule.deleteMany({});
      await this.prisma.inventoryBlockedAdvertiser.deleteMany({});

      // Finally clean the main table
      const deleted = await this.prisma.adInventory.deleteMany({});
      this.logger.log(`Deleted ${deleted.count} ad inventory slots`);
    } catch (error) {
      this.logger.error('Error cleaning ad inventory tables');
      this.logger.error(error);
      throw error;
    }
  }

  async isSeeded(): Promise<boolean> {
    const count = await this.prisma.adInventory.count();
    return count > 0;
  }
}
