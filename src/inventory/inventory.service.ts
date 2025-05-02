import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { InventorySearchDto } from './dto/inventory-search.dto';
import {
  ResourceNotFoundException,
  BadRequestException,
  DuplicateResourceException
} from '../common/exceptions/custom.exception';
import { ApprovalStatus, Prisma } from '@prisma/client';
import { PerformanceQueryDto } from './dto/performance-query.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) { }

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

  async findAvailableForAdvertiser(advertiserId: string, query: InventorySearchDto) {
    // Only return approved and active inventory
    const where: Prisma.AdInventoryWhereInput = {
      approvalStatus: ApprovalStatus.APPROVED,
      isActive: true
    };

    // Apply filters from query parameters
    if (query.format) where.format = query.format;
    if (query.position) where.position = query.position;
    if (query.minWidth) where.width = { gte: query.minWidth };
    if (query.minHeight) where.height = { gte: query.minHeight };

    // Filter by specific inventory IDs if provided
    if (query.inventoryIds && query.inventoryIds.length > 0) {
      where.id = { in: query.inventoryIds };
    }

    // Filter by categories if provided
    if (query.categoryIds && query.categoryIds.length > 0) {
      where.categories = {
        some: {
          categoryId: { in: query.categoryIds }
        }
      };
    }

    // Check for blocked advertisers
    where.blockedAdvertisers = {
      none: {
        advertiserId
      }
    };

    // Use default values for pagination parameters
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const [total, inventories] = await Promise.all([
      this.prisma.adInventory.count({ where }),
      this.prisma.adInventory.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          [sortBy as string]: sortOrder
        },
        include: {
          // Include only necessary data for advertisers
          categories: {
            include: {
              category: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          // Include current floor price
          floorPrices: {
            where: {
              startDate: { lte: new Date() },
              OR: [
                { endDate: { gte: new Date() } },
                { endDate: null }
              ]
            },
            orderBy: {
              startDate: 'desc'
            },
            take: 1
          },
          // Include average performance metrics
          _count: {
            select: {
              impressions: true
            }
          }
        }
      })
    ]);

    // Format the response to hide sensitive publisher data
    const formattedInventories = inventories.map(inventory => ({
      id: inventory.id,
      name: inventory.name,
      width: inventory.width,
      height: inventory.height,
      format: inventory.format,
      position: inventory.position,
      categories: inventory.categories.map(cat => cat.category),
      floorPrice: inventory.floorPrices[0]?.basePrice || 0.01,
      currency: inventory.floorPrices[0]?.currency || 'USD',
      viewabilityScore: inventory.viewabilityScore,
      estimatedImpressions: this.calculateEstimatedImpressions(inventory._count.impressions)
    }));

    return {
      items: formattedInventories,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getInventoryPerformanceForAdvertisers(query: PerformanceQueryDto) {
    const { format, categoryIds, days = 30 } = query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build the where condition for inventory
    const where: any = {
      approvalStatus: ApprovalStatus.APPROVED,
      isActive: true
    };

    if (format) {
      where.format = format;
    }

    if (categoryIds && categoryIds.length > 0) {
      where.categories = {
        some: {
          categoryId: { in: categoryIds }
        }
      };
    }

    // Get all matching inventory IDs
    const inventoryIds = await this.prisma.adInventory.findMany({
      where,
      select: { id: true }
    }).then(results => results.map(item => item.id));

    if (inventoryIds.length === 0) {
      return {
        timeframe: `${days} days`,
        metrics: {
          totalInventoryCount: 0,
          formats: {},
          categories: {},
          performance: {
            impressions: 0,
            clicks: 0,
            ctr: 0
          }
        }
      };
    }

    // Get impression and click counts for these inventories
    const [impressions, clicks, inventoryStats] = await Promise.all([
      this.prisma.impression.count({
        where: {
          inventoryId: { in: inventoryIds },
          createdAt: { gte: startDate }
        }
      }),
      this.prisma.click.count({
        where: {
          impression: {
            inventoryId: { in: inventoryIds }
          },
          createdAt: { gte: startDate }
        }
      }),
      // Get counts by format
      this.prisma.adInventory.groupBy({
        by: ['format'],
        where: {
          id: { in: inventoryIds }
        },
        _count: true
      })
    ]);

    // Calculate metrics
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

    // Format the output
    const formatStats = {};
    inventoryStats.forEach(stat => {
      formatStats[stat.format] = stat._count;
    });

    return {
      timeframe: `${days} days`,
      metrics: {
        totalInventoryCount: inventoryIds.length,
        formats: formatStats,
        performance: {
          impressions,
          clicks,
          ctr: ctr.toFixed(2) + '%',
          estimatedDailyImpressions: Math.round(impressions / days)
        }
      }
    };
  }

  // Helper function to estimate available impressions based on historical data
  private calculateEstimatedImpressions(historicalCount: number): number {
    // This would use historical data to estimate future availability
    // Simplified version for example
    return Math.round(historicalCount * 0.85); // 85% of historical as estimate
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

  async getAllCategories() {
    return this.prisma.contentCategory.findMany({
      select: {
        id: true,
        name: true,
        parentId: true
      }
    });
  }
}