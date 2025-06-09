// import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
// import { PrismaService } from 'src/prisma/prisma.service';
// import { ResourceNotFoundException } from 'src/common/exceptions/custom.exception';

// @Injectable()
// export class ClientService {
//   private readonly logger = new Logger(ClientService.name);

//   constructor(private prisma: PrismaService) { }

//   /**
//    * Get campaigns assigned to a client (Client access)
//    */
//   async getClientCampaigns(clientId: string) {
//     const client = await this.prisma.client.findUnique({
//       where: { id: clientId },
//       include: {
//         assignedCampaigns: {
//           include: {
//             campaign: {
//               select: {
//                 id: true,
//                 name: true,
//                 startDate: true,
//                 endDate: true,
//                 status: true,
//                 objective: true,
//                 websiteUrl: true,
//                 businessCategory: true,
//                 interests: true,
//                 createdAt: true,
//               },
//             },
//           },
//           orderBy: { assignedAt: 'desc' },
//         },
//       },
//     });

//     if (!client) {
//       throw new ResourceNotFoundException('Client', clientId);
//     }

//     return {
//       client: {
//         id: client.id,
//         name: client.name,
//         companyName: client.companyName,
//       },
//       campaigns: client.assignedCampaigns.map(ac => ({
//         ...ac.campaign,
//         assignedAt: ac.assignedAt,
//       })),
//     };
//   }

//   /**
//    * Get specific campaign details (Client access)
//    */
//   async getClientCampaignById(clientId: string, campaignId: string) {
//     // Verify client has access to this campaign
//     const clientCampaign = await this.prisma.clientCampaign.findFirst({
//       where: {
//         clientId,
//         campaignId,
//       },
//       include: {
//         campaign: {
//           include: {
//             advertiser: {
//               select: {
//                 id: true,
//                 name: true,
//                 email: true,
//                 companyName: true,
//               },
//             },
//           },
//         },
//       },
//     });

//     if (!clientCampaign) {
//       throw new ForbiddenException('You do not have access to this campaign');
//     }

//     return {
//       campaign: clientCampaign.campaign,
//       assignedAt: clientCampaign.assignedAt,
//     };
//   }

//   /**
//    * Get client profile (Client access)
//    */
//   async getClientProfile(clientId: string) {
//     const client = await this.prisma.client.findUnique({
//       where: { id: clientId },
//       include: {
//         advertiser: {
//           select: {
//             id: true,
//             name: true,
//             email: true,
//             companyName: true,
//           },
//         },
//         _count: {
//           select: {
//             assignedCampaigns: true,
//           },
//         },
//       },
//     });

//     if (!client) {
//       throw new ResourceNotFoundException('Client', clientId);
//     }

//     return {
//       id: client.id,
//       name: client.name,
//       email: client.email,
//       mobile: client.mobile,
//       companyName: client.companyName,
//       hqLocation: client.hqLocation,
//       companySize: client.companySize,
//       website: client.website,
//       emailVerifiedAt: client.emailVerifiedAt,
//       advertiser: client.advertiser,
//       campaignCount: client._count.assignedCampaigns,
//       createdAt: client.createdAt,
//     };
//   }
// }