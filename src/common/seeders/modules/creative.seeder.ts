import { Injectable, Logger } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import { CreativeStatus, CreativeType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ISeeder } from '../interfaces/seeder.interface';

@Injectable()
export class CreativeSeeder implements ISeeder {
  private readonly logger = new Logger(CreativeSeeder.name);

  constructor(private readonly prisma: PrismaService) { }

  getModuleName(): string {
    return 'Creative';
  }

  getDependencies(): string[] {
    // Depends on Campaign and AdSlotTemplate
    return ['Campaign', 'AdSlotTemplate'];
  }

  async seed(): Promise<void> {
    this.logger.log('Seeding creatives...');

    try {
      // Get all campaigns to assign creatives to
      const campaigns = await this.prisma.campaign.findMany({
        select: { id: true },
      });

      if (campaigns.length === 0) {
        throw new Error('No campaigns found. Please seed campaigns first.');
      }

      // Get all ad slot templates for creative sizing
      const templates = await this.prisma.adSlotTemplate.findMany({
        select: {
          id: true,
          name: true,
          width: true,
          height: true,
          format: true,
        },
      });

      if (templates.length === 0) {
        throw new Error(
          'No ad slot templates found. Please seed ad slot templates first.',
        );
      }

      const creativeData: any = [];
      const creativeTypes = Object.values(CreativeType);
      const statuses = 'APPROVED';

      // Create creatives for campaigns
      for (const campaign of campaigns) {
        // Create 1-3 creatives per campaign
        const creativeCount = faker.number.int({ min: 2, max: 7 });

        for (let i = 0; i < creativeCount; i++) {
          // Select a random template that will determine dimensions and format
          const template = faker.helpers.arrayElement(templates);

          // Map template format to creative type (with some variation)
          let creativeType: CreativeType;

          switch (template.format) {
            case 'VIDEO':
              creativeType = CreativeType.VIDEO;
              break;
            case 'NATIVE':
              creativeType = faker.helpers.arrayElement([
                CreativeType.HTML,
                CreativeType.HTML5,
              ]);
              break;
            default:
              // For BANNER, INTERSTITIAL, REWARDED - use various types
              creativeType = faker.helpers.arrayElement([
                CreativeType.IMAGE,
                CreativeType.HTML,
                CreativeType.HTML5,
                CreativeType.RICH_MEDIA,
              ]);
          }

          const creative = {
            campaignId: campaign.id,
            templateId: template.id,
            name: `${faker.company.buzzPhrase()} ${creativeType} Creative`,
            type: creativeType,
            fileUrl: faker.helpers.arrayElement([
              'https://s3.ap-south-1.amazonaws.com/bucket.programmatic.oceanadnetwork/uploads/campaigns/updated-summer-sale-2025-eba5d4ec-5828-4db9-8b33-46796da2a239/creatives/ad-1.jpg',
              'https://s3.ap-south-1.amazonaws.com/bucket.programmatic.oceanadnetwork/uploads/campaigns/updated-summer-sale-2025-eba5d4ec-5828-4db9-8b33-46796da2a239/creatives/ad-2.webp',
              'https://s3.ap-south-1.amazonaws.com/bucket.programmatic.oceanadnetwork/uploads/campaigns/updated-summer-sale-2025-eba5d4ec-5828-4db9-8b33-46796da2a239/creatives/object-promise-1749052140905-jpg',
              'https://s3.ap-south-1.amazonaws.com/bucket.programmatic.oceanadnetwork/uploads/campaigns/updated-summer-sale-2025-eba5d4ec-5828-4db9-8b33-46796da2a239/creatives/Black+and+White+Bold+Modern+Simple+Geometric+New+Collection+Fashion+Mobile+Banner+Ad.png',
              'https://s3.ap-south-1.amazonaws.com/bucket.programmatic.oceanadnetwork/uploads/campaigns/updated-summer-sale-2025-eba5d4ec-5828-4db9-8b33-46796da2a239/creatives/burger.jpg',
              'https://s3.ap-south-1.amazonaws.com/bucket.programmatic.oceanadnetwork/uploads/campaigns/updated-summer-sale-2025-eba5d4ec-5828-4db9-8b33-46796da2a239/creatives/ad-9.jpg',
              'https://s3.ap-south-1.amazonaws.com/bucket.programmatic.oceanadnetwork/uploads/campaigns/updated-summer-sale-2025-eba5d4ec-5828-4db9-8b33-46796da2a239/creatives/ad-10.webp',
              'https://s3.ap-south-1.amazonaws.com/bucket.programmatic.oceanadnetwork/uploads/campaigns/updated-summer-sale-2025-eba5d4ec-5828-4db9-8b33-46796da2a239/creatives/ad-5.jpg',
              'https://s3.ap-south-1.amazonaws.com/bucket.programmatic.oceanadnetwork/uploads/campaigns/updated-summer-sale-2025-eba5d4ec-5828-4db9-8b33-46796da2a239/creatives/ad-6.png',
              'https://s3.ap-south-1.amazonaws.com/bucket.programmatic.oceanadnetwork/uploads/campaigns/updated-summer-sale-2025-eba5d4ec-5828-4db9-8b33-46796da2a239/creatives/ad-7.jpg',
              'https://s3.ap-south-1.amazonaws.com/bucket.programmatic.oceanadnetwork/uploads/campaigns/updated-summer-sale-2025-eba5d4ec-5828-4db9-8b33-46796da2a239/creatives/ad-8.jpg',
              'https://s3.ap-south-1.amazonaws.com/bucket.programmatic.oceanadnetwork/uploads/campaigns/updated-summer-sale-2025-eba5d4ec-5828-4db9-8b33-46796da2a239/creatives/ad-15.jpeg',
              'https://s3.ap-south-1.amazonaws.com/bucket.programmatic.oceanadnetwork/uploads/campaigns/updated-summer-sale-2025-eba5d4ec-5828-4db9-8b33-46796da2a239/creatives/ad-14.jpg',
              'https://s3.ap-south-1.amazonaws.com/bucket.programmatic.oceanadnetwork/uploads/campaigns/updated-summer-sale-2025-eba5d4ec-5828-4db9-8b33-46796da2a239/creatives/ad-13.jpg',
              'https://s3.ap-south-1.amazonaws.com/bucket.programmatic.oceanadnetwork/uploads/campaigns/updated-summer-sale-2025-eba5d4ec-5828-4db9-8b33-46796da2a239/creatives/ad-12.webp',
              'https://s3.ap-south-1.amazonaws.com/bucket.programmatic.oceanadnetwork/uploads/campaigns/updated-summer-sale-2025-eba5d4ec-5828-4db9-8b33-46796da2a239/creatives/ad-11.jpg',
            ]),
            s3Key: this.generateS3Key(creativeType, template),
            landingUrl: faker.internet.url(),
            status: CreativeStatus.APPROVED, // All creatives are approved for simplicity
            contentSafetyThreshold: faker.number.float({
              min: 0.1,
              max: 0.9,
              fractionDigits: 2,
            }),
            reviewNotes: faker.datatype.boolean(0.3)
              ? faker.lorem.sentence()
              : null, // 30% chance of having review notes
            createdAt: faker.date.past(),
            updatedAt: faker.date.recent(),
          };

          creativeData.push(creative);
        }
      }

      // Create a special test creative for the default campaign
      const testCampaign = await this.prisma.campaign.findFirst({
        where: { name: 'Test Campaign' },
      });

      const testTemplate = await this.prisma.adSlotTemplate.findFirst({
        where: { name: 'Medium Rectangle' },
      });

      if (testCampaign && testTemplate) {
        creativeData.push({
          campaignId: testCampaign.id,
          templateId: testTemplate.id,
          name: 'Test Banner Creative',
          type: CreativeType.IMAGE,
          fileUrl:
            'https://s3.ap-south-1.amazonaws.com/bucket.programmatic.oceanadnetwork/uploads/campaigns/updated-summer-sale-2025-eba5d4ec-5828-4db9-8b33-46796da2a239/creatives/object-promise-1749052140905-jpg',
          s3Key: 'creatives/test/test-banner-300x250.jpg',
          landingUrl: 'https://example.com/landing',
          status: CreativeStatus.APPROVED,
          contentSafetyThreshold: 0.95,
          reviewNotes: 'Test creative - approved for development',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Insert all creatives
      await this.prisma.creative.createMany({
        data: creativeData,
        skipDuplicates: true,
      });

      const creativeCount = await this.prisma.creative.count();
      this.logger.log(`Successfully seeded ${creativeCount} creatives`);
    } catch (error) {
      this.logger.error('Error seeding creatives');
      this.logger.error(error);
      throw error;
    }
  }

  async clean(): Promise<void> {
    this.logger.log('Cleaning creatives table...');

    try {
      const deleted = await this.prisma.creative.deleteMany({});
      this.logger.log(`Deleted ${deleted.count} creatives`);
    } catch (error) {
      this.logger.error('Error cleaning creatives table');
      this.logger.error(error);
      throw error;
    }
  }

  async isSeeded(): Promise<boolean> {
    // Temporarily return false to allow adding more creatives for RTB testing
    return false;
    
    // Original logic (commented out):
    // const count = await this.prisma.creative.count();
    // return count > 0;
  }

  /**
   * Generate realistic creative URLs based on type and template
   */
  private generateCreativeUrl(type: CreativeType, template: any): string {
    const baseUrl = 'https://storage.oceanadtech.com/creatives';
    const timestamp = Date.now();
    const randomId = faker.string.alphanumeric(8);

    switch (type) {
      case CreativeType.IMAGE:
        return `${baseUrl}/images/${template.width}x${template.height}/img-${randomId}-${timestamp}.jpg`;
      case CreativeType.HTML:
        return `${baseUrl}/html/${template.width}x${template.height}/html-${randomId}-${timestamp}.html`;
      case CreativeType.HTML5:
        return `${baseUrl}/html5/${template.width}x${template.height}/html5-${randomId}-${timestamp}.zip`;
      case CreativeType.RICH_MEDIA:
        return `${baseUrl}/richmedia/${template.width}x${template.height}/rm-${randomId}-${timestamp}.zip`;
      case CreativeType.VIDEO:
        return `${baseUrl}/videos/${template.width}x${template.height}/video-${randomId}-${timestamp}.mp4`;
      default:
        return `${baseUrl}/misc/creative-${randomId}-${timestamp}.jpg`;
    }
  }

  /**
   * Generate S3 key for the creative file
   */
  private generateS3Key(type: CreativeType, template: any): string {
    const timestamp = Date.now();
    const randomId = faker.string.alphanumeric(8);
    const folder = type.toLowerCase();

    switch (type) {
      case CreativeType.IMAGE:
        return `creatives/${folder}/${template.width}x${template.height}/img-${randomId}-${timestamp}.jpg`;
      case CreativeType.HTML:
        return `creatives/${folder}/${template.width}x${template.height}/html-${randomId}-${timestamp}.html`;
      case CreativeType.HTML5:
        return `creatives/${folder}/${template.width}x${template.height}/html5-${randomId}-${timestamp}.zip`;
      case CreativeType.RICH_MEDIA:
        return `creatives/${folder}/${template.width}x${template.height}/rm-${randomId}-${timestamp}.zip`;
      case CreativeType.VIDEO:
        return `creatives/${folder}/${template.width}x${template.height}/video-${randomId}-${timestamp}.mp4`;
      default:
        return `creatives/misc/creative-${randomId}-${timestamp}.jpg`;
    }
  }
}
