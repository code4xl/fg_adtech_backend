import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { kafkaTopics } from 'src/kafka/constants/kafka.config';
import { KafkaService } from 'src/kafka/kafka.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TrackingConsumerService implements OnModuleInit {
  private readonly logger = new Logger(TrackingConsumerService.name);
  private impressionBatch: any[] = [];
  private clickBatch: any[] = [];
  private readonly BATCH_SIZE = 100;
  private readonly FLUSH_INTERVAL = 5000; // 5 seconds
  private flushTimer: NodeJS.Timeout;

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.subscribeToTrackingEvents();
    // Set up periodic batch flushing
    this.flushTimer = setInterval(
      () => this.flushBatches(),
      this.FLUSH_INTERVAL,
    );
    this.logger.log('TrackingConsumerService initialized');
  }

  onModuleDestroy() {
    // Clean up timer when service is destroyed
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    // Flush any remaining events
    this.flushBatches();
  }

  async subscribeToTrackingEvents() {
    const topic = kafkaTopics.TRACKING_EVENTS;
    const groupId = 'rtb-tracking-consumer';

    try {
      this.logger.log(`Subscribing to topic ${topic} with group ID ${groupId}`);

      await this.kafkaService.subscribe(
        topic,
        groupId,
        async ({ key, value, topic, partition, offset }) => {
          this.logger.debug(
            `Received message from topic ${topic}: key=${key}, partition=${partition}, offset=${offset}`,
          );

          if (value.eventType === 'impression') {
            // Add to impression batch
            this.impressionBatch.push(value);
            if (this.impressionBatch.length >= this.BATCH_SIZE) {
              await this.processImpressionBatch([...this.impressionBatch]);
              this.impressionBatch = [];
            }
          } else if (value.eventType === 'click') {
            // Add to click batch
            this.clickBatch.push(value);
            if (this.clickBatch.length >= this.BATCH_SIZE) {
              await this.processClickBatch([...this.clickBatch]);
              this.clickBatch = [];
            }
          } else {
            this.logger.warn(
              `Unknown event type: ${value.eventType} in message: ${JSON.stringify(
                value,
              )}`,
            );
          }
        },
      );
    } catch (error) {
      this.logger.error(
        `Error subscribing to tracking events: ${error.message}`,
        error.stack,
      );
    }
    this.logger.log(`Subscribed to topic: ${topic} with groupId: ${groupId}`);
  }

  // Flush batches on interval
  private async flushBatches() {
    if (this.impressionBatch.length > 0) {
      const batch = [...this.impressionBatch];
      this.impressionBatch = [];
      await this.processImpressionBatch(batch);
    }

    if (this.clickBatch.length > 0) {
      const batch = [...this.clickBatch];
      this.clickBatch = [];
      await this.processClickBatch(batch);
    }
  }

  private async processImpressionBatch(batch: any[]) {
    try {
      this.logger.log(`Processing batch of ${batch.length} impressions`);

      // Create impression records
      await this.prisma.$transaction(async (tx) => {
        // Bulk insert impressions
        await tx.impressionTrack.createMany({
          data: batch.map((event) => ({
            creativeId: event.creativeId,
            campaignId: event.campaignId,
            inventoryId: event.inventoryId,
            publisherId: event.publisherId,
            bidRequestId: event.bidRequestId,
            bidResponseId: event.bidResponseId,
            price: event.price,
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            referrer: event.referrer,
            country: event.country,
            region: event.region,
            city: event.city,
            deviceType: event.deviceType,
            browserType: event.browserType,
            viewable: event.viewable || false,
            viewTime: event.viewTime || 0,
            metadata: event.metadata || {},
          })),
        });

        // Batch update campaign spend
        const campaignUpdates = new Map<string, number>();

        // Aggregate spend by campaign
        batch.forEach((event) => {
          if (event.price) {
            const campaignId = event.campaignId;
            const price = parseFloat(event.price);

            if (campaignUpdates.has(campaignId)) {
              campaignUpdates.set(
                campaignId,
                campaignUpdates.get(campaignId)! + price,
              );
            } else {
              campaignUpdates.set(campaignId, price);
            }
          }
        });

        // Update spend for each campaign
        for (const [campaignId, totalPrice] of campaignUpdates.entries()) {
          await this.updateCampaignSpend(tx, campaignId, totalPrice);
        }

        // Batch update hourly stats
        await this.batchUpdateHourlyStats(tx, batch, 'impression');
      });

      this.logger.log(`Successfully processed ${batch.length} impressions`);
    } catch (error) {
      this.logger.error(`Error processing impression batch: ${error.message}`);
    }
  }

  private async processClickBatch(batch: any[]) {
    try {
      this.logger.log(`Processing batch of ${batch.length} clicks`);

      await this.prisma.$transaction(async (tx) => {
        // Bulk insert clicks
        await tx.clickTrack.createMany({
          data: batch.map((event) => ({
            creativeId: event.creativeId,
            campaignId: event.campaignId,
            inventoryId: event.inventoryId,
            publisherId: event.publisherId,
            impressionTrackId: event.impressionTrackId,
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            referrer: event.referrer,
            country: event.country,
            region: event.region,
            city: event.city,
            deviceType: event.deviceType,
            browserType: event.browserType,
            metadata: event.metadata || {},
          })),
        });

        // Batch update hourly stats
        await this.batchUpdateHourlyStats(tx, batch, 'click');
      });

      this.logger.log(`Successfully processed ${batch.length} clicks`);
    } catch (error) {
      this.logger.error(`Error processing click batch: ${error.message}`);
    }
  }

  private async updateCampaignSpend(
    tx: any,
    campaignId: string,
    price: number,
  ) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await tx.campaignStatistics.upsert({
        where: {
          campaignId_date: {
            campaignId: campaignId,
            date: today,
          },
        },
        update: {
          impressions: { increment: 1 },
          spend: { increment: price },
        },
        create: {
          campaignId,
          date: today,
          impressions: 1,
          clicks: 0,
          conversions: 0,
          spend: price,
        },
      });

      // Check budget exhaustion logic here
      // ...
    } catch (error) {
      this.logger.error(
        `Error updating campaign spend for campaign ${campaignId}: ${error.message}`,
      );
    }
  }

  // private async batchUpdateHourlyStats(
  //   tx: any,
  //   events: any[],
  //   eventType: 'impression' | 'click',
  // ) {
  //   try {
  //     // Group events by hour, campaign, inventory, publisher
  //     const statsUpdates = new Map<string, any>();

  //     for (const event of events) {
  //       const hourDate = new Date(event.timestamp || new Date());
  //       hourDate.setMinutes(0, 0, 0);

  //       const key = `${hourDate.toISOString()}_${event.campaignId}_${event.inventoryId}_${event.publisherId}`;

  //       if (!statsUpdates.has(key)) {
  //         statsUpdates.set(key, {
  //           hour: hourDate,
  //           campaignId: event.campaignId,
  //           inventoryId: event.inventoryId,
  //           publisherId: event.publisherId,
  //           impressions: eventType === 'impression' ? 1 : 0,
  //           clicks: eventType === 'click' ? 1 : 0,
  //           spend:
  //             eventType === 'impression' && event.price
  //               ? parseFloat(event.price)
  //               : 0,
  //         });
  //       } else {
  //         const stats = statsUpdates.get(key);
  //         if (eventType === 'impression') {
  //           stats.impressions += 1;
  //           if (event.price) {
  //             stats.spend += parseFloat(event.price);
  //           }
  //         } else {
  //           stats.clicks += 1;
  //         }
  //       }
  //     }

  //     // Update or create hourly stats records
  //     for (const stats of statsUpdates.values()) {
  //       await tx.hourlyStats.upsert({
  //         where: {
  //           hour_campaignId_inventoryId_publisherId: {
  //             hour: stats.hour,
  //             campaignId: stats.campaignId,
  //             inventoryId: stats.inventoryId,
  //             publisherId: stats.publisherId,
  //           },
  //         },
  //         update: {
  //           impressions:
  //             eventType === 'impression'
  //               ? { increment: stats.impressions }
  //               : undefined,
  //           clicks:
  //             eventType === 'click' ? { increment: stats.clicks } : undefined,
  //           spend:
  //             eventType === 'impression'
  //               ? { increment: stats.spend }
  //               : undefined,
  //           // Calculate derived metrics
  //           ctr: {
  //             set: tx.raw(`
  //               CASE
  //                 WHEN impressions + ${eventType === 'impression' ? stats.impressions : 0} > 0
  //                 THEN (clicks + ${eventType === 'click' ? stats.clicks : 0})::float / (impressions + ${eventType === 'impression' ? stats.impressions : 0})
  //                 ELSE 0
  //               END
  //             `),
  //           },
  //           cpc: {
  //             set: tx.raw(`
  //               CASE
  //                 WHEN clicks + ${eventType === 'click' ? stats.clicks : 0} > 0
  //                 THEN spend / (clicks + ${eventType === 'click' ? stats.clicks : 0})
  //                 ELSE 0
  //               END
  //             `),
  //           },
  //           ecpm: {
  //             set: tx.raw(`
  //               CASE
  //                 WHEN impressions + ${eventType === 'impression' ? stats.impressions : 0} > 0
  //                 THEN (spend * 1000) / (impressions + ${eventType === 'impression' ? stats.impressions : 0})
  //                 ELSE 0
  //               END
  //             `),
  //           },
  //         },
  //         create: {
  //           hour: stats.hour,
  //           campaignId: stats.campaignId,
  //           inventoryId: stats.inventoryId,
  //           publisherId: stats.publisherId,
  //           impressions: eventType === 'impression' ? stats.impressions : 0,
  //           clicks: eventType === 'click' ? stats.clicks : 0,
  //           spend: eventType === 'impression' ? stats.spend : 0,
  //           ctr: eventType === 'impression' && stats.impressions > 0 ? 0 : null,
  //           cpc: null,
  //           ecpm:
  //             eventType === 'impression' && stats.impressions > 0
  //               ? (stats.spend * 1000) / stats.impressions
  //               : null,
  //         },
  //       });
  //     }
  //   } catch (error) {
  //     this.logger.error(
  //       `Error updating hourly stats for ${eventType} events: ${error.message}`,
  //     );
  //   }
  // }

  // In the batchUpdateHourlyStats method, replace the complex upsert operations:

  private async batchUpdateHourlyStats(
    tx: any,
    events: any[],
    eventType: 'impression' | 'click',
  ) {
    try {
      // Group events by hour, campaign, inventory, publisher
      const statsUpdates = new Map<string, any>();

      for (const event of events) {
        const hourDate = new Date(event.timestamp || new Date());
        hourDate.setMinutes(0, 0, 0);

        const key = `${hourDate.toISOString()}_${event.campaignId}_${event.inventoryId}_${event.publisherId}`;

        if (!statsUpdates.has(key)) {
          statsUpdates.set(key, {
            hour: hourDate,
            campaignId: event.campaignId,
            inventoryId: event.inventoryId,
            publisherId: event.publisherId,
            impressions: eventType === 'impression' ? 1 : 0,
            clicks: eventType === 'click' ? 1 : 0,
            spend:
              eventType === 'impression' && event.price
                ? parseFloat(event.price)
                : 0,
          });
        } else {
          const stats = statsUpdates.get(key);
          if (eventType === 'impression') {
            stats.impressions += 1;
            if (event.price) {
              stats.spend += parseFloat(event.price);
            }
          } else {
            stats.clicks += 1;
          }
        }
      }

      // Simplified upsert for regular PostgreSQL
      for (const stats of statsUpdates.values()) {
        // Try to find existing record
        const existing = await tx.hourlyStats.findUnique({
          where: {
            hour_campaignId_inventoryId_publisherId: {
              hour: stats.hour,
              campaignId: stats.campaignId,
              inventoryId: stats.inventoryId,
              publisherId: stats.publisherId,
            },
          },
        });

        if (existing) {
          // Update existing record
          const newImpressions = existing.impressions + stats.impressions;
          const newClicks = existing.clicks + stats.clicks;
          const newSpend = Number(existing.spend) + stats.spend;

          await tx.hourlyStats.update({
            where: {
              hour_campaignId_inventoryId_publisherId: {
                hour: stats.hour,
                campaignId: stats.campaignId,
                inventoryId: stats.inventoryId,
                publisherId: stats.publisherId,
              },
            },
            data: {
              impressions: newImpressions,
              clicks: newClicks,
              spend: newSpend,
              // Calculate simple metrics
              ctr: newImpressions > 0 ? newClicks / newImpressions : 0,
              cpc: newClicks > 0 ? newSpend / newClicks : 0,
              ecpm: newImpressions > 0 ? (newSpend * 1000) / newImpressions : 0,
            },
          });
        } else {
          // Create new record
          await tx.hourlyStats.create({
            data: {
              hour: stats.hour,
              campaignId: stats.campaignId,
              inventoryId: stats.inventoryId,
              publisherId: stats.publisherId,
              impressions: stats.impressions,
              clicks: stats.clicks,
              spend: stats.spend,
              ctr: stats.impressions > 0 ? stats.clicks / stats.impressions : 0,
              cpc: stats.clicks > 0 ? stats.spend / stats.clicks : 0,
              ecpm:
                stats.impressions > 0
                  ? (stats.spend * 1000) / stats.impressions
                  : 0,
            },
          });
        }
      }
    } catch (error) {
      this.logger.error(
        `Error updating hourly stats for ${eventType} events: ${error.message}`,
      );
    }
  }
}
// import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { kafkaTopics } from 'src/kafka/constants/kafka.config';
// import { KafkaService } from 'src/kafka/kafka.service';
// import { PrismaService } from 'src/prisma/prisma.service';

// @Injectable()
// export class TrackingConsumerService implements OnModuleInit {
//   private readonly logger = new Logger(TrackingConsumerService.name);
//   private impressionBatch: any[] = [];
//   private clickBatch: any[] = [];
//   private readonly BATCH_SIZE = 100;
//   private readonly FLUSH_INTERVAL = 5000; // 5 seconds
//   private flushTimer: NodeJS.Timeout;

//   constructor(
//     private readonly kafkaService: KafkaService,
//     private readonly configService: ConfigService,
//     private readonly prisma: PrismaService,
//   ) {}

//   onModuleInit() {
//     this.subscribeToTrackingEvents();
//     // Set up periodic batch flushing
//     this.flushTimer = setInterval(
//       () => this.flushBatches(),
//       this.FLUSH_INTERVAL,
//     );
//     this.logger.log('TrackingConsumerService initialized');
//   }

//   onModuleDestroy() {
//     // Clean up timer when service is destroyed
//     if (this.flushTimer) {
//       clearInterval(this.flushTimer);
//     }
//     // Flush any remaining events
//     this.flushBatches();
//   }

//   async subscribeToTrackingEvents() {
//     const topic = kafkaTopics.TRACKING_EVENTS;
//     const groupId = 'rtb-tracking-consumer';

//     try {
//       this.logger.log(`Subscribing to topic ${topic} with group ID ${groupId}`);

//       await this.kafkaService.subscribe(
//         topic,
//         groupId,
//         async ({ key, value, topic, partition, offset }) => {
//           this.logger.debug(
//             `Received message from topic ${topic}: key=${key}, partition=${partition}, offset=${offset}`,
//           );

//           if (value.eventType === 'impression') {
//             // Add to impression batch
//             this.impressionBatch.push(value);
//             if (this.impressionBatch.length >= this.BATCH_SIZE) {
//               await this.processImpressionBatch([...this.impressionBatch]);
//               this.impressionBatch = [];
//             }
//           } else if (value.eventType === 'click') {
//             // Add to click batch
//             this.clickBatch.push(value);
//             if (this.clickBatch.length >= this.BATCH_SIZE) {
//               await this.processClickBatch([...this.clickBatch]);
//               this.clickBatch = [];
//             }
//           } else {
//             this.logger.warn(
//               `Unknown event type: ${value.eventType} in message: ${JSON.stringify(
//                 value,
//               )}`,
//             );
//           }
//         },
//       );
//     } catch (error) {
//       this.logger.error(
//         `Error subscribing to tracking events: ${error.message}`,
//         error.stack,
//       );
//     }
//     this.logger.log(`Subscribed to topic: ${topic} with groupId: ${groupId}`);
//   }

//   // Flush batches on interval
//   private async flushBatches() {
//     if (this.impressionBatch.length > 0) {
//       const batch = [...this.impressionBatch];
//       this.impressionBatch = [];
//       await this.processImpressionBatch(batch);
//     }

//     if (this.clickBatch.length > 0) {
//       const batch = [...this.clickBatch];
//       this.clickBatch = [];
//       await this.processClickBatch(batch);
//     }
//   }

//   private async processImpressionBatch(batch: any[]) {
//     try {
//       this.logger.log(`Processing batch of ${batch.length} impressions`);

//       // Create impression records using existing Impression table
//       await this.prisma.$transaction(async (tx) => {
//         // Process each impression individually (since createMany doesn't work with all required fields)
//         for (const event of batch) {
//           try {
//             await tx.impression.create({
//               data: {
//                 inventoryId: event.inventoryId,
//                 campaignId: event.campaignId,
//                 creativeId: event.creativeId,
//                 bidResponseId: event.bidResponseId || null,
//                 publisherId: event.publisherId,
//                 advertiserId:
//                   event.advertiserId ||
//                   (await this.getAdvertiserIdFromCampaign(
//                     tx,
//                     event.campaignId,
//                   )),
//                 revenue: event.price ? parseFloat(event.price) : 0,
//                 cost: event.price ? parseFloat(event.price) : 0,
//                 ipAddress: event.ipAddress,
//                 userAgent: event.userAgent,
//                 deviceType: event.deviceType,
//                 browserType: event.browserType,
//                 country: event.country,
//                 region: event.region,
//                 city: event.city,
//                 viewable: event.viewable || false,
//                 viewableDuration: event.viewTime || null,
//               },
//             });
//           } catch (error) {
//             this.logger.warn(`Failed to create impression: ${error.message}`);
//           }
//         }

//         // Batch update campaign spend
//         const campaignUpdates = new Map<string, number>();

//         // Aggregate spend by campaign
//         batch.forEach((event) => {
//           if (event.price) {
//             const campaignId = event.campaignId;
//             const price = parseFloat(event.price);

//             if (campaignUpdates.has(campaignId)) {
//               campaignUpdates.set(
//                 campaignId,
//                 campaignUpdates.get(campaignId)! + price,
//               );
//             } else {
//               campaignUpdates.set(campaignId, price);
//             }
//           }
//         });

//         // Update spend for each campaign
//         for (const [campaignId, totalPrice] of campaignUpdates.entries()) {
//           await this.updateCampaignSpend(tx, campaignId, totalPrice);
//         }

//         // Batch update hourly stats using existing HourlyMetrics table
//         await this.batchUpdateHourlyStats(tx, batch, 'impression');
//       });

//       this.logger.log(`Successfully processed ${batch.length} impressions`);
//     } catch (error) {
//       this.logger.error(`Error processing impression batch: ${error.message}`);
//     }
//   }

//   private async processClickBatch(batch: any[]) {
//     try {
//       this.logger.log(`Processing batch of ${batch.length} clicks`);

//       await this.prisma.$transaction(async (tx) => {
//         // Process each click individually using existing Click table
//         for (const event of batch) {
//           try {
//             // Find the impression first
//             const impression = await tx.impression.findFirst({
//               where: {
//                 creativeId: event.creativeId,
//                 campaignId: event.campaignId,
//                 inventoryId: event.inventoryId,
//               },
//               orderBy: {
//                 createdAt: 'desc',
//               },
//               take: 1,
//             });

//             if (impression) {
//               await tx.click.create({
//                 data: {
//                   impressionId: impression.id,
//                   ipAddress: event.ipAddress,
//                   userAgent: event.userAgent,
//                   deviceType: event.deviceType,
//                   browserType: event.browserType,
//                   country: event.country,
//                   region: event.region,
//                   city: event.city,
//                   referrer: event.referrer,
//                 },
//               });
//             }
//           } catch (error) {
//             this.logger.warn(`Failed to create click: ${error.message}`);
//           }
//         }

//         // Batch update hourly stats
//         await this.batchUpdateHourlyStats(tx, batch, 'click');
//       });

//       this.logger.log(`Successfully processed ${batch.length} clicks`);
//     } catch (error) {
//       this.logger.error(`Error processing click batch: ${error.message}`);
//     }
//   }

//   private async updateCampaignSpend(
//     tx: any,
//     campaignId: string,
//     price: number,
//   ) {
//     try {
//       const today = new Date();
//       today.setHours(0, 0, 0, 0);

//       await tx.campaignStatistics.upsert({
//         where: {
//           campaignId_date: {
//             campaignId: campaignId,
//             date: today,
//           },
//         },
//         update: {
//           impressions: { increment: 1 },
//           spend: { increment: price },
//         },
//         create: {
//           campaignId,
//           date: today,
//           impressions: 1,
//           clicks: 0,
//           conversions: 0,
//           spend: price,
//         },
//       });

//       // Check budget exhaustion logic here
//       // ...
//     } catch (error) {
//       this.logger.error(
//         `Error updating campaign spend for campaign ${campaignId}: ${error.message}`,
//       );
//     }
//   }

//   private async batchUpdateHourlyStats(
//     tx: any,
//     events: any[],
//     eventType: 'impression' | 'click',
//   ) {
//     try {
//       // Group events by hour, campaign, inventory
//       const statsUpdates = new Map<string, any>();

//       for (const event of events) {
//         const hourDate = new Date(event.timestamp || new Date());
//         hourDate.setMinutes(0, 0, 0);

//         const key = `${hourDate.toISOString()}_${event.campaignId}_${event.inventoryId}`;

//         if (!statsUpdates.has(key)) {
//           statsUpdates.set(key, {
//             date: new Date(hourDate.toDateString()), // Get just the date part
//             hour: hourDate.getHours(),
//             campaignId: event.campaignId,
//             inventoryId: event.inventoryId,
//             impressions: eventType === 'impression' ? 1 : 0,
//             clicks: eventType === 'click' ? 1 : 0,
//             spend:
//               eventType === 'impression' && event.price
//                 ? parseFloat(event.price)
//                 : 0,
//             revenue:
//               eventType === 'impression' && event.price
//                 ? parseFloat(event.price)
//                 : 0,
//           });
//         } else {
//           const stats = statsUpdates.get(key);
//           if (eventType === 'impression') {
//             stats.impressions += 1;
//             if (event.price) {
//               const price = parseFloat(event.price);
//               stats.spend += price;
//               stats.revenue += price;
//             }
//           } else {
//             stats.clicks += 1;
//           }
//         }
//       }

//       // Use existing HourlyMetrics table
//       for (const stats of statsUpdates.values()) {
//         try {
//           await tx.hourlyMetrics.upsert({
//             where: {
//               campaignId_inventoryId_date_hour: {
//                 campaignId: stats.campaignId,
//                 inventoryId: stats.inventoryId,
//                 date: stats.date,
//                 hour: stats.hour,
//               },
//             },
//             update: {
//               impressions: { increment: stats.impressions },
//               clicks: { increment: stats.clicks },
//               spend: { increment: stats.spend },
//               revenue: { increment: stats.revenue },
//             },
//             create: {
//               campaignId: stats.campaignId,
//               inventoryId: stats.inventoryId,
//               date: stats.date,
//               hour: stats.hour,
//               impressions: stats.impressions,
//               clicks: stats.clicks,
//               spend: stats.spend,
//               revenue: stats.revenue,
//             },
//           });
//         } catch (error) {
//           this.logger.error(`Error updating hourly metrics: ${error.message}`);
//         }
//       }
//     } catch (error) {
//       this.logger.error(
//         `Error updating hourly stats for ${eventType} events: ${error.message}`,
//       );
//     }
//   }

//   // Helper method to get advertiser ID from campaign
//   private async getAdvertiserIdFromCampaign(
//     tx: any,
//     campaignId: string,
//   ): Promise<string> {
//     const campaign = await tx.campaign.findUnique({
//       where: { id: campaignId },
//       select: { advertiserId: true },
//     });
//     return campaign?.advertiserId || '';
//   }
// }
