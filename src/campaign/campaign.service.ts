import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CampaignQueryDto } from './dto/campaign-query.dto';
import { AddInventoryToCampaignDto } from './dto/campaign-inventory.dto';
import { CreateCreativeDto, GetAvailableInventoriesForCreativeDto } from './dto/creative.dto';
import { CampaignStatus, CreativeStatus, Prisma, TargetingRuleType } from '@prisma/client';
import {
  ResourceNotFoundException,
  BadRequestException,
  ForbiddenException,
} from '../common/exceptions/custom.exception';
import { InventoryService } from '../inventory/inventory.service';
import { CampaignHelperService } from './campaign.helper';
import { CampaignTargetingDto } from './dto/targetting-rule.dto';

@Injectable()
export class CampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly campaignHelper: CampaignHelperService
  ) { }

  async create(advertiserId: string, createCampaignDto: CreateCampaignDto) {
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

    // Use a transaction to create campaign and targeting rules together
    return this.prisma.$transaction(async (tx) => {
      // Create the campaign
      const campaign = await tx.campaign.create({
        data: {
          name: createCampaignDto.name,
          budget: createCampaignDto.budget,
          dailyBudget: createCampaignDto.dailyBudget,
          startDate: new Date(createCampaignDto.startDate),
          endDate: new Date(createCampaignDto.endDate),
          objective: createCampaignDto.objective,
          bidStrategy: createCampaignDto.bidStrategy || 'LOWEST_COST',
          bidAmount: createCampaignDto.bidAmount,
          pacing: createCampaignDto.pacing || 'STANDARD',
          status: startDate <= now ? CampaignStatus.ACTIVE : CampaignStatus.SCHEDULED,
          advertiser: {
            connect: { id: advertiserId }
          },
          client: createCampaignDto.clientId ? {
            connect: { id: createCampaignDto.clientId }
          } : undefined
        }
      });

      // If targeting is specified, create targeting rules
      if (createCampaignDto.targeting) {
        await this.createTargetingRules(tx, campaign.id, createCampaignDto.targeting);
      }

      return campaign;
    });
  }

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

  async update(id: string, advertiserId: string, updateCampaignDto: UpdateCampaignDto) {
    // Check if campaign exists and belongs to the advertiser
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      select: {
        id: true,
        advertiserId: true,
        status: true,
        startDate: true,
        endDate: true,
        bidStrategy: true  // Added this to fix the error
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

      await this.campaignHelper.validateCampaignDates(startDate, endDate!);
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

    // Update campaign
    return this.prisma.$transaction(async (tx) => {
      // Update campaign
      const updatedCampaign = await tx.campaign.update({
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
          clientId: updateCampaignDto.clientId
        }
      });

      // If targeting is specified, update targeting rules
      if (updateCampaignDto.targeting) {
        // Delete existing targeting rules
        await tx.campaignTargetingRule.deleteMany({
          where: { campaignId: id }
        });

        // Create new targeting rules
        await this.createTargetingRules(tx, id, updateCampaignDto.targeting);
      }

      return updatedCampaign;
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

  // Campaign status management
  async updateStatus(id: string, advertiserId: string, status: string) {
    const validStatuses = Object.values(CampaignStatus);
    if (!validStatuses.includes(status as CampaignStatus)) {
      throw new BadRequestException(`Invalid status: ${status}`);
    }

    // Check if campaign exists and belongs to the advertiser
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      select: {
        id: true,
        advertiserId: true,
        status: true,
        startDate: true,
        endDate: true
      }
    });

    if (!campaign) {
      throw new ResourceNotFoundException('Campaign', id);
    }

    if (campaign.advertiserId !== advertiserId) {
      throw new ForbiddenException('You do not have access to this campaign');
    }

    // Validate status transitions
    this.campaignHelper.validateStatusTransition(campaign.status, status as CampaignStatus);

    // Perform any status-specific validations
    if (status === CampaignStatus.ACTIVE) {
      // Check if campaign has at least one inventory and creative
      const [inventoryCount, creativeCount] = await Promise.all([
        this.prisma.campaignInventory.count({
          where: { campaignId: id }
        }),
        this.prisma.creative.count({
          where: {
            campaignId: id,
            status: CreativeStatus.APPROVED
          }
        })
      ]);

      if (inventoryCount === 0) {
        throw new BadRequestException('Cannot activate campaign without any inventory. Please add inventory first.');
      }

      if (creativeCount === 0) {
        throw new BadRequestException('Cannot activate campaign without any approved creatives. Please add creatives first.');
      }
    }

    // Update campaign status
    return this.prisma.campaign.update({
      where: { id },
      data: { status: status as CampaignStatus }
    });
  }

  // Campaign inventory management
  async addInventory(id: string, advertiserId: string, dto: AddInventoryToCampaignDto) {
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

    // Validate each inventory item
    const inventoryPromises = dto.inventories.map(async (item) => {
      // Check if inventory exists and is available for this advertiser
      try {
        // Create a query to check if the specific inventory ID exists and is available
        const searchQuery: Prisma.AdInventoryWhereInput = {
          id: item.inventoryId,
          approvalStatus: 'APPROVED',
          isActive: true,
          blockedAdvertisers: {
            none: {
              advertiserId
            }
          }
        };

        const inventory = await this.prisma.adInventory.findFirst({
          where: searchQuery,
          select: {
            id: true,
            name: true,
            width: true,
            height: true,
            format: true,
            position: true
          }
        });

        if (!inventory) {
          throw new BadRequestException(`Inventory ${item.inventoryId} is not available or does not exist`);
        }

        // Check if this inventory is already added to the campaign
        const existingInventory = await this.prisma.campaignInventory.findUnique({
          where: {
            campaignId_inventoryId: {
              campaignId: id,
              inventoryId: item.inventoryId
            }
          }
        });

        if (existingInventory) {
          // Update existing inventory
          return this.prisma.campaignInventory.update({
            where: {
              campaignId_inventoryId: {
                campaignId: id,
                inventoryId: item.inventoryId
              }
            },
            data: {
              maxBid: item.maxBid
            },
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
            }
          });
        } else {
          // Create new inventory association
          return this.prisma.campaignInventory.create({
            data: {
              campaign: {
                connect: { id }
              },
              inventory: {
                connect: { id: item.inventoryId }
              },
              maxBid: item.maxBid
            },
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
            }
          });
        }
      } catch (error) {
        throw new BadRequestException(`Error adding inventory ${item.inventoryId}: ${error.message}`);
      }
    });

    return Promise.all(inventoryPromises);
  }

  async removeInventory(id: string, inventoryId: string, advertiserId: string) {
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

    // Check if inventory is associated with campaign
    const campaignInventory = await this.prisma.campaignInventory.findUnique({
      where: {
        campaignId_inventoryId: {
          campaignId: id,
          inventoryId
        }
      }
    });

    if (!campaignInventory) {
      throw new ResourceNotFoundException('Campaign Inventory', `${id}:${inventoryId}`);
    }

    // Remove inventory from campaign
    return this.prisma.campaignInventory.delete({
      where: {
        campaignId_inventoryId: {
          campaignId: id,
          inventoryId
        }
      }
    });
  }

  // Creative management
  async addCreative(id: string, advertiserId: string, dto: CreateCreativeDto) {
    // Check if campaign exists and belongs to the advertiser
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      select: {
        id: true,
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
      throw new ResourceNotFoundException('Campaign', id);
    }

    if (campaign.advertiserId !== advertiserId) {
      throw new ForbiddenException('You do not have access to this campaign');
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

    // Validate creative dimensions against the selected inventory
    if (inventory.width !== dto.width || inventory.height !== dto.height) {
      throw new BadRequestException(
        `Creative dimensions (${dto.width}x${dto.height}) do not match the selected inventory dimensions (${inventory.width}x${inventory.height})`
      );
    }

    // All validations passed, auto-approve the creative
    return this.prisma.creative.create({
      data: {
        campaign: {
          connect: { id }
        },
        inventory: {
          connect: { id: dto.inventoryId }
        },
        name: dto.name,
        type: dto.type,
        width: dto.width,
        height: dto.height,
        fileUrl: dto.fileUrl,
        landingUrl: dto.landingUrl,
        status: CreativeStatus.APPROVED // Auto-approve since all validations passed
      }
    });
  }

  async getAvailableInventoriesForCreative(id: string, advertiserId: string, query: GetAvailableInventoriesForCreativeDto) {
    // Check if campaign exists and belongs to the advertiser
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      select: {
        id: true,
        advertiserId: true
      }
    });

    if (!campaign) {
      throw new ResourceNotFoundException('Campaign', id);
    }

    if (campaign.advertiserId !== advertiserId) {
      throw new ForbiddenException('You do not have access to this campaign');
    }

    // Build the inventory filter
    const inventoryFilter: Prisma.AdInventoryWhereInput = {
      isActive: true,
      approvalStatus: 'APPROVED'
    };

    // Add dimension filters if provided
    if (query.width) {
      inventoryFilter.width = query.width;
    }

    if (query.height) {
      inventoryFilter.height = query.height;
    }

    // Get the campaign inventories with filtered inventory
    const campaignInventories = await this.prisma.campaignInventory.findMany({
      where: {
        campaignId: id,
        inventory: inventoryFilter
      },
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Format the response
    const inventories = campaignInventories.map(ci => ({
      id: ci.inventory.id,
      name: ci.inventory.name,
      width: ci.inventory.width,
      height: ci.inventory.height,
      format: ci.inventory.format,
      position: ci.inventory.position,
      viewabilityScore: ci.inventory.viewabilityScore,
      maxBid: ci.maxBid
    }));

    return {
      items: inventories,
      meta: {
        total: inventories.length,
        availableDimensions: this.getUniqueDimensions(inventories)
      }
    };
  }

  // Helper method to get unique dimensions from inventory list
  private getUniqueDimensions(inventories: any[]) {
    const dimensions = new Set<string>();

    inventories.forEach(inventory => {
      dimensions.add(`${inventory.width}x${inventory.height}`);
    });

    return Array.from(dimensions);
  }

  async getCreatives(id: string, advertiserId: string) {
    // Check if campaign exists and belongs to the advertiser
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      select: {
        id: true,
        advertiserId: true
      }
    });

    if (!campaign) {
      throw new ResourceNotFoundException('Campaign', id);
    }

    if (campaign.advertiserId !== advertiserId) {
      throw new ForbiddenException('You do not have access to this campaign');
    }

    // Get all creatives for the campaign
    return this.prisma.creative.findMany({
      where: {
        campaignId: id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async removeCreative(id: string, creativeId: string, advertiserId: string) {
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

    // Check if creative exists and belongs to the campaign
    const creative = await this.prisma.creative.findFirst({
      where: {
        id: creativeId,
        campaignId: id
      }
    });

    if (!creative) {
      throw new ResourceNotFoundException('Creative', creativeId);
    }

    // Remove creative
    return this.prisma.creative.delete({
      where: { id: creativeId }
    });
  }

  // Campaign statistics
  async getCampaignStatistics(id: string, advertiserId: string) {
    // Check if campaign exists and belongs to the advertiser
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      select: {
        id: true,
        advertiserId: true,
        startDate: true,
        endDate: true
      }
    });

    if (!campaign) {
      throw new ResourceNotFoundException('Campaign', id);
    }

    if (campaign.advertiserId !== advertiserId) {
      throw new ForbiddenException('You do not have access to this campaign');
    }

    // Get statistics for the campaign
    const stats = await this.prisma.campaignStatistics.findMany({
      where: {
        campaignId: id
      },
      orderBy: {
        date: 'desc'
      },
      take: 30 // Last 30 days
    });

    // Calculate totals
    const totalImpressions = stats.reduce((sum, stat) => sum + stat.impressions, 0);
    const totalClicks = stats.reduce((sum, stat) => sum + stat.clicks, 0);
    const totalConversions = stats.reduce((sum, stat) => sum + stat.conversions, 0);
    const totalSpend = stats.reduce((sum, stat) => sum + Number(stat.spend), 0);

    const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

    return {
      campaign: {
        id: campaign.id,
        startDate: campaign.startDate,
        endDate: campaign.endDate
      },
      totals: {
        impressions: totalImpressions,
        clicks: totalClicks,
        conversions: totalConversions,
        spend: totalSpend,
        ctr: averageCtr,
        cpc: averageCpc
      },
      dailyStats: stats
    };
  }
}