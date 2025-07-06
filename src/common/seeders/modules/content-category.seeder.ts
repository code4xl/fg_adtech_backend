import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ISeeder } from '../interfaces/seeder.interface';

@Injectable()
export class ContentCategorySeeder implements ISeeder {
  private readonly logger = new Logger(ContentCategorySeeder.name);

  constructor(private readonly prisma: PrismaService) {}

  getModuleName(): string {
    return 'ContentCategory';
  }

  getDependencies(): string[] {
    // No dependencies
    return [];
  }

  async seed(): Promise<void> {
    this.logger.debug('Seeding content categories...');

    try {
      const categories = [
        {
          name: 'Technology',
          description: 'Technology, software, hardware, and tech news',
        },
        {
          name: 'Finance',
          description: 'Finance, banking, investments, and economic news',
        },
        {
          name: 'Sports',
          description: 'Sports news, events, and athletic content',
        },
        {
          name: 'Entertainment',
          description: 'Movies, TV shows, music, and celebrity news',
        },
        {
          name: 'Health',
          description: 'Health, fitness, wellness, and medical content',
        },
        {
          name: 'Travel',
          description: 'Travel guides, destinations, and tourism',
        },
        {
          name: 'Food',
          description: 'Food, recipes, restaurants, and culinary content',
        },
        {
          name: 'Fashion',
          description: 'Fashion, style, beauty, and lifestyle trends',
        },
        {
          name: 'Education',
          description: 'Educational content, courses, and learning resources',
        },
        {
          name: 'Business',
          description: 'Business news, entrepreneurship, and corporate content',
        },
        {
          name: 'Gaming',
          description: 'Video games, esports, and gaming content',
        },
        {
          name: 'News',
          description: 'General news, current events, and journalism',
        },
        {
          name: 'Automotive',
          description: 'Cars, vehicles, and automotive industry news',
        },
        {
          name: 'Real Estate',
          description: 'Property, housing market, and real estate content',
        },
        {
          name: 'Parenting',
          description: 'Family, children, parenting tips and advice',
        },
      ];

      for (const category of categories) {
        await this.prisma.contentCategory.create({
          data: category,
        });
      }

      const categoryCount = await this.prisma.contentCategory.count();
      this.logger.debug(
        `Successfully seeded ${categoryCount} content categories`,
      );
    } catch (error) {
      this.logger.error('Error seeding content categories');
      this.logger.error(error);
      throw error;
    }
  }

  async clean(): Promise<void> {
    this.logger.debug('Cleaning content categories table...');

    try {
      const deleted = await this.prisma.contentCategory.deleteMany({});
      this.logger.debug(`Deleted ${deleted.count} content categories`);
    } catch (error) {
      this.logger.error('Error cleaning content categories table');
      this.logger.error(error);
      throw error;
    }
  }

  async isSeeded(): Promise<boolean> {
    const count = await this.prisma.contentCategory.count();
    return count > 0;
  }
}
