import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePublisherDto } from './dto/create-publisher.dto';
import { UpdatePublisherDto } from './dto/update-publisher.dto';
import { Language, PublisherStatus, InventoryFormat } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  ResourceNotFoundException,
  DuplicateResourceException,
  BadRequestException
} from '../common/exceptions/custom.exception';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { CreateFloorPriceDto } from './dto/create-floor-price.dto';
import { UpdateFloorPriceDto } from './dto/update-floor-price.dto';
import { CreateTargetingRuleDto } from './dto/create-targeting-rule.dto';
import { UpdateTargetingRuleDto } from './dto/update-targeting-rule.dto';

// Since the ApprovalStatus enum might be causing issues, define it here
enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

@Injectable()
export class PublisherService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPublisherDto: CreatePublisherDto) {
    // Check if email already exists
    const existingPublisher = await this.prisma.publisher.findUnique({
      where: { email: createPublisherDto.email }
    });

    if (existingPublisher) {
      throw new DuplicateResourceException(
        'Publisher',
        'email',
        createPublisherDto.email
      );
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(createPublisherDto.password, 10);

    // Create publisher
    const publisher = await this.prisma.publisher.create({
      data: {
        firstName: createPublisherDto.firstName,
        lastName: createPublisherDto.lastName,
        email: createPublisherDto.email,
        password: hashedPassword,
        domain: createPublisherDto.domain,
        status: createPublisherDto.status || PublisherStatus.ACTIVE
      }
    });

    // Assign categories if provided
    if (createPublisherDto.categoryIds && createPublisherDto.categoryIds.length > 0) {
      await Promise.all(
        createPublisherDto.categoryIds.map(categoryId =>
          this.assignCategory(publisher.id, categoryId)
        )
      );
    }

    // Assign languages if provided
    if (createPublisherDto.languages && createPublisherDto.languages.length > 0) {
      await Promise.all(
        createPublisherDto.languages.map(language =>
          this.assignLanguage(publisher.id, language)
        )
      );
    }

    // Return publisher with associated data
    return this.findOne(publisher.id);
  }
  async getPublishersByCategoryAndLanguage(categoryId?: string, language?: string) {
    const where: any = {};
    
    // Add category filter if provided
    if (categoryId) {
      where.categories = {
        some: { categoryId }
      };
    }
    
    // Add language filter if provided
    if (language) {
      where.languages = {
        some: { language }
      };
    }
    
    return this.prisma.publisher.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        domain: true,
        status: true
      }
    });
  }
  async findAll(query?: { status?: string; search?: string }) {
    const where: any = {};

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.search) {
      where.OR = [
        {
          firstName: {
            contains: query.search,
            mode: 'insensitive'
          }
        },
        {
          lastName: {
            contains: query.search,
            mode: 'insensitive'
          }
        },
        {
          email: {
            contains: query.search,
            mode: 'insensitive'
          }
        }
      ];
    }

    return this.prisma.publisher.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        domain: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            inventories: true,
            categories: true,
            languages: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: string) {
    const publisher = await this.prisma.publisher.findUnique({
      where: { id },
      include: {
        categories: {
          include: {
            category: true
          }
        },
        languages: true,
        _count: {
          select: {
            inventories: true
          }
        }
      }
    });

    if (!publisher) {
      throw new ResourceNotFoundException('Publisher', id);
    }

    // Don't return the password
    const { password, ...result } = publisher;
    return result;
  }

  async update(id: string, updatePublisherDto: UpdatePublisherDto) {
    // Check if publisher exists
    await this.findOne(id);

    // Check if email is being updated and already exists
    if (updatePublisherDto.email) {
      const existingPublisher = await this.prisma.publisher.findFirst({
        where: {
          email: updatePublisherDto.email,
          id: { not: id }
        }
      });

      if (existingPublisher) {
        throw new DuplicateResourceException(
          'Publisher',
          'email',
          updatePublisherDto.email
        );
      }
    }

    // Hash the password if it's being updated
    let data: any = { ...updatePublisherDto };
    if (updatePublisherDto.password) {
      data.password = await bcrypt.hash(updatePublisherDto.password, 10);
    }

    // Remove categoryIds and languages from data as they're handled separately
    const { categoryIds, languages, ...publisherData } = data;

    // Update publisher basic info
    await this.prisma.publisher.update({
      where: { id },
      data: publisherData
    });

    // Update categories if provided
    if (categoryIds && categoryIds.length > 0) {
      // Get current categories
      const currentCategories = await this.prisma.publisherCategory.findMany({
        where: { publisherId: id },
        select: { categoryId: true }
      });
      
      const currentCategoryIds = currentCategories.map(c => c.categoryId);
      
      // Categories to add
      const categoriesToAdd = categoryIds.filter(
        catId => !currentCategoryIds.includes(catId)
      );
      
      // Categories to remove
      const categoriesToRemove = currentCategoryIds.filter(
        catId => !categoryIds.includes(catId)
      );
      
      // Add new categories
      await Promise.all(
        categoriesToAdd.map(categoryId => 
          this.assignCategory(id, categoryId)
        )
      );
      
      // Remove old categories
      await Promise.all(
        categoriesToRemove.map(categoryId => 
          this.removeCategory(id, categoryId)
        )
      );
    }

    // Update languages if provided
    if (languages && languages.length > 0) {
      // Get current languages
      const currentLanguages = await this.prisma.publisherLanguage.findMany({
        where: { publisherId: id },
        select: { language: true }
      });
      
      const currentLanguageValues = currentLanguages.map(l => l.language);
      
      // Languages to add
      const languagesToAdd = languages.filter(
        lang => !currentLanguageValues.includes(lang as Language)
      );
      
      // Languages to remove
      const languagesToRemove = currentLanguageValues.filter(
        lang => !languages.includes(lang as string)
      );
      
      // Add new languages
      await Promise.all(
        languagesToAdd.map(language => 
          this.assignLanguage(id, language)
        )
      );
      
      // Remove old languages
      await Promise.all(
        languagesToRemove.map(language => 
          this.removeLanguage(id, language as string)
        )
      );
    }

    // Return updated publisher
    return this.findOne(id);
  }

  async remove(id: string) {
    // Check if publisher exists
    await this.findOne(id);

    // Check if publisher has inventory
    const inventoryCount = await this.prisma.adInventory.count({
      where: { publisherId: id }
    });

    if (inventoryCount > 0) {
      throw new BadRequestException(
        'Cannot delete publisher with active inventory. Delete inventory first or deactivate publisher instead.'
      );
    }

    // Delete publisher and all related data (categories, languages)
    return this.prisma.publisher.delete({
      where: { id }
    });
  }

  async getPublisherInventory(publisherId: string) {
    // Verify publisher exists
    await this.findOne(publisherId);

    return this.prisma.adInventory.findMany({
      where: { publisherId },
      include: {
        floorPrices: {
          where: {
            startDate: { lte: new Date() },
            OR: [
              { endDate: { gte: new Date() } },
              { endDate: null }
            ]
          },
          orderBy: { startDate: 'desc' },
          take: 1
        },
        categories: {
          include: {
            category: true
          }
        },
        _count: {
          select: {
            impressions: true
          }
        }
      }
    });
  }

  async getPublisherCategories(publisherId: string) {
    // Verify publisher exists
    await this.findOne(publisherId);

    return this.prisma.publisherCategory.findMany({
      where: { publisherId },
      include: {
        category: true
      }
    });
  }

  async assignCategory(publisherId: string, categoryId: string) {
    // Verify publisher exists
    await this.findOne(publisherId);

    // Verify category exists
    const category = await this.prisma.contentCategory.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      throw new ResourceNotFoundException('Category', categoryId);
    }

    // Check if assignment already exists
    const existingAssignment = await this.prisma.publisherCategory.findFirst({
      where: {
        publisherId,
        categoryId
      }
    });

    if (existingAssignment) {
      return existingAssignment;
    }

    // Create new assignment
    return this.prisma.publisherCategory.create({
      data: {
        publisherId,
        categoryId
      }
    });
  }

  async removeCategory(publisherId: string, categoryId: string) {
    // Verify assignment exists
    const assignment = await this.prisma.publisherCategory.findFirst({
      where: {
        publisherId,
        categoryId
      }
    });

    if (!assignment) {
      throw new ResourceNotFoundException(
        'Category assignment',
        `${publisherId}:${categoryId}`
      );
    }

    // Delete assignment
    return this.prisma.publisherCategory.delete({
      where: {
        publisherId_categoryId: {
          publisherId,
          categoryId
        }
      }
    });
  }

  async getPublisherLanguages(publisherId: string) {
    // Verify publisher exists
    await this.findOne(publisherId);

    return this.prisma.publisherLanguage.findMany({
      where: { publisherId }
    });
  }

  async assignLanguage(publisherId: string, language: string) {
    // Verify publisher exists
    await this.findOne(publisherId);

    // Verify language is valid
    if (!Object.values(Language).includes(language as Language)) {
      throw new BadRequestException(`Invalid language: ${language}`);
    }

    // Check if assignment already exists
    const existingAssignment = await this.prisma.publisherLanguage.findFirst({
      where: {
        publisherId,
        language: language as Language
      }
    });

    if (existingAssignment) {
      return existingAssignment;
    }

    // Create new assignment
    return this.prisma.publisherLanguage.create({
      data: {
        publisherId,
        language: language as Language
      }
    });
  }

  async removeLanguage(publisherId: string, language: string) {
    // Verify language is valid
    if (!Object.values(Language).includes(language as Language)) {
      throw new BadRequestException(`Invalid language: ${language}`);
    }

    // Verify assignment exists
    const assignment = await this.prisma.publisherLanguage.findFirst({
      where: {
        publisherId,
        language: language as Language
      }
    });

    if (!assignment) {
      throw new ResourceNotFoundException(
        'Language assignment',
        `${publisherId}:${language}`
      );
    }

    // Delete assignment
    return this.prisma.publisherLanguage.delete({
      where: {
        publisherId_language: {
          publisherId,
          language: language as Language
        }
      }
    });
  }

  // Inventory Management Methods
  async createInventory(publisherId: string, createInventoryDto: CreateInventoryDto) {
    // Verify publisher exists
    await this.findOne(publisherId);

    // Create inventory
    const inventory = await this.prisma.adInventory.create({
      data: {
        publisherId,
        name: createInventoryDto.name,
        format: createInventoryDto.type as InventoryFormat,
        position: 'IN_CONTENT', // Default position, should come from DTO
        width: 300, // Default width, should come from DTO
        height: 250, // Default height, should come from DTO
        isActive: createInventoryDto.active !== undefined ? createInventoryDto.active : true,
        approvalStatus: ApprovalStatus.PENDING,
      }
    });

    // Create floor price if provided
    if (createInventoryDto.floorPrice) {
      await this.prisma.floorPrice.create({
        data: {
          inventoryId: inventory.id,
          basePrice: createInventoryDto.floorPrice,
          currency: 'USD', // Default currency
          startDate: new Date(),
        }
      });
    }

    return inventory;
  }

  async updatePublisherInventory(publisherId: string, inventoryId: string, updateInventoryDto: UpdateInventoryDto) {
    // Verify inventory exists and belongs to publisher
    const inventory = await this.prisma.adInventory.findUnique({
      where: { id: inventoryId }
    });

    if (!inventory) {
      throw new ResourceNotFoundException('Inventory', inventoryId);
    }

    if (inventory.publisherId !== publisherId) {
      throw new ForbiddenException('You do not have permission to update this inventory');
    }

    // Update inventory
    const updatedInventory = await this.prisma.adInventory.update({
      where: { id: inventoryId },
      data: {
        name: updateInventoryDto.name,
        isActive: updateInventoryDto.active
      }
    });

    // Update floor price if provided
    if (updateInventoryDto.floorPrice) {
      const existingFloorPrice = await this.prisma.floorPrice.findFirst({
        where: {
          inventoryId,
          startDate: { lte: new Date() },
          OR: [
            { endDate: { gte: new Date() } },
            { endDate: null }
          ]
        },
        orderBy: { startDate: 'desc' }
      });

      if (existingFloorPrice) {
        // End the current floor price
        await this.prisma.floorPrice.update({
          where: { id: existingFloorPrice.id },
          data: { endDate: new Date() }
        });
      }

      // Create new floor price
      await this.prisma.floorPrice.create({
        data: {
          inventoryId,
          basePrice: updateInventoryDto.floorPrice,
          currency: 'USD',
          startDate: new Date()
        }
      });
    }

    return updatedInventory;
  }

  async deletePublisherInventory(publisherId: string, inventoryId: string) {
    // Verify inventory exists and belongs to publisher
    const inventory = await this.prisma.adInventory.findUnique({
      where: { id: inventoryId }
    });

    if (!inventory) {
      throw new ResourceNotFoundException('Inventory', inventoryId);
    }

    if (inventory.publisherId !== publisherId) {
      throw new ForbiddenException('You do not have permission to delete this inventory');
    }

    // Check if inventory has active campaigns
    const campaignCount = await this.prisma.campaignInventory.count({
      where: { 
        inventoryId,
        campaign: {
          status: {
            in: ['ACTIVE', 'SCHEDULED']
          }
        }
      }
    });

    if (campaignCount > 0) {
      throw new BadRequestException(
        'Cannot delete inventory with active campaigns. Please deactivate inventory instead.'
      );
    }

    // Delete inventory and all related data
    return this.prisma.adInventory.delete({
      where: { id: inventoryId }
    });
  }

  async toggleInventoryStatus(publisherId: string, inventoryId: string, active: boolean) {
    // Verify inventory exists and belongs to publisher
    const inventory = await this.prisma.adInventory.findUnique({
      where: { id: inventoryId }
    });

    if (!inventory) {
      throw new ResourceNotFoundException('Inventory', inventoryId);
    }

    if (inventory.publisherId !== publisherId) {
      throw new ForbiddenException('You do not have permission to update this inventory');
    }

    // Update inventory status
    return this.prisma.adInventory.update({
      where: { id: inventoryId },
      data: { isActive: active }
    });
  }

  async getInventoryMetrics(publisherId: string, inventoryId: string, startDate: string, endDate: string) {
    // Verify inventory exists and belongs to publisher
    const inventory = await this.prisma.adInventory.findUnique({
      where: { id: inventoryId }
    });

    if (!inventory) {
      throw new ResourceNotFoundException('Inventory', inventoryId);
    }

    if (inventory.publisherId !== publisherId) {
      throw new ForbiddenException('You do not have permission to view metrics for this inventory');
    }

    // Parse dates
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();

    // Get impressions data
    const impressions = await this.prisma.impression.groupBy({
      by: ['createdAt'],
      where: {
        inventoryId,
        createdAt: {
          gte: start,
          lte: end
        }
      },
      _count: {
        id: true
      },
      _sum: {
        revenue: true
      }
    });

    // Get clicks data
    const clicks = await this.prisma.click.groupBy({
      by: ['createdAt'],
      where: {
        impression: {
          inventoryId
        },
        createdAt: {
          gte: start,
          lte: end
        }
      },
      _count: {
        id: true
      }
    });

    // Format the metrics
    const dateRange = this.getDateRange(start, end);
    const metricsMap = new Map();

    // Initialize metrics map with dates
    dateRange.forEach(date => {
      metricsMap.set(date.toISOString().split('T')[0], {
        date: date.toISOString().split('T')[0],
        impressions: 0,
        clicks: 0,
        ctr: 0,
        revenue: 0
      });
    });

    // Fill in impressions data
    impressions.forEach(impression => {
      const dateKey = new Date(impression.createdAt).toISOString().split('T')[0];
      if (metricsMap.has(dateKey)) {
        const metrics = metricsMap.get(dateKey);
        metrics.impressions = impression._count.id;
        metrics.revenue = impression._sum.revenue || 0;
        metricsMap.set(dateKey, metrics);
      }
    });

    // Fill in clicks data
    clicks.forEach(click => {
      const dateKey = new Date(click.createdAt).toISOString().split('T')[0];
      if (metricsMap.has(dateKey)) {
        const metrics = metricsMap.get(dateKey);
        metrics.clicks = click._count.id;
        // Calculate CTR
        if (metrics.impressions > 0) {
          metrics.ctr = (metrics.clicks / metrics.impressions) * 100;
        }
        metricsMap.set(dateKey, metrics);
      }
    });

    // Convert map to array
    const metricsArray = Array.from(metricsMap.values());

    // Calculate totals
    const totalImpressions = metricsArray.reduce((sum, metric) => sum + metric.impressions, 0);
    const totalClicks = metricsArray.reduce((sum, metric) => sum + metric.clicks, 0);
    const totalRevenue = metricsArray.reduce((sum, metric) => sum + metric.revenue, 0);
    const totalCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    return {
      daily: metricsArray,
      totals: {
        impressions: totalImpressions,
        clicks: totalClicks,
        ctr: totalCtr,
        revenue: totalRevenue,
        period: {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        }
      }
    };
  }

  // Helper method to generate date range
  private getDateRange(startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dates;
  }

  // Category Management Methods
  async assignCategoriesToInventory(publisherId: string, inventoryId: string, categoryIds: string[]) {
    // Verify inventory exists and belongs to publisher
    const inventory = await this.prisma.adInventory.findUnique({
      where: { id: inventoryId }
    });

    if (!inventory) {
      throw new ResourceNotFoundException('Inventory', inventoryId);
    }

    if (inventory.publisherId !== publisherId) {
      throw new ForbiddenException('You do not have permission to update this inventory');
    }

    // Get current categories
    const currentCategories = await this.prisma.inventoryCategory.findMany({
      where: { inventoryId },
      select: { categoryId: true }
    });
    
    const currentCategoryIds = currentCategories.map(c => c.categoryId);
    
    // Categories to add
    const categoriesToAdd = categoryIds.filter(
      catId => !currentCategoryIds.includes(catId)
    );
    
    // Add new categories
    await Promise.all(
      categoriesToAdd.map(async (categoryId) => {
        // Verify category exists
        const category = await this.prisma.contentCategory.findUnique({
          where: { id: categoryId }
        });
        
        if (!category) {
          throw new ResourceNotFoundException('Category', categoryId);
        }

        return this.prisma.inventoryCategory.create({
          data: {
            inventoryId,
            categoryId
          }
        });
      })
    );

    return this.prisma.inventoryCategory.findMany({
      where: { inventoryId },
      include: {
        category: true
      }
    });
  }

  async removeCategoryFromInventory(publisherId: string, inventoryId: string, categoryId: string) {
    // Verify inventory exists and belongs to publisher
    const inventory = await this.prisma.adInventory.findUnique({
      where: { id: inventoryId }
    });

    if (!inventory) {
      throw new ResourceNotFoundException('Inventory', inventoryId);
    }

    if (inventory.publisherId !== publisherId) {
      throw new ForbiddenException('You do not have permission to update this inventory');
    }

    // Verify category assignment exists
    const categoryAssignment = await this.prisma.inventoryCategory.findFirst({
      where: {
        inventoryId,
        categoryId
      }
    });

    if (!categoryAssignment) {
      throw new ResourceNotFoundException('Category assignment', `${inventoryId}:${categoryId}`);
    }

    // Remove category
    return this.prisma.inventoryCategory.delete({
      where: {
        inventoryId_categoryId: {
          inventoryId,
          categoryId
        }
      }
    });
  }

  async assignCategoriesToProfile(publisherId: string, categoryIds: string[]) {
    // Verify publisher exists
    await this.findOne(publisherId);

    // Get current categories
    const currentCategories = await this.prisma.publisherCategory.findMany({
      where: { publisherId },
      select: { categoryId: true }
    });
    
    const currentCategoryIds = currentCategories.map(c => c.categoryId);
    
    // Categories to add
    const categoriesToAdd = categoryIds.filter(
      catId => !currentCategoryIds.includes(catId)
    );
    
    // Categories to remove
    const categoriesToRemove = currentCategoryIds.filter(
      catId => !categoryIds.includes(catId)
    );
    
    // Add new categories
    await Promise.all(
      categoriesToAdd.map(categoryId => 
        this.assignCategory(publisherId, categoryId)
      )
    );
    
    // Remove old categories
    await Promise.all(
      categoriesToRemove.map(categoryId => 
        this.removeCategory(publisherId, categoryId)
      )
    );

    return this.getPublisherCategories(publisherId);
  }

  // Floor Price Management Methods
  async createFloorPrice(publisherId: string, inventoryId: string, createFloorPriceDto: CreateFloorPriceDto) {
    // Verify inventory exists and belongs to publisher
    const inventory = await this.prisma.adInventory.findUnique({
      where: { id: inventoryId }
    });

    if (!inventory) {
      throw new ResourceNotFoundException('Inventory', inventoryId);
    }

    if (inventory.publisherId !== publisherId) {
      throw new ForbiddenException('You do not have permission to update this inventory');
    }

    // Create floor price
    return this.prisma.floorPrice.create({
      data: {
        inventoryId,
        basePrice: createFloorPriceDto.price,
        currency: 'USD',
        startDate: createFloorPriceDto.startDate ? new Date(createFloorPriceDto.startDate) : new Date()
        // Omit endDate and buyerTargeting to prevent type issues
      }
    });
  }

  async updateFloorPrice(publisherId: string, inventoryId: string, floorPriceId: string, updateFloorPriceDto: UpdateFloorPriceDto) {
    // Verify inventory exists and belongs to publisher
    const inventory = await this.prisma.adInventory.findUnique({
      where: { id: inventoryId }
    });

    if (!inventory) {
      throw new ResourceNotFoundException('Inventory', inventoryId);
    }

    if (inventory.publisherId !== publisherId) {
      throw new ForbiddenException('You do not have permission to update this inventory');
    }

    // Verify floor price exists and belongs to inventory
    const floorPrice = await this.prisma.floorPrice.findUnique({
      where: { id: floorPriceId }
    });

    if (!floorPrice) {
      throw new ResourceNotFoundException('Floor Price', floorPriceId);
    }

    if (floorPrice.inventoryId !== inventoryId) {
      throw new ForbiddenException('Floor price does not belong to this inventory');
    }

    // Update floor price
    return this.prisma.floorPrice.update({
      where: { id: floorPriceId },
      data: {
        basePrice: updateFloorPriceDto.price,
        startDate: updateFloorPriceDto.startDate ? new Date(updateFloorPriceDto.startDate) : undefined
        // Omit endDate and buyerTargeting to prevent type issues
      }
    });
  }

  async deleteFloorPrice(publisherId: string, inventoryId: string, floorPriceId: string) {
    // Verify inventory exists and belongs to publisher
    const inventory = await this.prisma.adInventory.findUnique({
      where: { id: inventoryId }
    });

    if (!inventory) {
      throw new ResourceNotFoundException('Inventory', inventoryId);
    }

    if (inventory.publisherId !== publisherId) {
      throw new ForbiddenException('You do not have permission to update this inventory');
    }

    // Verify floor price exists and belongs to inventory
    const floorPrice = await this.prisma.floorPrice.findUnique({
      where: { id: floorPriceId }
    });

    if (!floorPrice) {
      throw new ResourceNotFoundException('Floor Price', floorPriceId);
    }

    if (floorPrice.inventoryId !== inventoryId) {
      throw new ForbiddenException('Floor price does not belong to this inventory');
    }

    // Delete floor price
    return this.prisma.floorPrice.delete({
      where: { id: floorPriceId }
    });
  }

  // Targeting Rules Methods
  async createTargetingRule(publisherId: string, inventoryId: string, createTargetingRuleDto: CreateTargetingRuleDto) {
    // Verify inventory exists and belongs to publisher
    const inventory = await this.prisma.adInventory.findUnique({
      where: { id: inventoryId }
    });

    if (!inventory) {
      throw new ResourceNotFoundException('Inventory', inventoryId);
    }

    if (inventory.publisherId !== publisherId) {
      throw new ForbiddenException('You do not have permission to update this inventory');
    }

    // Create targeting rule
    return this.prisma.inventoryTargetingRule.create({
      data: {
        inventoryId,
        ruleType: createTargetingRuleDto.type as any, // Type conversion needed
        ruleData: {
          name: createTargetingRuleDto.name,
          include: createTargetingRuleDto.include !== undefined ? createTargetingRuleDto.include : true,
          values: createTargetingRuleDto.values || [],
          parameters: createTargetingRuleDto.parameters || {},
          isActive: createTargetingRuleDto.active !== undefined ? createTargetingRuleDto.active : true
        }
      }
    });
  }

  async updateTargetingRule(publisherId: string, inventoryId: string, ruleId: string, updateTargetingRuleDto: UpdateTargetingRuleDto) {
    // Verify inventory exists and belongs to publisher
    const inventory = await this.prisma.adInventory.findUnique({
      where: { id: inventoryId }
    });

    if (!inventory) {
      throw new ResourceNotFoundException('Inventory', inventoryId);
    }

    if (inventory.publisherId !== publisherId) {
      throw new ForbiddenException('You do not have permission to update this inventory');
    }

    // Verify targeting rule exists and belongs to inventory
    const targetingRule = await this.prisma.inventoryTargetingRule.findUnique({
      where: { id: ruleId }
    });

    if (!targetingRule) {
      throw new ResourceNotFoundException('Targeting Rule', ruleId);
    }

    if (targetingRule.inventoryId !== inventoryId) {
      throw new ForbiddenException('Targeting rule does not belong to this inventory');
    }

    // Get existing rule data
    const existingData = targetingRule.ruleData as any;

    // Update targeting rule
    return this.prisma.inventoryTargetingRule.update({
      where: { id: ruleId },
      data: {
        ruleType: updateTargetingRuleDto.type as any || undefined,
        ruleData: {
          ...existingData,
          name: updateTargetingRuleDto.name || existingData.name,
          include: updateTargetingRuleDto.include !== undefined ? updateTargetingRuleDto.include : existingData.include,
          values: updateTargetingRuleDto.values || existingData.values,
          parameters: updateTargetingRuleDto.parameters || existingData.parameters,
          isActive: updateTargetingRuleDto.active !== undefined ? updateTargetingRuleDto.active : existingData.isActive
        }
      }
    });
  }

  async deleteTargetingRule(publisherId: string, inventoryId: string, ruleId: string) {
    // Verify inventory exists and belongs to publisher
    const inventory = await this.prisma.adInventory.findUnique({
      where: { id: inventoryId }
    });

    if (!inventory) {
      throw new ResourceNotFoundException('Inventory', inventoryId);
    }

    if (inventory.publisherId !== publisherId) {
      throw new ForbiddenException('You do not have permission to update this inventory');
    }

    // Verify targeting rule exists and belongs to inventory
    const targetingRule = await this.prisma.inventoryTargetingRule.findUnique({
      where: { id: ruleId }
    });

    if (!targetingRule) {
      throw new ResourceNotFoundException('Targeting Rule', ruleId);
    }

    if (targetingRule.inventoryId !== inventoryId) {
      throw new ForbiddenException('Targeting rule does not belong to this inventory');
    }

    // Delete targeting rule
    return this.prisma.inventoryTargetingRule.delete({
      where: { id: ruleId }
    });
  }

  async getTargetingRules(publisherId: string, inventoryId: string) {
    // Verify inventory exists and belongs to publisher
    const inventory = await this.prisma.adInventory.findUnique({
      where: { id: inventoryId }
    });

    if (!inventory) {
      throw new ResourceNotFoundException('Inventory', inventoryId);
    }

    if (inventory.publisherId !== publisherId) {
      throw new ForbiddenException('You do not have permission to view this inventory');
    }

    // Get targeting rules
    return this.prisma.inventoryTargetingRule.findMany({
      where: { inventoryId }
    });
  }
}