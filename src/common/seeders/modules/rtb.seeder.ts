import { Injectable, Logger } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import { AuctionType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ISeeder } from '../interfaces/seeder.interface';

@Injectable()
export class RtbSeeder implements ISeeder {
  private readonly logger = new Logger(RtbSeeder.name);

  constructor(private readonly prisma: PrismaService) {}

  getModuleName(): string {
    return 'RTB';
  }

  getDependencies(): string[] {
    // Depends on many other entities
    return ['AdInventory', 'Publisher', 'Campaign', 'Advertiser', 'Creative'];
  }

  async seed(count: number = 20): Promise<void> {
    this.logger.log(`Seeding ${count} RTB records...`);

    try {
      // Get required entities
      const inventories = await this.prisma.adInventory.findMany({
        where: { isActive: true },
        select: { id: true, publisherId: true },
      });

      const campaigns = await this.prisma.campaign.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, advertiserId: true },
      });

      const creatives = await this.prisma.creative.findMany({
        select: { id: true, campaignId: true },
        take: 20, // Limit to avoid excessive queries
      });

      if (
        inventories.length === 0 ||
        campaigns.length === 0 ||
        creatives.length === 0
      ) {
        throw new Error(
          'Required entities not found. Please seed required entities first.',
        );
      }

      // Create bid requests
      for (let i = 0; i < count; i++) {
        const inventory = faker.helpers.arrayElement(inventories);

        // Create a bid request
        const bidRequest = await this.prisma.bidRequest.create({
          data: {
            requestId: faker.string.uuid(),
            inventoryId: inventory.id,
            publisherId: inventory.publisherId,
            userAgent: faker.internet.userAgent(),
            ipAddress: faker.internet.ip(),
            deviceType: faker.helpers.arrayElement([
              'mobile',
              'desktop',
              'tablet',
            ]),
            browserType: faker.helpers.arrayElement([
              'chrome',
              'firefox',
              'safari',
              'edge',
            ]),
            country: faker.location.country(),
            region: faker.location.state(),
            city: faker.location.city(),
            floor: faker.number.float({ min: 0.5, max: 3.0 }),
            auctionType: faker.helpers.arrayElement([
              AuctionType.FIRST_PRICE,
              AuctionType.SECOND_PRICE,
            ]),
            timeout: 200,
            targeting: {
              interests: faker.helpers.arrayElements(
                ['tech', 'business', 'sports'],
                { min: 1, max: 3 },
              ),
              context: faker.helpers.arrayElement([
                'news',
                'entertainment',
                'finance',
              ]),
            },
          },
        });

        // Create auction log
        const auctionLog = await this.prisma.auctionLog.create({
          data: {
            bidRequestId: bidRequest.id,
            floorPrice: bidRequest.floor,
            totalBids: faker.number.int({ min: 1, max: 5 }),
            auctionStartTime: bidRequest.requestTimestamp,
            auctionEndTime: new Date(
              bidRequest.requestTimestamp.getTime() +
                faker.number.int({ min: 50, max: 180 }),
            ),
            auctionDuration: faker.number.int({ min: 50, max: 180 }),
            status: 'COMPLETED',
          },
        });

        // Create 1-5 bid responses
        const bidCount = faker.number.int({ min: 1, max: 5 });
        const bidResponses: any[] = [];

        for (let j = 0; j < bidCount; j++) {
          // Select a campaign and its related creative
          const campaignCreatives = creatives.filter(
            (c) => c.campaignId === campaigns[j % campaigns.length].id,
          );
          const creative =
            campaignCreatives.length > 0 ? campaignCreatives[0] : creatives[0]; // Fallback

          const campaign = campaigns.find((c) => c.id === creative.campaignId);

          if (!campaign) continue;

          const bidPrice = faker.number.float({
            min:
              bidRequest.floor != null
                ? parseFloat(bidRequest.floor.toString())
                : 0.5,
            max: 10.0,
          });

          const bidResponse: any = await this.prisma.bidResponse.create({
            data: {
              bidRequestId: bidRequest.id,
              campaignId: campaign.id,
              creativeId: creative.id,
              advertiserId: campaign.advertiserId,
              bidPrice: bidPrice,
              currency: 'USD',
              bidTimestamp: new Date(
                bidRequest.requestTimestamp.getTime() +
                  faker.number.int({ min: 20, max: 150 }),
              ),
              status: j === 0 ? 'WON' : 'LOST', // First bid is the winner
              responseTime: faker.number.int({ min: 20, max: 150 }),
              winNoticed: j === 0, // Winner gets notified
              adMarkup: j === 0 ? '<div>Test Ad Creative</div>' : null,
            },
          });

          bidResponses.push(bidResponse);
        }

        // Update auction log with winning bid
        if (bidResponses.length > 0) {
          await this.prisma.auctionLog.update({
            where: { id: auctionLog.id },
            data: {
              winningBidId: bidResponses[0].id,
              finalPrice: bidResponses[0].bidPrice,
            },
          });
        }
      }

      // Create test RTB data with the test entities
      const testPublisher = await this.prisma.publisher.findFirst({
        where: { email: 'publisher@example.com' },
      });

      const testInventory = await this.prisma.adInventory.findFirst({
        where: { name: 'Test Banner 300x250' },
      });

      const testCampaign = await this.prisma.campaign.findFirst({
        where: { name: 'Test Campaign' },
      });

      const testCreative = await this.prisma.creative.findFirst({
        where: { name: 'Test Banner Creative' },
      });

      const testAdvertiser = await this.prisma.advertiser.findFirst({
        where: { email: 'advertiser@example.com' },
      });

      if (
        testPublisher &&
        testInventory &&
        testCampaign &&
        testCreative &&
        testAdvertiser
      ) {
        // Create test bid request
        const testBidRequest = await this.prisma.bidRequest.create({
          data: {
            requestId: 'test-bid-request',
            inventoryId: testInventory.id,
            publisherId: testPublisher.id,
            userAgent:
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
            ipAddress: '192.168.1.1',
            deviceType: 'desktop',
            browserType: 'chrome',
            country: 'IN',
            region: 'Maharashtra',
            city: 'Mumbai',
            floor: 1.0,
            auctionType: AuctionType.FIRST_PRICE,
            timeout: 200,
            targeting: {
              interests: ['tech', 'business'],
              context: 'news',
            },
          },
        });

        // Create test bid response
        const testBidResponse = await this.prisma.bidResponse.create({
          data: {
            bidRequestId: testBidRequest.id,
            campaignId: testCampaign.id,
            creativeId: testCreative.id,
            advertiserId: testAdvertiser.id,
            bidPrice: 2.5,
            currency: 'USD',
            bidTimestamp: new Date(
              testBidRequest.requestTimestamp.getTime() + 50,
            ),
            status: 'WON',
            responseTime: 50,
            winNoticed: true,
            adMarkup: '<div class="test-ad">Test Banner Ad</div>',
          },
        });

        // Create test auction log
        await this.prisma.auctionLog.create({
          data: {
            bidRequestId: testBidRequest.id,
            winningBidId: testBidResponse.id,
            floorPrice: 1.0,
            finalPrice: 2.5,
            totalBids: 1,
            auctionStartTime: testBidRequest.requestTimestamp,
            auctionEndTime: new Date(
              testBidRequest.requestTimestamp.getTime() + 100,
            ),
            auctionDuration: 100,
            status: 'COMPLETED',
          },
        });
      }

      const bidRequestCount = await this.prisma.bidRequest.count();
      const bidResponseCount = await this.prisma.bidResponse.count();
      const auctionLogCount = await this.prisma.auctionLog.count();

      this.logger.log(
        `Successfully seeded ${bidRequestCount} bid requests, ${bidResponseCount} bid responses, and ${auctionLogCount} auction logs`,
      );
    } catch (error) {
      this.logger.error('Error seeding RTB data');
      this.logger.error(error);
      throw error;
    }
  }

  async clean(): Promise<void> {
    this.logger.log('Cleaning RTB tables...');

    try {
      // Clean in proper order to respect foreign key constraints
      await this.prisma.auctionLog.deleteMany({});
      await this.prisma.bidResponse.deleteMany({});
      await this.prisma.bidRequest.deleteMany({});

      this.logger.log('RTB tables cleaned successfully');
    } catch (error) {
      this.logger.error('Error cleaning RTB tables');
      this.logger.error(error);
      throw error;
    }
  }

  async isSeeded(): Promise<boolean> {
    const bidRequestCount = await this.prisma.bidRequest.count();
    return bidRequestCount > 0;
  }
}
