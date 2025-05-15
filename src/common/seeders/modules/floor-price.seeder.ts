import { Injectable, Logger } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import { PrismaService } from 'src/prisma/prisma.service';
import { ISeeder } from '../interfaces/seeder.interface';

@Injectable()
export class FloorPriceSeeder implements ISeeder {
  private readonly logger = new Logger(FloorPriceSeeder.name);

  constructor(private readonly prisma: PrismaService) {}

  getModuleName(): string {
    return 'FloorPrice';
  }

  getDependencies(): string[] {
    // Depends on AdInventory
    return ['AdInventory'];
  }

  async seed(): Promise<void> {
    this.logger.log('Seeding floor prices...');

    try {
      // Get all ad inventory
      const inventories = await this.prisma.adInventory.findMany({
        select: { id: true },
        where: { isActive: true },
      });

      if (inventories.length === 0) {
        throw new Error(
          'No active inventory found. Please seed ad inventory first.',
        );
      }

      const floorPriceData = [];

      // Create floor prices for all inventories
      for (const inventory of inventories) {
        // Basic floor price for all inventory
        const baseFloorPrice = {
          inventoryId: inventory.id,
          basePrice: faker.number.float({
            min: 0.5,
            max: 5.0,
          }),
          currency: 'USD',
          startDate: new Date(),
          endDate: faker.date.future({ years: 1 }),
        };

        await this.prisma.floorPrice.create({
          data: baseFloorPrice,
        });

        // For some inventory, add time-targeted floor prices (higher during peak hours)
        if (faker.datatype.boolean(0.3)) {
          await this.prisma.floorPrice.create({
            data: {
              inventoryId: inventory.id,
              basePrice: faker.number.float({
                min: 5.0,
                max: 12.0,
              }),
              currency: 'USD',
              startDate: new Date(),
              endDate: faker.date.future({ years: 1 }),
              timeTargeting: {
                daysOfWeek: [
                  'monday',
                  'tuesday',
                  'wednesday',
                  'thursday',
                  'friday',
                ],
                hoursOfDay: [
                  '8',
                  '9',
                  '10',
                  '11',
                  '12',
                  '13',
                  '14',
                  '15',
                  '16',
                  '17',
                  '18',
                  '19',
                ],
                timeZone: 'IST',
              },
            },
          });
        }

        // For some inventory, add buyer-targeted floor prices
        if (faker.datatype.boolean(0.2)) {
          await this.prisma.floorPrice.create({
            data: {
              inventoryId: inventory.id,
              basePrice: faker.number.float({
                min: 3.0,
                max: 8.0,
              }),
              currency: 'USD',
              startDate: new Date(),
              endDate: faker.date.future({ years: 1 }),
              buyerTargeting: {
                preferredAdvertisers: Array.from({ length: 3 }, () =>
                  faker.string.uuid(),
                ),
                premiumCategories: ['automotive', 'finance', 'technology'],
              },
            },
          });
        }
      }

      // Create special floor prices for test inventory
      const testInventory = await this.prisma.adInventory.findFirst({
        where: { name: 'Test Banner 300x250' },
      });

      if (testInventory) {
        // Standard floor price
        await this.prisma.floorPrice.create({
          data: {
            inventoryId: testInventory.id,
            basePrice: 1.5,
            currency: 'USD',
            startDate: new Date(),
            endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
          },
        });

        // Premium time targeting
        await this.prisma.floorPrice.create({
          data: {
            inventoryId: testInventory.id,
            basePrice: 3.0,
            currency: 'USD',
            startDate: new Date(),
            endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            timeTargeting: {
              daysOfWeek: [
                'monday',
                'tuesday',
                'wednesday',
                'thursday',
                'friday',
              ],
              hoursOfDay: ['9', '10', '11', '12', '13', '14', '15', '16', '17'],
              timeZone: 'IST',
            },
          },
        });
      }

      const floorPriceCount = await this.prisma.floorPrice.count();
      this.logger.log(`Successfully seeded ${floorPriceCount} floor prices`);
    } catch (error) {
      this.logger.error('Error seeding floor prices');
      this.logger.error(error);
      throw error;
    }
  }

  async clean(): Promise<void> {
    this.logger.log('Cleaning floor prices table...');

    try {
      const deleted = await this.prisma.floorPrice.deleteMany({});
      this.logger.log(`Deleted ${deleted.count} floor prices`);
    } catch (error) {
      this.logger.error('Error cleaning floor prices table');
      this.logger.error(error);
      throw error;
    }
  }

  async isSeeded(): Promise<boolean> {
    const count = await this.prisma.floorPrice.count();
    return count > 0;
  }
}
