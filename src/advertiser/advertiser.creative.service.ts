import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreativeStatus, CreativeType, InventoryFormat } from '@prisma/client';
import {
  ResourceNotFoundException,
  ForbiddenException,
} from '../common/exceptions/custom.exception';
import { ConfigService } from '@nestjs/config';
import * as mime from 'mime-types';
import { CreateCreativeDto } from './dto/creative/create-creative.dto';
import { UpdateCreativeDto } from './dto/creative/update-creative.dto';
import { S3StorageService } from '../common/services/s3-storage.service';
import { AdvertiserHelper } from './advertiser.helper';
import { CreativeNotificationService } from 'src/notification/services/creative.notification.service';

@Injectable()
export class AdvertiserCreativeService {
  private readonly logger = new Logger(AdvertiserCreativeService.name);

  // Configuration constants
  private readonly MAX_FILE_SIZES = {
    IMAGE: 5 * 1024 * 1024, // 5MB for images
    VIDEO: 50 * 1024 * 1024, // 50MB for videos
    HTML5: 10 * 1024 * 1024, // 10MB for HTML5
    HTML: 5 * 1024 * 1024, // 5MB for HTML
    RICH_MEDIA: 20 * 1024 * 1024, // 20MB for rich media
  };

  private readonly ALLOWED_FILE_TYPES = {
    IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    VIDEO: ['video/mp4', 'video/webm', 'video/ogg'],
    HTML5: ['application/zip', 'text/html'],
    HTML: ['text/html', 'application/zip'],
    RICH_MEDIA: ['application/zip', 'text/html'],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly s3StorageService: S3StorageService,
    private readonly advertiserHelper: AdvertiserHelper,
    private readonly creativeNotificationService: CreativeNotificationService,
  ) {}

  /**
   * Get all available ad slot templates
   */
  async getAdSlotTemplates() {
    return this.prisma.adSlotTemplate.findMany({
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Add a new creative to a campaign
   */
  async addCreative(
    campaignId: string,
    advertiserId: string,
    dto: CreateCreativeDto,
    file: Express.Multer.File,
  ) {
    // Verify campaign exists and belongs to the advertiser
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        name: true,
        advertiserId: true,
        clientId: true,
        status: true,
      },
    });

    if (!campaign) {
      throw new ResourceNotFoundException('Campaign', campaignId);
    }

    if (campaign.advertiserId !== advertiserId) {
      throw new ForbiddenException('You do not have access to this campaign');
    }

    // Check if campaign allows adding creatives
    if (['COMPLETED', 'CANCELED', 'REJECTED'].includes(campaign.status)) {
      throw new BadRequestException(
        `Cannot add creative to a campaign with status: ${campaign.status}`,
      );
    }

    // Verify ad slot template exists
    const template = await this.prisma.adSlotTemplate.findUnique({
      where: { id: dto.templateId },
    });

    if (!template) {
      throw new ResourceNotFoundException('Ad Slot Template', dto.templateId);
    }

    // Check if creative type is compatible with the campaign's inventory format
    const isCompatible =
      await this.advertiserHelper.validateCreativeCompatibility(
        dto.type as CreativeType,
        template.format,
      );

    if (!isCompatible) {
      throw new BadRequestException(
        `Creative type ${dto.type} is not compatible with inventory format ${template.format}`,
      );
    }

    // Validate file type and size
    await this.validateCreativeFile(file, dto.type as CreativeType);

    // Validate dimensions for images
    if (dto.type === 'IMAGE') {
      const dimensions = await this.advertiserHelper.getImageDimensions(
        file.buffer,
      );
      if (
        dimensions.width !== template.width ||
        dimensions.height !== template.height
      ) {
        throw new BadRequestException(
          `Image dimensions (${dimensions.width}x${dimensions.height}) do not match template dimensions (${template.width}x${template.height})`,
        );
      }
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExt = mime.extension(file.mimetype) || 'jpg';
    const filename = `${this.advertiserHelper.slugify(dto.name)}-${timestamp}.${fileExt}`;

    // Store the creative file in S3
    const s3Key = this.s3StorageService.generateCreativeKey(
      campaign.name,
      campaignId,
      filename,
    );

    // Generate public URL for the file
    const fileUrl = this.s3StorageService.getPublicUrl(s3Key);

    try {
      // Upload file to S3
      await this.s3StorageService.uploadFile(file.buffer, s3Key, file.mimetype);

      // Create the creative in the database
      const creative = await this.prisma.creative.create({
        data: {
          campaign: {
            connect: { id: campaignId },
          },
          adSlotTemplate: {
            connect: { id: dto.templateId },
          },
          name: dto.name,
          type: dto.type as CreativeType,
          s3Key: s3Key,
          fileUrl: fileUrl,
          landingUrl: dto.landingUrl,
          status: CreativeStatus.APPROVED,
        },
        include: {
          adSlotTemplate: true,
        },
      });

      this.logger.log(`Creative created successfully: ${creative.id}`);

      try {
        await this.creativeNotificationService.notifyCreativeAdded(
          creative,
          campaign,
          advertiserId,
          campaign.clientId!,
        );
      } catch (error) {
        this.logger.error(`Failed to send notifications: ${error.message}`);
      }

      return creative;
    } catch (error) {
      // If database creation fails, clean up the uploaded file
      try {
        await this.s3StorageService.deleteFile(s3Key);
      } catch (deleteError) {
        this.logger.warn(
          `Failed to clean up file after error: ${deleteError.message}`,
        );
      }

      this.logger.error(`Failed to create creative: ${error.message}`);
      throw new BadRequestException(
        `Failed to create creative: ${error.message}`,
      );
    }
  }

  /**
   * Update a creative
   */
  async updateCreative(
    creativeId: string,
    campaignId: string,
    advertiserId: string,
    updateDto: UpdateCreativeDto,
    file?: Express.Multer.File,
  ) {
    // Verify campaign exists and belongs to the advertiser
    const campaign = await this.prisma.campaign.findUnique({
      where: {
        id: campaignId,
        advertiserId,
      },
      select: {
        id: true,
        name: true,
        clientId: true,
      },
    });

    if (!campaign) {
      throw new ResourceNotFoundException('Campaign', campaignId);
    }

    // Get the existing creative
    const existingCreative = await this.prisma.creative.findFirst({
      where: {
        id: creativeId,
        campaignId,
      },
      include: {
        adSlotTemplate: true,
      },
    });

    if (!existingCreative) {
      throw new ResourceNotFoundException('Creative', creativeId);
    }

    // Only allow updates of pending or rejected creatives
    if (existingCreative.status === CreativeStatus.APPROVED) {
      throw new BadRequestException(
        'Cannot update an approved creative. Please create a new one instead.',
      );
    }

    // Prepare update data
    const updateData: any = {};

    // Update name if provided
    if (updateDto.name) {
      updateData.name = updateDto.name;
    }

    // Update landing URL if provided
    if (updateDto.landingUrl) {
      updateData.landingUrl = updateDto.landingUrl;
    }

    // Update type if provided
    if (updateDto.type) {
      updateData.type = updateDto.type;
    }

    // Handle file upload if provided
    if (file) {
      // Check if creative type is compatible with the campaign's inventory format
      const isCompatible =
        await this.advertiserHelper.validateCreativeCompatibility(
          updateDto.type as CreativeType,
          existingCreative.adSlotTemplate.format,
        );

      if (!isCompatible) {
        throw new BadRequestException(
          `Creative type ${updateDto.type} is not compatible with inventory format ${existingCreative.adSlotTemplate.format}`,
        );
      }

      // Validate file type and size
      await this.validateCreativeFile(file, existingCreative.type);

      // Validate dimensions for images
      if (existingCreative.type === 'IMAGE') {
        const dimensions = await this.advertiserHelper.getImageDimensions(
          file.buffer,
        );
        if (
          dimensions.width !== existingCreative.adSlotTemplate.width ||
          dimensions.height !== existingCreative.adSlotTemplate.height
        ) {
          throw new BadRequestException(
            `Image dimensions (${dimensions.width}x${dimensions.height}) do not match template dimensions (${existingCreative.adSlotTemplate.width}x${existingCreative.adSlotTemplate.height})`,
          );
        }
      }

      // Generate new filename
      const timestamp = Date.now();
      const fileExt = mime.extension(file.mimetype) || 'jpg';
      const filename = `${this.advertiserHelper.slugify(updateDto.name || existingCreative.name)}-${timestamp}.${fileExt}`;

      // Generate new S3 key
      const newS3Key = this.s3StorageService.generateCreativeKey(
        campaign.name,
        campaignId,
        filename,
      );

      try {
        // Upload new file to S3
        await this.s3StorageService.uploadFile(
          file.buffer,
          newS3Key,
          file.mimetype,
        );

        // If successful, delete the old file if it exists
        if (existingCreative.s3Key) {
          try {
            await this.s3StorageService.deleteFile(existingCreative.s3Key);
            this.logger.log(
              `Deleted old creative file: ${existingCreative.s3Key}`,
            );
          } catch (deleteError) {
            this.logger.warn(
              `Failed to delete old file: ${deleteError.message}`,
            );
            // Continue with the update even if deletion fails
          }
        }

        // Update S3 key and file URL
        updateData.s3Key = newS3Key;
        updateData.fileUrl = this.s3StorageService.getPublicUrl(newS3Key);
      } catch (error) {
        this.logger.error(
          `Failed to update creative file in S3: ${error.message}`,
        );
        throw new BadRequestException(
          `Failed to update creative file: ${error.message}`,
        );
      }
    }

    // Reset status to pending review if any changes were made
    if (Object.keys(updateData).length > 0) {
      updateData.status = CreativeStatus.PENDING_REVIEW;
    } else {
      // No changes were made, return the existing creative
      return existingCreative;
    }

    // Update the creative
    const updatedCreative = await this.prisma.creative.update({
      where: { id: creativeId },
      data: updateData,
      include: {
        adSlotTemplate: true,
      },
    });

    this.logger.log(`Creative updated successfully: ${creativeId}`);
    return updatedCreative;
  }

  /**
   * Get all creatives for a campaign
   */
  async getCreatives(campaignId: string, advertiserId: string) {
    // Verify campaign exists and belongs to the advertiser
    const campaign = await this.prisma.campaign.findUnique({
      where: {
        id: campaignId,
        advertiserId,
      },
      select: { id: true },
    });

    if (!campaign) {
      throw new ResourceNotFoundException('Campaign', campaignId);
    }

    return this.prisma.creative.findMany({
      where: { campaignId },
      include: {
        adSlotTemplate: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a specific creative
   */
  async getCreative(
    creativeId: string,
    campaignId: string,
    advertiserId: string,
  ) {
    // Verify campaign exists and belongs to the advertiser
    const campaign = await this.prisma.campaign.findUnique({
      where: {
        id: campaignId,
        advertiserId,
      },
      select: { id: true },
    });

    if (!campaign) {
      throw new ResourceNotFoundException('Campaign', campaignId);
    }

    const creative = await this.prisma.creative.findFirst({
      where: {
        id: creativeId,
        campaignId,
      },
      include: {
        adSlotTemplate: true,
      },
    });

    if (!creative) {
      throw new ResourceNotFoundException('Creative', creativeId);
    }

    return creative;
  }

  /**
   * Remove a creative
   */
  async removeCreative(
    creativeId: string,
    campaignId: string,
    advertiserId: string,
  ) {
    // Get creative with all necessary related data
    const creative = await this.prisma.creative.findFirst({
      where: {
        id: creativeId,
        campaignId,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            clientId: true,
            advertiserId: true,
          },
        },
        adSlotTemplate: true,
      },
    });

    if (!creative) {
      throw new ResourceNotFoundException('Creative', creativeId);
    }

    // Verify campaign belongs to the advertiser
    if (creative.campaign.advertiserId !== advertiserId) {
      throw new ForbiddenException('You do not have access to this campaign');
    }

    try {
      // Delete the creative from the database
      await this.prisma.creative.delete({
        where: { id: creativeId },
      });

      // Delete the file from S3
      if (creative.s3Key) {
        await this.s3StorageService.deleteFile(creative.s3Key);
      }

      this.logger.log(`Creative removed successfully: ${creativeId}`);
      return { success: true, message: 'Creative removed successfully' };
    } catch (error) {
      this.logger.error(`Error removing creative: ${error.message}`);
      throw new BadRequestException(
        `Failed to remove creative: ${error.message}`,
      );
    }
  }

  /**
   * Get a pre-signed URL for accessing a creative
   */
  async getCreativePresignedUrl(
    creativeId: string,
    campaignId: string,
    advertiserId: string,
    expiresIn: number = 3600,
  ): Promise<{ url: string }> {
    // Verify permissions
    const creative = await this.getCreative(
      creativeId,
      campaignId,
      advertiserId,
    );

    if (!creative.s3Key) {
      throw new BadRequestException('Creative has no associated S3 file');
    }

    // Generate pre-signed URL
    const url = await this.s3StorageService.getPresignedUrl(
      creative.s3Key,
      expiresIn,
    );

    return { url };
  }

  /**
   * Get creatives by template ID (for targeting specific ad slots)
   */
  async getCreativesByTemplate(
    campaignId: string,
    templateId: string,
    advertiserId: string,
  ) {
    // Verify campaign exists and belongs to the advertiser
    const campaign = await this.prisma.campaign.findUnique({
      where: {
        id: campaignId,
        advertiserId,
      },
      select: { id: true },
    });

    if (!campaign) {
      throw new ResourceNotFoundException('Campaign', campaignId);
    }

    return this.prisma.creative.findMany({
      where: {
        campaignId,
        templateId,
        status: CreativeStatus.APPROVED,
      },
      include: {
        adSlotTemplate: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get creatives by status
   */
  async getCreativesByStatus(
    campaignId: string,
    status: CreativeStatus,
    advertiserId: string,
  ) {
    // Verify campaign exists and belongs to the advertiser
    const campaign = await this.prisma.campaign.findUnique({
      where: {
        id: campaignId,
        advertiserId,
      },
      select: { id: true },
    });

    if (!campaign) {
      throw new ResourceNotFoundException('Campaign', campaignId);
    }

    return this.prisma.creative.findMany({
      where: {
        campaignId,
        status,
      },
      include: {
        adSlotTemplate: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Validate creative file type and size
   */
  private async validateCreativeFile(
    file: Express.Multer.File,
    creativeType: CreativeType,
  ): Promise<void> {
    // Validate file type
    const allowedTypes = this.ALLOWED_FILE_TYPES[creativeType];
    if (!allowedTypes || !allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed for ${creativeType}. Allowed types: ${allowedTypes?.join(', ') || 'none'}`,
      );
    }

    // Validate file size
    const maxSize = this.MAX_FILE_SIZES[creativeType];
    if (!maxSize || file.size > maxSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed for ${creativeType} (${file.size} bytes / ${maxSize || 0} bytes)`,
      );
    }
  }
}
