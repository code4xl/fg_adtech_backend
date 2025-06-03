// import { Injectable, Logger, BadRequestException } from '@nestjs/common';
// import { PrismaService } from '../prisma/prisma.service';
// import { CreativeStatus } from '@prisma/client';
// import { ResourceNotFoundException } from '../common/exceptions/custom.exception';
// import { ConfigService } from '@nestjs/config';
// import * as fs from 'fs';
// import * as path from 'path';
// import * as util from 'util';
// import * as mime from 'mime-types';
// import { CreativeHelperService } from './creative.helper';
// import { CreateCreativeDto } from './dto/create-creative.dto';
// import { CreativeNotificationService } from 'src/notification/services/creative.notification.service';
// import { UpdateCreativeDto } from './dto/update-creative.dto';
// import { S3StorageService } from 'src/common/services/s3-storage.service';

// // Convert callback-based fs functions to Promise-based
// const mkdir = util.promisify(fs.mkdir);
// const writeFile = util.promisify(fs.writeFile);

// @Injectable()
// export class CreativeService {
//   private readonly logger = new Logger(CreativeService.name);
//   private readonly baseUploadPath: string;
//   private readonly serverUrl: string;

//   constructor(
//     private readonly prisma: PrismaService,
//     private readonly configService: ConfigService,
//     private readonly creativeHelper: CreativeHelperService,
//     private readonly creativeNotificationService: CreativeNotificationService,
//     private readonly s3StorageService: S3StorageService
//   ) {
//     // Initialize base upload path and ensure it exists
//     this.baseUploadPath = path.join(process.cwd(), 'uploads');
//     this.serverUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';

//     // Create base upload directory if it doesn't exist
//     if (!fs.existsSync(this.baseUploadPath)) {
//       fs.mkdirSync(this.baseUploadPath, { recursive: true });
//     }
//   }

//   /**
//    * Add a new creative to a campaign
//    */
//   async addCreative(
//     campaignId: string,
//     advertiserId: string,
//     dto: CreateCreativeDto, // Using the DTO without width/height
//     file: Express.Multer.File
//   ) {
//     // Verify campaign exists and belongs to the advertiser
//     const campaign = await this.prisma.campaign.findUnique({
//       where: { id: campaignId },
//       select: {
//         id: true,
//         name: true,
//         advertiserId: true,
//         clientId: true,
//         status: true,
//         campaignInventories: {
//           where: {
//             inventoryId: dto.inventoryId
//           },
//           include: {
//             inventory: {
//               select: {
//                 id: true,
//                 publisherId: true,
//                 name: true,
//                 width: true,
//                 height: true,
//                 isActive: true,
//                 approvalStatus: true
//               }
//             }
//           }
//         }
//       }
//     });

//     if (!campaign) {
//       throw new ResourceNotFoundException('Campaign', campaignId);
//     }

//     if (campaign.advertiserId !== advertiserId) {
//       throw new BadRequestException('You do not have access to this campaign');
//     }

//     // Check if the specified inventory belongs to this campaign
//     if (campaign.campaignInventories.length === 0) {
//       throw new BadRequestException(
//         `Inventory ${dto.inventoryId} is not associated with this campaign. Please add it first.`
//       );
//     }

//     const campaignInventory = campaign.campaignInventories[0];
//     const inventory = campaignInventory.inventory;

//     // Check if inventory is active and approved
//     if (!inventory.isActive || inventory.approvalStatus !== 'APPROVED') {
//       throw new BadRequestException(
//         `Inventory ${dto.inventoryId} is not active or not approved.`
//       );
//     }

//     let dimensions;
//     try {
//       // Get image dimensions (we'll only validate file type and size here)
//       if (dto.type === 'IMAGE') {
//         dimensions = await this.creativeHelper.getImageDimensions(file);
//       } else {
//         throw new BadRequestException(`Creative type ${dto.type} is not currently supported`);
//       }

//       // Validate dimensions against inventory
//       if (dimensions.width !== inventory.width || dimensions.height !== inventory.height) {
//         throw new BadRequestException(
//           `Image dimensions (${dimensions.width}x${dimensions.height}) do not match the selected inventory dimensions (${inventory.width}x${inventory.height})`
//         );
//       }
//     } catch (error) {
//       throw new BadRequestException(`Dimension validation failed: ${error.message}`);
//     }

//     // Validate other technical aspects
//     const fileTypeAllowed = this.creativeHelper.ALLOWED_FILE_TYPES[dto.type]?.includes(file.mimetype);
//     if (!fileTypeAllowed) {
//       throw new BadRequestException(
//         `File type ${file.mimetype} is not allowed for ${dto.type}. Allowed types: ${this.creativeHelper.ALLOWED_FILE_TYPES[dto.type].join(', ')}`
//       );
//     }

//     if (file.size > this.creativeHelper.MAX_FILE_SIZES[dto.type]) {
//       throw new BadRequestException(
//         `File size exceeds maximum allowed for ${dto.type} (${file.size} bytes / ${this.creativeHelper.MAX_FILE_SIZES[dto.type]} bytes)`
//       );
//     }

//     // let res = await this.creativeHelper.validateCreativeContent(creative.id)
//     //   .catch(error => this.logger.error(`Error during creative validation: ${error.message}`));

//     if (true) {

//       // Generate unique filename
//       const timestamp = Date.now();
//       const fileExt = mime.extension(file.mimetype) || 'jpg';
//       const filename = `${dto.name}-${timestamp}.${fileExt}`;

//       // Store the creative file in S3
//       const s3Key = this.s3StorageService.generateCreativeKey(
//         campaign.name,
//         campaignId,
//         inventory.name,
//         inventory.id,
//         filename
//       );

//       // Generate public URL for the file
//       const fileUrl = this.s3StorageService.getPublicUrl(s3Key);

//       try {
//         // Upload file to S3
//         await this.s3StorageService.uploadFile(
//           file.buffer,
//           s3Key,
//           file.mimetype
//         );

//         return this.prisma.$transaction(async (tx) => {
//           // Create the creative in the database
//           const creative = await tx.creative.create({
//             data: {
//               campaign: {
//                 connect: { id: campaignId }
//               },
//               inventory: {
//                 connect: { id: dto.inventoryId }
//               },
//               name: dto.name,
//               type: dto.type,
//               width: dimensions.width,
//               height: dimensions.height,
//               s3Key: s3Key,
//               fileUrl: fileUrl,
//               landingUrl: dto.landingUrl,
//               status: CreativeStatus.PENDING_REVIEW
//             }
//           });

//           // Send notifications
//           try {
//             await this.creativeNotificationService.notifyCreativeAdded(
//               creative,
//               campaign,
//               advertiserId,
//               campaign.clientId!,
//               inventory.publisherId,
//             );
//           } catch (error) {
//             this.logger.error(`Failed to send notifications: ${error.message}`);
//           }

//           return creative;
//         });
//       } catch (error) {
//         this.logger.error(`Failed to upload creative to S3: ${error.message}`);
//         throw new BadRequestException(`Failed to upload creative: ${error.message}`);
//       }
//     }
//   }

//   /**
//  * Update a creative
//  */

//   async updateCreative(
//     creativeId: string,
//     campaignId: string,
//     advertiserId: string,
//     updateDto: UpdateCreativeDto,
//     file?: Express.Multer.File
//   ) {
//     // Verify campaign exists and belongs to the advertiser
//     const campaign = await this.prisma.campaign.findUnique({
//       where: {
//         id: campaignId,
//         advertiserId
//       },
//       select: {
//         id: true,
//         name: true,
//         clientId: true
//       }
//     });

//     if (!campaign) {
//       throw new ResourceNotFoundException('Campaign', campaignId);
//     }

//     // Get the existing creative
//     const existingCreative = await this.prisma.creative.findFirst({
//       where: {
//         id: creativeId,
//         campaignId
//       },
//       include: {
//         inventory: {
//           select: {
//             id: true,
//             name: true,
//             width: true,
//             height: true,
//             publisherId: true
//           }
//         }
//       }
//     });

//     if (!existingCreative) {
//       throw new ResourceNotFoundException('Creative', creativeId);
//     }

//     // Only allow updates of pending or rejected creatives
//     if (existingCreative.status === CreativeStatus.APPROVED) {
//       throw new BadRequestException('Cannot update an approved creative. Please create a new one instead.');
//     }

//     // Prepare update data
//     const updateData: any = {};

//     // Update name if provided
//     if (updateDto.name) {
//       updateData.name = updateDto.name;
//     }

//     // Update landing URL if provided
//     if (updateDto.landingUrl) {
//       updateData.landingUrl = updateDto.landingUrl;
//     }

//     // Handle file upload if provided
//     if (file) {
//       // Validate file type
//       const fileTypeAllowed = this.creativeHelper.ALLOWED_FILE_TYPES[existingCreative.type]?.includes(file.mimetype);
//       if (!fileTypeAllowed) {
//         throw new BadRequestException(
//           `File type ${file.mimetype} is not allowed for ${existingCreative.type}. Allowed types: ${this.creativeHelper.ALLOWED_FILE_TYPES[existingCreative.type].join(', ')}`
//         );
//       }

//       // Validate file size
//       if (file.size > this.creativeHelper.MAX_FILE_SIZES[existingCreative.type]) {
//         throw new BadRequestException(
//           `File size exceeds maximum allowed for ${existingCreative.type} (${file.size} bytes / ${this.creativeHelper.MAX_FILE_SIZES[existingCreative.type]} bytes)`
//         );
//       }

//       // Validate dimensions for images
//       if (existingCreative.type === 'IMAGE') {
//         const dimensions = await this.creativeHelper.getImageDimensions(file);
//         if (dimensions.width !== existingCreative.width || dimensions.height !== existingCreative.height) {
//           throw new BadRequestException(
//             `Image dimensions (${dimensions.width}x${dimensions.height}) do not match the required dimensions (${existingCreative.width}x${existingCreative.height})`
//           );
//         }
//       }

//       // Validate creative content
//       try {
//         // ! Pending implementation
//         // await this.creativeHelper.validateCreativeContent(creative.id)

//         // If you have more sophisticated validation, uncomment and implement this
//         // await this.creativeHelper.validateCreativeContent(file.buffer, existingCreative.type);
//       } catch (error) {
//         this.logger.error(`Error validating creative content: ${error.message}`);
//         throw new BadRequestException(`Creative validation failed: ${error.message}`);
//       }
//     }

//     // If file is provided, update the file in S3
//     if (file) {
//       // Generate new filename
//       const timestamp = Date.now();
//       const fileExt = mime.extension(file.mimetype) || 'jpg';
//       const filename = `creative-${timestamp}.${fileExt}`;

//       // Generate new S3 key
//       const newS3Key = this.s3StorageService.generateCreativeKey(
//         campaign.name,
//         campaignId,
//         existingCreative.inventory.name,
//         existingCreative.inventory.id,
//         filename
//       );

//       try {
//         // Upload new file to S3
//         await this.s3StorageService.uploadFile(
//           file.buffer,
//           newS3Key,
//           file.mimetype
//         );

//         // If successful, delete the old file if it exists
//         if (existingCreative.s3Key) {
//           try {
//             await this.s3StorageService.deleteFile(existingCreative.s3Key);
//             this.logger.log(`Deleted old creative file: ${existingCreative.s3Key}`);
//           } catch (deleteError) {
//             this.logger.warn(`Failed to delete old file: ${deleteError.message}`);
//             // Continue with the update even if deletion fails
//           }
//         }

//         // Update S3 key and file URL
//         updateData.s3Key = newS3Key;
//         updateData.fileUrl = this.s3StorageService.getPublicUrl(newS3Key);
//       } catch (error) {
//         this.logger.error(`Failed to update creative file in S3: ${error.message}`);
//         throw new BadRequestException(`Failed to update creative file: ${error.message}`);
//       }
//     }

//     // Reset status to pending review if any changes were made
//     if (Object.keys(updateData).length > 0) {
//       updateData.status = CreativeStatus.PENDING_REVIEW;
//     } else {
//       // No changes were made, return the existing creative
//       return existingCreative;
//     }

//     // Update the creative
//     const updatedCreative = await this.prisma.creative.update({
//       where: { id: creativeId },
//       data: updateData
//     });

//     // Send notifications about the update
//     try {
//       await this.creativeNotificationService.notifyCreativeUpdated(
//         updatedCreative,
//         campaign,
//         advertiserId,
//         campaign.clientId!,
//         existingCreative.inventory.publisherId
//       );
//     } catch (error) {
//       this.logger.error(`Failed to send update notifications: ${error.message}`);
//     }

//     return updatedCreative;
//   }

//   // /**
//   //  * Store the creative file with descriptive folder structure
//   //  */
//   // private async storeCreativeFile(
//   //   file: Express.Multer.File,
//   //   campaignId: string,
//   //   campaignName: string,
//   //   inventoryId: string,
//   //   inventoryName: string
//   // ): Promise<string> {
//   //   // Sanitize names for filesystem use
//   //   const safeCampaignName = this.creativeHelper.slugify(campaignName);
//   //   const safeInventoryName = this.creativeHelper.slugify(inventoryName);

//   //   // Create directory structure: uploads/campaign-name-campaignId/inventory-name-inventoryId/
//   //   const dirPath = path.join(
//   //     this.baseUploadPath,
//   //     `${safeCampaignName}-${campaignId}`,
//   //     `${safeInventoryName}-${inventoryId}`
//   //   );

//   //   await mkdir(dirPath, { recursive: true });

//   //   // Generate unique filename
//   //   const timestamp = Date.now();
//   //   const fileExt = mime.extension(file.mimetype) || path.extname(file.originalname).substring(1);
//   //   const filename = `creative-${timestamp}.${fileExt}`;
//   //   const filePath = path.join(dirPath, filename);

//   //   // Write file to disk
//   //   await writeFile(filePath, file.buffer);

//   //   // Return the URL relative to the server
//   //   return `${this.serverUrl}/uploads/${safeCampaignName}-${campaignId}/${safeInventoryName}-${inventoryId}/${filename}`;
//   // }

//   /**
//    * Get all creatives for a campaign
//    */
//   async getCreatives(campaignId: string, advertiserId: string) {
//     // Verify campaign exists and belongs to the advertiser
//     const campaign = await this.prisma.campaign.findUnique({
//       where: {
//         id: campaignId,
//         advertiserId
//       },
//       select: { id: true }
//     });

//     if (!campaign) {
//       throw new ResourceNotFoundException('Campaign', campaignId);
//     }

//     return this.prisma.creative.findMany({
//       where: { campaignId },
//       include: {
//         inventory: {
//           select: {
//             id: true,
//             name: true,
//             width: true,
//             height: true,
//             format: true,
//             position: true
//           }
//         }
//       },
//       orderBy: { createdAt: 'desc' }
//     });
//   }

//   /**
//    * Get a specific creative
//    */
//   async getCreative(creativeId: string, campaignId: string, advertiserId: string) {
//     // Verify campaign exists and belongs to the advertiser
//     const campaign = await this.prisma.campaign.findUnique({
//       where: {
//         id: campaignId,
//         advertiserId
//       },
//       select: { id: true }
//     });

//     if (!campaign) {
//       throw new ResourceNotFoundException('Campaign', campaignId);
//     }

//     const creative = await this.prisma.creative.findFirst({
//       where: {
//         id: creativeId,
//         campaignId
//       },
//       include: {
//         inventory: true
//       }
//     });

//     if (!creative) {
//       throw new ResourceNotFoundException('Creative', creativeId);
//     }

//     return creative;
//   }

//   /**
//    * Remove a creative
//    */
//   async removeCreative(creativeId: string, campaignId: string, advertiserId: string) {
//     // Get creative with all necessary related data for notifications
//     const creative = await this.prisma.creative.findFirst({
//       where: {
//         id: creativeId,
//         campaignId
//       },
//       include: {
//         campaign: {
//           select: {
//             id: true,
//             name: true,
//             clientId: true
//           }
//         },
//         inventory: {
//           select: {
//             id: true,
//             name: true,
//             publisherId: true
//           }
//         }
//       }
//     });

//     if (!creative) {
//       throw new ResourceNotFoundException('Creative', creativeId);
//     }

//     // Verify campaign belongs to the advertiser
//     const campaign = await this.prisma.campaign.findUnique({
//       where: {
//         id: campaignId,
//         advertiserId
//       }
//     });

//     if (!campaign) {
//       throw new ResourceNotFoundException('Campaign', campaignId);
//     }

//     try {
//       // Check if this is the last creative for the inventory
//       const creativeCount = await this.prisma.creative.count({
//         where: {
//           campaignId,
//           inventoryId: creative.inventory.id
//         }
//       });

//       // Delete the creative from the database
//       await this.prisma.creative.delete({
//         where: { id: creativeId }
//       });

//       // Delete the file from S3
//       if (creative.s3Key) {
//         await this.s3StorageService.deleteFile(creative.s3Key);
//       }

//       // If this was the last creative for this inventory, delete the inventory folder
//       if (creativeCount === 1) {
//         await this.s3StorageService.deleteInventoryFolder(
//           campaign.name,
//           campaignId,
//           creative.inventory.name,
//           creative.inventory.id
//         );
//       }

//       // Send notifications
//       try {
//         await this.creativeNotificationService.notifyCreativeRemoved(
//           creative,
//           creative.campaign,
//           advertiserId,
//           creative.campaign.clientId!,
//           creative.inventory.publisherId
//         );
//       } catch (error) {
//         this.logger.error(`Failed to send notifications: ${error.message}`);
//       }

//       return { success: true, message: 'Creative removed successfully' };
//     } catch (error) {
//       this.logger.error(`Error removing creative: ${error.message}`);
//       throw new BadRequestException(`Failed to remove creative: ${error.message}`);
//     }
//   }

//   /**
//    * Handle inventory name update - move all creatives to the new folder
//    * This should be called when an inventory name is updated
//    */
//   async handleInventoryNameUpdate(
//     campaignId: string,
//     inventoryId: string,
//     oldInventoryName: string,
//     newInventoryName: string
//   ): Promise<boolean> {
//     try {
//       // Get campaign name
//       const campaign = await this.prisma.campaign.findUnique({
//         where: { id: campaignId },
//         select: { name: true }
//       });

//       if (!campaign) {
//         throw new ResourceNotFoundException('Campaign', campaignId);
//       }

//       // Get all creatives for this inventory
//       const creatives = await this.prisma.creative.findMany({
//         where: {
//           campaignId,
//           inventoryId
//         }
//       });

//       if (creatives.length === 0) {
//         return true; // No creatives to update
//       }

//       // Move all files to the new folder location
//       await this.s3StorageService.moveInventoryFolder(
//         campaign.name,
//         campaignId,
//         oldInventoryName,
//         inventoryId,
//         newInventoryName
//       );

//       // Update S3 keys and fileUrls in the database
//       for (const creative of creatives) {
//         if (creative.s3Key) {
//           // Extract filename from old S3 key
//           const filename = creative.s3Key.split('/').pop();

//           // Generate new S3 key
//           const newS3Key = this.s3StorageService.generateCreativeKey(
//             campaign.name,
//             campaignId,
//             newInventoryName,
//             inventoryId,
//             filename!
//           );

//           // Update creative record
//           await this.prisma.creative.update({
//             where: { id: creative.id },
//             data: {
//               s3Key: newS3Key,
//               fileUrl: this.s3StorageService.getPublicUrl(newS3Key)
//             }
//           });
//         }
//       }

//       return true;
//     } catch (error) {
//       this.logger.error(`Error handling inventory name update: ${error.message}`);
//       return false;
//     }
//   }

//   /**
//    * Manual approval of a creative (for admin use)
//    */
//   async approveCreative(creativeId: string, notes?: string) {
//     const creative = await this.prisma.creative.findUnique({
//       where: { id: creativeId },
//       include: {
//         campaign: {
//           select: {
//             id: true,
//             name: true,
//             advertiserId: true,
//             clientId: true
//           }
//         },
//         inventory: {
//           select: {
//             id: true,
//             name: true,
//             publisherId: true
//           }
//         }
//       }
//     });

//     if (!creative) {
//       throw new ResourceNotFoundException('Creative', creativeId);
//     }

//     // Update creative status
//     const updatedCreative = await this.prisma.creative.update({
//       where: { id: creativeId },
//       data: {
//         status: CreativeStatus.APPROVED,
//         reviewNotes: notes || 'Approved'
//       }
//     });

//     // Send notifications
//     try {
//       await this.creativeNotificationService.notifyCreativeApproved(
//         creative,
//         creative.campaign,
//         creative.campaign.advertiserId,
//         creative.campaign.clientId!,
//         creative.inventory.publisherId,
//         notes
//       );
//     } catch (error) {
//       this.logger.error(`Failed to send notifications: ${error.message}`);
//     }

//     return updatedCreative;
//   }

//   /**
//    * Manual rejection of a creative (for admin use)
//    */
//   async rejectCreative(creativeId: string, reason: string) {
//     const creative = await this.prisma.creative.findUnique({
//       where: { id: creativeId },
//       include: {
//         campaign: {
//           select: {
//             id: true,
//             name: true,
//             advertiserId: true,
//             clientId: true
//           }
//         },
//         inventory: {
//           select: {
//             id: true,
//             name: true,
//             publisherId: true
//           }
//         }
//       }
//     });

//     if (!creative) {
//       throw new ResourceNotFoundException('Creative', creativeId);
//     }

//     // Update creative status
//     const updatedCreative = await this.prisma.creative.update({
//       where: { id: creativeId },
//       data: {
//         status: CreativeStatus.REJECTED,
//         reviewNotes: reason
//       }
//     });

//     // Send notifications
//     try {
//       await this.creativeNotificationService.notifyCreativeRejected(
//         creative,
//         creative.campaign,
//         creative.campaign.advertiserId,
//         creative.campaign.clientId!,
//         creative.inventory.publisherId,
//         reason
//       );
//     } catch (error) {
//       this.logger.error(`Failed to send notifications: ${error.message}`);
//     }

//     return updatedCreative;
//   }

//   /**
//  * Get all creatives pending review (for admin use)
//  */
//   async getPendingCreatives() {
//     return this.prisma.creative.findMany({
//       where: { status: CreativeStatus.PENDING_REVIEW },
//       include: {
//         campaign: {
//           select: {
//             id: true,
//             name: true,
//             advertiserId: true
//           }
//         },
//         inventory: {
//           select: {
//             id: true,
//             name: true,
//             publisherId: true,
//             width: true,
//             height: true,
//             format: true
//           }
//         }
//       },
//       orderBy: { createdAt: 'desc' }
//     });
//   }

//   /**
//    * Get a specific creative regardless of ownership (for admin use)
//    */
//   async getCreativeForAdmin(creativeId: string) {
//     const creative = await this.prisma.creative.findUnique({
//       where: { id: creativeId },
//       include: {
//         campaign: {
//           select: {
//             id: true,
//             name: true,
//             advertiserId: true,
//             clientId: true
//           }
//         },
//         inventory: {
//           select: {
//             id: true,
//             name: true,
//             publisherId: true,
//             width: true,
//             height: true,
//             format: true,
//             position: true
//           }
//         }
//       }
//     });

//     if (!creative) {
//       throw new ResourceNotFoundException('Creative', creativeId);
//     }

//     return creative;
//   }

//   async getCreativePresignedUrl(
//     creativeId: string,
//     campaignId: string,
//     advertiserId: string,
//     expiresIn: number = 3600
//   ): Promise<{ url: string }> {
//     // Verify permissions
//     const creative = await this.getCreative(creativeId, campaignId, advertiserId);

//     if (!creative.s3Key) {
//       throw new BadRequestException('Creative has no associated S3 file');
//     }

//     // Generate pre-signed URL
//     const url = await this.s3StorageService.getPresignedUrl(
//       creative.s3Key,
//       expiresIn
//     );

//     return { url };
//   }
// }
