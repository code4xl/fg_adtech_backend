import { Injectable, Logger } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import { TargetingRuleType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ISeeder } from '../interfaces/seeder.interface';

@Injectable()
export class CampaignTargetingRuleSeeder implements ISeeder {
  private readonly logger = new Logger(CampaignTargetingRuleSeeder.name);

  constructor(private readonly prisma: PrismaService) {}

  getModuleName(): string {
    return 'CampaignTargetingRule';
  }

  getDependencies(): string[] {
    // Depends on Campaign
    return ['Campaign'];
  }

  async seed(): Promise<void> {
    this.logger.log('Seeding campaign targeting rules...');

    try {
      // Get all campaigns
      const campaigns = await this.prisma.campaign.findMany({
        select: { id: true },
      });

      if (campaigns.length === 0) {
        throw new Error('No campaigns found. Please seed campaigns first.');
      }

      // Get all rule types
      const ruleTypes = Object.values(TargetingRuleType);

      // For each campaign, create 2-4 targeting rules
      for (const campaign of campaigns) {
        // How many rules will this campaign have?
        const ruleCount = faker.number.int({ min: 2, max: 4 });

        // Choose random rule types (no duplicates)
        const selectedRuleTypes = faker.helpers.arrayElements(ruleTypes, {
          min: ruleCount,
          max: ruleCount,
        });

        // Create targeting rules
        for (const ruleType of selectedRuleTypes) {
          await this.prisma.campaignTargetingRule.create({
            data: {
              campaignId: campaign.id,
              ruleType: ruleType,
              ruleData: this.generateRuleData(ruleType),
            },
          });
        }
      }

      // Create targeting rules for test campaign
      const testCampaign = await this.prisma.campaign.findFirst({
        where: { name: 'Test Campaign' },
      });

      if (testCampaign) {
        // Create demographic targeting rule
        await this.prisma.campaignTargetingRule.create({
          data: {
            campaignId: testCampaign.id,
            ruleType: TargetingRuleType.DEMOGRAPHIC,
            ruleData: {
              ageRanges: ['25-34', '35-44', '45-54'],
              genders: ['male', 'female'],
              income: ['medium', 'high'],
            },
          },
        });

        // Create geographic targeting rule
        await this.prisma.campaignTargetingRule.create({
          data: {
            campaignId: testCampaign.id,
            ruleType: TargetingRuleType.GEOGRAPHIC,
            ruleData: {
              countries: ['US', 'CA', 'UK', 'IN'],
              cities: ['Mumbai', 'Delhi', 'Bangalore'],
            },
          },
        });

        // Create device targeting rule
        await this.prisma.campaignTargetingRule.create({
          data: {
            campaignId: testCampaign.id,
            ruleType: TargetingRuleType.DEVICE,
            ruleData: {
              deviceTypes: ['mobile', 'desktop'],
              browsers: ['chrome', 'safari', 'firefox'],
            },
          },
        });
      }

      const ruleCount = await this.prisma.campaignTargetingRule.count();
      this.logger.log(
        `Successfully seeded ${ruleCount} campaign targeting rules`,
      );
    } catch (error) {
      this.logger.error('Error seeding campaign targeting rules');
      this.logger.error(error);
      throw error;
    }
  }

  async clean(): Promise<void> {
    this.logger.log('Cleaning campaign targeting rules...');

    try {
      const deleted = await this.prisma.campaignTargetingRule.deleteMany({});
      this.logger.log(`Deleted ${deleted.count} campaign targeting rules`);
    } catch (error) {
      this.logger.error('Error cleaning campaign targeting rules');
      this.logger.error(error);
      throw error;
    }
  }

  async isSeeded(): Promise<boolean> {
    const count = await this.prisma.campaignTargetingRule.count();
    return count > 0;
  }

  // Helper to generate appropriate rule data based on rule type
  private generateRuleData(ruleType: TargetingRuleType): any {
    switch (ruleType) {
      case TargetingRuleType.DEMOGRAPHIC:
        return {
          ageRanges: faker.helpers.arrayElements(
            ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'],
            { min: 1, max: 4 },
          ),
          genders: faker.helpers.arrayElements(['male', 'female', 'other'], {
            min: 1,
            max: 3,
          }),
          income: faker.helpers.arrayElements(
            ['low', 'medium', 'high', 'very_high'],
            { min: 0, max: 3 },
          ),
          education: faker.helpers.arrayElements(
            ['high_school', 'bachelors', 'masters', 'doctorate'],
            { min: 0, max: 4 },
          ),
        };

      case TargetingRuleType.GEOGRAPHIC:
        return {
          countries: faker.helpers.arrayElements(
            ['US', 'CA', 'UK', 'AU', 'IN', 'JP', 'DE', 'FR'],
            { min: 1, max: 5 },
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
            { min: 0, max: 4 },
          ),
          cities: faker.helpers.arrayElements(
            [
              'Mumbai',
              'New York',
              'Los Angeles',
              'London',
              'Toronto',
              'Delhi',
              'Bangalore',
              'Sydney',
            ],
            { min: 0, max: 6 },
          ),
          radius: faker.datatype.boolean()
            ? faker.number.int({ min: 10, max: 100 })
            : null,
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
          connectionTypes: faker.helpers.arrayElements(
            ['wifi', 'cellular', 'broadband'],
            { min: 0, max: 3 },
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
            { min: 8, max: 16 },
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
              'education',
            ],
            { min: 2, max: 8 },
          ),
          contentTypes: faker.helpers.arrayElements(
            ['article', 'blog', 'video', 'social', 'review', 'news', 'forum'],
            { min: 1, max: 4 },
          ),
          categories: faker.helpers.arrayElements(
            [
              'Technology',
              'Business',
              'Sports',
              'Entertainment',
              'Health',
              'Travel',
              'Education',
              'Food',
            ],
            { min: 1, max: 5 },
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
              'fitness',
            ],
            { min: 2, max: 6 },
          ),
          recentSearches: faker.datatype.boolean(),
          purchaseIntent: faker.helpers.arrayElements(
            [
              'electronics',
              'clothing',
              'travel',
              'automotive',
              'home_goods',
              'services',
            ],
            { min: 0, max: 3 },
          ),
          appUsage: faker.helpers.arrayElements(
            ['social_media', 'gaming', 'productivity', 'finance', 'shopping'],
            { min: 0, max: 3 },
          ),
        };

      case TargetingRuleType.FREQUENCY:
        return {
          maxImpressions: faker.number.int({ min: 3, max: 15 }),
          timeWindow: faker.helpers.arrayElement([
            'day',
            'week',
            'month',
            'campaign',
          ]),
          cooldownPeriod: faker.number.int({ min: 1, max: 48 }),
          sequential: faker.datatype.boolean(),
        };

      default:
        return {};
    }
  }
}
