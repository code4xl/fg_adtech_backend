import { Injectable, Logger } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import {
  CampaignStatus,
  CampaignObjective,
  BidStrategy,
  CampaignPacing,
  BusinessCategory,
  CampaignInterest,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ISeeder } from '../interfaces/seeder.interface';

@Injectable()
export class CampaignSeeder implements ISeeder {
  private readonly logger = new Logger(CampaignSeeder.name);

  constructor(private readonly prisma: PrismaService) {}

  getModuleName(): string {
    return 'Campaign';
  }

  getDependencies(): string[] {
    // Campaign depends on Advertiser and Client
    return ['Advertiser', 'Client'];
  }

  async seed(count: number = 100): Promise<void> {
    this.logger.debug(`Seeding ${count} campaigns...`);

    try {
      // Get all advertisers with their clients in one query
      const advertisersWithClients = await this.prisma.advertiser.findMany({
        select: {
          id: true,
          email: true,
          clients: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      if (advertisersWithClients.length === 0) {
        throw new Error('No advertisers found. Please seed advertisers first.');
      }

      // Filter out advertisers with no clients and log warnings
      const validAdvertisers = advertisersWithClients.filter((advertiser) => {
        if (advertiser.clients.length === 0) {
          this.logger.warn(
            `Advertiser ${advertiser.email} has no clients, skipping campaign creation for this advertiser`,
          );
          return false;
        }
        return true;
      });

      if (validAdvertisers.length === 0) {
        throw new Error(
          'No advertisers with clients found. Please ensure the client seeder runs successfully first.',
        );
      }

      this.logger.debug(
        `Found ${validAdvertisers.length} advertisers with clients. Creating campaigns...`,
      );

      const campaignData: any = [];

      // All possible values for enums
      const objectives = Object.values(CampaignObjective);
      const bidStrategies = Object.values(BidStrategy);
      const pacingOptions = Object.values(CampaignPacing);
      const businessCategories = Object.values(BusinessCategory);
      const interests = Object.values(CampaignInterest);

      // Generate fake campaigns
      for (let i = 0; i < count; i++) {
        // Randomly select an advertiser that has clients
        const advertiser = faker.helpers.arrayElement(validAdvertisers);

        // Select a random client from this advertiser's clients
        const selectedClient = faker.helpers.arrayElement(advertiser.clients);

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
        const bidAmount = faker.number.float({
          min: 10,
          max: 50,
        });

        // Generate targeting arrays
        const selectedInterests = faker.helpers.arrayElements(interests, {
          max: 5,
          min: 1,
        });

        campaignData.push({
          name: `${faker.company.catchPhrase()} Campaign`,
          advertiserId: advertiser.id,
          clientId: selectedClient.id,
          startDate: startDate,
          endDate: endDate,
          status: CampaignStatus.ACTIVE, // Always ACTIVE
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
      const defaultAdvertiser = validAdvertisers.find(
        (advertiser) => advertiser.email === 'advertiser@example.com',
      );

      if (defaultAdvertiser) {
        const defaultClient = defaultAdvertiser.clients.find(
          (client) => client.email === 'client@example.com',
        );

        if (defaultClient) {
          campaignData.push({
            name: 'Test Campaign',
            advertiserId: defaultAdvertiser.id,
            clientId: defaultClient.id,
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            status: CampaignStatus.ACTIVE,
            objective: CampaignObjective.AWARENESS,
            bidStrategy: BidStrategy.TARGET_CPM,
            bidAmount: 10.0,
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
        } else {
          this.logger.warn(
            'Default test client not found for default advertiser',
          );
        }
      } else {
        this.logger.warn('Default test advertiser not found or has no clients');
      }

      // Create campaigns and budgets using transactions (Option A: Every campaign gets a budget)
      const createdCampaigns = [];
      let successfullyCreated = 0;

      for (const data of campaignData) {
        try {
          // Use a transaction to ensure data consistency
          const result = await this.prisma.$transaction(async (tx) => {
            // Step 1: Create campaign without budget reference (temporarily null)
            const campaign = await tx.campaign.create({
              data: {
                ...data,
                campaignBudgetId: null, // Initially null
              },
            });

            // Step 2: Create the budget with campaign reference
            const totalBudget = faker.number.float({
              min: 1000,
              max: 50000,
              fractionDigits: 2,
            });
            const dailyBudget = faker.number.float({
              min: totalBudget * 0.01, // 1% of total budget per day minimum
              max: totalBudget * 0.1, // 10% of total budget per day maximum
              fractionDigits: 2,
            });

            const campaignBudget = await tx.campaignBudget.create({
              data: {
                campaignId: campaign.id,
                totalBudget: totalBudget,
                dailyBudget: dailyBudget,
                isExhausted: faker.datatype.boolean(0.1), // 10% chance of being exhausted
                lastUpdated: faker.date.recent(),
              },
            });

            // Step 3: Update campaign with budget reference
            const updatedCampaign = await tx.campaign.update({
              where: { id: campaign.id },
              data: { campaignBudgetId: campaignBudget.id },
            });

            return updatedCampaign;
          });

          createdCampaigns.push(result);
          successfullyCreated++;
        } catch (error) {
          this.logger.warn(`Failed to create campaign: ${error.message}`);
          continue;
        }
      }

      const campaignCount = await this.prisma.campaign.count();
      this.logger.debug(
        `Successfully seeded ${successfullyCreated} new campaigns (total: ${campaignCount})`,
      );

      // Log campaign distribution per advertiser
      const campaignDistribution = await this.prisma.advertiser.findMany({
        select: {
          email: true,
          _count: {
            select: {
              Campaign: true,
            },
          },
        },
      });

      this.logger.debug('Campaign distribution per advertiser:');
      campaignDistribution.forEach((advertiser) => {
        this.logger.debug(
          `  ${advertiser.email}: ${advertiser._count.Campaign} campaigns`,
        );
      });

      // Seed related campaign statistics
      await this.seedCampaignStatistics(createdCampaigns);

      // Seed daily budget tracking
      await this.seedCampaignDailyBudgets(createdCampaigns);
    } catch (error) {
      this.logger.error('Error seeding campaigns');
      this.logger.error(error);
      throw error;
    }
  }

  async clean(): Promise<void> {
    this.logger.debug('Cleaning campaigns table...');

    try {
      // Clean related tables first (respecting foreign key constraints)
      await this.prisma.campaignStatistics.deleteMany({});
      await this.prisma.campaignDailyBudget.deleteMany({});
      await this.prisma.creative.deleteMany({});
      await this.prisma.demographicTargeting.deleteMany({});
      await this.prisma.geographicTargeting.deleteMany({});
      await this.prisma.deviceTargeting.deleteMany({});
      await this.prisma.contextualTargeting.deleteMany({});
      await this.prisma.behavioralTargeting.deleteMany({});
      await this.prisma.timeTargeting.deleteMany({});
      await this.prisma.frequencyTargeting.deleteMany({});
      await this.prisma.hourlyMetrics.deleteMany({});
      await this.prisma.budgetTransaction.deleteMany({});
      await this.prisma.systemRevenue.deleteMany({});
      await this.prisma.bidResponse.deleteMany({});
      await this.prisma.impressionEvent.deleteMany({});
      await this.prisma.clickEvent.deleteMany({});

      // Clean campaigns first (this will set campaignBudgetId to null due to foreign key)
      const deletedCampaigns = await this.prisma.campaign.deleteMany({});

      // Clean campaign budgets
      const deletedBudgets = await this.prisma.campaignBudget.deleteMany({});

      this.logger.debug(
        `Deleted ${deletedCampaigns.count} campaigns and ${deletedBudgets.count} budgets`,
      );
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
  private async seedCampaignStatistics(campaigns: any[]): Promise<void> {
    try {
      const statisticsData: any = [];

      // Only seed stats for first 10 campaigns to avoid too much data
      const campaignsToSeed = campaigns.slice(0, 10);

      for (const campaign of campaignsToSeed) {
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

      this.logger.debug(`Seeded ${statisticsData.length} campaign statistics`);
    } catch (error) {
      this.logger.warn('Error seeding campaign statistics, but continuing...');
    }
  }

  /**
   * Seed campaign daily budget tracking for all campaigns
   */
  private async seedCampaignDailyBudgets(campaigns: any[]): Promise<void> {
    try {
      const dailyBudgetData: any = [];

      // Seed for ALL campaigns (not just first 10)
      for (const campaign of campaigns) {
        // Create daily budget tracking for today
        const date = new Date();

        // Get the campaign's actual daily budget from the campaignBudget
        const campaignWithBudget = await this.prisma.campaign.findUnique({
          where: { id: campaign.id },
          include: { campaignBudget: true },
        });

        if (campaignWithBudget?.campaignBudget) {
          const dailyBudget = Number(
            campaignWithBudget.campaignBudget.dailyBudget,
          );
          const spentToday = faker.number.float({
            min: 0,
            max: 0, // zero
            fractionDigits: 2,
          });
          const remainingToday = Math.max(0, dailyBudget - spentToday);
          const isExhausted = spentToday >= dailyBudget;

          dailyBudgetData.push({
            campaignId: campaign.id,
            date: date,
            spentToday: spentToday,
            remainingToday: remainingToday,
            isExhausted: isExhausted,
            lastUpdated: faker.date.recent(),
          });
        }
      }

      await this.prisma.campaignDailyBudget.createMany({
        data: dailyBudgetData,
        skipDuplicates: true,
      });

      this.logger.debug(
        `Seeded ${dailyBudgetData.length} campaign daily budget tracking records`,
      );
    } catch (error) {
      this.logger.warn(
        'Error seeding campaign daily budget tracking, but continuing...',
      );
      this.logger.error(error);
    }
  }
}
