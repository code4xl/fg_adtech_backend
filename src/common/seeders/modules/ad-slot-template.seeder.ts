import { Injectable, Logger } from '@nestjs/common';
import { InventoryFormat, InventoryPosition } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ISeeder } from '../interfaces/seeder.interface';

@Injectable()
export class AdSlotTemplateSeeder implements ISeeder {
  private readonly logger = new Logger(AdSlotTemplateSeeder.name);

  constructor(private readonly prisma: PrismaService) {}

  getModuleName(): string {
    return 'AdSlotTemplate';
  }

  getDependencies(): string[] {
    // No dependencies - this is foundational
    return [];
  }

  async seed(): Promise<void> {
    this.logger.log('Seeding ad slot templates...');

    try {
      const templates = [
        // Banner formats
        {
          name: 'Medium Rectangle',
          width: 300,
          height: 250,
          format: InventoryFormat.BANNER,
          position: InventoryPosition.ABOVE_FOLD,
        },
        {
          name: 'Leaderboard',
          width: 728,
          height: 90,
          format: InventoryFormat.BANNER,
          position: InventoryPosition.HEADER,
        },
        {
          name: 'Wide Skyscraper',
          width: 160,
          height: 600,
          format: InventoryFormat.BANNER,
          position: InventoryPosition.SIDEBAR,
        },
        {
          name: 'Mobile Banner',
          width: 320,
          height: 50,
          format: InventoryFormat.BANNER,
          position: InventoryPosition.HEADER,
        },
        {
          name: 'Large Rectangle',
          width: 336,
          height: 280,
          format: InventoryFormat.BANNER,
          position: InventoryPosition.ABOVE_FOLD,
        },
        {
          name: 'Large Leaderboard',
          width: 970,
          height: 90,
          format: InventoryFormat.BANNER,
          position: InventoryPosition.HEADER,
        },

        // Native formats
        {
          name: 'Native Content',
          width: 300,
          height: 250,
          format: InventoryFormat.NATIVE,
          position: InventoryPosition.IN_CONTENT,
        },
        {
          name: 'Native Feed',
          width: 400,
          height: 300,
          format: InventoryFormat.NATIVE,
          position: InventoryPosition.IN_CONTENT,
        },

        // Video formats
        {
          name: 'Video Player',
          width: 640,
          height: 360,
          format: InventoryFormat.VIDEO,
          position: InventoryPosition.ABOVE_FOLD,
        },
        {
          name: 'Mobile Video',
          width: 320,
          height: 180,
          format: InventoryFormat.VIDEO,
          position: InventoryPosition.ABOVE_FOLD,
        },

        // Interstitial formats
        {
          name: 'Mobile Interstitial',
          width: 320,
          height: 480,
          format: InventoryFormat.INTERSTITIAL,
          position: InventoryPosition.ABOVE_FOLD,
        },
        {
          name: 'Desktop Interstitial',
          width: 800,
          height: 600,
          format: InventoryFormat.INTERSTITIAL,
          position: InventoryPosition.ABOVE_FOLD,
        },

        // Rewarded formats
        {
          name: 'Rewarded Video',
          width: 320,
          height: 480,
          format: InventoryFormat.REWARDED,
          position: InventoryPosition.ABOVE_FOLD,
        },
      ];

      for (const template of templates) {
        await this.prisma.adSlotTemplate.create({
          data: template,
        });
      }

      const templateCount = await this.prisma.adSlotTemplate.count();
      this.logger.log(`Successfully seeded ${templateCount} ad slot templates`);
    } catch (error) {
      this.logger.error('Error seeding ad slot templates');
      this.logger.error(error);
      throw error;
    }
  }

  async clean(): Promise<void> {
    this.logger.log('Cleaning ad slot templates table...');

    try {
      const deleted = await this.prisma.adSlotTemplate.deleteMany({});
      this.logger.log(`Deleted ${deleted.count} ad slot templates`);
    } catch (error) {
      this.logger.error('Error cleaning ad slot templates table');
      this.logger.error(error);
      throw error;
    }
  }

  async isSeeded(): Promise<boolean> {
    const count = await this.prisma.adSlotTemplate.count();
    return count > 0;
  }
}
