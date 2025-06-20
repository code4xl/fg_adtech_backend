import { Injectable, Logger } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import {
  CampaignStatus,
  CampaignObjective,
  BidStrategy,
  CampaignPacing,
  BusinessCategory,
  CampaignInterest,
  Currency,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ISeeder } from '../interfaces/seeder.interface';

@Injectable()
export class CampaignSeeder implements ISeeder {
  private readonly logger = new Logger(CampaignSeeder.name);

  constructor(private readonly prisma: PrismaService) { }

  getModuleName(): string {
    return 'Campaign';
  }

  getDependencies(): string[] {
    // Campaign depends on Advertiser and Client
    return ['Advertiser', 'Client'];
  }

  async seed(count: number = 200): Promise<void> {
    this.logger.log(`Seeding ${count} campaigns...`);

    try {
      // Get all advertisers to assign campaigns to
      const advertisers = await this.prisma.advertiser.findMany({
        select: { id: true },
      });

      if (advertisers.length === 0) {
        throw new Error('No advertisers found. Please seed advertisers first.');
      }

      // Get all clients (campaigns require a client)
      const clients = await this.prisma.client.findMany({
        select: { id: true, advertiserId: true },
      });

      if (clients.length === 0) {
        throw new Error(
          'No clients found. Please seed clients first since campaigns require a client.',
        );
      }

      const campaignData: any = [];

      // All possible values for enums (excluding status since we only want ACTIVE)
      const objectives = Object.values(CampaignObjective);
      const bidStrategies = Object.values(BidStrategy);
      const pacingOptions = Object.values(CampaignPacing);
      const businessCategories = Object.values(BusinessCategory);
      const interests = Object.values(CampaignInterest);

      // Generate fake campaigns
      for (let i = 0; i < count; i++) {
        // Randomly assign to an advertiser
        const advertiser = faker.helpers.arrayElement(advertisers);

        // Get clients for this advertiser
        const advertiserClients = clients.filter(
          (c) => c.advertiserId === advertiser.id,
        );

        // Must assign to a client - if advertiser has no clients, skip this iteration
        if (advertiserClients.length === 0) {
          this.logger.warn(
            `Advertiser ${advertiser.id} has no clients, skipping campaign creation`,
          );
          continue;
        }

        // Select a random client from this advertiser's clients
        const selectedClient = faker.helpers.arrayElement(advertiserClients);

        const now = new Date();
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        const oneYearFromNow = new Date(now);
        oneYearFromNow.setFullYear(now.getFullYear() + 1);

        // Generate random dates ensuring endDate is after startDate
        const startDate = faker.date.between({
          from: thirtyDaysAgo,
          to: now,
        });
        const endDate = faker.date.between({
          from: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000), // At least 7 days after start
          to: oneYearFromNow,
        });

        const bidStrategy = faker.helpers.arrayElement(bidStrategies);
        const bidAmount =
          bidStrategy === BidStrategy.BID_CAP ||
            bidStrategy === BidStrategy.TARGET_COST
            ? faker.number.float({
              min: 0.5,
              max: 50.0,
              fractionDigits: 2,
            })
            : null;

        // Generate targeting arrays
        const selectedInterests = faker.helpers.arrayElements(interests, {
          max: 5,
          min: 1,
        });

        campaignData.push({
          name: `${faker.company.catchPhrase()} Campaign`,
          advertiserId: advertiser.id,
          clientId: selectedClient.id, // Always assign a valid client
          startDate: startDate,
          endDate: endDate,
          status: CampaignStatus.ACTIVE, // Fixed: Always ACTIVE
          objective: faker.helpers.arrayElement(objectives),
          bidStrategy: bidStrategy,
          bidAmount: bidAmount,
          pacing: faker.helpers.arrayElement(pacingOptions),
          businessCategory: faker.helpers.arrayElement(businessCategories),
          websiteUrl: faker.internet.url(),
          interests: selectedInterests,
          createdAt: faker.date.past(),
          updatedAt: faker.date.recent(),
        });
      }

      // Add a default test campaign
      const defaultAdvertiser = await this.prisma.advertiser.findFirst({
        where: { email: 'advertiser@example.com' },
      });

      if (defaultAdvertiser) {
        const defaultClient = await this.prisma.client.findFirst({
          where: {
            email: 'client@example.com',
            advertiserId: defaultAdvertiser.id,
          },
        });

        if (!defaultClient) {
          throw new Error(
            'Default client not found for default advertiser. Please ensure client seeder creates a client for advertiser@example.com',
          );
        }

        campaignData.push({
          name: 'Test Campaign',
          advertiserId: defaultAdvertiser.id,
          clientId: defaultClient.id, // Guaranteed to be non-null
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          status: CampaignStatus.ACTIVE, // Fixed: Always ACTIVE
          objective: CampaignObjective.AWARENESS,
          bidStrategy: BidStrategy.LOWEST_COST,
          bidAmount: null,
          pacing: CampaignPacing.STANDARD,
          businessCategory: BusinessCategory.TECHNOLOGY,
          websiteUrl: 'https://example.com',
          interests: [
            CampaignInterest.TECHNOLOGY,
            CampaignInterest.BUSINESS_AND_FINANCE,
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Insert all campaigns
      await this.prisma.campaign.createMany({
        data: campaignData,
        skipDuplicates: true,
      });

      const campaignCount = await this.prisma.campaign.count();
      this.logger.log(`Successfully seeded ${campaignCount} campaigns`);

      // Seed related campaign statistics
      await this.seedCampaignStatistics();

      // Fixed: Seed campaign budget tracking
      await this.seedCampaignBudgetTracking();
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
      await this.prisma.campaignBudgetTracker.deleteMany({});
      await this.prisma.creative.deleteMany({});
      await this.prisma.demographicTargeting.deleteMany({});
      await this.prisma.geographicTargeting.deleteMany({});
      await this.prisma.deviceTargeting.deleteMany({});
      await this.prisma.contextualTargeting.deleteMany({});
      await this.prisma.behavioralTargeting.deleteMany({});
      await this.prisma.timeTargeting.deleteMany({});
      await this.prisma.frequencyTargeting.deleteMany({});
      await this.prisma.hourlyMetrics.deleteMany({});

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

  /**
   * Seed related campaign statistics for the last 7 days
   */
  private async seedCampaignStatistics(): Promise<void> {
    try {
      const campaigns = await this.prisma.campaign.findMany({
        select: { id: true },
        take: 10, // Only seed stats for first 10 campaigns
      });

      const statisticsData: any = [];

      for (const campaign of campaigns) {
        for (let i = 0; i < 7; i++) {
          const date = new Date();
          date.setDate(date.getDate() - i);

          const impressions = faker.number.int({ min: 100, max: 10000 });
          const clicks = faker.number.int({
            min: 0,
            max: Math.floor(impressions * 0.1),
          });
          const conversions = faker.number.int({
            min: 0,
            max: Math.floor(clicks * 0.1),
          });
          const spend = faker.number.float({
            min: 10,
            max: 500,
            fractionDigits: 2,
          });

          statisticsData.push({
            campaignId: campaign.id,
            date: date,
            impressions: impressions,
            clicks: clicks,
            conversions: conversions,
            spend: spend,
            ctr: impressions > 0 ? clicks / impressions : null,
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
      this.logger.warn('Error seeding campaign statistics, but continuing...');
    }
  }

  /**
   * Fixed: Added method to seed campaign budget tracking data
   */
  private async seedCampaignBudgetTracking(): Promise<void> {
    try {
      const campaigns = await this.prisma.campaign.findMany({
        select: { id: true },
      });

      const budgetData: any = [];

      for (const campaign of campaigns) {
        // Create budget tracking for the last 30 days
        for (let i = 0; i < 30; i++) {
          const date = new Date();
          date.setDate(date.getDate() - i);

          const totalBudget = faker.number.float({
            min: 1000,
            max: 10000,
            fractionDigits: 2,
          });
          const dailyBudget = faker.number.float({
            min: totalBudget * 0.01, // 1% of total budget per day minimum
            max: totalBudget * 0.1, // 10% of total budget per day maximum
            fractionDigits: 2,
          });
          const spentToday = faker.number.float({
            min: 0,
            max: dailyBudget * 1.2, // Can slightly exceed daily budget
            fractionDigits: 2,
          });
          const remainingBudget = Math.max(
            0,
            totalBudget - spentToday * (i + 1),
          );
          const isExhausted = remainingBudget <= 0 || spentToday >= dailyBudget;

          budgetData.push({
            campaignId: campaign.id,
            date: date,
            totalBudget: totalBudget,
            dailyBudget: dailyBudget,
            spentToday: spentToday,
            remainingBudget: remainingBudget,
            isExhausted: isExhausted,
            lastUpdated: faker.date.recent(),
          });
        }
      }

      await this.prisma.campaignBudgetTracker.createMany({
        data: budgetData,
        skipDuplicates: true,
      });

      this.logger.log(
        `Seeded ${budgetData.length} campaign budget tracking records`,
      );
    } catch (error) {
      this.logger.warn(
        'Error seeding campaign budget tracking, but continuing...',
      );
      this.logger.error(error);
    }
  }
}
