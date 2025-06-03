// import { Injectable, Logger } from '@nestjs/common';
// import { faker } from '@faker-js/faker';
// import { PrismaService } from 'src/prisma/prisma.service';
// import { ISeeder } from '../interfaces/seeder.interface';

// @Injectable()
// export class CampaignInventorySeeder implements ISeeder {
//   private readonly logger = new Logger(CampaignInventorySeeder.name);

//   constructor(private readonly prisma: PrismaService) {}

//   getModuleName(): string {
//     return 'CampaignInventory';
//   }

//   getDependencies(): string[] {
//     // Depends on Campaign and AdInventory
//     return ['Campaign', 'AdInventory'];
//   }

//   async seed(): Promise<void> {
//     this.logger.log('Seeding campaign inventory relationships...');

//     try {
//       // Get all campaigns
//       const campaigns = await this.prisma.campaign.findMany({
//         select: { id: true },
//       });

//       if (campaigns.length === 0) {
//         throw new Error('No campaigns found. Please seed campaigns first.');
//       }

//       // Get all inventories
//       const inventories = await this.prisma.adInventory.findMany({
//         where: { isActive: true },
//         select: { id: true },
//       });

//       if (inventories.length === 0) {
//         throw new Error(
//           'No active ad inventory found. Please seed ad inventory first.',
//         );
//       }

//       // Link campaigns to inventories
//       for (const campaign of campaigns) {
//         // Determine how many inventory slots this campaign will target (2-5)
//         const inventoryCount = faker.number.int({ min: 2, max: 5 });

//         // Get random inventory slots
//         const selectedInventories = faker.helpers.arrayElements(inventories, {
//           min: inventoryCount,
//           max: inventoryCount,
//         });

//         // Create campaign-inventory relationships
//         for (const inventory of selectedInventories) {
//           const exist = await this.prisma.campaignInventory.findFirst({
//             where: {
//               campaignId: campaign.id,
//               inventoryId: inventory.id,
//             },
//             select: { campaignId: true, inventoryId: true },
//           });
//           if (exist) continue;
//           await this.prisma.campaignInventory.create({
//             data: {
//               campaignId: campaign.id,
//               inventoryId: inventory.id,
//               maxBid: faker.number.float({
//                 min: 0.5,
//                 max: 10.0,
//               }),
//             },
//           });
//         }
//       }

//       // Create relationship for test campaign and test inventory
//       const testCampaign = await this.prisma.campaign.findFirst({
//         where: { name: 'Test Campaign' },
//       });

//       const testInventory = await this.prisma.adInventory.findFirst({
//         where: { name: 'Test Banner 300x250' },
//       });

//       if (testCampaign && testInventory) {
//         await this.prisma.campaignInventory.create({
//           data: {
//             campaignId: testCampaign.id,
//             inventoryId: testInventory.id,
//             maxBid: 2.5,
//           },
//         });
//       }

//       const relationshipCount = await this.prisma.campaignInventory.count();
//       this.logger.log(
//         `Successfully seeded ${relationshipCount} campaign-inventory relationships`,
//       );
//     } catch (error) {
//       this.logger.error('Error seeding campaign inventory relationships');
//       this.logger.error(error);
//       throw error;
//     }
//   }

//   async clean(): Promise<void> {
//     this.logger.log('Cleaning campaign inventory relationships...');

//     try {
//       const deleted = await this.prisma.campaignInventory.deleteMany({});
//       this.logger.log(
//         `Deleted ${deleted.count} campaign-inventory relationships`,
//       );
//     } catch (error) {
//       this.logger.error('Error cleaning campaign inventory relationships');
//       this.logger.error(error);
//       throw error;
//     }
//   }

//   async isSeeded(): Promise<boolean> {
//     const count = await this.prisma.campaignInventory.count();
//     return count > 0;
//   }
// }
