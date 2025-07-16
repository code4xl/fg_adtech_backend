import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCampaignDto,
} from './dto/campaign/campaign.dto';
import { UpdateCampaignDto } from './dto/campaign/campaign.dto';
import { CampaignQueryDto } from './dto/campaign/campaign-query.dto';
import { CampaignStatus, Prisma } from '@prisma/client';
import {
  ResourceNotFoundException,
  BadRequestException,
  ForbiddenException,
} from '../common/exceptions/custom.exception';
import { AdvertiserHelper } from './advertiser.helper';
import { CampaignEligibilityService } from 'src/rtb/services/campaign-eligibility.service';
import { CampaignNotificationService } from 'src/notification/services/campaign.notification.service';

@Injectable()
export class AdvertiserCampaignService {
  private readonly logger = new Logger(AdvertiserCampaignService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly advertiserHelper: AdvertiserHelper,
    private readonly campaignEligibilityService: CampaignEligibilityService,
    private readonly campaignNotificationService: CampaignNotificationService,
  ) {}

  /**
   * Create a new campaign (without budget allocation) -- DONE
   */
  async create(advertiserId: string, createCampaignDto: CreateCampaignDto) {
    this.logger.debug(`Creating campaign for advertiser: ${advertiserId}`);

    // Validate campaign dates
    await this.advertiserHelper.validateCampaignDates(
      createCampaignDto.startDate,
      createCampaignDto.endDate,
    );

    // Validate client belongs to advertiser
    await this.advertiserHelper.validateClient(
      createCampaignDto.clientId,
      advertiserId,
    );

    // Validate bid strategy and bid amount
    await this.advertiserHelper.validateBidStrategy(
      createCampaignDto.bidStrategy,
      createCampaignDto.bidAmount,
    );

    // Determine initial status - Always DRAFT until budget is allocated
    const startDate = new Date(createCampaignDto.startDate);
    const endDate = new Date(createCampaignDto.endDate);

    // Campaign starts as DRAFT regardless of start date
    // It will only become SCHEDULED/ACTIVE when budget is allocated
    const initialStatus = CampaignStatus.DRAFT;

    // Create campaign with transaction to ensure all operations succeed
    const campaign = await this.prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.create({
        data: {
          name: createCampaignDto.name,
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
          advertiserId,
          clientId: createCampaignDto.clientId,
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
      });

      return campaign;
    });

    this.logger.debug(`Campaign created successfully: ${campaign.id}`);

    // Send notifications to advertiser and client
    try {
      await this.campaignNotificationService.notifyCampaignCreated(
        campaign,
        advertiserId,
        campaign.clientId,
      );
    } catch (error) {
      this.logger.error(`Failed to send campaign creation notifications: ${error.message}`);
    }

    // Add hasBudget flag
    const response = {
      ...campaign,
      hasBudget: false, // New campaigns don't have budget allocated
    };

    return response;
  }

  /**
   * Update an existing campaign -- DONE
   */
  async update(
    campaignId: string,
    advertiserId: string,
    updateCampaignDto: UpdateCampaignDto,
  ) {
    this.logger.debug(`Updating campaign: ${campaignId} for advertiser: ${advertiserId}`);

    // Check if campaign exists and belongs to the advertiser
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        name: true,
        advertiserId: true,
        clientId: true,
        status: true,
        startDate: true,
        endDate: true,
        bidStrategy: true,
      },
    });

    if (!campaign) {
      throw new ResourceNotFoundException('Campaign', campaignId);
    }

    if (campaign.advertiserId !== advertiserId) {
      throw new ForbiddenException('You do not have access to this campaign');
    }

    // Industry standard restrictions for campaign updates
    this.validateCampaignUpdatePermissions(campaign.status, updateCampaignDto);

    // Validate campaign dates if provided
    if (updateCampaignDto.endDate) {
      const startDate = campaign.startDate;
      const endDate = new Date(updateCampaignDto.endDate);
      
      await this.advertiserHelper.validateCampaignDates(startDate, endDate);
      
      // Don't allow reducing end date if campaign is active
      if (campaign.status === CampaignStatus.ACTIVE && endDate < campaign.endDate) {
        throw new BadRequestException(
          'Cannot reduce end date of an active campaign'
        );
      }
    }

    // Validate bid strategy and amount if provided
    if (updateCampaignDto.bidStrategy || updateCampaignDto.bidAmount) {
      await this.advertiserHelper.validateBidStrategy(
        updateCampaignDto.bidStrategy || campaign.bidStrategy,
        updateCampaignDto.bidAmount,
      );
    }

    // Prepare update data with only allowed fields
    const updateData = this.prepareUpdateData(campaign.status, updateCampaignDto);

    // Update campaign
    const updatedCampaign = await this.prisma.campaign.update({
      where: { id: campaignId },
      data: updateData,
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
    });

    // Check if campaign has budget
    const hasBudget = await this.checkCampaignHasBudget(campaignId);

    // Invalidate cache if necessary -> If the campaign has been updated, then make an expensive call in RTB process (in findEligibleCampaigns)
    await this.campaignEligibilityService.invalidateCampaignPoolCache();

    // Send update notifications
    try {
      await this.campaignNotificationService.notifyCampaignUpdated(
        updatedCampaign,
        advertiserId,
        updatedCampaign.clientId,
      );
    } catch (error) {
      this.logger.error(`Failed to send campaign update notifications: ${error.message}`);
    }

    return {
      ...updatedCampaign,
      hasBudget,
    };
  }

  /**
   * Get all campaigns for a specific advertiser with pagination and filtering -- DONE
   */
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

    // Add hasBudget flag to each campaign
    const campaignsWithBudgetInfo = await Promise.all(
      campaigns.map(async (campaign) => ({
        ...campaign,
        hasBudget: await this.checkCampaignHasBudget(campaign.id),
      })),
    );

    return {
      items: campaignsWithBudgetInfo,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single campaign by ID (excluding budget details) -- DONE
   */
  async findOne(campaignId: string, advertiserId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
        creatives: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
            templateId: true,
            landingUrl: true,
            createdAt: true,
          },
        },
        statistics: {
          orderBy: {
            date: 'desc',
          },
          take: 7, // Last 7 days of statistics
          select: {
            id: true,
            date: true,
            impressions: true,
            clicks: true,
            conversions: true,
            spend: true,
            ctr: true,
            cpc: true,
          },
        },
        // Include targeting rules
        demographicTargeting: true,
        geographicTargeting: true,
        deviceTargeting: true,
        contextualTargeting: true,
        behavioralTargeting: true,
        timeTargeting: true,
        frequencyTargeting: true,
      },
    });

    if (!campaign) {
      throw new ResourceNotFoundException('Campaign', campaignId);
    }

    // Verify ownership
    if (campaign.advertiserId !== advertiserId) {
      throw new ForbiddenException('You do not have access to this campaign');
    }

    // Check if campaign has budget but don't include budget details
    const hasBudget = await this.checkCampaignHasBudget(campaignId);

    return {
      ...campaign,
      hasBudget,
    };
  }

  /**
   * Delete a campaign (with industry standard restrictions) -- DONE
   */
  async remove(campaignId: string, advertiserId: string) {
    this.logger.debug(`Attempting to delete campaign: ${campaignId}`);

    // Check if campaign exists and belongs to the advertiser
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        name: true,
        advertiserId: true,
        clientId: true,
        status: true,
        createdAt: true,
      },
    });

    if (!campaign) {
      throw new ResourceNotFoundException('Campaign', campaignId);
    }

    if (campaign.advertiserId !== advertiserId) {
      throw new ForbiddenException('You do not have access to this campaign');
    }

    // Industry standard: Cannot delete campaigns that are or were active
    const restrictedStatuses: CampaignStatus[] = [
      CampaignStatus.ACTIVE,
      CampaignStatus.COMPLETED,
      CampaignStatus.BUDGET_EXHAUSTED,
    ];

    if (restrictedStatuses.includes(campaign.status)) {
      throw new BadRequestException(
        `Cannot delete a campaign with status: ${campaign.status}. Active, completed, or budget-exhausted campaigns cannot be deleted for audit purposes.`,
      );
    }

    // Additional check: Don't allow deletion if campaign has historical data
    const hasImpressions = await this.prisma.impressionEvent.count({
      where: { campaignId },
    });

    if (hasImpressions > 0) {
      throw new BadRequestException(
        'Cannot delete campaign with existing impression data. Please contact support if you need to archive this campaign.',
      );
    }

    // Additional check: Don't allow deletion if campaign has creatives that were used
    const hasUsedCreatives = await this.prisma.creative.count({
      where: {
        campaignId,
        status: 'APPROVED',
      },
    });

    if (hasUsedCreatives > 0) {
      throw new BadRequestException(
        'Cannot delete campaign with approved creatives. Please remove all creatives first.',
      );
    }

    // Only allow deletion of DRAFT, SCHEDULED, PAUSED, or CANCELED campaigns
    const allowedStatuses = [
      'DRAFT',
      'SCHEDULED',
      'PAUSED',
      'CANCELED',
    ];

    if (!allowedStatuses.includes(campaign.status)) {
      throw new BadRequestException(
        `Cannot delete campaign with status: ${campaign.status}`,
      );
    }

    // Delete campaign in transaction
    await this.prisma.$transaction(async (tx) => {
      // First delete related budget records if any
      await tx.campaignBudget.deleteMany({
        where: { campaignId },
      });

      await tx.campaignDailyBudget.deleteMany({
        where: { campaignId },
      });

      // Delete the campaign
      await tx.campaign.delete({
        where: { id: campaignId },
      });
    });

    this.logger.debug(`Campaign deleted successfully: ${campaignId}`);

    // Send deletion notifications
    try {
      await this.campaignNotificationService.notifyCampaignDeleted(
        campaign.name,
        advertiserId,
        campaign.clientId,
      );
    } catch (error) {
      this.logger.error(`Failed to send campaign deletion notifications: ${error.message}`);
    }

    return { message: 'Campaign deleted successfully' };
  }

  // Done
  private async checkCampaignHasBudget(campaignId: string): Promise<boolean> {
    const budget = await this.prisma.campaignBudget.findFirst({
      where: { campaignId },
    });
    return !!budget;
  }

  // Done
  private validateCampaignUpdatePermissions(
    status: CampaignStatus,
    updateDto: UpdateCampaignDto,
  ) {
    // Industry standard: Active campaigns have very limited update options
    if (status === CampaignStatus.ACTIVE) {
      const allowedFields = ['name', 'endDate', 'websiteUrl'];
      const providedFields = Object.keys(updateDto);
      
      const restrictedFields = providedFields.filter(
        field => !allowedFields.includes(field)
      );

      if (restrictedFields.length > 0) {
        throw new BadRequestException(
          `Cannot update ${restrictedFields.join(', ')} on an active campaign. Only name, end date, and website URL can be modified.`
        );
      }
    }

    // Completed, canceled, or budget exhausted campaigns cannot be updated
    const immutableStatuses: CampaignStatus[] = [
      CampaignStatus.COMPLETED,
      CampaignStatus.CANCELED,
      CampaignStatus.BUDGET_EXHAUSTED,
    ];

    if (immutableStatuses.includes(status)) {
      throw new BadRequestException(
        `Cannot update a campaign with status: ${status}`,
      );
    }
  }

  // Done
  private prepareUpdateData(status: CampaignStatus, updateDto: UpdateCampaignDto) {
    const updateData: any = {};

    // Always allowed updates
    if (updateDto.name) updateData.name = updateDto.name;
    if (updateDto.websiteUrl) updateData.websiteUrl = updateDto.websiteUrl;

    // Conditional updates based on status
    if (status !== CampaignStatus.ACTIVE) {
      if (updateDto.objective) updateData.objective = updateDto.objective;
      if (updateDto.bidStrategy) updateData.bidStrategy = updateDto.bidStrategy;
      if (updateDto.bidAmount !== undefined) updateData.bidAmount = updateDto.bidAmount;
      if (updateDto.pacing) updateData.pacing = updateDto.pacing;
      if (updateDto.businessCategory) updateData.businessCategory = updateDto.businessCategory;
      if (updateDto.interests) updateData.interests = updateDto.interests;
    }

    // End date can be extended for active campaigns
    if (updateDto.endDate) {
      updateData.endDate = new Date(updateDto.endDate);
    }

    return updateData;
  }
}