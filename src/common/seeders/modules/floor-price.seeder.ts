import { Injectable, Logger } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import { Currency } from '@prisma/client';
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
    this.logger.debug('Seeding floor prices...');

    try {
      // Get all active ad inventory
      const inventories = await this.prisma.adInventory.findMany({
        select: { id: true, name: true },
        where: { isActive: true },
      });

      if (inventories.length === 0) {
        throw new Error(
          'No active inventory found. Please seed ad inventory first.',
        );
      }

      const floorPriceData: any = [];

      // Create floor prices for all inventories
      for (const inventory of inventories) {
        // 80% of inventory gets a basic floor price
        if (faker.datatype.boolean(0.8)) {
          const currency = faker.helpers.arrayElement(Object.values(Currency));

          // Generate price based on currency
          let basePrice: number;
          if (currency === Currency.INR) {
            basePrice = faker.number.float({
              min: 0.5,
              max: 8.0,
              fractionDigits: 2,
            });
          } else {
            // INR
            basePrice = faker.number.float({
              min: 30,
              max: 500,
              fractionDigits: 2,
            });
          }

          const startDate = faker.date.recent({ days: 30 });
          const endDate = faker.datatype.boolean(0.7)
            ? faker.date.future({ years: 1 })
            : null; // 30% have no end date

          floorPriceData.push({
            inventoryId: inventory.id,
            basePrice: basePrice,
            currency: currency,
            startDate: startDate,
            endDate: endDate,
            createdAt: faker.date.past(),
            updatedAt: faker.date.recent(),
          });
        }

        // 30% of inventory gets an additional premium floor price (for peak hours/better targeting)
        if (faker.datatype.boolean(0.3)) {
          const currency = faker.helpers.arrayElement(Object.values(Currency));

          let premiumPrice: number;
          if (currency === Currency.INR) {
            premiumPrice = faker.number.float({
              min: 5.0,
              max: 20.0,
              fractionDigits: 2,
            });
          } else {
            // INR
            premiumPrice = faker.number.float({
              min: 300,
              max: 1200,
              fractionDigits: 2,
            });
          }

          const premiumStartDate = faker.date.recent({ days: 15 });
          const premiumEndDate = faker.date.future({ refDate: 180 });

          floorPriceData.push({
            inventoryId: inventory.id,
            basePrice: premiumPrice,
            currency: currency,
            startDate: premiumStartDate,
            endDate: premiumEndDate,
            createdAt: faker.date.past(),
            updatedAt: faker.date.recent(),
          });
        }
      }

      // Create special floor prices for test inventory
      const testInventory = await this.prisma.adInventory.findFirst({
        where: { name: 'Test Banner 300x250' },
      });

      if (testInventory) {
        // INR floor price
        floorPriceData.push({
          inventoryId: testInventory.id,
          basePrice: 1.5,
          currency: Currency.INR,
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // INR floor price (for Indian market)
        floorPriceData.push({
          inventoryId: testInventory.id,
          basePrice: 100.0,
          currency: Currency.INR,
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Insert all floor prices
      await this.prisma.floorPrice.createMany({
        data: floorPriceData,
        skipDuplicates: true,
      });

      const floorPriceCount = await this.prisma.floorPrice.count();
      this.logger.debug(`Successfully seeded ${floorPriceCount} floor prices`);
    } catch (error) {
      this.logger.error('Error seeding floor prices');
      this.logger.error(error);
      throw error;
    }
  }

  async clean(): Promise<void> {
    this.logger.debug('Cleaning floor prices table...');

    try {
      const deleted = await this.prisma.floorPrice.deleteMany({});
      this.logger.debug(`Deleted ${deleted.count} floor prices`);
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
