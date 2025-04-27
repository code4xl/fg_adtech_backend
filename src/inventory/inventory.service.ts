import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { 
  ResourceNotFoundException, 
  BadRequestException,
  DuplicateResourceException 
} from '../common/exceptions/custom.exception';
import { ApprovalStatus, Prisma } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(publisherId: string, createInventoryDto: CreateInventoryDto) {
    // Verify publisher exists
    const publisher = await this.prisma.publisher.findUnique({
      where: { id: publisherId }
    });

    if (!publisher) {
      throw new ResourceNotFoundException('Publisher', publisherId);
    }

    return this.prisma.adInventory.create({
      data: {
        ...createInventoryDto,
        publisherId,
        approvalStatus: ApprovalStatus.PENDING,
        isActive: false // Inventory is inactive until approved
      }
    });
  }

  async findAll(publisherId: string, query: InventoryQueryDto) {
    const { 
      format, 
      position, 
      isActive, 
      approvalStatus, 
      search, 
      page = 1, 
      limit = 10, 
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = query;

    const where: Prisma.AdInventoryWhereInput = {
      publisherId
    };

    if (format) where.format = format;
    if (position) where.position = position;
    if (isActive !== undefined) where.isActive = isActive;
    if (approvalStatus) where.approvalStatus = approvalStatus;
    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive'
      };
    }

    const [total, inventories] = await Promise.all([
      this.prisma.adInventory.count({ where }),
      this.prisma.adInventory.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder
        },
        include: {
          floorPrices: {
            where: {
              endDate: {
                gt: new Date()
              }
            },
            orderBy: {
              startDate: 'desc'
            },
            take: 1
          },
          categories: {
            include: {
              category: true
            }
          }
        }
      })
    ]);

    return {
      items: inventories,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async findOne(id: string, publisherId: string) {
    const inventory = await this.prisma.adInventory.findFirst({
      where: { 
        id,
        publisherId 
      },
      include: {
        floorPrices: {
          orderBy: {
            startDate: 'desc'
          }
        },
        categories: {
          include: {
            category: true
          }
        },
        blockedAdvertisers: {
          include: {
            advertiser: {
              select: {
                id: true,
                name: true,
                companyName: true
              }
            }
          }
        },
        targetingRules: true
      }
    });

    if (!inventory) {
      throw new ResourceNotFoundException('Inventory', id);
    }

    return inventory;
  }

  async update(id: string, publisherId: string, updateInventoryDto: UpdateInventoryDto) {
    const inventory = await this.findOne(id, publisherId);

    // If publisher is trying to update approval status, prevent it
    if (updateInventoryDto.approvalStatus) {
      throw new BadRequestException('Publishers cannot update approval status');
    }

    return this.prisma.adInventory.update({
      where: { id },
      data: updateInventoryDto
    });
  }

  async remove(id: string, publisherId: string) {
    await this.findOne(id, publisherId);

    // Check if inventory has active campaigns or future reservations
    const [activeImpressions, futureReservations] = await Promise.all([
      this.prisma.impression.count({
        where: {
          inventoryId: id,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      }),
      this.prisma.inventoryAvailability.count({
        where: {
          inventoryId: id,
          date: {
            gt: new Date()
          },
          reservedImpressions: {
            gt: 0
          }
        }
      })
    ]);

    if (activeImpressions > 0 || futureReservations > 0) {
      throw new BadRequestException(
        'Cannot delete inventory with active campaigns or future reservations'
      );
    }

    return this.prisma.adInventory.delete({
      where: { id }
    });
  }

  async activate(id: string, publisherId: string) {
    const inventory = await this.findOne(id, publisherId);

    if (inventory.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new BadRequestException('Inventory must be approved before activation');
    }

    return this.prisma.adInventory.update({
      where: { id },
      data: { isActive: true }
    });
  }

  async deactivate(id: string, publisherId: string) {
    await this.findOne(id, publisherId);

    return this.prisma.adInventory.update({
      where: { id },
      data: { isActive: false }
    });
  }

  
async findPendingApprovals(query: InventoryQueryDto) {
    const where: Prisma.AdInventoryWhereInput = {
      approvalStatus: ApprovalStatus.PENDING
    };
  
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = query;
  
    const [total, inventories] = await Promise.all([
      this.prisma.adInventory.count({ where }),
      this.prisma.adInventory.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder
        },
        include: {
          publisher: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      })
    ]);
  
    return {
      items: inventories,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
  
  async updateApprovalStatus(id: string, status: ApprovalStatus, reason?: string) {
    const inventory = await this.prisma.adInventory.findUnique({
      where: { id }
    });
  
    if (!inventory) {
      throw new ResourceNotFoundException('Inventory', id);
    }
  
    return this.prisma.adInventory.update({
      where: { id },
      data: { 
        approvalStatus: status,
        // You might want to add rejectionReason to your schema
      }
    });
  }
  
  async getPerformanceMetrics(id: string, publisherId: string) {
    await this.findOne(id, publisherId);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [impressions, clicks] = await Promise.all([
      this.prisma.impression.count({
        where: {
          inventoryId: id,
          createdAt: {
            gte: thirtyDaysAgo
          }
        }
      }),
      this.prisma.click.count({
        where: {
          impression: {
            inventoryId: id
          },
          createdAt: {
            gte: thirtyDaysAgo
          }
        }
      })
    ]);

    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

    return {
      inventoryId: id,
      timeframe: '30_days',
      metrics: {
        impressions,
        clicks,
        ctr
      }
    };
  }
}