import { Injectable, Logger } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import { ApprovalStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ISeeder } from '../interfaces/seeder.interface';

@Injectable()
export class AdInventorySeeder implements ISeeder {
  private readonly logger = new Logger(AdInventorySeeder.name);

  constructor(private readonly prisma: PrismaService) {}

  getModuleName(): string {
    return 'AdInventory';
  }

  getDependencies(): string[] {
    // Depends on Publisher, Website, and AdSlotTemplate
    return ['Publisher', 'Website', 'AdSlotTemplate'];
  }

  async seed(count: number = 40): Promise<void> {
    this.logger.log(`Seeding ${count} ad inventory slots...`);

    try {
      // Get all required entities
      const publishers = await this.prisma.publisher.findMany({
        select: { id: true },
      });

      const websites = await this.prisma.website.findMany({
        select: { id: true, publisherId: true, domain: true },
        where: { isActive: true },
      });

      const templates = await this.prisma.adSlotTemplate.findMany({
        select: {
          id: true,
          name: true,
          width: true,
          height: true,
          format: true,
        },
      });

      if (publishers.length === 0) {
        throw new Error('No publishers found. Please seed publishers first.');
      }

      if (websites.length === 0) {
        throw new Error(
          'No active websites found. Please seed websites first.',
        );
      }

      if (templates.length === 0) {
        throw new Error(
          'No ad slot templates found. Please seed ad slot templates first.',
        );
      }

      const inventoryData: any = [];

      // Generate fake ad inventory
      for (let i = 0; i < count; i++) {
        // Select a random website
        const website = faker.helpers.arrayElement(websites);

        // Select a random template
        const template = faker.helpers.arrayElement(templates);

        // Generate inventory name
        const inventoryName = `${template.name} - ${website.domain} - ${faker.word.adjective()}`;

        inventoryData.push({
          publisherId: website.publisherId,
          websiteId: website.id,
          name: inventoryName,
          isActive: faker.datatype.boolean(0.8), // 80% chance of being active
          adSlotTemplateId: template.id,
          viewabilityScore: faker.number.float({
            min: 0.4,
            max: 0.95,
            fractionDigits: 2,
          }),
          approvalStatus: faker.helpers.arrayElement(
            Object.values(ApprovalStatus),
          ),
          adSlotScript: this.generateAdSlotScript(template, website.domain),
          createdAt: faker.date.past(),
          updatedAt: faker.date.recent(),
        });
      }

      // Add a default test inventory
      const testPublisher = await this.prisma.publisher.findFirst({
        where: { email: 'publisher@example.com' },
      });

      const testWebsite = await this.prisma.website.findFirst({
        where: { domain: 'testpublisher.com' },
      });

      const testTemplate = await this.prisma.adSlotTemplate.findFirst({
        where: { name: 'Medium Rectangle' },
      });

      if (testPublisher && testWebsite && testTemplate) {
        inventoryData.push({
          publisherId: testPublisher.id,
          websiteId: testWebsite.id,
          name: 'Test Banner 300x250',
          isActive: true,
          adSlotTemplateId: testTemplate.id,
          viewabilityScore: 0.85,
          approvalStatus: ApprovalStatus.APPROVED,
          adSlotScript: this.generateAdSlotScript(
            testTemplate,
            'testpublisher.com',
          ),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Insert all inventory
      await this.prisma.adInventory.createMany({
        data: inventoryData,
        skipDuplicates: true,
      });

      const inventoryCount = await this.prisma.adInventory.count();
      this.logger.log(
        `Successfully seeded ${inventoryCount} ad inventory slots`,
      );
    } catch (error) {
      this.logger.error('Error seeding ad inventory');
      this.logger.error(error);
      throw error;
    }
  }

  async clean(): Promise<void> {
    this.logger.log('Cleaning ad inventory tables...');

    try {
      // Clean related tables first (respecting foreign key constraints)
      await this.prisma.floorPrice.deleteMany({});
      await this.prisma.demographicTargeting.deleteMany({});
      await this.prisma.geographicTargeting.deleteMany({});
      await this.prisma.deviceTargeting.deleteMany({});
      await this.prisma.contextualTargeting.deleteMany({});
      await this.prisma.behavioralTargeting.deleteMany({});
      await this.prisma.timeTargeting.deleteMany({});
      await this.prisma.frequencyTargeting.deleteMany({});
      await this.prisma.hourlyMetrics.deleteMany({});

      // Finally clean the main table
      const deleted = await this.prisma.adInventory.deleteMany({});
      this.logger.log(`Deleted ${deleted.count} ad inventory slots`);
    } catch (error) {
      this.logger.error('Error cleaning ad inventory tables');
      this.logger.error(error);
      throw error;
    }
  }

  async isSeeded(): Promise<boolean> {
    const count = await this.prisma.adInventory.count();
    return count > 0;
  }

  /**
   * Generate ad slot script for embedding on website
   */
  private generateAdSlotScript(template: any, domain: string): string {
    const slotId = faker.string.alphanumeric(12);
    return `<!-- Ocean AdSlot: ${template.name} -->
<div id="ocean-ad-${slotId}" 
     data-ad-slot="${slotId}"
     data-width="${template.width}"
     data-height="${template.height}"
     data-format="${template.format.toLowerCase()}"
     style="width: ${template.width}px; height: ${template.height}px; background: #f0f0f0; border: 1px dashed #ccc; text-align: center; line-height: ${template.height}px;">
    <!-- Ad will be loaded here -->
</div>
<script>
Ocean.loadAd('${slotId}', {
    width: ${template.width},
    height: ${template.height},
    format: '${template.format.toLowerCase()}',
    domain: '${domain}'
});
</script>`;
  }
}
