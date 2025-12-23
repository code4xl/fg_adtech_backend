import { Injectable, Logger } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import { CreativeStatus, CreativeType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ISeeder } from '../interfaces/seeder.interface';

@Injectable()
export class CreativeCampaignSeeder implements ISeeder {
  private readonly logger = new Logger(CreativeCampaignSeeder.name);

  constructor(private readonly prisma: PrismaService) {}

  getModuleName(): string {
    return 'Creative';
  }

  getDependencies(): string[] {
    return ['Campaign', 'AdSlotTemplate'];
  }

  /**
   * SEED ONLY FOR SPECIFIC CAMPAIGN
   */
  async seed(): Promise<void> {
    this.logger.debug('Seeding creatives for specific campaign...');

    try {
      // 🔥 CHANGE THIS TO YOUR CAMPAIGN NAME
      const targetCampaignName = 'Test Campaign';

      // Fetch only the specific campaign
      const targetCampaign = await this.prisma.campaign.findFirst({
        where: { id: 'b9263e3b-edea-49c4-8496-ec6c49754941' },
        select: { id: true },
      });

      if (!targetCampaign) {
        throw new Error(
          `Campaign "${targetCampaignName}" not found. Please seed the campaign first.`,
        );
      }

      // Fetch all templates (still required)
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

      const creativeData: any[] = [];

      // 🔥 Create only creatives for ONE CAMPAIGN
      const creativeCount = faker.number.int({ min: 15, max: 25 });

      for (let i = 0; i < creativeCount; i++) {
        const template = faker.helpers.arrayElement(templates);

        // Map template format to creative type
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
            creativeType = faker.helpers.arrayElement([
              CreativeType.IMAGE,
              CreativeType.HTML,
              CreativeType.HTML5,
              CreativeType.RICH_MEDIA,
            ]);
        }

        creativeData.push({
          campaignId: targetCampaign.id,
          templateId: template.id,
          name: `${faker.company.buzzPhrase()} ${creativeType} Creative`,
          type: creativeType,
          fileUrl: faker.helpers.arrayElement([
            'https://s3.ap-south-1.amazonaws.com/bucket.programmatic.oceanadnetwork/uploads/campaigns/updated-summer-sale-2025/creatives/ad-1.jpg',
            'https://s3.ap-south-1.amazonaws.com/bucket.programmatic.oceanadnetwork/uploads/campaigns/updated-summer-sale-2025/creatives/ad-2.webp',
            'https://s3.ap-south-1.amazonaws.com/bucket.programmatic.oceanadnetwork/uploads/campaigns/updated-summer-sale-2025/creatives/ad-3.jpg',
          ]),
          s3Key: this.generateS3Key(creativeType, template),
          landingUrl: faker.internet.url(),
          status: CreativeStatus.APPROVED,
          contentSafetyThreshold: faker.number.float({
            min: 0.1,
            max: 0.9,
            fractionDigits: 2,
          }),
          reviewNotes: faker.datatype.boolean(0.3)
            ? faker.lorem.sentence()
            : null,
          createdAt: faker.date.past(),
          updatedAt: faker.date.recent(),
        });
      }

      // Insert creatives
      await this.prisma.creative.createMany({
        data: creativeData,
        skipDuplicates: true,
      });

      const totalCreatives = await this.prisma.creative.count();
      this.logger.debug(
        `Successfully seeded ${creativeData.length} creatives for campaign "${targetCampaignName}". Total creatives: ${totalCreatives}`,
      );
    } catch (error) {
      this.logger.error('Error seeding creatives (specific campaign)');
      this.logger.error(error);
      throw error;
    }
  }

  async clean(): Promise<void> {
    this.logger.debug('Cleaning creatives table...');

    try {
      const deleted = await this.prisma.creative.deleteMany({});
      this.logger.debug(`Deleted ${deleted.count} creatives`);
    } catch (error) {
      this.logger.error('Error cleaning creatives table');
      this.logger.error(error);
      throw error;
    }
  }

  async isSeeded(): Promise<boolean> {
    return false;
  }

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
