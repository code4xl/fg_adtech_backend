// import { Injectable, Logger } from '@nestjs/common';
// import { faker } from '@faker-js/faker';
// import { CreativeStatus, CreativeType } from '@prisma/client';
// import { PrismaService } from 'src/prisma/prisma.service';
// import { ISeeder } from '../interfaces/seeder.interface';

// @Injectable()
// export class CreativeSeeder implements ISeeder {
//   private readonly logger = new Logger(CreativeSeeder.name);

//   constructor(private readonly prisma: PrismaService) {}

//   getModuleName(): string {
//     return 'Creative';
//   }

//   getDependencies(): string[] {
//     // Depends on Campaign and AdInventory
//     return ['Campaign', 'AdInventory'];
//   }

//   async seed(): Promise<void> {
//     this.logger.log('Seeding creatives...');

//     try {
//       // Get all campaigns to assign creatives to
//       const campaigns = await this.prisma.campaign.findMany({
//         select: { id: true },
//       });

//       if (campaigns.length === 0) {
//         throw new Error('No campaigns found. Please seed campaigns first.');
//       }

//       // Get all ad inventory to associate with creatives
//       const inventories = await this.prisma.adInventory.findMany({
//         select: { id: true, width: true, height: true },
//       });

//       if (inventories.length === 0) {
//         throw new Error(
//           'No ad inventory found. Please seed ad inventory first.',
//         );
//       }

//       const creativeData = [];
//       const creativeTypes = Object.values(CreativeType);
//       const statuses = Object.values(CreativeStatus);

//       // Associate creatives with campaigns
//       for (const campaign of campaigns) {
//         // Create 1-3 creatives per campaign
//         const creativeCount = faker.number.int({ min: 1, max: 3 });

//         for (let i = 0; i < creativeCount; i++) {
//           // Select a random inventory that will determine dimensions
//           const inventory = faker.helpers.arrayElement(inventories);

//           // Generate creative type (exclude VIDEO for simplicity unless explicitly testing video)
//           const nonVideoTypes = creativeTypes.filter(
//             (type) => type !== CreativeType.VIDEO,
//           );
//           const type = faker.helpers.arrayElement(nonVideoTypes);

//           // Create a creative
//           const creative = {
//             campaignId: campaign.id,
//             inventoryId: inventory.id,
//             name: `${faker.company.buzzPhrase()} ${type} Ad`,
//             type: type,
//             width: inventory.width,
//             height: inventory.height,
//             fileUrl: this.generateCreativeUrl(
//               type,
//               inventory.width,
//               inventory.height,
//             ),
//             landingUrl: faker.internet.url(),
//             status: faker.helpers.arrayElement(statuses),
//             reviewNotes: faker.datatype.boolean(0.3)
//               ? faker.lorem.sentence()
//               : null, // 30% chance of having review notes
//           };

//           await this.prisma.creative.create({
//             data: creative,
//           });
//         }
//       }

//       // Create a special test creative for the default campaign
//       const testCampaign = await this.prisma.campaign.findFirst({
//         where: { name: 'Test Campaign' },
//       });

//       if (testCampaign) {
//         const testInventory = await this.prisma.adInventory.findFirst({
//           where: { name: 'Test Banner 300x250' },
//         });

//         if (testInventory) {
//           await this.prisma.creative.create({
//             data: {
//               campaignId: testCampaign.id,
//               inventoryId: testInventory.id,
//               name: 'Test Banner Creative',
//               type: CreativeType.IMAGE,
//               width: testInventory.width,
//               height: testInventory.height,
//               fileUrl: 'https://example.com/test-creative.jpg',
//               landingUrl: 'https://example.com/landing',
//               status: CreativeStatus.APPROVED,
//             },
//           });
//         }
//       }

//       const creativeCount = await this.prisma.creative.count();
//       this.logger.log(`Successfully seeded ${creativeCount} creatives`);
//     } catch (error) {
//       this.logger.error('Error seeding creatives');
//       this.logger.error(error);
//       throw error;
//     }
//   }

//   async clean(): Promise<void> {
//     this.logger.log('Cleaning creatives table...');

//     try {
//       const deleted = await this.prisma.creative.deleteMany({});
//       this.logger.log(`Deleted ${deleted.count} creatives`);
//     } catch (error) {
//       this.logger.error('Error cleaning creatives table');
//       this.logger.error(error);
//       throw error;
//     }
//   }

//   async isSeeded(): Promise<boolean> {
//     const count = await this.prisma.creative.count();
//     return count > 0;
//   }

//   // Helper method to generate realistic creative URLs based on type and size
//   private generateCreativeUrl(
//     type: CreativeType,
//     width: number,
//     height: number,
//   ): string {
//     const baseUrl = 'https://storage.example.com/creatives';

//     switch (type) {
//       case CreativeType.IMAGE:
//         return `${baseUrl}/image-${width}x${height}-${faker.string.uuid().substring(0, 8)}.jpg`;
//       case CreativeType.HTML:
//         return `${baseUrl}/html-${width}x${height}-${faker.string.uuid().substring(0, 8)}.html`;
//       case CreativeType.HTML5:
//         return `${baseUrl}/html5-${width}x${height}-${faker.string.uuid().substring(0, 8)}.zip`;
//       case CreativeType.RICH_MEDIA:
//         return `${baseUrl}/rich-${width}x${height}-${faker.string.uuid().substring(0, 8)}.zip`;
//       case CreativeType.VIDEO:
//         return `${baseUrl}/video-${width}x${height}-${faker.string.uuid().substring(0, 8)}.mp4`;
//       default:
//         return `${baseUrl}/creative-${width}x${height}-${faker.string.uuid().substring(0, 8)}.jpg`;
//     }
//   }
// }
