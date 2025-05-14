import { Injectable, Logger } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import {
  CampaignStatus,
  CampaignObjective,
  BidStrategy,
  CampaignPacing,
  BusinessCategory,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ISeeder } from '../interfaces/seeder.interface';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class CampaignSeeder implements ISeeder {
  private readonly logger = new Logger(CampaignSeeder.name);

  constructor(private readonly prisma: PrismaService) {}

  getModuleName(): string {
    return 'Campaign';
  }

  getDependencies(): string[] {
    // Campaign depends on Advertiser
    return ['Advertiser'];
  }

  async seed(count: number = 20): Promise<void> {
    this.logger.log(`Seeding ${count} campaigns...`);

    try {
      // Get all advertisers to assign campaigns to
      const advertisers = await this.prisma.advertiser.findMany({
        select: { id: true },
      });

      if (advertisers.length === 0) {
        throw new Error('No advertisers found. Please seed advertisers first.');
      }

      const campaignData: any = [];

      // All possible values for enums
      const statuses = Object.values(CampaignStatus);
      const objectives = Object.values(CampaignObjective);
      const bidStrategies = Object.values(BidStrategy);
      const pacingOptions = Object.values(CampaignPacing);
      const businessCategories = Object.values(BusinessCategory);

      // Generate fake campaigns
      for (let i = 0; i < count; i++) {
        // Randomly assign to an advertiser
        const advertiser = faker.helpers.arrayElement(advertisers);

        // Generate random dates ensuring endDate is after startDate
        const startDate = faker.date.between({
          from: faker.date.recent({ days: 30 }),
          to: faker.date.future({ years: 1 }),
        });
        const endDate = faker.date.between({
          from: startDate,
          to: faker.date.future({ years: 1 }),
        });

        // Generate budget values
        const budget = faker.number.float({
          min: 1000,
          max: 100000,
          fractionDigits: 2,
        });
        const dailyBudget = faker.datatype.boolean()
          ? faker.number.float({
              min: budget / 30,
              max: budget / 10,
              fractionDigits: 2,
            })
          : null;

        const bidStrategy = faker.helpers.arrayElement(bidStrategies);
        const bidAmount =
          bidStrategy === BidStrategy.BID_CAP ||
          bidStrategy === BidStrategy.TARGET_COST
            ? faker.number.float({ min: 0.5, max: 50.0, fractionDigits: 2 })
            : null;

        campaignData.push({
          name: `${faker.company.catchPhrase()} Campaign`,
          advertiserId: advertiser.id,
          clientId: null, // You can add client logic here if needed
          budget: budget,
          dailyBudget: dailyBudget,
          startDate: startDate,
          endDate: endDate,
          status: faker.helpers.arrayElement(statuses),
          objective: faker.helpers.arrayElement(objectives),
          bidStrategy: bidStrategy,
          bidAmount: bidAmount,
          pacing: faker.helpers.arrayElement(pacingOptions),
          businessCategory: faker.helpers.arrayElement(businessCategories),
          websiteUrl: faker.internet.url(),
          // Generate random interests as a comma-separated string
          interests: faker.helpers
            .arrayElements(
              [
                'technology',
                'fashion',
                'sports',
                'travel',
                'food',
                'music',
                'gaming',
                'health',
                'finance',
                'education',
              ],
              { min: 1, max: 5 },
            )
            .join(','),
          // Generate a CSV string for audiences
          audienceCSV: this.generateAudienceCSV(),
          createdAt: faker.date.past(),
          updatedAt: faker.date.recent(),
        });
      }

      // Add a default campaign for testing
      const defaultAdvertiser = await this.prisma.advertiser.findFirst({
        where: { email: 'advertiser@example.com' },
      });

      if (defaultAdvertiser) {
        campaignData.push({
          name: 'Test Campaign',
          advertiserId: defaultAdvertiser.id,
          clientId: null,
          budget: 5000.0,
          dailyBudget: 250.0,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          status: CampaignStatus.ACTIVE,
          objective: CampaignObjective.AWARENESS,
          bidStrategy: BidStrategy.LOWEST_COST,
          bidAmount: null,
          pacing: CampaignPacing.STANDARD,
          businessCategory: BusinessCategory.TECHNOLOGY,
          websiteUrl: 'https://example.com',
          interests: 'technology,business',
          audienceCSV: 'age:25-45,gender:all,location:US',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Insert all campaigns
      await this.prisma.campaign.createMany({
        data: campaignData,
      });

      const campaignCount = await this.prisma.campaign.count();
      this.logger.log(`Successfully seeded ${campaignCount} campaigns`);

      // Optionally seed related data
      await this.seedCampaignRelations();
    } catch (error) {
      this.logger.error('Error seeding campaigns');
      this.logger.error(error);
      throw error;
    }
  }

  async clean(): Promise<void> {
    this.logger.log('Cleaning campaigns table...');

    try {
      // Clean related tables first (respecting foreign key constraints)
      await this.prisma.campaignStatistics.deleteMany({});
      await this.prisma.campaignTargetingRule.deleteMany({});
      await this.prisma.campaignInventory.deleteMany({});

      // Clean main table
      const deleted = await this.prisma.campaign.deleteMany({});
      this.logger.log(`Deleted ${deleted.count} campaigns`);
    } catch (error) {
      this.logger.error('Error cleaning campaigns table');
      this.logger.error(error);
      throw error;
    }
  }

  async isSeeded(): Promise<boolean> {
    const count = await this.prisma.campaign.count();
    return count > 0;
  }

  // Helper method to generate audience CSV
  private generateAudienceCSV(): string {
    const ageRanges = ['18-24', '25-34', '35-44', '45-54', '55+'];
    const genders = ['male', 'female', 'all'];
    const locations = ['US', 'UK', 'CA', 'AU', 'IN'];
    const devices = ['mobile', 'desktop', 'tablet'];

    return [
      `age:${faker.helpers.arrayElement(ageRanges)}`,
      `gender:${faker.helpers.arrayElement(genders)}`,
      `location:${faker.helpers.arrayElements(locations, { min: 1, max: 3 }).join('|')}`,
      `devices:${faker.helpers.arrayElements(devices, { min: 1, max: 3 }).join('|')}`,
    ].join(',');
  }

  // Optional: Seed related data like statistics, targeting rules
  private async seedCampaignRelations(): Promise<void> {
    try {
      const campaigns = await this.prisma.campaign.findMany({
        select: { id: true },
      });

      // Seed some campaign statistics for the last 7 days
      const statisticsData: any = [];

      for (const campaign of campaigns.slice(0, 10)) {
        // Only seed stats for first 10 campaigns
        for (let i = 0; i < 7; i++) {
          const date = new Date();
          date.setDate(date.getDate() - i);

          const impressions = faker.number.int({ min: 1000, max: 100000 });
          const clicks = faker.number.int({ min: 0, max: impressions * 0.1 });
          const conversions = faker.number.int({ min: 0, max: clicks * 0.1 });
          const spend = faker.number.float({
            min: 10,
            max: 1000,
            fractionDigits: 2,
          });

          statisticsData.push({
            campaignId: campaign.id,
            date: date,
            impressions: impressions,
            clicks: clicks,
            conversions: conversions,
            spend: spend,
            ctr: clicks / impressions,
            cpc: clicks > 0 ? spend / clicks : null,
          });
        }
      }

      await this.prisma.campaignStatistics.createMany({
        data: statisticsData,
        skipDuplicates: true,
      });

      this.logger.log(`Seeded ${statisticsData.length} campaign statistics`);
    } catch (error) {
      this.logger.warn('Error seeding campaign relations, but continuing...');
      // Don't throw - these are optional
    }
  }
}
