import { Injectable, Logger } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import { PrismaService } from 'src/prisma/prisma.service';
import { ISeeder } from '../interfaces/seeder.interface';

@Injectable()
export class WebsiteSeeder implements ISeeder {
  private readonly logger = new Logger(WebsiteSeeder.name);

  constructor(private readonly prisma: PrismaService) {}

  getModuleName(): string {
    return 'Website';
  }

  getDependencies(): string[] {
    // Depends on Publisher and ContentCategory
    return ['Publisher', 'ContentCategory'];
  }

  async seed(count: number = 500): Promise<void> {
    this.logger.log(`Seeding ${count} websites...`);

    try {
      // Get all publishers to assign websites to
      const publishers = await this.prisma.publisher.findMany({
        select: { id: true },
      });

      if (publishers.length === 0) {
        throw new Error('No publishers found. Please seed publishers first.');
      }

      // Get all content categories
      const categories = await this.prisma.contentCategory.findMany({
        select: { id: true },
      });

      if (categories.length === 0) {
        throw new Error(
          'No content categories found. Please seed content categories first.',
        );
      }

      const websiteData: any = [];

      // Website name templates for realistic domains
      const websiteNames = [
        'TechBuzz',
        'NewsDaily',
        'SportsFan',
        'FoodieLife',
        'TravelGuide',
        'HealthHub',
        'FashionTrends',
        'GameZone',
        'BusinessToday',
        'AutoWorld',
        'MusicVibes',
        'MovieCritic',
        'FinanceWise',
        'EduCenter',
        'LifestyleMag',
      ];

      // Generate fake websites
      for (let i = 0; i < count; i++) {
        // Randomly assign to a publisher
        const publisher = faker.helpers.arrayElement(publishers);

        // Generate realistic domain and URL
        const siteName =
          faker.helpers.arrayElement(websiteNames) +
          faker.number.int({ min: 1, max: 999 });
        const domain = `${siteName.toLowerCase()}-${i}.${faker.helpers.arrayElement(['com', 'net', 'org', 'io', 'co'])}`;
        const url = `https://${domain}`;

        websiteData.push({
          publisherId: publisher.id,
          domain: domain,
          url: url,
          name: siteName,
          description: faker.lorem.sentences(2),
          isActive: true, // 85% chance of being active
          initScript: this.generateInitScript(domain),
          createdAt: faker.date.past(),
          updatedAt: faker.date.recent(),
        });
      }

      // Add a default test website
      const testPublisher = await this.prisma.publisher.findFirst({
        where: { email: 'publisher@example.com' },
      });

      if (testPublisher) {
        websiteData.push({
          publisherId: testPublisher.id,
          domain: 'testpublisher.com',
          url: 'https://testpublisher.com',
          name: 'Test Publisher Website',
          description: 'A test website for development and testing purposes',
          isActive: true,
          initScript: this.generateInitScript('testpublisher.com'),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Insert all websites first
      const createdWebsites = [];
      for (const data of websiteData) {
        try {
          const website = await this.prisma.website.create({ data });
          createdWebsites.push(website);
        } catch (error) {
          // Skip if domain/url already exists
          if (error.code === 'P2002') {
            this.logger.warn(
              `Website with domain ${data.domain} already exists, skipping...`,
            );
            continue;
          }
          throw error;
        }
      }

      // Then assign categories to websites using update
      for (const website of createdWebsites) {
        // Assign 1-3 random categories to each website
        const selectedCategories = faker.helpers.arrayElements(categories, {
          min: 1,
          max: 3,
        });

        try {
          // Connect website to categories
          await this.prisma.website.update({
            where: { id: website.id },
            data: {
              websiteCategories: {
                connect: selectedCategories.map((cat) => ({ id: cat.id })),
              },
            },
          });
        } catch (error) {
          this.logger.warn(
            `Failed to connect categories to website ${website.name}: ${error.message}`,
          );
        }
      }

      const websiteCount = await this.prisma.website.count();
      this.logger.log(`Successfully seeded ${websiteCount} websites`);
    } catch (error) {
      this.logger.error('Error seeding websites');
      this.logger.error(error);
      throw error;
    }
  }

  async clean(): Promise<void> {
    this.logger.log('Cleaning websites table...');

    try {
      // Clean related data first to avoid foreign key constraint issues
      await this.prisma.adInventory.deleteMany({});
      await this.prisma.bidRequest.deleteMany({});

      const deleted = await this.prisma.website.deleteMany({});
      this.logger.log(`Deleted ${deleted.count} websites`);
    } catch (error) {
      this.logger.error('Error cleaning websites table');
      this.logger.error(error);
      throw error;
    }
  }

  async isSeeded(): Promise<boolean> {
    const count = await this.prisma.website.count();
    return count > 0;
  }

  /**
   * Generate Ocean initialization script for a website
   */
  private generateInitScript(domain: string): string {
    const scriptId = faker.string.alphanumeric(16);
    return `<!-- Ocean AdTech Init Script for ${domain} -->
<script>
(function() {
    window.Ocean = window.Ocean || {};
    window.Ocean.config = {
        publisherId: '${faker.string.uuid()}',
        domain: '${domain}',
        scriptVersion: '1.0.0',
        endpoint: 'https://api.oceanadtech.com/v1/bid',
        timeout: 2000
    };
    
    var script = document.createElement('script');
    script.src = 'https://cdn.oceanadtech.com/js/ocean-sdk.min.js';
    script.async = true;
    script.id = 'ocean-sdk-${scriptId}';
    document.head.appendChild(script);
})();
</script>`;
  }
}
