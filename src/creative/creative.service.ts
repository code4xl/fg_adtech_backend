import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreativeStatus } from '@prisma/client';
import { ResourceNotFoundException } from '../common/exceptions/custom.exception';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import * as mime from 'mime-types';
import { CreativeHelperService } from './creative.helper';
import { CreateCreativeDto } from './dto/create-creative.dto';

// Convert callback-based fs functions to Promise-based
const mkdir = util.promisify(fs.mkdir);
const writeFile = util.promisify(fs.writeFile);

@Injectable()
export class CreativeService {
  private readonly logger = new Logger(CreativeService.name);
  private readonly baseUploadPath: string;
  private readonly serverUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly creativeHelper: CreativeHelperService
  ) {
    // Initialize base upload path and ensure it exists
    this.baseUploadPath = path.join(process.cwd(), 'uploads');
    this.serverUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';

    // Create base upload directory if it doesn't exist
    if (!fs.existsSync(this.baseUploadPath)) {
      fs.mkdirSync(this.baseUploadPath, { recursive: true });
    }
  }

  /**
   * Add a new creative to a campaign
   */
  async addCreative(
    campaignId: string,
    advertiserId: string,
    dto: CreateCreativeDto, // Using the DTO without width/height
    file: Express.Multer.File
  ) {
    // Verify campaign exists and belongs to the advertiser
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        name: true,
        advertiserId: true,
        status: true,
        campaignInventories: {
          where: {
            inventoryId: dto.inventoryId
          },
          include: {
            inventory: {
              select: {
                id: true,
                name: true,
                width: true,
                height: true,
                isActive: true,
                approvalStatus: true
              }
            }
          }
        }
      }
    });

    if (!campaign) {
      throw new ResourceNotFoundException('Campaign', campaignId);
    }

    if (campaign.advertiserId !== advertiserId) {
      throw new BadRequestException('You do not have access to this campaign');
    }

    // Check if the specified inventory belongs to this campaign
    if (campaign.campaignInventories.length === 0) {
      throw new BadRequestException(
        `Inventory ${dto.inventoryId} is not associated with this campaign. Please add it first.`
      );
    }

    const campaignInventory = campaign.campaignInventories[0];
    const inventory = campaignInventory.inventory;

    // Check if inventory is active and approved
    if (!inventory.isActive || inventory.approvalStatus !== 'APPROVED') {
      throw new BadRequestException(
        `Inventory ${dto.inventoryId} is not active or not approved.`
      );
    }

    let dimensions;
    try {
      // Get image dimensions (we'll only validate file type and size here)
      if (dto.type === 'IMAGE') {
        dimensions = await this.creativeHelper.getImageDimensions(file);
      } else {
        throw new BadRequestException(`Creative type ${dto.type} is not currently supported`);
      }

      // Validate dimensions against inventory
      if (dimensions.width !== inventory.width || dimensions.height !== inventory.height) {
        throw new BadRequestException(
          `Image dimensions (${dimensions.width}x${dimensions.height}) do not match the selected inventory dimensions (${inventory.width}x${inventory.height})`
        );
      }
    } catch (error) {
      throw new BadRequestException(`Dimension validation failed: ${error.message}`);
    }

    // Validate other technical aspects
    const fileTypeAllowed = this.creativeHelper.ALLOWED_FILE_TYPES[dto.type]?.includes(file.mimetype);
    if (!fileTypeAllowed) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed for ${dto.type}. Allowed types: ${this.creativeHelper.ALLOWED_FILE_TYPES[dto.type].join(', ')}`
      );
    }

    if (file.size > this.creativeHelper.MAX_FILE_SIZES[dto.type]) {
      throw new BadRequestException(
        `File size exceeds maximum allowed for ${dto.type} (${file.size} bytes / ${this.creativeHelper.MAX_FILE_SIZES[dto.type]} bytes)`
      );
    }

    // Store the creative file using campaign and inventory names
    const fileUrl = await this.storeCreativeFile(
      file,
      campaignId,
      campaign.name,
      inventory.id,
      inventory.name
    );

    return this.prisma.$transaction(async (tx) => {
      // Create the creative in the database
      const creative = await this.prisma.creative.create({
        data: {
          campaign: {
            connect: { id: campaignId }
          },
          inventory: {
            connect: { id: dto.inventoryId }
          },
          name: dto.name,
          type: dto.type,
          width: dimensions.width,    // Use detected dimensions
          height: dimensions.height,   // Use detected dimensions
          fileUrl: fileUrl,
          landingUrl: dto.landingUrl,
          status: CreativeStatus.PENDING_REVIEW // Initial status pending validation
        }
      });

      return await this.creativeHelper.validateCreativeContent(creative.id)
        .catch(error => this.logger.error(`Error during creative validation: ${error.message}`));
    })
  }

  /**
   * Store the creative file with descriptive folder structure
   */
  private async storeCreativeFile(
    file: Express.Multer.File,
    campaignId: string,
    campaignName: string,
    inventoryId: string,
    inventoryName: string
  ): Promise<string> {
    // Sanitize names for filesystem use
    const safeCampaignName = this.creativeHelper.slugify(campaignName);
    const safeInventoryName = this.creativeHelper.slugify(inventoryName);

    // Create directory structure: uploads/campaign-name-campaignId/inventory-name-inventoryId/
    const dirPath = path.join(
      this.baseUploadPath,
      `${safeCampaignName}-${campaignId}`,
      `${safeInventoryName}-${inventoryId}`
    );

    await mkdir(dirPath, { recursive: true });

    // Generate unique filename
    const timestamp = Date.now();
    const fileExt = mime.extension(file.mimetype) || path.extname(file.originalname).substring(1);
    const filename = `creative-${timestamp}.${fileExt}`;
    const filePath = path.join(dirPath, filename);

    // Write file to disk
    await writeFile(filePath, file.buffer);

    // Return the URL relative to the server
    return `${this.serverUrl}/uploads/${safeCampaignName}-${campaignId}/${safeInventoryName}-${inventoryId}/${filename}`;
  }

  /**
   * Get all creatives for a campaign
   */
  async getCreatives(campaignId: string, advertiserId: string) {
    // Verify campaign exists and belongs to the advertiser
    const campaign = await this.prisma.campaign.findUnique({
      where: {
        id: campaignId,
        advertiserId
      },
      select: { id: true }
    });

    if (!campaign) {
      throw new ResourceNotFoundException('Campaign', campaignId);
    }

    return this.prisma.creative.findMany({
      where: { campaignId },
      include: {
        inventory: {
          select: {
            id: true,
            name: true,
            width: true,
            height: true,
            format: true,
            position: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Get a specific creative
   */
  async getCreative(creativeId: string, campaignId: string, advertiserId: string) {
    // Verify campaign exists and belongs to the advertiser
    const campaign = await this.prisma.campaign.findUnique({
      where: {
        id: campaignId,
        advertiserId
      },
      select: { id: true }
    });

    if (!campaign) {
      throw new ResourceNotFoundException('Campaign', campaignId);
    }

    const creative = await this.prisma.creative.findFirst({
      where: {
        id: creativeId,
        campaignId
      },
      include: {
        inventory: true
      }
    });

    if (!creative) {
      throw new ResourceNotFoundException('Creative', creativeId);
    }

    return creative;
  }

  /**
   * Remove a creative
   */
  async removeCreative(creativeId: string, campaignId: string, advertiserId: string) {
    // Verify creative exists and belongs to the campaign/advertiser
    await this.getCreative(creativeId, campaignId, advertiserId);

    // Delete the creative
    return this.prisma.creative.delete({
      where: { id: creativeId }
    });
  }

  /**
   * Manual approval of a creative (for admin use)
   */
  async approveCreative(creativeId: string, notes?: string) {
    const creative = await this.prisma.creative.findUnique({
      where: { id: creativeId }
    });

    if (!creative) {
      throw new ResourceNotFoundException('Creative', creativeId);
    }

    return this.prisma.creative.update({
      where: { id: creativeId },
      data: {
        status: CreativeStatus.APPROVED,
        reviewNotes: notes || 'Manually approved by admin'
      }
    });
  }

  /**
   * Manual rejection of a creative (for admin use)
   */
  async rejectCreative(creativeId: string, reason: string) {
    const creative = await this.prisma.creative.findUnique({
      where: { id: creativeId }
    });

    if (!creative) {
      throw new ResourceNotFoundException('Creative', creativeId);
    }

    return this.prisma.creative.update({
      where: { id: creativeId },
      data: {
        status: CreativeStatus.REJECTED,
        reviewNotes: reason
      }
    });
  }
}