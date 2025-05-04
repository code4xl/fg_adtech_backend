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
import { FileStorageService } from 'src/file-storage/file-storage.service';

@Injectable()
export class CampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorageService: FileStorageService,
    private readonly campaignHelper: CampaignHelperService
  ) { }

  // Create a new campaign
  async create(advertiserId: string, createCampaignDto: CreateCampaignDto, file?: any) {
    // Validate campaign dates
    await this.campaignHelper.validateCampaignDates(createCampaignDto.startDate, createCampaignDto.endDate);

    // Validate client belongs to advertiser if clientId is provided
    if (createCampaignDto.clientId) {
      await this.campaignHelper.validateClient(createCampaignDto.clientId, advertiserId);
    }

    // Validate bid strategy and bid amount
    this.campaignHelper.validateBidStrategy(createCampaignDto.bidStrategy || 'LOWEST_COST', createCampaignDto.bidAmount);

    // Determine initial status based on start date
    const startDate = new Date(createCampaignDto.startDate);
    const endDate = new Date(createCampaignDto.endDate);
    const now = new Date();
    const initialStatus = startDate <= now ? CampaignStatus.ACTIVE : CampaignStatus.SCHEDULED;

    // Process audience CSV file if provided
    let audienceCSVPath = null;
    if (file) {
      console.log("File");
      console.log(file);

      // Now file should have path and filename properties
      const isValid = await this.fileStorageService.validateCsvFile(file.path);
      if (!isValid) {
        throw new BadRequestException('Invalid CSV file format');
      }

      // Store just the filename in the database
      audienceCSVPath = file.filename;
    }


    console.log("PAth");
    console.log(audienceCSVPath);



    // Create campaign
    return this.prisma.$transaction(async (tx) => {
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
          audienceCSV: audienceCSVPath!,
          advertiser: {
            connect: { id: advertiserId }
          },
          client: createCampaignDto.clientId ? {
            connect: { id: createCampaignDto.clientId }
          } : undefined
        }


      });

      if (createCampaignDto.targeting) {
        await this.createTargetingRules(tx, campaign.id, createCampaignDto.targeting);
      }

      return campaign;
    });
  }

  // Used in the campaign creation process to create targeting rules
  private async createTargetingRules(
    tx: Prisma.TransactionClient,
    campaignId: string,
    targeting: CampaignTargetingDto
  ) {
    const targetingRules: any = [];

    // Create demographic targeting rule if specified
    if (targeting.demographic) {
      targetingRules.push({
        campaignId,
        ruleType: TargetingRuleType.DEMOGRAPHIC,
        ruleData: targeting.demographic
      });
    }

    // Create geographic targeting rule if specified
    if (targeting.geo) {
      targetingRules.push({
        campaignId,
        ruleType: TargetingRuleType.GEOGRAPHIC,
        ruleData: targeting.geo
      });
    }

    // Create device targeting rule if specified
    if (targeting.device) {
      targetingRules.push({
        campaignId,
        ruleType: TargetingRuleType.DEVICE,
        ruleData: targeting.device
      });
    }

    // Create contextual targeting rule if specified
    if (targeting.contextual) {
      targetingRules.push({
        campaignId,
        ruleType: TargetingRuleType.CONTEXTUAL,
        ruleData: targeting.contextual
      });
    }

    // Create behavioral targeting rule if specified
    if (targeting.behavioral) {
      targetingRules.push({
        campaignId,
        ruleType: TargetingRuleType.BEHAVIORAL,
        ruleData: targeting.behavioral
      });
    }

    // Create time targeting rule if specified
    if (targeting.time) {
      targetingRules.push({
        campaignId,
        ruleType: TargetingRuleType.TIME,
        ruleData: targeting.time
      });
    }

    // Create frequency cap rule if specified
    if (targeting.frequencyCap) {
      targetingRules.push({
        campaignId,
        ruleType: TargetingRuleType.FREQUENCY,
        ruleData: targeting.frequencyCap
      });
    }

    // Create all targeting rules in the database
    if (targetingRules.length > 0) {
      await tx.campaignTargetingRule.createMany({
        data: targetingRules
      });
    }
  }

  // Method to update campaign targeting
  async updateCampaignTargeting(
    campaignId: string,
    advertiserId: string,
    targeting: CampaignTargetingDto
  ) {
    // Verify campaign exists and belongs to advertiser
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, advertiserId: true }
    });

    if (!campaign) {
      throw new ResourceNotFoundException('Campaign', campaignId);
    }

    if (campaign.advertiserId !== advertiserId) {
      throw new ForbiddenException('You do not have access to this campaign');
    }

    // Use transaction to update targeting rules
    return this.prisma.$transaction(async (tx) => {
      // Delete existing targeting rules
      await tx.campaignTargetingRule.deleteMany({
        where: { campaignId }
      });

      // Create new targeting rules
      await this.createTargetingRules(tx, campaignId, targeting);

      return { message: 'Campaign targeting updated successfully' };
    });
  }

  // Method to get campaign targeting
  async getCampaignTargeting(campaignId: string, advertiserId: string) {
    // Verify campaign exists and belongs to advertiser
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        advertiserId: true,
        targetingRules: true
      }
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
      sortOrder = 'desc'
    } = query;

    // Build where clause
    const where: Prisma.CampaignWhereInput = {
      advertiserId
    };

    if (status) where.status = status;
    if (objective) where.objective = objective;
    if (clientId) where.clientId = clientId;
    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive'
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
          [sortBy]: sortOrder
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              companyName: true
            }
          },
          _count: {
            select: {
              campaignInventories: true,
              creatives: true
            }
          }
        }
      })
    ]);

    return {
      items: campaigns,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
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
            companyName: true
          }
        },
        campaignInventories: {
          include: {
            inventory: {
              select: {
                id: true,
                name: true,
                width: true,
                height: true,
                format: true,
                position: true,
                viewabilityScore: true
              }
            }
          }
        },
        creatives: true,
        statistics: {
          orderBy: {
            date: 'desc'
          },
          take: 7 // Last 7 days of statistics
        },
        targetingRules: true
      }
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
    file?: any,
  ) {
    // Check if campaign exists and belongs to the advertiser
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      select: {
        id: true,
        advertiserId: true,
        status: true,
        startDate: true,
        endDate: true,
        bidStrategy: true,
        audienceCSV: true
      }
    });

    if (!campaign) {
      throw new ResourceNotFoundException('Campaign', id);
    }

    if (campaign.advertiserId !== advertiserId) {
      throw new ForbiddenException('You do not have access to this campaign');
    }

    // Validate that we aren't trying to update a completed or canceled campaign
    if (['COMPLETED', 'CANCELED', 'REJECTED'].includes(campaign.status)) {
      throw new BadRequestException(`Cannot update a campaign with status: ${campaign.status}`);
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
      await this.campaignHelper.validateClient(updateCampaignDto.clientId, advertiserId);
    }

    // Validate bid strategy and amount if provided
    if (updateCampaignDto.bidStrategy || updateCampaignDto.bidAmount) {
      this.campaignHelper.validateBidStrategy(
        updateCampaignDto.bidStrategy || campaign.bidStrategy,
        updateCampaignDto.bidAmount
      );
    }

    // Process audience CSV file if provided
    let audienceCSVPath = campaign.audienceCSV;
    if (file) {
      // Validate CSV
      const isValid = await this.fileStorageService.validateCsvFile(file.filename);
      if (!isValid) {
        throw new BadRequestException('Invalid CSV file format');
      }

      // Delete the old file if it exists
      if (campaign.audienceCSV) {
        await this.fileStorageService.deleteFile(campaign.audienceCSV);
      }

      audienceCSVPath = file.filename;
    }

    // If updating status, handle status transitions
    const now = new Date();
    let status = campaign.status;

    if (updateCampaignDto.startDate) {
      const startDate = new Date(updateCampaignDto.startDate);

      // Update status based on new start date if campaign is in DRAFT or SCHEDULED status
      if (['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
        status = startDate <= now ? CampaignStatus.ACTIVE : CampaignStatus.SCHEDULED;
      }
    }

    // Update campaign with all provided fields
    return this.prisma.campaign.update({
      where: { id },
      data: {
        name: updateCampaignDto.name,
        budget: updateCampaignDto.budget,
        dailyBudget: updateCampaignDto.dailyBudget,
        startDate: updateCampaignDto.startDate ? new Date(updateCampaignDto.startDate) : undefined,
        endDate: updateCampaignDto.endDate ? new Date(updateCampaignDto.endDate) : undefined,
        objective: updateCampaignDto.objective,
        bidStrategy: updateCampaignDto.bidStrategy,
        bidAmount: updateCampaignDto.bidAmount,
        pacing: updateCampaignDto.pacing,
        status,
        businessCategory: updateCampaignDto.businessCategory,
        websiteUrl: updateCampaignDto.websiteUrl,
        interests: updateCampaignDto.interests,
        audienceCSV: audienceCSVPath,
        clientId: updateCampaignDto.clientId
      }
    });
  }

  async remove(id: string, advertiserId: string) {
    // Check if campaign exists and belongs to the advertiser
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      select: {
        id: true,
        advertiserId: true,
        status: true
      }
    });

    if (!campaign) {
      throw new ResourceNotFoundException('Campaign', id);
    }

    if (campaign.advertiserId !== advertiserId) {
      throw new ForbiddenException('You do not have access to this campaign');
    }

    // If campaign is active, we should cancel it instead of deleting
    if (campaign.status === CampaignStatus.ACTIVE) {
      throw new BadRequestException('Cannot delete an active campaign. Please cancel it first.');
    }

    // Delete campaign
    return this.prisma.campaign.delete({
      where: { id }
    });
  }
}