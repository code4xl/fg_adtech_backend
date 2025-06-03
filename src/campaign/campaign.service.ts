import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CampaignQueryDto } from './dto/campaign-query.dto';
import { CampaignStatus, Prisma, TargetingRuleType } from '@prisma/client';
import {
  ResourceNotFoundException,
  BadRequestException,
  ForbiddenException,
} from '../common/exceptions/custom.exception';
import { CampaignHelperService } from './campaign.helper';
import { CampaignTargetingDto } from './dto/targetting-rule.dto';
import { S3StorageService } from '../common/services/s3-storage.service';
import { CampaignNotificationService } from 'src/notification/services/campaign.notification.service';

@Injectable()
export class CampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaignHelper: CampaignHelperService,
    private readonly s3StorageService: S3StorageService,
    private readonly campaignNotificationService: CampaignNotificationService,
  ) {}

  // Create a new campaign
  async create(
    advertiserId: string,
    createCampaignDto: CreateCampaignDto,
    file: Express.Multer.File,
  ) {
    // Validate campaign dates
    await this.campaignHelper.validateCampaignDates(
      createCampaignDto.startDate,
      createCampaignDto.endDate,
    );

    // Validate client belongs to advertiser if clientId is provided
    if (createCampaignDto.clientId) {
      await this.campaignHelper.validateClient(
        createCampaignDto.clientId,
        advertiserId,
      );
    }

    // Validate bid strategy and bid amount
    this.campaignHelper.validateBidStrategy(
      createCampaignDto.bidStrategy || 'LOWEST_COST',
      createCampaignDto.bidAmount,
    );

    // Determine initial status based on start date
    const startDate = new Date(createCampaignDto.startDate);
    const endDate = new Date(createCampaignDto.endDate);
    const now = new Date();
    const initialStatus =
      startDate <= now ? CampaignStatus.ACTIVE : CampaignStatus.SCHEDULED;

    // We'll use a transaction to ensure that everything succeeds or fails together
    const campaign = await this.prisma.$transaction(async (tx) => {
      // First create the campaign record to get an ID
      const campaign = await tx.campaign.create({
        data: {
          name: createCampaignDto.name,
          budget: createCampaignDto.budget,
          dailyBudget: createCampaignDto.dailyBudget,
          startDate,
          endDate,
          objective: createCampaignDto.objective,
          bidStrategy: createCampaignDto.bidStrategy || 'LOWEST_COST',
          bidAmount: createCampaignDto.bidAmount,
          pacing: createCampaignDto.pacing || 'STANDARD',
          status: initialStatus,
          businessCategory: createCampaignDto.businessCategory,
          websiteUrl: createCampaignDto.websiteUrl,
          interests: createCampaignDto.interests,
          audienceCSV: '', // We'll update this after uploading to S3
          advertiser: {
            connect: { id: advertiserId },
          },
          client: createCampaignDto.clientId
            ? {
                connect: { id: createCampaignDto.clientId },
              }
            : undefined,
        },
      });

      // Now upload the file to S3
      console.log('File' + file.size);
      console.log('File' + file.buffer);
      console.log('File' + file.mimetype);
      if (file) {
        try {
          // Generate the S3 key for this campaign's audience file
          const s3Key = this.s3StorageService.generateCampaignAudienceKey(
            campaign.name,
            campaign.id,
          );

          // Upload the file to S3
          await this.s3StorageService.uploadFile(
            file.buffer,
            s3Key,
            'text/csv',
          );

          // Update the campaign record with the S3 key
          await tx.campaign.update({
            where: { id: campaign.id },
            data: { audienceCSV: s3Key },
          });

          // Update the local campaign object to return
          campaign.audienceCSV = s3Key;
        } catch (error) {
          // If S3 upload fails, we need to throw an error to roll back the transaction
          throw new BadRequestException(
            `Failed to upload audience file: ${error.message}`,
          );
        }
      }

      // Create targeting rules if provided
      if (createCampaignDto.targeting) {
        await this.createTargetingRules(
          tx,
          campaign.id,
          createCampaignDto.targeting,
        );
      }

      return campaign;
    });

    // Send campaign creation notification
    await this.campaignNotificationService.notifyCampaignCreated(
      campaign,
      advertiserId,
      createCampaignDto.clientId,
    );

    return campaign;
  }

  // Used in the campaign creation process to create targeting rules
  private async createTargetingRules(
    tx: Prisma.TransactionClient,
    campaignId: string,
    targeting: CampaignTargetingDto,
  ) {
    const targetingRules: any = [];

    // Create demographic targeting rule if specified
    if (targeting.demographic) {
      targetingRules.push({
        campaignId,
        ruleType: TargetingRuleType.DEMOGRAPHIC,
        ruleData: targeting.demographic,
      });
    }

    // Create geographic targeting rule if specified
    if (targeting.geo) {
      targetingRules.push({
        campaignId,
        ruleType: TargetingRuleType.GEOGRAPHIC,
        ruleData: targeting.geo,
      });
    }

    // Create device targeting rule if specified
    if (targeting.device) {
      targetingRules.push({
        campaignId,
        ruleType: TargetingRuleType.DEVICE,
        ruleData: targeting.device,
      });
    }

    // Create contextual targeting rule if specified
    if (targeting.contextual) {
      targetingRules.push({
        campaignId,
        ruleType: TargetingRuleType.CONTEXTUAL,
        ruleData: targeting.contextual,
      });
    }

    // Create behavioral targeting rule if specified
    if (targeting.behavioral) {
      targetingRules.push({
        campaignId,
        ruleType: TargetingRuleType.BEHAVIORAL,
        ruleData: targeting.behavioral,
      });
    }

    // Create time targeting rule if specified
    if (targeting.time) {
      targetingRules.push({
        campaignId,
        ruleType: TargetingRuleType.TIME,
        ruleData: targeting.time,
      });
    }

    // Create frequency cap rule if specified
    if (targeting.frequencyCap) {
      targetingRules.push({
        campaignId,
        ruleType: TargetingRuleType.FREQUENCY,
        ruleData: targeting.frequencyCap,
      });
    }

    // Create all targeting rules in the database
    if (targetingRules.length > 0) {
      await tx.campaignTargetingRule.createMany({
        data: targetingRules,
      });
    }
  }

  // Method to update campaign targeting
  async updateCampaignTargeting(
    campaignId: string,
    advertiserId: string,
    targeting: CampaignTargetingDto,
  ) {
    // Verify campaign exists and belongs to advertiser
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        name: true,
        advertiserId: true,
        clientId: true,
      },
    });

    if (!campaign) {
      throw new ResourceNotFoundException('Campaign', campaignId);
    }

    if (campaign.advertiserId !== advertiserId) {
      throw new ForbiddenException('You do not have access to this campaign');
    }

    // Use transaction to update targeting rules
    await this.prisma.$transaction(async (tx) => {
      // Delete existing targeting rules
      await tx.campaignTargetingRule.deleteMany({
        where: { campaignId },
      });

      // Create new targeting rules
      await this.createTargetingRules(tx, campaignId, targeting);
    });

    // Send notification about targeting update
    await this.campaignNotificationService.notifyCampaignTargetingUpdated(
      campaign,
      advertiserId,
      campaign.clientId!,
    );

    return { message: 'Campaign targeting updated successfully' };
  }

  // Method to get campaign targeting
  async getCampaignTargeting(campaignId: string, advertiserId: string) {
    // Verify campaign exists and belongs to advertiser
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        advertiserId: true,
        targetingRules: true,
      },
    });

    if (!campaign) {
      throw new ResourceNotFoundException('Campaign', campaignId);
    }

    if (campaign.advertiserId !== advertiserId) {
      throw new ForbiddenException('You do not have access to this campaign');
    }

    // Transform targeting rules to the DTO format
    const targeting: any = {};

    for (const rule of campaign.targetingRules) {
      switch (rule.ruleType) {
        case TargetingRuleType.DEMOGRAPHIC:
          targeting.demographic = rule.ruleData;
          break;
        case TargetingRuleType.GEOGRAPHIC:
          targeting.geo = rule.ruleData;
          break;
        case TargetingRuleType.DEVICE:
          targeting.device = rule.ruleData;
          break;
        case TargetingRuleType.CONTEXTUAL:
          targeting.contextual = rule.ruleData;
          break;
        case TargetingRuleType.BEHAVIORAL:
          targeting.behavioral = rule.ruleData;
          break;
        case TargetingRuleType.TIME:
          targeting.time = rule.ruleData;
          break;
        case TargetingRuleType.FREQUENCY:
          targeting.frequencyCap = rule.ruleData;
          break;
      }
    }

    return targeting;
  }

  async findAll(advertiserId: string, query: CampaignQueryDto) {
    const {
      status,
      objective,
      clientId,
      search,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    // Build where clause
    const where: Prisma.CampaignWhereInput = {
      advertiserId,
    };

    if (status) where.status = status;
    if (objective) where.objective = objective;
    if (clientId) where.clientId = clientId;
    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    // Get total count and paginated results
    const [total, campaigns] = await Promise.all([
      this.prisma.campaign.count({ where }),
      this.prisma.campaign.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              companyName: true,
            },
          },
          _count: {
            select: {
              creatives: true,
            },
          },
        },
      }),
    ]);

    return {
      items: campaigns,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, advertiserId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
        creatives: true,
        statistics: {
          orderBy: {
            date: 'desc',
          },
          take: 7, // Last 7 days of statistics
        },
        targetingRules: true,
      },
    });

    if (!campaign) {
      throw new ResourceNotFoundException('Campaign', id);
    }

    // Verify ownership
    if (campaign.advertiserId !== advertiserId) {
      throw new ForbiddenException('You do not have access to this campaign');
    }

    return campaign;
  }

  async update(
    id: string,
    advertiserId: string,
    updateCampaignDto: UpdateCampaignDto,
    file?: Express.Multer.File,
  ) {
    // Check if campaign exists and belongs to the advertiser
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        advertiserId: true,
        clientId: true,
        status: true,
        startDate: true,
        endDate: true,
        bidStrategy: true,
        audienceCSV: true,
      },
    });

    if (!campaign) {
      throw new ResourceNotFoundException('Campaign', id);
    }

    if (campaign.advertiserId !== advertiserId) {
      throw new ForbiddenException('You do not have access to this campaign');
    }

    // Validate that we aren't trying to update a completed or canceled campaign
    if (['COMPLETED', 'CANCELED', 'REJECTED'].includes(campaign.status)) {
      throw new BadRequestException(
        `Cannot update a campaign with status: ${campaign.status}`,
      );
    }

    // Validate campaign dates if provided
    if (updateCampaignDto.startDate || updateCampaignDto.endDate) {
      const startDate = updateCampaignDto.startDate
        ? new Date(updateCampaignDto.startDate)
        : campaign.startDate;

      const endDate = updateCampaignDto.endDate
        ? new Date(updateCampaignDto.endDate)
        : campaign.endDate;

      await this.campaignHelper.validateCampaignDates(startDate, endDate);
    }

    // Validate client if provided
    if (updateCampaignDto.clientId) {
      await this.campaignHelper.validateClient(
        updateCampaignDto.clientId,
        advertiserId,
      );
    }

    // Validate bid strategy and amount if provided
    if (updateCampaignDto.bidStrategy || updateCampaignDto.bidAmount) {
      this.campaignHelper.validateBidStrategy(
        updateCampaignDto.bidStrategy || campaign.bidStrategy,
        updateCampaignDto.bidAmount,
      );
    }

    // If updating status, handle status transitions
    const now = new Date();
    let status = campaign.status;

    if (updateCampaignDto.startDate) {
      const startDate = new Date(updateCampaignDto.startDate);

      // Update status based on new start date if campaign is in DRAFT or SCHEDULED status
      if (['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
        status =
          startDate <= now ? CampaignStatus.ACTIVE : CampaignStatus.SCHEDULED;
      }
    }

    // Use transaction to ensure all operations succeed or fail together
    const updatedCampaign = await this.prisma.$transaction(async (tx) => {
      // Handle file upload if provided
      let audienceCSVKey = campaign.audienceCSV;

      if (file) {
        // Generate the S3 key for this campaign's audience file
        // If name is being updated, use the new name
        const campaignName = updateCampaignDto.name || campaign.name;
        const s3Key = this.s3StorageService.generateCampaignAudienceKey(
          campaignName,
          campaign.id,
        );

        // Upload the new file to S3
        await this.s3StorageService.uploadFile(file.buffer, s3Key, 'text/csv');

        // Delete the old file if it exists and is different from the new one
        if (campaign.audienceCSV && campaign.audienceCSV !== s3Key) {
          await this.s3StorageService.deleteFile(campaign.audienceCSV);
        }

        audienceCSVKey = s3Key;
      } else if (updateCampaignDto.name && campaign.audienceCSV) {
        // If just the name is updated and there's an existing file, we need to move it
        const oldKey = campaign.audienceCSV;
        const newKey = this.s3StorageService.generateCampaignAudienceKey(
          updateCampaignDto.name,
          campaign.id,
        );

        if (oldKey !== newKey) {
          // Check if the old file exists
          const exists = await this.s3StorageService.fileExists(oldKey);

          if (exists) {
            // Copy the object to the new location
            await this.s3StorageService.copyObject(oldKey, newKey);

            // Delete the old file after successful copy
            await this.s3StorageService.deleteFile(oldKey);

            audienceCSVKey = newKey;
          }
        }
      }

      // Update campaign with all provided fields
      const updatedCampaign = await tx.campaign.update({
        where: { id },
        data: {
          name: updateCampaignDto.name,
          budget: updateCampaignDto.budget,
          dailyBudget: updateCampaignDto.dailyBudget,
          startDate: updateCampaignDto.startDate
            ? new Date(updateCampaignDto.startDate)
            : undefined,
          endDate: updateCampaignDto.endDate
            ? new Date(updateCampaignDto.endDate)
            : undefined,
          objective: updateCampaignDto.objective,
          bidStrategy: updateCampaignDto.bidStrategy,
          bidAmount: updateCampaignDto.bidAmount,
          pacing: updateCampaignDto.pacing,
          status,
          businessCategory: updateCampaignDto.businessCategory,
          websiteUrl: updateCampaignDto.websiteUrl,
          interests: updateCampaignDto.interests,
          audienceCSV: audienceCSVKey,
          clientId: updateCampaignDto.clientId,
        },
      });

      return updatedCampaign;
    });

    // Send notification about campaign update
    await this.campaignNotificationService.notifyCampaignUpdated(
      updatedCampaign,
      advertiserId,
      updatedCampaign.clientId!,
    );

    return updatedCampaign;
  }

  async remove(id: string, advertiserId: string) {
    // Check if campaign exists and belongs to the advertiser
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        advertiserId: true,
        clientId: true,
        status: true,
        audienceCSV: true,
      },
    });

    if (!campaign) {
      throw new ResourceNotFoundException('Campaign', id);
    }

    if (campaign.advertiserId !== advertiserId) {
      throw new ForbiddenException('You do not have access to this campaign');
    }

    // If campaign is active, we should cancel it instead of deleting
    if (campaign.status === CampaignStatus.ACTIVE) {
      throw new BadRequestException(
        'Cannot delete an active campaign. Please cancel it first.',
      );
    }

    // Send notification before deleting
    await this.campaignNotificationService.notifyCampaignDeleted(
      campaign.name,
      advertiserId,
      campaign.clientId!,
    );

    // Delete the audience file from S3 if it exists
    if (campaign.audienceCSV) {
      await this.s3StorageService.deleteFile(campaign.audienceCSV);
    }

    // Delete campaign
    return this.prisma.campaign.delete({
      where: { id },
    });
  }

  /**
   * Get a pre-signed URL to download a campaign's audience file
   * @param campaignId Campaign ID
   * @param advertiserId Advertiser ID for permission check
   * @returns Pre-signed URL
   */
  async getAudienceFileUrl(
    campaignId: string,
    advertiserId: string,
  ): Promise<string> {
    // Check if campaign exists and belongs to the advertiser
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        advertiserId: true,
        audienceCSV: true,
      },
    });

    if (!campaign) {
      throw new ResourceNotFoundException('Campaign', campaignId);
    }

    if (campaign.advertiserId !== advertiserId) {
      throw new ForbiddenException('You do not have access to this campaign');
    }

    if (!campaign.audienceCSV) {
      throw new BadRequestException(
        'This campaign does not have an audience file',
      );
    }

    // Generate a pre-signed URL for the audience file
    const presignedUrl = await this.s3StorageService.getPresignedUrl(
      campaign.audienceCSV,
      3600, // 1 hour expiration
    );

    return presignedUrl;
  }
}
