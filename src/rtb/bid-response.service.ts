// // src/rtb/bid-response.service.ts

// import { Injectable, Logger } from '@nestjs/common';
// import { AdMarkupService } from './ad-markup.service';
// import { PrismaService } from 'src/prisma/prisma.service';
// import { RedisService } from 'src/redis/redis.service';
// import { KafkaService } from 'src/kafka/kafka.service';
// import { kafkaTopics } from 'src/kafka/constants/kafka.config';
// import { BadRequestException } from 'src/common/exceptions/custom.exception';

// @Injectable()
// export class BidResponseService {
//   private readonly logger = new Logger(BidResponseService.name);
//   private readonly CACHE_TTL = 60 * 5; // 5 minutes

//   constructor(
//     private readonly adMarkupService: AdMarkupService,
//     private readonly redisService: RedisService,
//     private readonly prisma: PrismaService,
//     private readonly kafka: KafkaService,
//   ) {}

//   async getBidResponse(requestId: string) {
//     try {
//       // Try to check in cache first
//       const cacheKey = `bid-response:${requestId}`;
//       const cachedResponse = await this.redisService.get<string>(cacheKey);
//       if (cachedResponse) {
//         this.logger.log(`Cache hit for requestId: ${requestId}`);
//         return { html: cachedResponse, cached: true };
//       }

//       // Cache miss, fetch from db
//       const bidRequest = await this.prisma.bidRequest.findUnique({
//         where: {
//           requestId: requestId,
//         },
//       });

//       if (!bidRequest) {
//         throw new BadRequestException('Bid request not found');
//       }

//       // Find the winning bid response
//       const bidResponse = await this.prisma.bidResponse.findFirst({
//         where: {
//           bidRequestId: bidRequest.id,
//           status: 'WON',
//         },
//         include: {
//           creative: true,
//         },
//       });

//       if (!bidResponse) {
//         this.logger.warn(`No winning bid found for request ID: ${requestId}`);
//         return { html: this.generateNoBidResponse(bidRequest), cached: false };
//       }

//       let adMarkup: string;

//       if (bidResponse.adMarkup) {
//         adMarkup = bidResponse.adMarkup;
//       } else if (bidResponse.creative) {
//         // Generate markup from creative data
//         adMarkup = this.adMarkupService.generateAdMarkup(bidResponse.creative, {
//           bidRequestId: bidRequest.id,
//           bidResponseId: bidResponse.id,
//           price: bidResponse.bidPrice,
//         });

//         // Update the bid response with the generated markup
//         await this.prisma.bidResponse.update({
//           where: {
//             id: bidResponse.id,
//           },
//           data: {
//             adMarkup: adMarkup,
//           },
//         });
//       } else {
//         throw new BadRequestException('Creative not found');
//       }

//       // Cache the response
//       await this.redisService.set(cacheKey, adMarkup, this.CACHE_TTL);
//       this.logger.log(`Cache set for requestId: ${requestId}`);
//       return { html: adMarkup, cached: false };
//     } catch (error) {
//       this.logger.error(
//         `Error fetching bid response for request ID ${requestId}: ${error.message}`,
//         error.stack,
//       );
//       throw new BadRequestException('Error fetching bid response');
//     }
//   }

//   private generateNoBidResponse(bidRequest: any) {
//     const width = bidRequest.targetingData?.width || 300;
//     const height = bidRequest.targetingData?.height || 250;

//     return `
//       <div class="ocean-ad ocean-ad-no-bid" style="width:${width}px;height:${height}px;border:1px solid #eee;display:flex;align-items:center;justify-content:center;background:#f9f9f9;color:#999;font-family:sans-serif;font-size:12px;">
//         <span>Advertisement</span>
//       </div>
//     `;
//   }

//   async recordClick(creativeId: string, trackingData: any): Promise<string> {
//     try {
//       const creative = await this.prisma.creative.findUnique({
//         where: { id: creativeId },
//         select: {
//           id: true,
//           landingUrl: true,
//           campaignId: true,
//           inventory: {
//             select: {
//               id: true,
//               publisherId: true,
//             },
//           },
//         },
//       });

//       if (!creative) {
//         throw new BadRequestException('Creative not found');
//       }

//       // Increment click counter in Redis
//       const clickCountKey = `click:count:creative:${creativeId}`;
//       const campaignClickCountKey = `click:count:campaign:${creative.campaignId}`;

//       await Promise.all([
//         this.redisService.get<number>(clickCountKey).then((count) => {
//           this.redisService.set(clickCountKey, (count || 0) + 1);
//         }),
//         this.redisService.get<number>(campaignClickCountKey).then((count) => {
//           this.redisService.set(campaignClickCountKey, (count || 0) + 1);
//         }),
//       ]);

//       // Publish click event to Kafka for processing
//       await this.kafka.publish(kafkaTopics.TRACKING_EVENTS, {
//         key: `click:${creativeId}:${Date.now()}`,
//         value: {
//           eventType: 'click',
//           creativeId,
//           campaignId: creative.campaignId,
//           inventoryId: creative.inventory.id,
//           publisherId: creative.inventory.publisherId,
//           timestamp: new Date().toISOString(),
//           ipAddress: trackingData.ip,
//           userAgent: trackingData.userAgent,
//           referrer: trackingData.referrer,
//           ...trackingData,
//         },
//       });

//       // Return the landing URL for redirect
//       return creative.landingUrl;
//     } catch (error) {
//       this.logger.error(`Error recording click: ${error.message}`, error.stack);
//       // If there's an error, still return the redirect URL if possible
//       return trackingData.redirect || '/';
//     }
//   }

//   async recordImpression(creativeId: string, trackingData: any): Promise<void> {
//     try {
//       const creative = await this.prisma.creative.findUnique({
//         where: { id: creativeId },
//         select: {
//           id: true,
//           campaignId: true,
//           inventory: {
//             select: {
//               id: true,
//               publisherId: true,
//             },
//           },
//         },
//       });

//       if (!creative) {
//         throw new BadRequestException('Creative not found');
//       }

//       // Increment impression counter in Redis
//       const impressionCountKey = `impression:count:creative:${creativeId}`;
//       const campaignImpressionCountKey = `impression:count:campaign:${creative.campaignId}`;

//       await Promise.all([
//         this.redisService.get<number>(impressionCountKey).then((count) => {
//           this.redisService.set(impressionCountKey, (count || 0) + 1);
//         }),
//         this.redisService
//           .get<number>(campaignImpressionCountKey)
//           .then((count) => {
//             this.redisService.set(campaignImpressionCountKey, (count || 0) + 1);
//           }),
//       ]);

//       // Publish impression event to Kafka for processing
//       await this.kafka.publish(kafkaTopics.TRACKING_EVENTS, {
//         key: `impression:${creativeId}:${Date.now()}`,
//         value: {
//           eventType: 'impression',
//           creativeId,
//           campaignId: creative.campaignId,
//           inventoryId: creative.inventory.id,
//           publisherId: creative.inventory.publisherId,
//           timestamp: new Date().toISOString(),
//           ipAddress: trackingData.ip,
//           userAgent: trackingData.userAgent,
//           referrer: trackingData.referrer,
//           ...trackingData,
//         },
//       });
//     } catch (error) {
//       this.logger.error(
//         `Error recording impression: ${error.message}`,
//         error.stack,
//       );
//       // Swallow the error as we don't want to disrupt the user experience
//     }
//   }
// }
