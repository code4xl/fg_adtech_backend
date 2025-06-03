// // done
// import { Injectable, Logger } from '@nestjs/common';
// import { AuctionLogStatus } from '@prisma/client';
// import { kafkaTopics } from 'src/kafka/constants/kafka.config';
// import { KafkaService } from 'src/kafka/kafka.service';
// import { PrismaService } from 'src/prisma/prisma.service';
// import { AdMarkupService } from './ad-markup.service';

// @Injectable()
// export class AuctionResultService {
//   private readonly logger = new Logger(AuctionResultService.name);
//   constructor(
//     private readonly kafka: KafkaService,
//     private readonly prisma: PrismaService,
//     private readonly adMarkupService: AdMarkupService,
//   ) {}

//   async processAuctionResult(
//     auctionId: string,
//     bidRequestId: string,
//     bids: any[],
//     auctionType: 'FIRST_PRICE' | 'SECOND_PRICE',
//   ) {
//     try {
//       if (bids.length === 0) {
//         await this.handleNoBids(auctionId, bidRequestId);
//         return null;
//       }

//       bids.sort((a, b) => b.price - a.price);
//       const winningBid = bids[0];
//       let finalPrice = winningBid.bidPrice;

//       if (auctionType == 'SECOND_PRICE' && bids.length > 1) {
//         const secondPrice = bids[1].bidPrice;
//         finalPrice = secondPrice + 0.01; // small increment
//         finalPrice = Math.min(finalPrice, winningBid.bidPrice);
//       }

//       const bidResponses = await this.createBidResponses(
//         bidRequestId,
//         bids,
//         winningBid.campaignId,
//       );

//       await this.updateAuctionLog(
//         auctionId,
//         winningBid.id,
//         bidRequestId,
//         finalPrice,
//         bids.length,
//       );

//       const auctionResult = {
//         auctionId,
//         bidRequestId,
//         winningBid: {
//           ...winningBid,
//           finalPrice,
//           bidResponseId: bidResponses[0].id,
//         },
//         timestamp: new Date().toISOString(),
//       };

//       await this.publishAuctionResult(auctionResult);
//       return auctionResult;
//     } catch (error) {
//       this.logger.error(
//         `Error handling auction results for auction ${auctionId}: ${error.message}`,
//       );
//       await this.prisma.auctionLog.update({
//         where: { id: auctionId },
//         data: {
//           status: AuctionLogStatus.FAILED,
//           errorMessage: error.message,
//           auctionEndTime: new Date(),
//         },
//       });

//       return null;
//     }
//   }

//   private async handleNoBids(auctionId: string, bidRequestId: string) {
//     // Handle the case where no bids were received
//     this.logger.warn(
//       `No bids received for auction ${auctionId} and bid request ${bidRequestId}`,
//     );
//     // update auction log

//     await this.prisma.auctionLog.update({
//       where: {
//         id: auctionId,
//       },
//       data: {
//         status: AuctionLogStatus.NO_BIDS,
//         auctionEndTime: new Date(),
//         totalBids: 0,
//       },
//     });

//     // Publish no-bid result to Kafka
//     await this.kafka.publish(kafkaTopics.AUCTION_RESULTS, {
//       key: auctionId,
//       value: {
//         auctionId,
//         bidRequestId,
//         noBids: true,
//         timestamp: new Date().toISOString(),
//       },
//     });
//   }

//   private async createBidResponses(
//     bidRequestId: string,
//     bids: any[],
//     winningCampaignId: string,
//   ) {
//     const bidReponses: any[] = await Promise.all(
//       bids.map(async (bid, index) => {
//         const isWinner = bid.campaignId === winningCampaignId;
//         const bidRepsonse = await this.prisma.bidResponse.create({
//           data: {
//             bidRequestId,
//             campaignId: bid.campaignId,
//             creativeId: bid.creativeId,
//             advertiserId: bid.advertiserId,
//             bidPrice: bid.bidPrice,
//             status: isWinner ? 'WON' : 'LOST',
//             responseTime: 0,
//             adMarkup: isWinner
//               ? this.adMarkupService.generateAdMarkup(bid.creative)
//               : null,
//           },
//         });
//       }),
//     );

//     return bidReponses.sort((a, b) => {
//       if (a.status === 'WON') return -1;
//       if (b.status === 'WON') return 1;
//       return 0;
//     });
//   }

//   private generateAdMarkup(creative: any) {
//     const markup = `
//       <div class="ocean-ad" data-creative-id="${creative.id}">
//         <a href="${creative.landingUrl}" target="_blank">
//           <img src="${creative.fileUrl}" width="${creative.width}" height="${creative.height}" alt="${creative.name}" />
//         </a>
//         <img src="/track/impression/${creative.id}?t=${Date.now()}" style="position:absolute;width:1px;height:1px;opacity:0" />
//       </div>
//     `;

//     return markup;
//   }

//   private async updateAuctionLog(
//     auctionId: string,
//     winningBidId: string,
//     bidRequestId: string,
//     finalPrice: number,
//     totalBids: number,
//   ) {
//     const startTime = await this.prisma.auctionLog.findUnique({
//       where: { id: auctionId },
//       select: { auctionStartTime: true },
//     });

//     const endTime = new Date();
//     const duration = startTime
//       ? endTime.getTime() - new Date(startTime.auctionStartTime).getTime()
//       : 0;

//     await this.prisma.auctionLog.update({
//       where: { id: auctionId },
//       data: {
//         status: AuctionLogStatus.COMPLETED,
//         winningBidId,
//         finalPrice,
//         totalBids,
//         auctionEndTime: endTime,
//         auctionDuration: duration,
//       },
//     });
//   }

//   private async publishAuctionResult(auctionResult: any) {
//     await this.kafka.publish(kafkaTopics.AUCTION_RESULTS, {
//       key: auctionResult.auctionId,
//       value: auctionResult,
//     });
//     this.logger.log(
//       `Auction result published for auction ${auctionResult.auctionId}`,
//     );
//   }
// }
