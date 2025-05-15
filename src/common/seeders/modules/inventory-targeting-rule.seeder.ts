import { Injectable, Logger } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import { TargetingRuleType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ISeeder } from '../interfaces/seeder.interface';

@Injectable()
export class InventoryTargetingRuleSeeder implements ISeeder {
  private readonly logger = new Logger(InventoryTargetingRuleSeeder.name);

  constructor(private readonly prisma: PrismaService) {}

  getModuleName(): string {
    return 'InventoryTargetingRule';
  }

  getDependencies(): string[] {
    // Depends on AdInventory
    return ['AdInventory'];
  }

  async seed(): Promise<void> {
    this.logger.log('Seeding inventory targeting rules...');

    try {
      // Get all active inventories
      const inventories = await this.prisma.adInventory.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      if (inventories.length === 0) {
        throw new Error(
          'No active inventory found. Please seed ad inventory first.',
        );
      }

      // Get all rule types
      const ruleTypes = Object.values(TargetingRuleType);

      // For each inventory, create 1-3 targeting rules
      for (const inventory of inventories) {
        // How many rules will this inventory have?
        const ruleCount = faker.number.int({ min: 1, max: 3 });

        // Choose random rule types (no duplicates)
        const selectedRuleTypes = faker.helpers.arrayElements(ruleTypes, {
          min: ruleCount,
          max: ruleCount,
        });

        // Create targeting rules
        for (const ruleType of selectedRuleTypes) {
          await this.prisma.inventoryTargetingRule.create({
            data: {
              inventoryId: inventory.id,
              ruleType: ruleType,
              ruleData: this.generateRuleData(ruleType),
            },
          });
        }
      }

      // Create targeting rules for test inventory
      const testInventory = await this.prisma.adInventory.findFirst({
        where: { name: 'Test Banner 300x250' },
      });

      if (testInventory) {
        // Create demographic targeting rule
        await this.prisma.inventoryTargetingRule.create({
          data: {
            inventoryId: testInventory.id,
            ruleType: TargetingRuleType.DEMOGRAPHIC,
            ruleData: {
              ageRanges: ['18-24', '25-34', '35-44'],
              genders: ['male', 'female'],
            },
          },
        });

        // Create geographic targeting rule
        await this.prisma.inventoryTargetingRule.create({
          data: {
            inventoryId: testInventory.id,
            ruleType: TargetingRuleType.GEOGRAPHIC,
            ruleData: {
              countries: ['US', 'CA', 'UK', 'IN'],
              cities: ['Mumbai', 'New York', 'London'],
            },
          },
        });
      }

      const ruleCount = await this.prisma.inventoryTargetingRule.count();
      this.logger.log(
        `Successfully seeded ${ruleCount} inventory targeting rules`,
      );
    } catch (error) {
      this.logger.error('Error seeding inventory targeting rules');
      this.logger.error(error);
      throw error;
    }
  }

  async clean(): Promise<void> {
    this.logger.log('Cleaning inventory targeting rules...');

    try {
      const deleted = await this.prisma.inventoryTargetingRule.deleteMany({});
      this.logger.log(`Deleted ${deleted.count} inventory targeting rules`);
    } catch (error) {
      this.logger.error('Error cleaning inventory targeting rules');
      this.logger.error(error);
      throw error;
    }
  }

  async isSeeded(): Promise<boolean> {
    const count = await this.prisma.inventoryTargetingRule.count();
    return count > 0;
  }

  // Helper to generate appropriate rule data based on rule type
  private generateRuleData(ruleType: TargetingRuleType): any {
    switch (ruleType) {
      case TargetingRuleType.DEMOGRAPHIC:
        return {
          ageRanges: faker.helpers.arrayElements(
            ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'],
            { min: 1, max: 4 },
          ),
          genders: faker.helpers.arrayElements(['male', 'female', 'other'], {
            min: 1,
            max: 3,
          }),
          income: faker.helpers.arrayElements(
            ['low', 'medium', 'high', 'very_high'],
            { min: 0, max: 2 },
          ),
        };

      case TargetingRuleType.GEOGRAPHIC:
        return {
          countries: faker.helpers.arrayElements(
            ['US', 'CA', 'UK', 'AU', 'IN', 'JP', 'DE', 'FR'],
            { min: 1, max: 4 },
          ),
          regions: faker.helpers.arrayElements(
            [
              'Maharashtra',
              'California',
              'New York',
              'Texas',
              'Ontario',
              'London',
            ],
            { min: 0, max: 3 },
          ),
          cities: faker.helpers.arrayElements(
            [
              'Mumbai',
              'New York',
              'Los Angeles',
              'London',
              'Toronto',
              'Sydney',
              'Berlin',
            ],
            { min: 0, max: 5 },
          ),
        };

      case TargetingRuleType.DEVICE:
        return {
          deviceTypes: faker.helpers.arrayElements(
            ['mobile', 'tablet', 'desktop'],
            { min: 1, max: 3 },
          ),
          browsers: faker.helpers.arrayElements(
            ['chrome', 'firefox', 'safari', 'edge', 'opera'],
            { min: 0, max: 5 },
          ),
          operatingSystems: faker.helpers.arrayElements(
            ['android', 'ios', 'windows', 'macos', 'linux'],
            { min: 0, max: 5 },
          ),
        };

      case TargetingRuleType.TIME:
        return {
          daysOfWeek: faker.helpers.arrayElements(
            [
              'monday',
              'tuesday',
              'wednesday',
              'thursday',
              'friday',
              'saturday',
              'sunday',
            ],
            { min: 1, max: 7 },
          ),
          hoursOfDay: faker.helpers.arrayElements(
            Array.from({ length: 24 }, (_, i) => i.toString()),
            { min: 6, max: 18 },
          ),
          timeZone: faker.helpers.arrayElement(['UTC', 'EST', 'PST', 'IST']),
        };

      case TargetingRuleType.CONTEXTUAL:
        return {
          keywords: faker.helpers.arrayElements(
            [
              'tech',
              'business',
              'finance',
              'health',
              'sports',
              'entertainment',
              'news',
              'lifestyle',
              'travel',
            ],
            { min: 2, max: 6 },
          ),
          contentTypes: faker.helpers.arrayElements(
            ['article', 'blog', 'video', 'social', 'review'],
            { min: 1, max: 3 },
          ),
        };

      case TargetingRuleType.BEHAVIORAL:
        return {
          interests: faker.helpers.arrayElements(
            [
              'technology',
              'sports',
              'travel',
              'fashion',
              'food',
              'movies',
              'music',
              'finance',
              'gaming',
            ],
            { min: 2, max: 5 },
          ),
          recentSearches: faker.datatype.boolean() ? true : false,
          purchaseHistory: faker.datatype.boolean() ? true : false,
        };

      case TargetingRuleType.FREQUENCY:
        return {
          maxImpressions: faker.number.int({ min: 3, max: 10 }),
          timeWindow: faker.helpers.arrayElement(['day', 'week', 'month']),
          cooldownPeriod: faker.number.int({ min: 1, max: 24 }),
        };

      default:
        return {};
    }
  }
}
