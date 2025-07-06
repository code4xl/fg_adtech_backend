import { Injectable, Logger } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import {
  Gender,
  Education,
  IncomeRange,
  DeviceType,
  OperatingSystem,
  BrowserType,
  ConnectionType,
  BusinessCategory,
  PageType,
  BrandSafety,
  CampaignInterest,
  PurchaseIntent,
  LifestyleSegment,
  AudienceType,
  UserSegment,
  PurchaseFrequency,
  SessionEngagement,
  DayOfWeek,
  TimeSlot,
  HolidayType,
  FrequencyWindow,
  FrequencyScope,
  Language,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ISeeder } from '../interfaces/seeder.interface';

@Injectable()
export class TargetingRuleSeeder implements ISeeder {
  private readonly logger = new Logger(TargetingRuleSeeder.name);

  constructor(private readonly prisma: PrismaService) {}

  getModuleName(): string {
    return 'TargetingRule';
  }

  getDependencies(): string[] {
    return ['Campaign', 'AdInventory'];
  }

  async seed(): Promise<void> {
    this.logger.debug('Seeding targeting rules...');

    try {
      // Get campaigns and inventories
      const campaigns = await this.prisma.campaign.findMany({
        select: { id: true, name: true },
      });

      const inventories = await this.prisma.adInventory.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      });

      if (campaigns.length === 0 || inventories.length === 0) {
        throw new Error(
          'No campaigns or inventories found. Please seed them first.',
        );
      }

      // Seed campaign targeting rules
      await this.seedCampaignTargeting(campaigns);

      // Seed inventory targeting rules
      await this.seedInventoryTargeting(inventories);

      // Create specific test targeting rules
      await this.seedTestTargetingRules();

      const stats = await this.getTargetingStats();
      this.logger.debug(
        `Successfully seeded targeting rules: ${JSON.stringify(stats)}`,
      );
    } catch (error) {
      this.logger.error('Error seeding targeting rules');
      this.logger.error(error);
      throw error;
    }
  }

  private async seedCampaignTargeting(
    campaigns: { id: string; name: string }[],
  ): Promise<void> {
    for (const campaign of campaigns) {
      // Create demographic targeting for most campaigns (80%)
      if (faker.datatype.boolean(0.8)) {
        await this.prisma.demographicTargeting.create({
          data: {
            campaignId: campaign.id,
            ageMin: faker.number.int({ min: 18, max: 35 }),
            ageMax: faker.number.int({ min: 35, max: 65 }),
            genders: faker.helpers.arrayElements(Object.values(Gender), {
              min: 1,
              max: 3,
            }),
            languages: faker.helpers.arrayElements(Object.values(Language), {
              min: 1,
              max: 3,
            }),
            education: faker.helpers.arrayElements(Object.values(Education), {
              min: 0,
              max: 3,
            }),
            incomeRange: faker.helpers.arrayElements(
              Object.values(IncomeRange),
              {
                min: 1,
                max: 3,
              },
            ),
          },
        });
      }

      // Create geographic targeting (90%)
      if (faker.datatype.boolean(0.9)) {
        await this.prisma.geographicTargeting.create({
          data: {
            campaignId: campaign.id,
            countries: faker.helpers.arrayElements(
              ['IN', 'US', 'UK', 'CA', 'AU'],
              {
                min: 1,
                max: 3,
              },
            ),
            states: faker.helpers.arrayElements(
              ['MAHARASHTRA', 'DELHI', 'KARNATAKA', 'TAMIL_NADU', 'GUJARAT'],
              {
                min: 0,
                max: 3,
              },
            ),
            cities: faker.helpers.arrayElements(
              ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune'],
              {
                min: 0,
                max: 4,
              },
            ),
            postalCodes: faker.datatype.boolean(0.3)
              ? Array.from(
                  { length: faker.number.int({ min: 1, max: 5 }) },
                  () => faker.location.zipCode(),
                )
              : [],
            radius: faker.datatype.boolean(0.2)
              ? faker.number.int({ min: 5, max: 50 })
              : null,
            isInclude: faker.datatype.boolean(0.9), // 90% include, 10% exclude
          },
        });
      }

      // Create device targeting (70%)
      if (faker.datatype.boolean(0.7)) {
        await this.prisma.deviceTargeting.create({
          data: {
            campaignId: campaign.id,
            deviceTypes: faker.helpers.arrayElements(
              Object.values(DeviceType),
              {
                min: 1,
                max: 3,
              },
            ),
            operatingSystems: faker.helpers.arrayElements(
              Object.values(OperatingSystem),
              {
                min: 0,
                max: 4,
              },
            ),
            browsers: faker.helpers.arrayElements(Object.values(BrowserType), {
              min: 0,
              max: 3,
            }),
            connectionTypes: faker.helpers.arrayElements(
              Object.values(ConnectionType),
              {
                min: 0,
                max: 2,
              },
            ),
            minOSVersion: faker.datatype.boolean(0.2)
              ? faker.system.semver()
              : null,
            maxOSVersion: faker.datatype.boolean(0.2)
              ? faker.system.semver()
              : null,
            deviceModels: faker.datatype.boolean(0.3)
              ? faker.helpers.arrayElements(
                  ['iPhone', 'Samsung Galaxy', 'OnePlus', 'Pixel'],
                  {
                    min: 1,
                    max: 2,
                  },
                )
              : [],
            isInclude: faker.datatype.boolean(0.85),
          },
        });
      }

      // Create contextual targeting (60%)
      if (faker.datatype.boolean(0.6)) {
        await this.prisma.contextualTargeting.create({
          data: {
            campaignId: campaign.id,
            contentCategories: faker.helpers.arrayElements(
              Object.values(BusinessCategory),
              {
                min: 1,
                max: 4,
              },
            ),
            keywords: faker.helpers.arrayElements(
              [
                'technology',
                'business',
                'finance',
                'health',
                'sports',
                'entertainment',
                'travel',
                'education',
                'food',
                'fashion',
              ],
              {
                min: 2,
                max: 6,
              },
            ),
            urlPatterns: faker.datatype.boolean(0.2)
              ? [`*${faker.internet.domainName()}*`, `*${faker.word.noun()}*`]
              : [],
            pageTypes: faker.helpers.arrayElements(Object.values(PageType), {
              min: 0,
              max: 3,
            }),
            brandSafety: faker.helpers.arrayElements(
              Object.values(BrandSafety),
              {
                min: 1,
                max: 2,
              },
            ),
            blockedKeywords: faker.datatype.boolean(0.3)
              ? faker.helpers.arrayElements(['adult', 'violence', 'gambling'], {
                  min: 1,
                  max: 3,
                })
              : [],
            isInclude: faker.datatype.boolean(0.9),
          },
        });
      }

      // Create behavioral targeting (50%)
      if (faker.datatype.boolean(0.5)) {
        await this.prisma.behavioralTargeting.create({
          data: {
            campaignId: campaign.id,
            interests: faker.helpers.arrayElements(
              Object.values(CampaignInterest),
              {
                min: 2,
                max: 5,
              },
            ),
            purchaseIntent: faker.helpers.arrayElements(
              Object.values(PurchaseIntent),
              {
                min: 0,
                max: 3,
              },
            ),
            lifestyleSegments: faker.helpers.arrayElements(
              Object.values(LifestyleSegment),
              {
                min: 0,
                max: 4,
              },
            ),
            audienceTypes: faker.helpers.arrayElements(
              Object.values(AudienceType),
              {
                min: 1,
                max: 3,
              },
            ),
            userSegments: faker.helpers.arrayElements(
              Object.values(UserSegment),
              {
                min: 1,
                max: 3,
              },
            ),
            purchaseFrequency: faker.helpers.arrayElements(
              Object.values(PurchaseFrequency),
              {
                min: 0,
                max: 2,
              },
            ),
            sessionEngagement: faker.helpers.arrayElements(
              Object.values(SessionEngagement),
              {
                min: 0,
                max: 2,
              },
            ),
            avgOrderValue: faker.datatype.boolean(0.3)
              ? faker.number.float({ min: 10, max: 500, fractionDigits: 2 })
              : null,
            sessionDuration: faker.datatype.boolean(0.3)
              ? faker.number.int({ min: 1, max: 60 })
              : null,
            pageViews: faker.datatype.boolean(0.3)
              ? faker.number.int({ min: 1, max: 20 })
              : null,
            isInclude: faker.datatype.boolean(0.85),
          },
        });
      }

      // Create time targeting (40%)
      if (faker.datatype.boolean(0.4)) {
        await this.prisma.timeTargeting.create({
          data: {
            campaignId: campaign.id,
            timezone: faker.helpers.arrayElement([
              'Asia/Kolkata',
              'America/New_York',
              'Europe/London',
            ]),
            timeSlots: faker.helpers.arrayElements(Object.values(TimeSlot), {
              min: 1,
              max: 3,
            }),
            daysOfWeek: faker.helpers.arrayElements(Object.values(DayOfWeek), {
              min: 1,
              max: 7,
            }),
            holidayTypes: faker.helpers.arrayElements(
              Object.values(HolidayType),
              {
                min: 0,
                max: 2,
              },
            ),
            startHour: faker.datatype.boolean(0.3)
              ? faker.number.int({ min: 6, max: 10 })
              : null,
            endHour: faker.datatype.boolean(0.3)
              ? faker.number.int({ min: 18, max: 23 })
              : null,
            includeHolidays: faker.datatype.boolean(0.7),
            workingDaysOnly: faker.datatype.boolean(0.2),
          },
        });
      }

      // Create frequency targeting (30%)
      if (faker.datatype.boolean(0.3)) {
        await this.prisma.frequencyTargeting.create({
          data: {
            campaignId: campaign.id,
            maxImpressions: faker.number.int({ min: 3, max: 15 }),
            frequencyWindow: faker.helpers.arrayElement(
              Object.values(FrequencyWindow),
            ),
            frequencyScope: faker.helpers.arrayElement(
              Object.values(FrequencyScope),
            ),
            maxClicksPerUser: faker.datatype.boolean(0.3)
              ? faker.number.int({ min: 1, max: 5 })
              : null,
            minTimeBetween: faker.datatype.boolean(0.3)
              ? faker.number.int({ min: 30, max: 480 })
              : null,
            customTimeWindowHours: faker.datatype.boolean(0.2)
              ? faker.number.int({ min: 1, max: 168 })
              : null,
          },
        });
      }
    }
  }

  private async seedInventoryTargeting(
    inventories: { id: string; name: string }[],
  ): Promise<void> {
    // Create targeting rules for a subset of inventories (60%)
    const selectedInventories = faker.helpers.arrayElements(inventories, {
      min: Math.floor(inventories.length * 0.4),
      max: Math.floor(inventories.length * 0.8),
    });

    for (const inventory of selectedInventories) {
      // Publishers might set demographic preferences (40%)
      if (faker.datatype.boolean(0.4)) {
        await this.prisma.demographicTargeting.create({
          data: {
            inventoryId: inventory.id,
            ageMin: faker.number.int({ min: 18, max: 25 }),
            ageMax: faker.number.int({ min: 45, max: 65 }),
            genders: faker.helpers.arrayElements(Object.values(Gender), {
              min: 1,
              max: 2,
            }),
            languages: [Language.ENGLISH], // Most inventory targeting English
            incomeRange: faker.helpers.arrayElements(
              Object.values(IncomeRange),
              {
                min: 1,
                max: 2,
              },
            ),
          },
        });
      }

      // Geographic restrictions (30%)
      if (faker.datatype.boolean(0.3)) {
        await this.prisma.geographicTargeting.create({
          data: {
            inventoryId: inventory.id,
            countries: faker.helpers.arrayElements(['IN', 'US'], {
              min: 1,
              max: 2,
            }),
            states: faker.datatype.boolean(0.5)
              ? ['MAHARASHTRA', 'DELHI', 'KARNATAKA']
              : [],
            isInclude: true,
          },
        });
      }

      // Device preferences (50%)
      if (faker.datatype.boolean(0.5)) {
        await this.prisma.deviceTargeting.create({
          data: {
            inventoryId: inventory.id,
            deviceTypes: faker.helpers.arrayElements(
              Object.values(DeviceType),
              {
                min: 1,
                max: 2,
              },
            ),
            browsers: faker.helpers.arrayElements(
              [BrowserType.CHROME, BrowserType.SAFARI, BrowserType.FIREFOX],
              {
                min: 1,
                max: 3,
              },
            ),
            isInclude: true,
          },
        });
      }

      // Content safety requirements (80%)
      if (faker.datatype.boolean(0.8)) {
        await this.prisma.contextualTargeting.create({
          data: {
            inventoryId: inventory.id,
            brandSafety: [BrandSafety.SAFE],
            blockedKeywords: [
              'adult',
              'gambling',
              'violence',
              'drugs',
              'alcohol',
            ],
            isInclude: false, // These are exclusions
          },
        });
      }

      // Time restrictions for some inventory (20%)
      if (faker.datatype.boolean(0.2)) {
        await this.prisma.timeTargeting.create({
          data: {
            inventoryId: inventory.id,
            daysOfWeek: [
              DayOfWeek.MONDAY,
              DayOfWeek.TUESDAY,
              DayOfWeek.WEDNESDAY,
              DayOfWeek.THURSDAY,
              DayOfWeek.FRIDAY,
            ],
            startHour: 9,
            endHour: 18,
            workingDaysOnly: true,
          },
        });
      }

      // Frequency caps (40%)
      if (faker.datatype.boolean(0.4)) {
        await this.prisma.frequencyTargeting.create({
          data: {
            inventoryId: inventory.id,
            maxImpressions: faker.number.int({ min: 5, max: 20 }),
            frequencyWindow: FrequencyWindow.DAILY,
            frequencyScope: FrequencyScope.PLACEMENT,
            minTimeBetween: faker.number.int({ min: 60, max: 300 }), // 1-5 minutes
          },
        });
      }
    }
  }

  private async seedTestTargetingRules(): Promise<void> {
    // Find test campaign and inventory
    const testCampaign = await this.prisma.campaign.findFirst({
      where: { name: 'Test Campaign' },
    });

    const testInventory = await this.prisma.adInventory.findFirst({
      where: { name: 'Test Banner 300x250' },
    });

    if (testCampaign) {
      // Comprehensive test campaign targeting
      await this.prisma.demographicTargeting.create({
        data: {
          campaignId: testCampaign.id,
          ageMin: 25,
          ageMax: 45,
          genders: [Gender.MALE, Gender.FEMALE],
          languages: [Language.ENGLISH, Language.HINDI],
          education: [Education.BACHELOR, Education.MASTER],
          incomeRange: [
            IncomeRange.RANGE_50K_100K,
            IncomeRange.RANGE_100K_200K,
          ],
        },
      });

      await this.prisma.geographicTargeting.create({
        data: {
          campaignId: testCampaign.id,
          countries: ['IN', 'US'],
          states: ['MAHARASHTRA', 'DELHI', 'KARNATAKA'],
          cities: ['Mumbai', 'Delhi', 'Bangalore'],
          isInclude: true,
        },
      });

      await this.prisma.deviceTargeting.create({
        data: {
          campaignId: testCampaign.id,
          deviceTypes: [DeviceType.MOBILE, DeviceType.DESKTOP],
          operatingSystems: [
            OperatingSystem.ANDROID,
            OperatingSystem.IOS,
            OperatingSystem.WINDOWS,
          ],
          browsers: [BrowserType.CHROME, BrowserType.SAFARI],
          isInclude: true,
        },
      });

      await this.prisma.behavioralTargeting.create({
        data: {
          campaignId: testCampaign.id,
          interests: [
            CampaignInterest.TECHNOLOGY,
            CampaignInterest.BUSINESS_AND_FINANCE,
          ],
          purchaseIntent: [PurchaseIntent.HIGH, PurchaseIntent.MEDIUM],
          userSegments: [
            UserSegment.NEW_VISITORS,
            UserSegment.RETURNING_VISITORS,
          ],
          isInclude: true,
        },
      });
    }

    if (testInventory) {
      // Test inventory targeting rules
      await this.prisma.contextualTargeting.create({
        data: {
          inventoryId: testInventory.id,
          brandSafety: [BrandSafety.SAFE],
          contentCategories: [
            BusinessCategory.TECHNOLOGY,
            BusinessCategory.BUSINESS_SERVICES,
          ],
          blockedKeywords: ['adult', 'gambling'],
          isInclude: false,
        },
      });

      await this.prisma.frequencyTargeting.create({
        data: {
          inventoryId: testInventory.id,
          maxImpressions: 5,
          frequencyWindow: FrequencyWindow.DAILY,
          frequencyScope: FrequencyScope.PLACEMENT,
          minTimeBetween: 120, // 2 minutes
        },
      });
    }
  }

  private async getTargetingStats(): Promise<any> {
    const [
      demographicCount,
      geographicCount,
      deviceCount,
      contextualCount,
      behavioralCount,
      timeCount,
      frequencyCount,
    ] = await Promise.all([
      this.prisma.demographicTargeting.count(),
      this.prisma.geographicTargeting.count(),
      this.prisma.deviceTargeting.count(),
      this.prisma.contextualTargeting.count(),
      this.prisma.behavioralTargeting.count(),
      this.prisma.timeTargeting.count(),
      this.prisma.frequencyTargeting.count(),
    ]);

    return {
      demographic: demographicCount,
      geographic: geographicCount,
      device: deviceCount,
      contextual: contextualCount,
      behavioral: behavioralCount,
      time: timeCount,
      frequency: frequencyCount,
      total:
        demographicCount +
        geographicCount +
        deviceCount +
        contextualCount +
        behavioralCount +
        timeCount +
        frequencyCount,
    };
  }

  async clean(): Promise<void> {
    this.logger.debug('Cleaning targeting rules...');

    try {
      await Promise.all([
        this.prisma.demographicTargeting.deleteMany({}),
        this.prisma.geographicTargeting.deleteMany({}),
        this.prisma.deviceTargeting.deleteMany({}),
        this.prisma.contextualTargeting.deleteMany({}),
        this.prisma.behavioralTargeting.deleteMany({}),
        this.prisma.timeTargeting.deleteMany({}),
        this.prisma.frequencyTargeting.deleteMany({}),
      ]);

      this.logger.debug('All targeting rules cleaned successfully');
    } catch (error) {
      this.logger.error('Error cleaning targeting rules');
      this.logger.error(error);
      throw error;
    }
  }

  async isSeeded(): Promise<boolean> {
    const counts = await Promise.all([
      this.prisma.demographicTargeting.count(),
      this.prisma.geographicTargeting.count(),
      this.prisma.deviceTargeting.count(),
      this.prisma.contextualTargeting.count(),
      this.prisma.behavioralTargeting.count(),
      this.prisma.timeTargeting.count(),
      this.prisma.frequencyTargeting.count(),
    ]);

    return counts.some((count) => count > 0);
  }
}
