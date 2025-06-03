// import { Injectable, Logger } from '@nestjs/common';
// import { PrismaService } from '../prisma/prisma.service';
// import { Cron, CronExpression } from '@nestjs/schedule';
// import { CampaignStatus } from '@prisma/client';
// import { CampaignNotificationService } from 'src/notification/services/campaign.notification.service';

// @Injectable()
// export class CampaignStatusService {
//   private readonly logger = new Logger(CampaignStatusService.name);

//   constructor(
//     private readonly prisma: PrismaService,
//     private readonly campaignNotificationService: CampaignNotificationService,
//   ) {}

//   /**
//    * Updates campaign statuses automatically
//    * Runs every 15 minutes
//    */
//   @Cron(CronExpression.EVERY_10_MINUTES)
//   async updateCampaignStatuses() {
//     this.logger.log('Updating campaign statuses...');

//     const now = new Date();

//     try {
//       // Activate scheduled campaigns that have reached their start date
//       await this.activateScheduledCampaigns(now);

//       // Complete active campaigns that have reached their end date
//       await this.completeEndedCampaigns(now);

//       // Check for budget exhaustion
//       await this.checkBudgetExhaustion();

//       this.logger.log('Campaign status update completed successfully');
//     } catch (error) {
//       this.logger.error('Error updating campaign statuses', error.stack);
//     }
//   }

//   /**
//    * Activates scheduled campaigns that have reached their start date
//    */
//   private async activateScheduledCampaigns(now: Date) {
//     const campaigns = await this.prisma.campaign.findMany({
//       where: {
//         status: CampaignStatus.SCHEDULED,
//         startDate: {
//           lte: now,
//         },
//       },
//       select: {
//         id: true,
//         name: true,
//         advertiserId: true,
//         clientId: true,
//         status: true,
//         startDate: true,
//         _count: {
//           select: {
//             creatives: true,
//           },
//         },
//       },
//     });

//     if (campaigns.length > 0) {
//       // Filter campaigns that have both inventory and creatives
//       const readyCampaigns = campaigns.filter(
//         (c) => c._count.campaignInventories > 0 && c._count.creatives > 0,
//       );

//       if (readyCampaigns.length > 0) {
//         this.logger.log(
//           `Activating ${readyCampaigns.length} scheduled campaigns`,
//         );

//         await this.prisma.campaign.updateMany({
//           where: {
//             id: {
//               in: readyCampaigns.map((c) => c.id),
//             },
//           },
//           data: {
//             status: CampaignStatus.ACTIVE,
//           },
//         });

//         // Send notifications for each activated campaign
//         for (const campaign of readyCampaigns) {
//           this.logger.log(
//             `Activated campaign: ${campaign.id} - ${campaign.name}`,
//           );
//           await this.campaignNotificationService.notifyCampaignActivated(
//             campaign,
//           );
//         }
//       }

//       // Log campaigns that couldn't be activated due to missing inventory or creatives
//       const notReadyCampaigns = campaigns.filter(
//         (c) => c._count.campaignInventories === 0 || c._count.creatives === 0,
//       );

//       if (notReadyCampaigns.length > 0) {
//         for (const campaign of notReadyCampaigns) {
//           this.logger.warn(
//             `Campaign ${campaign.id} - ${campaign.name} couldn't be activated: ` +
//               `${campaign._count.campaignInventories === 0 ? 'Missing inventory' : 'Missing creatives'}`,
//           );

//           // Send notification about activation failure
//           await this.campaignNotificationService.notifyCampaignActivationFailed(
//             campaign,
//           );
//         }
//       }
//     }
//   }

//   /**
//    * Completes active campaigns that have reached their end date
//    */
//   private async completeEndedCampaigns(now: Date) {
//     const campaigns = await this.prisma.campaign.findMany({
//       where: {
//         status: CampaignStatus.ACTIVE,
//         endDate: {
//           lte: now,
//         },
//       },
//       select: {
//         id: true,
//         name: true,
//         advertiserId: true,
//         clientId: true,
//         status: true,
//         startDate: true,
//         endDate: true,
//       },
//     });

//     if (campaigns.length > 0) {
//       this.logger.log(`Completing ${campaigns.length} ended campaigns`);

//       await this.prisma.campaign.updateMany({
//         where: {
//           id: {
//             in: campaigns.map((c) => c.id),
//           },
//         },
//         data: {
//           status: CampaignStatus.COMPLETED,
//         },
//       });

//       // Send notifications for each completed campaign
//       for (const campaign of campaigns) {
//         this.logger.log(
//           `Completed campaign: ${campaign.id} - ${campaign.name}`,
//         );
//         await this.campaignNotificationService.notifyCampaignCompleted(
//           campaign,
//         );
//       }
//     }
//   }

//   /**
//    * Checks for budget exhaustion and updates campaign status accordingly
//    */
//   private async checkBudgetExhaustion() {
//     // Find active campaigns
//     const activeCampaigns = await this.prisma.campaign.findMany({
//       where: {
//         status: CampaignStatus.ACTIVE,
//       },
//       select: {
//         id: true,
//         name: true,
//         budget: true,
//         advertiserId: true,
//         clientId: true,
//         startDate: true,
//         endDate: true,
//         statistics: {
//           select: {
//             spend: true,
//           },
//         },
//       },
//     });

//     const exhaustedCampaigns: any = [];

//     for (const campaign of activeCampaigns) {
//       // Calculate total spend
//       const totalSpend = campaign.statistics.reduce(
//         (sum, stat) => sum + Number(stat.spend),
//         0,
//       );

//       // Check if budget is exhausted (>= 99% spent)
//       if (totalSpend >= Number(campaign.budget) * 0.99) {
//         exhaustedCampaigns.push({
//           ...campaign,
//           totalSpend,
//         });
//         this.logger.log(
//           `Budget exhausted for campaign: ${campaign.id} - ${campaign.name}`,
//         );
//       }
//     }

//     if (exhaustedCampaigns.length > 0) {
//       this.logger.log(
//         `Updating ${exhaustedCampaigns.length} campaigns to BUDGET_EXHAUSTED status`,
//       );

//       // Update status in database
//       await this.prisma.campaign.updateMany({
//         where: {
//           id: {
//             in: exhaustedCampaigns.map((c) => c.id),
//           },
//         },
//         data: {
//           status: CampaignStatus.BUDGET_EXHAUSTED,
//         },
//       });

//       // Send notifications for each exhausted campaign
//       for (const campaign of exhaustedCampaigns) {
//         await this.campaignNotificationService.notifyCampaignBudgetExhausted(
//           campaign,
//         );
//       }
//     }
//   }

//   /**
//    * Daily statistics reset and aggregation
//    * Runs at midnight every day
//    */
//   @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
//   async aggregateDailyStatistics() {
//     this.logger.log('Aggregating daily campaign statistics...');

//     const yesterday = new Date();
//     yesterday.setDate(yesterday.getDate() - 1);
//     yesterday.setHours(0, 0, 0, 0);

//     try {
//       // Get active campaigns
//       const activeCampaigns = await this.prisma.campaign.findMany({
//         where: {
//           status: {
//             in: [CampaignStatus.ACTIVE, CampaignStatus.PAUSED],
//           },
//         },
//         select: {
//           id: true,
//         },
//       });

//       // For each campaign, aggregate impression and click data
//       for (const campaign of activeCampaigns) {
//         // In a real system, you would query your impression and click tracking system
//         // For this example, we'll create sample data

//         // Get actual impression and click counts from your tracking database
//         const [impressions, clicks, conversions, spend] =
//           await this.getCampaignMetrics(campaign.id, yesterday);

//         // Create or update statistics record
//         await this.prisma.campaignStatistics.upsert({
//           where: {
//             campaignId_date: {
//               campaignId: campaign.id,
//               date: yesterday,
//             },
//           },
//           update: {
//             impressions,
//             clicks,
//             conversions,
//             spend,
//             ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
//             cpc: clicks > 0 ? spend / clicks : 0,
//           },
//           create: {
//             campaignId: campaign.id,
//             date: yesterday,
//             impressions,
//             clicks,
//             conversions,
//             spend,
//             ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
//             cpc: clicks > 0 ? spend / clicks : 0,
//           },
//         });
//       }

//       this.logger.log('Daily statistics aggregation completed successfully');
//     } catch (error) {
//       this.logger.error('Error aggregating daily statistics', error.stack);
//     }
//   }

//   /**
//    * Gets campaign metrics for a specific day
//    * In a real system, this would query your impression and click tracking database
//    */
//   private async getCampaignMetrics(
//     campaignId: string,
//     date: Date,
//   ): Promise<[number, number, number, number]> {
//     try {
//       // In a real implementation, you would:
//       // 1. Query your impression tracking database for this campaign and date
//       // 2. Query your click tracking database for this campaign and date
//       // 3. Query your conversion tracking database
//       // 4. Calculate actual spend based on bids won

//       // For this example, we'll simulate with either:
//       // 1. Random data (for demonstration)
//       // 2. Query from Prisma for related impression/click data if available

//       // Option 1: Simulate with random data for testing
//       const impressions = Math.floor(Math.random() * 10000);
//       const clicks = Math.floor(impressions * (Math.random() * 0.1)); // Up to 10% CTR
//       const conversions = Math.floor(clicks * (Math.random() * 0.2)); // Up to 20% conversion rate
//       const spend = parseFloat((clicks * (Math.random() * 2 + 0.5)).toFixed(2)); // $0.50 to $2.50 per click

//       // Option 2: For a real implementation, you would query your tracking database:
//       /*
//             const [impressionData, clickData, conversionData] = await Promise.all([
//               this.prisma.impression.count({
//                 where: {
//                   campaignId,
//                   createdAt: {
//                     gte: startOfDay(date),
//                     lt: endOfDay(date)
//                   }
//                 }
//               }),
//               this.prisma.click.count({
//                 where: {
//                   impression: {
//                     campaignId
//                   },
//                   createdAt: {
//                     gte: startOfDay(date),
//                     lt: endOfDay(date)
//                   }
//                 }
//               }),
//               this.prisma.conversion.count({
//                 where: {
//                   campaignId,
//                   createdAt: {
//                     gte: startOfDay(date),
//                     lt: endOfDay(date)
//                   }
//                 }
//               })
//             ]);

//             // Calculate spend based on actual bid amounts won
//             const spend = await this.prisma.bidWin.sum({
//               where: {
//                 campaignId,
//                 createdAt: {
//                   gte: startOfDay(date),
//                   lt: endOfDay(date)
//                 }
//               },
//               _sum: {
//                 bidAmount: true
//               }
//             });
//             */

//       return [impressions, clicks, conversions, spend];
//     } catch (error) {
//       this.logger.error(
//         `Error getting metrics for campaign ${campaignId}`,
//         error,
//       );
//       return [0, 0, 0, 0]; // Return zeros if there's an error
//     }
//   }
// }
