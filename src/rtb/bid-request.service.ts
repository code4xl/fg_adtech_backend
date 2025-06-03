// // src/rtb/bid-request.service.ts - done
// import {
//   Injectable,
//   BadRequestException,
//   NotFoundException,
// } from '@nestjs/common';
// import { PrismaService } from '../prisma/prisma.service';
// import { KafkaService } from '../kafka/kafka.service';
// import { RtbEnrichmentService } from './rtb-enrichment.service';
// import { CreateBidRequestDto } from './dto/create-bid-request.dto';
// import { Request } from 'express';
// import { v4 as uuidv4 } from 'uuid';
// import { ResourceNotFoundException } from 'src/common/exceptions/custom.exception';
// import { Prisma } from '@prisma/client';
// import { CircuitBreakerService } from 'src/common/resilience/circuit-breaker.service';

// @Injectable()
// export class BidRequestService {
//   constructor(
//     private readonly prisma: PrismaService,
//     private readonly kafka: KafkaService,
//     private readonly enrichment: RtbEnrichmentService,
//     private readonly circuitBreaker: CircuitBreakerService,
//   ) {
//     // Register circuits
//     this.circuitBreaker.registerCircuit('kafka-publish');
//     this.circuitBreaker.registerCircuit('bid-request-processing');
//   }

//   async create(createBidRequestDto: CreateBidRequestDto, req: Request) {
//     return this.circuitBreaker.executeWithCircuitBreaker(
//       'bid-request-processing',
//       async () => {
//         try {
//           console.log('Creating bid request:', createBidRequestDto);
//           const { publisherId, inventoryId } = createBidRequestDto;
//           const [publisher, inventory] = await Promise.all([
//             this.validatePublisher(publisherId),
//             this.validateInventory(inventoryId, publisherId),
//           ]);

//           const internalRequestId = uuidv4();

//           const enrichedRequest = await this.enrichment.enrichBidRequest(
//             createBidRequestDto,
//             req,
//           );

//           const bidRequestData: Prisma.BidRequestUncheckedCreateInput = {
//             id: internalRequestId,
//             requestId: createBidRequestDto.requestId, // From SDK
//             inventoryId: createBidRequestDto.inventoryId,
//             publisherId: createBidRequestDto.publisherId,
//             userAgent: enrichedRequest.userAgent,
//             ipAddress: enrichedRequest.ipAddress,
//             deviceType: enrichedRequest.deviceType,
//             browserType: enrichedRequest.browserType,
//             country: enrichedRequest.country,
//             region: enrichedRequest.region,
//             city: enrichedRequest.city,
//             floor: enrichedRequest.floor,
//             auctionType: 'SECOND_PRICE', // Default auction type
//             timeout: createBidRequestDto.timeout || 200,
//             targeting: enrichedRequest.targeting,
//             requestTimestamp: new Date(),
//           };

//           const bidRequest = await this.prisma.bidRequest.create({
//             data: bidRequestData,
//           });
//           console.log('Bid request created:', bidRequest);
//           const data = await this.prisma.bidRequest.findMany();
//           console.log('Bid request data:', data);

//           await this.circuitBreaker.executeWithCircuitBreaker(
//             'kafka-publish',
//             () =>
//               this.kafka.publish('bid-requests', {
//                 key: bidRequest.id,
//                 value: {
//                   ...bidRequest,
//                   adSlot: createBidRequestDto.adSlot,
//                   referrer: createBidRequestDto.referrer,
//                   pageUrl: createBidRequestDto.pageUrl,
//                 },
//               }),
//           );
//           return { requestId: bidRequest.requestId, internalId: bidRequest.id };
//         } catch (error) {
//           if (
//             error instanceof BadRequestException ||
//             error instanceof NotFoundException
//           ) {
//             throw error;
//           }

//           console.error('Error creating bid request:', error);
//           throw new BadRequestException('Failed to process bid request');
//         }
//       },
//     );
//   }

//   async validatePublisher(publisherId: string) {
//     const publisher = await this.prisma.publisher.findUnique({
//       where: { id: publisherId },
//     });

//     if (!publisher) {
//       throw new ResourceNotFoundException('Publisher not found', publisherId);
//     }

//     if (publisher.status !== 'ACTIVE') {
//       throw new BadRequestException('Publisher is not active');
//     }
//     return publisher;
//   }

//   async validateInventory(inventoryId: string, publisherId: string) {
//     const inventory = await this.prisma.adInventory.findUnique({
//       where: {
//         id: inventoryId,
//       },
//       include: {
//         floorPrices: true,
//         // publisher: true,
//       },
//     });

//     if (!inventory) {
//       throw new ResourceNotFoundException('Inventory not found', inventoryId);
//     }
//     if (!inventory.isActive) {
//       throw new BadRequestException('Inventory is not active');
//     }
//     if (inventory.publisherId !== publisherId) {
//       throw new BadRequestException(
//         'Inventory does not belong to the publisher',
//       );
//     }
//     return inventory;
//   }
// }
