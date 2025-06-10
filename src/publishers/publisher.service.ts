import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePublisherDto } from './dto/create-publisher.dto';
import { UpdatePublisherDto } from './dto/update-publisher.dto';
import { Language, PublisherStatus, InventoryFormat } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  ResourceNotFoundException,
  DuplicateResourceException,
  BadRequestException,
} from '../common/exceptions/custom.exception';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { CreateFloorPriceDto } from './dto/floor-price.dto';
import { UpdateFloorPriceDto } from './dto/update-floor-price.dto';
import { CreateWebsiteDto } from './dto/create-website.dto';
import {
  ActivateInventoryDto,
  CreateAdInventoryDto,
} from './dto/inventory.dto';
import {
  CreateBehavioralTargetingDto,
  UpdateBehavioralTargetingDto,
} from './dto/targeting/behavourial-targeting.dto';
import {
  CreateContextualTargetingDto,
  UpdateContextualTargetingDto,
} from './dto/targeting/contextual-targeting.dto';
import {
  CreateDemographicTargetingDto,
  UpdateDemographicTargetingDto,
} from './dto/targeting/demographic-targeting.dto';
import {
  CreateDeviceTargetingDto,
  UpdateDeviceTargetingDto,
} from './dto/targeting/device-targeting.dto';
import {
  CreateFrequencyTargetingDto,
  UpdateFrequencyTargetingDto,
} from './dto/targeting/frequency-targeting.dto';
import {
  CreateGeographicTargetingDto,
  UpdateGeographicTargetingDto,
} from './dto/targeting/geographic-targeting.dto';
import {
  CreateTimeTargetingDto,
  UpdateTimeTargetingDto,
} from './dto/targeting/time-targeting.dto';

// Since the ApprovalStatus enum might be causing issues, define it here
enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Injectable()
export class PublisherService {
  constructor(private readonly prisma: PrismaService) {}

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
            mode: 'insensitive',
          },
        },
        {
          lastName: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    return this.prisma.publisher.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            inventories: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const publisher = await this.prisma.publisher.findUnique({
      where: { id },
      include: {
        inventories: true,
        websites: true,
      },
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
          id: { not: id },
        },
      });

      if (existingPublisher) {
        throw new DuplicateResourceException(
          'Publisher',
          'email',
          updatePublisherDto.email,
        );
      }
    }

    // Hash the password if it's being updated
    let data: any = { ...updatePublisherDto };
    if (updatePublisherDto.password) {
      throw new BadRequestException(
        'Password update is not allowed via this endpoint.',
      );
    }

    // Remove categoryIds and languages from data as they're handled separately
    const { categoryIds, languages, ...publisherData } = data;

    // Update publisher basic info
    await this.prisma.publisher.update({
      where: { id },
      data: publisherData,
    });

    // Return updated publisher
    return this.findOne(id);
  }
  async deactivatePublisherAccount(id: string) {
    // Check if publisher exists
    const publisher = await this.findOne(id);
    if (!publisher) {
      throw new ResourceNotFoundException('Publisher', id);
    }
    // Deactivate the publisher account
    return this.prisma.publisher.update({
      where: { id },
      data: {
        status: PublisherStatus.DEACTIVATED,
      },
    });
  }
  async createWebsite(createWebsiteDto: CreateWebsiteDto) {
    // Check if publisher exists
    const publisher = await this.prisma.publisher.findUnique({
      where: { id: createWebsiteDto.publisherId },
    });

    if (!publisher) {
      throw new ResourceNotFoundException(
        'Publisher',
        createWebsiteDto.publisherId,
      );
    }
    // Generate Initialization Script
    const initializationScript = `
    <script></script>`;
    // Check if website URL already exists
    const existingWebsite = await this.prisma.website.findUnique({
      where: { url: createWebsiteDto.url },
    });

    if (existingWebsite) {
      throw new DuplicateResourceException(
        'Website',
        'url',
        createWebsiteDto.url,
      );
    }

    // Create website
    let data = await this.prisma.website.create({
      data: {
        url: createWebsiteDto.url,
        name: createWebsiteDto.websiteName,
        publisherId: createWebsiteDto.publisherId,
        initScript: initializationScript,
        isActive: true,
        description: createWebsiteDto.description || '',
        websiteCategories: {
          connect: createWebsiteDto.categoryIds.map((id) => ({ id })),
        },
      },
    });
    return data;
  }
  async getAllWebsites(publisherId: string) {
    await this.findOne(publisherId);

    const data = await this.prisma.website.findMany({
      where: { publisherId },
      include: {
        inventories: true,
        websiteCategories: true,
      },
    });

    return data;
  }
  async getWebsiteById(publisherId: string, websiteId: string) {
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId, publisherId, isActive: true },
      include: {
        inventories: true,
        websiteCategories: true,
      },
    });
    if (!website) {
      throw new ResourceNotFoundException('Website', websiteId);
    }
    return website;
  }
  async getWebsiteByURL(publisherId: string, websiteURL: string) {
    const website = await this.prisma.website.findUnique({
      where: { url: websiteURL, publisherId, isActive: true },
      include: {
        inventories: true,
        websiteCategories: true,
      },
    });
    if (!website) {
      throw new ResourceNotFoundException('Website', websiteURL);
    }
    return website;
  }
  async activateWebsite(publisherId: string, websiteId: string) {
    await this.getWebsiteById(publisherId, websiteId);
    const data = await this.prisma.website.update({
      where: { id: websiteId },
      data: { isActive: true },
    });

    return data;
  }
  async deleteWebsite(publisherId: string, websiteId: string) {
    await this.getWebsiteById(publisherId, websiteId);

    // Check if website has active inventories
    const activeInventories = await this.prisma.adInventory.count({
      where: {
        websiteId: websiteId,
        isActive: true,
      },
    });
    if (activeInventories > 0) {
      throw new BadRequestException(
        'Cannot delete website with active inventories. Please deactivate them first.',
      );
    }
    // Delete website
    return await this.prisma.website.update({
      where: { id: websiteId },
      data: {
        isActive: false, // Soft delete
      },
    });
  }
  async getAvailableAdSlotTemplates() {
    const adSlotTypes = await this.prisma.adSlotTemplate.findMany({});
    return adSlotTypes;
  }
  // Inventory Management Methods
  async createAdSlot(createInventoryDto: CreateAdInventoryDto) {
    // Verify publisher exists & website belongs to publisher
    await this.findOne(createInventoryDto.publisherId);
    await this.getWebsiteById(
      createInventoryDto.publisherId,
      createInventoryDto.websiteId,
    );
    // check ad slot template exists
    const checkTemplateExist = await this.prisma.adSlotTemplate.findUnique({
      where: { id: createInventoryDto.adSlotTemplateId },
    });
    if (!checkTemplateExist) {
      throw new ResourceNotFoundException(
        'Ad Slot Template',
        createInventoryDto.adSlotTemplateId,
      );
    }
    // Create inventory
    const inventory = await this.prisma.adInventory.create({
      data: {
        name: createInventoryDto.name,
        adSlotTemplateId: createInventoryDto.adSlotTemplateId,
        publisherId: createInventoryDto.publisherId,
        websiteId: createInventoryDto.websiteId,
        isActive: true,
        viewabilityScore: createInventoryDto.viewabilityScore || 0.8,
        approvalStatus: ApprovalStatus.PENDING,
      },
      include: {
        adSlotTemplate: {
          select: {
            format: true,
            height: true,
            width: true,
            position: true,
            id: true,
            name: true,
          },
        },
        publisher: {
          select: {
            id: true,
            email: true,
          },
        },
        website: {
          select: {
            initScript: true,
            url: true,
            name: true,
            id: true,
          },
        },
        floorPrices: true,
      },
    });

    return inventory;
  }
  async getAdSlotsForPublisher(publisherId: string) {
    // Verify publisher exists
    await this.findOne(publisherId);

    // Get all ad slots for the publisher
    const adSlots = await this.prisma.adInventory.findMany({
      where: { publisherId },
      include: {
        adSlotTemplate: true,
        website: true,
        floorPrices: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return adSlots;
  }
  async getAdSlotsForWebsite(publisherId: string, websiteId: string) {
    // Verify publisher exists
    await this.findOne(publisherId);
    // Verify website exists and belongs to publisher
    const website = await this.getWebsiteById(publisherId, websiteId);

    // Get all ad slots for the publisher
    const adSlots = await this.prisma.adInventory.findMany({
      where: { publisherId, websiteId },
      include: {
        adSlotTemplate: true,
        website: true,
        floorPrices: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return adSlots;
  }
  async getSpecificAdSlot(
    publisherId: string,
    inventoryId: string,
    websiteId: string,
  ) {
    // Verify publisher exists
    await this.findOne(publisherId);
    // Verify website exists and belongs to publisher
    const website = await this.getWebsiteById(publisherId, websiteId);

    // Get specific ad slot for the publisher and website
    const adSlot = await this.prisma.adInventory.findUnique({
      where: { id: inventoryId, publisherId, websiteId },
      include: {
        adSlotTemplate: true,
        website: true,
        floorPrices: true,
      },
    });

    if (!adSlot) {
      throw new ResourceNotFoundException('Ad Slot', inventoryId);
    }

    return adSlot;
  }
  //
  async toggleActivationStatus(activateDto: ActivateInventoryDto) {
    // Verify Ad Slot Exist
    const { publisherId, inventoryId, websiteId, isActive } = activateDto;
    await this.getSpecificAdSlot(publisherId, inventoryId, websiteId);

    // Update inventory activation status
    const updatedInventory = await this.prisma.adInventory.update({
      where: { id: inventoryId, publisherId, websiteId },
      data: { isActive },
      include: {
        adSlotTemplate: true,
        website: true,
        floorPrices: true,
      },
    });
    if (!updatedInventory) {
      throw new ResourceNotFoundException('Ad Slot', inventoryId);
    }
    return updatedInventory;
  }
  async deleteAdSlot(publisherId: string, adSlotId: string, websiteId: string) {
    // Verify Ad Slot Exist
    const adSlot = await this.getSpecificAdSlot(
      publisherId,
      adSlotId,
      websiteId,
    );
    if (!adSlot) {
      throw new ResourceNotFoundException('Ad Slot', adSlotId);
    }
    const del = await this.prisma.adInventory.delete({
      where: { id: adSlotId, publisherId, websiteId },
    });
    if (!del) {
      throw new ResourceNotFoundException('Ad Slot', adSlotId);
    }
    return del;
  }
  async createFloorPriceRule(createFloorPriceDto: CreateFloorPriceDto) {
    // Verify inventory exists and belongs to publisher
    const inventory = await this.prisma.adInventory.findUnique({
      where: { id: createFloorPriceDto.inventoryId },
    });

    if (!inventory) {
      throw new ResourceNotFoundException(
        'Inventory',
        createFloorPriceDto.inventoryId,
      );
    }

    if (inventory.publisherId !== createFloorPriceDto.publisherId) {
      throw new ForbiddenException(
        'You do not have permission to create floor price for this inventory',
      );
    }

    // Create floor price
    return await this.prisma.floorPrice.create({
      data: {
        inventoryId: createFloorPriceDto.inventoryId,
        basePrice: createFloorPriceDto.basePrice,
        currency: 'INR',
        startDate: createFloorPriceDto.startDate
          ? new Date(createFloorPriceDto.startDate)
          : new Date(),
        endDate: createFloorPriceDto.endDate
          ? new Date(createFloorPriceDto.endDate)
          : null,
      },
    });
  }

  async getAllFloorPriceRules(publisherId: string, inventoryId: string) {
    // Verify inventory exists and belongs to publisher
    const inventory = await this.prisma.adInventory.findUnique({
      where: { id: inventoryId },
    });

    if (!inventory) {
      throw new ResourceNotFoundException('Inventory', inventoryId);
    }

    if (inventory.publisherId !== publisherId) {
      throw new ForbiddenException(
        'You do not have permission to view floor prices for this inventory',
      );
    }

    // Get all floor prices for the inventory
    return await this.prisma.floorPrice.findMany({
      where: { inventoryId },
      orderBy: { startDate: 'desc' },
    });
  }
  async getSingleFloorPriceRule(
    publisherId: string,
    inventoryId: string,
    floorPriceId: string,
  ) {
    // Verify inventory exists and belongs to publisher
    const inventory = await this.prisma.adInventory.findUnique({
      where: { id: inventoryId },
    });

    if (!inventory) {
      throw new ResourceNotFoundException('Inventory', inventoryId);
    }

    if (inventory.publisherId !== publisherId) {
      throw new ForbiddenException(
        'You do not have permission to view floor prices for this inventory',
      );
    }

    // Get all floor prices for the inventory
    return await this.prisma.floorPrice.findUnique({
      where: { inventoryId, id: floorPriceId },
    });
  }
  async updateFloorPriceRule(updateFloorPriceDto: UpdateFloorPriceDto) {
    // Verify Floor Price Exists
    const floorPrice = await this.prisma.floorPrice.findUnique({
      where: { id: updateFloorPriceDto.id },
    });
    if (!floorPrice) {
      throw new ResourceNotFoundException(
        'Floor Price',
        updateFloorPriceDto.id,
      );
    }
    // Verify inventory exists and belongs to publisher
    const inventory = await this.prisma.adInventory.findUnique({
      where: { id: floorPrice.inventoryId },
    });
    if (!inventory) {
      throw new ResourceNotFoundException('Inventory', floorPrice.inventoryId);
    }
    if (inventory.publisherId !== updateFloorPriceDto.publisherId) {
      throw new ForbiddenException(
        'You do not have permission to update this floor price',
      );
    }
    // Update Floor Price
    const updatedFloorPrice = await this.prisma.floorPrice.update({
      where: { id: updateFloorPriceDto.id },
      data: {
        basePrice: updateFloorPriceDto.basePrice,
        currency: 'INR',
        startDate: updateFloorPriceDto.startDate
          ? new Date(updateFloorPriceDto.startDate)
          : new Date(),
        endDate: updateFloorPriceDto.endDate
          ? new Date(updateFloorPriceDto.endDate)
          : null,
      },
    });
    return updatedFloorPrice;
  }
  async deleteFloorPriceRule(publisherId: string, floorPriceId: string) {
    // check floor price exist & belong to publisher
    const floorPrice = await this.prisma.floorPrice.findUnique({
      where: { id: floorPriceId, AND: { inventory: { publisherId } } },
    });
    if (!floorPrice) {
      throw new ResourceNotFoundException('Floor Price', floorPriceId);
    }
    // Delete Floor Price
    const del = await this.prisma.floorPrice.delete({
      where: { id: floorPriceId },
    });
    return del;
  }

  // Helper method to verify inventory ownership
  private async verifyInventoryOwnership(
    publisherId: string,
    inventoryId: string,
  ) {
    const inventory = await this.prisma.adInventory.findFirst({
      where: {
        id: inventoryId,
        publisherId: publisherId,
      },
    });

    if (!inventory) {
      throw new NotFoundException('Inventory not found or access denied');
    }

    return inventory;
  }

  // ======================
  // DEMOGRAPHIC TARGETING
  // ======================

  async addDemographicTargeting(
    publisherId: string,
    createDto: CreateDemographicTargetingDto,
  ) {
    await this.verifyInventoryOwnership(publisherId, createDto.inventoryId);

    // Validate age range if both are provided
    if (
      createDto.ageMin &&
      createDto.ageMax &&
      createDto.ageMin > createDto.ageMax
    ) {
      throw new BadRequestException(
        'Minimum age cannot be greater than maximum age',
      );
    }

    return this.prisma.demographicTargeting.create({
      data: {
        inventoryId: createDto.inventoryId,
        ageMin: createDto.ageMin,
        ageMax: createDto.ageMax,
        genders: createDto.genders || [],
        languages: createDto.languages || [],
        education: createDto.education || [],
        incomeRange: createDto.incomeRange || [],
      },
      include: {
        inventory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async getDemographicTargeting(publisherId: string, inventoryId: string) {
    await this.verifyInventoryOwnership(publisherId, inventoryId);

    return this.prisma.demographicTargeting.findMany({
      where: {
        inventoryId: inventoryId,
      },
      include: {
        inventory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async updateDemographicTargeting(
    publisherId: string,
    id: string,
    updateDto: UpdateDemographicTargetingDto,
  ) {
    await this.verifyInventoryOwnership(publisherId, updateDto.inventoryId);

    // Check if the targeting rule exists and belongs to the inventory
    const existingRule = await this.prisma.demographicTargeting.findFirst({
      where: {
        id: id,
        inventoryId: updateDto.inventoryId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Demographic targeting rule not found');
    }

    // Validate age range if both are provided
    if (
      updateDto.ageMin &&
      updateDto.ageMax &&
      updateDto.ageMin > updateDto.ageMax
    ) {
      throw new BadRequestException(
        'Minimum age cannot be greater than maximum age',
      );
    }

    return this.prisma.demographicTargeting.update({
      where: { id },
      data: {
        ageMin: updateDto.ageMin,
        ageMax: updateDto.ageMax,
        genders: updateDto.genders,
        languages: updateDto.languages,
        education: updateDto.education,
        incomeRange: updateDto.incomeRange,
      },
      include: {
        inventory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async deleteDemographicTargeting(
    publisherId: string,
    inventoryId: string,
    id: string,
  ) {
    await this.verifyInventoryOwnership(publisherId, inventoryId);

    const existingRule = await this.prisma.demographicTargeting.findFirst({
      where: {
        id: id,
        inventoryId: inventoryId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Demographic targeting rule not found');
    }

    await this.prisma.demographicTargeting.delete({
      where: { id },
    });

    return { message: 'Demographic targeting rule deleted successfully' };
  }

  // ======================
  // GEOGRAPHIC TARGETING
  // ======================

  async addGeographicTargeting(
    publisherId: string,
    createDto: CreateGeographicTargetingDto,
  ) {
    await this.verifyInventoryOwnership(publisherId, createDto.inventoryId);

    return this.prisma.geographicTargeting.create({
      data: {
        inventoryId: createDto.inventoryId,
        countries: createDto.countries || [],
        states: createDto.states || [],
        cities: createDto.cities || [],
        postalCodes: createDto.postalCodes || [],
        radius: createDto.radius,
        latitude: createDto.latitude,
        longitude: createDto.longitude,
        isInclude: createDto.isInclude ?? true,
      },
      include: {
        inventory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async getGeographicTargeting(publisherId: string, inventoryId: string) {
    await this.verifyInventoryOwnership(publisherId, inventoryId);

    return this.prisma.geographicTargeting.findMany({
      where: {
        inventoryId: inventoryId,
      },
      include: {
        inventory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async updateGeographicTargeting(
    publisherId: string,
    id: string,
    updateDto: UpdateGeographicTargetingDto,
  ) {
    await this.verifyInventoryOwnership(publisherId, updateDto.inventoryId);

    const existingRule = await this.prisma.geographicTargeting.findFirst({
      where: {
        id: id,
        inventoryId: updateDto.inventoryId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Geographic targeting rule not found');
    }

    return this.prisma.geographicTargeting.update({
      where: { id },
      data: {
        countries: updateDto.countries,
        states: updateDto.states,
        cities: updateDto.cities,
        postalCodes: updateDto.postalCodes,
        radius: updateDto.radius,
        latitude: updateDto.latitude,
        longitude: updateDto.longitude,
        isInclude: updateDto.isInclude,
      },
      include: {
        inventory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async deleteGeographicTargeting(
    publisherId: string,
    inventoryId: string,
    id: string,
  ) {
    await this.verifyInventoryOwnership(publisherId, inventoryId);

    const existingRule = await this.prisma.geographicTargeting.findFirst({
      where: {
        id: id,
        inventoryId: inventoryId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Geographic targeting rule not found');
    }

    await this.prisma.geographicTargeting.delete({
      where: { id },
    });

    return { message: 'Geographic targeting rule deleted successfully' };
  }

  // ======================
  // DEVICE TARGETING
  // ======================

  async addDeviceTargeting(
    publisherId: string,
    createDto: CreateDeviceTargetingDto,
  ) {
    await this.verifyInventoryOwnership(publisherId, createDto.inventoryId);

    return this.prisma.deviceTargeting.create({
      data: {
        inventoryId: createDto.inventoryId,
        deviceTypes: createDto.deviceTypes || [],
        operatingSystems: createDto.operatingSystems || [],
        browsers: createDto.browsers || [],
        connectionTypes: createDto.connectionTypes || [],
        minOSVersion: createDto.minOSVersion,
        maxOSVersion: createDto.maxOSVersion,
        deviceModels: createDto.deviceModels || [],
        isInclude: createDto.isInclude ?? true,
      },
      include: {
        inventory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async getDeviceTargeting(publisherId: string, inventoryId: string) {
    await this.verifyInventoryOwnership(publisherId, inventoryId);

    return this.prisma.deviceTargeting.findMany({
      where: {
        inventoryId: inventoryId,
      },
      include: {
        inventory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async updateDeviceTargeting(
    publisherId: string,
    id: string,
    updateDto: UpdateDeviceTargetingDto,
  ) {
    await this.verifyInventoryOwnership(publisherId, updateDto.inventoryId);

    const existingRule = await this.prisma.deviceTargeting.findFirst({
      where: {
        id: id,
        inventoryId: updateDto.inventoryId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Device targeting rule not found');
    }

    return this.prisma.deviceTargeting.update({
      where: { id },
      data: {
        deviceTypes: updateDto.deviceTypes,
        operatingSystems: updateDto.operatingSystems,
        browsers: updateDto.browsers,
        connectionTypes: updateDto.connectionTypes,
        minOSVersion: updateDto.minOSVersion,
        maxOSVersion: updateDto.maxOSVersion,
        deviceModels: updateDto.deviceModels,
        isInclude: updateDto.isInclude,
      },
      include: {
        inventory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async deleteDeviceTargeting(
    publisherId: string,
    inventoryId: string,
    id: string,
  ) {
    await this.verifyInventoryOwnership(publisherId, inventoryId);

    const existingRule = await this.prisma.deviceTargeting.findFirst({
      where: {
        id: id,
        inventoryId: inventoryId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Device targeting rule not found');
    }

    await this.prisma.deviceTargeting.delete({
      where: { id },
    });

    return { message: 'Device targeting rule deleted successfully' };
  }

  // ======================
  // CONTEXTUAL TARGETING
  // ======================

  async addContextualTargeting(
    publisherId: string,
    createDto: CreateContextualTargetingDto,
  ) {
    await this.verifyInventoryOwnership(publisherId, createDto.inventoryId);

    return this.prisma.contextualTargeting.create({
      data: {
        inventoryId: createDto.inventoryId,
        contentCategories: createDto.contentCategories || [],
        keywords: createDto.keywords || [],
        urlPatterns: createDto.urlPatterns || [],
        pageTypes: createDto.pageTypes || [],
        brandSafety: createDto.brandSafety || [],
        blockedKeywords: createDto.blockedKeywords || [],
        isInclude: createDto.isInclude ?? true,
      },
      include: {
        inventory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async getContextualTargeting(publisherId: string, inventoryId: string) {
    await this.verifyInventoryOwnership(publisherId, inventoryId);

    return this.prisma.contextualTargeting.findMany({
      where: {
        inventoryId: inventoryId,
      },
      include: {
        inventory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async updateContextualTargeting(
    publisherId: string,
    id: string,
    updateDto: UpdateContextualTargetingDto,
  ) {
    await this.verifyInventoryOwnership(publisherId, updateDto.inventoryId);

    const existingRule = await this.prisma.contextualTargeting.findFirst({
      where: {
        id: id,
        inventoryId: updateDto.inventoryId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Contextual targeting rule not found');
    }

    return this.prisma.contextualTargeting.update({
      where: { id },
      data: {
        contentCategories: updateDto.contentCategories,
        keywords: updateDto.keywords,
        urlPatterns: updateDto.urlPatterns,
        pageTypes: updateDto.pageTypes,
        brandSafety: updateDto.brandSafety,
        blockedKeywords: updateDto.blockedKeywords,
        isInclude: updateDto.isInclude,
      },
      include: {
        inventory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async deleteContextualTargeting(
    publisherId: string,
    inventoryId: string,
    id: string,
  ) {
    await this.verifyInventoryOwnership(publisherId, inventoryId);

    const existingRule = await this.prisma.contextualTargeting.findFirst({
      where: {
        id: id,
        inventoryId: inventoryId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Contextual targeting rule not found');
    }

    await this.prisma.contextualTargeting.delete({
      where: { id },
    });

    return { message: 'Contextual targeting rule deleted successfully' };
  }

  // ======================
  // BEHAVIORAL TARGETING
  // ======================

  async addBehavioralTargeting(
    publisherId: string,
    createDto: CreateBehavioralTargetingDto,
  ) {
    await this.verifyInventoryOwnership(publisherId, createDto.inventoryId);

    return this.prisma.behavioralTargeting.create({
      data: {
        inventoryId: createDto.inventoryId,
        interests: createDto.interests || [],
        purchaseIntent: createDto.purchaseIntent || [],
        lifestyleSegments: createDto.lifestyleSegments || [],
        audienceTypes: createDto.audienceTypes || [],
        userSegments: createDto.userSegments || [],
        purchaseFrequency: createDto.purchaseFrequency || [],
        sessionEngagement: createDto.sessionEngagement || [],
        avgOrderValue: createDto.avgOrderValue,
        sessionDuration: createDto.sessionDuration,
        pageViews: createDto.pageViews,
        isInclude: createDto.isInclude ?? true,
      },
      include: {
        inventory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async getBehavioralTargeting(publisherId: string, inventoryId: string) {
    await this.verifyInventoryOwnership(publisherId, inventoryId);

    return this.prisma.behavioralTargeting.findMany({
      where: {
        inventoryId: inventoryId,
      },
      include: {
        inventory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async updateBehavioralTargeting(
    publisherId: string,
    id: string,
    updateDto: UpdateBehavioralTargetingDto,
  ) {
    await this.verifyInventoryOwnership(publisherId, updateDto.inventoryId);

    const existingRule = await this.prisma.behavioralTargeting.findFirst({
      where: {
        id: id,
        inventoryId: updateDto.inventoryId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Behavioral targeting rule not found');
    }

    return this.prisma.behavioralTargeting.update({
      where: { id },
      data: {
        interests: updateDto.interests,
        purchaseIntent: updateDto.purchaseIntent,
        lifestyleSegments: updateDto.lifestyleSegments,
        audienceTypes: updateDto.audienceTypes,
        userSegments: updateDto.userSegments,
        purchaseFrequency: updateDto.purchaseFrequency,
        sessionEngagement: updateDto.sessionEngagement,
        avgOrderValue: updateDto.avgOrderValue,
        sessionDuration: updateDto.sessionDuration,
        pageViews: updateDto.pageViews,
        isInclude: updateDto.isInclude,
      },
      include: {
        inventory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async deleteBehavioralTargeting(
    publisherId: string,
    inventoryId: string,
    id: string,
  ) {
    await this.verifyInventoryOwnership(publisherId, inventoryId);

    const existingRule = await this.prisma.behavioralTargeting.findFirst({
      where: {
        id: id,
        inventoryId: inventoryId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Behavioral targeting rule not found');
    }

    await this.prisma.behavioralTargeting.delete({
      where: { id },
    });

    return { message: 'Behavioral targeting rule deleted successfully' };
  }

  // ======================
  // TIME TARGETING
  // ======================

  async addTimeTargeting(
    publisherId: string,
    createDto: CreateTimeTargetingDto,
  ) {
    await this.verifyInventoryOwnership(publisherId, createDto.inventoryId);

    // Validate time range if both start and end hours are provided
    if (createDto.startHour !== undefined && createDto.endHour !== undefined) {
      if (createDto.startHour > createDto.endHour) {
        throw new BadRequestException(
          'Start hour cannot be greater than end hour',
        );
      }
    }

    // Validate date range if both dates are provided
    if (createDto.startDate && createDto.endDate) {
      if (createDto.startDate > createDto.endDate) {
        throw new BadRequestException('Start date cannot be after end date');
      }
    }

    return this.prisma.timeTargeting.create({
      data: {
        inventoryId: createDto.inventoryId,
        timezone: createDto.timezone || 'Asia/Kolkata',
        timeSlots: createDto.timeSlots || [],
        daysOfWeek: createDto.daysOfWeek || [],
        holidayTypes: createDto.holidayTypes || [],
        startHour: createDto.startHour,
        endHour: createDto.endHour,
        startDate: createDto.startDate,
        endDate: createDto.endDate,
        includeHolidays: createDto.includeHolidays ?? true,
        workingDaysOnly: createDto.workingDaysOnly ?? false,
      },
      include: {
        inventory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async getTimeTargeting(publisherId: string, inventoryId: string) {
    await this.verifyInventoryOwnership(publisherId, inventoryId);

    return this.prisma.timeTargeting.findMany({
      where: {
        inventoryId: inventoryId,
      },
      include: {
        inventory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async updateTimeTargeting(
    publisherId: string,
    id: string,
    updateDto: UpdateTimeTargetingDto,
  ) {
    await this.verifyInventoryOwnership(publisherId, updateDto.inventoryId);

    const existingRule = await this.prisma.timeTargeting.findFirst({
      where: {
        id: id,
        inventoryId: updateDto.inventoryId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Time targeting rule not found');
    }

    // Validate time range if both start and end hours are provided
    if (updateDto.startHour !== undefined && updateDto.endHour !== undefined) {
      if (updateDto.startHour > updateDto.endHour) {
        throw new BadRequestException(
          'Start hour cannot be greater than end hour',
        );
      }
    }

    // Validate date range if both dates are provided
    if (updateDto.startDate && updateDto.endDate) {
      if (updateDto.startDate > updateDto.endDate) {
        throw new BadRequestException('Start date cannot be after end date');
      }
    }

    return this.prisma.timeTargeting.update({
      where: { id },
      data: {
        timezone: updateDto.timezone,
        timeSlots: updateDto.timeSlots,
        daysOfWeek: updateDto.daysOfWeek,
        holidayTypes: updateDto.holidayTypes,
        startHour: updateDto.startHour,
        endHour: updateDto.endHour,
        startDate: updateDto.startDate,
        endDate: updateDto.endDate,
        includeHolidays: updateDto.includeHolidays,
        workingDaysOnly: updateDto.workingDaysOnly,
      },
      include: {
        inventory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async deleteTimeTargeting(
    publisherId: string,
    inventoryId: string,
    id: string,
  ) {
    await this.verifyInventoryOwnership(publisherId, inventoryId);

    const existingRule = await this.prisma.timeTargeting.findFirst({
      where: {
        id: id,
        inventoryId: inventoryId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Time targeting rule not found');
    }

    await this.prisma.timeTargeting.delete({
      where: { id },
    });

    return { message: 'Time targeting rule deleted successfully' };
  }

  // ======================
  // FREQUENCY TARGETING
  // ======================

  async addFrequencyTargeting(
    publisherId: string,
    createDto: CreateFrequencyTargetingDto,
  ) {
    await this.verifyInventoryOwnership(publisherId, createDto.inventoryId);

    return this.prisma.frequencyTargeting.create({
      data: {
        inventoryId: createDto.inventoryId,
        maxImpressions: createDto.maxImpressions,
        frequencyWindow: createDto.frequencyWindow,
        frequencyScope: createDto.frequencyScope,
        maxClicksPerUser: createDto.maxClicksPerUser,
        minTimeBetween: createDto.minTimeBetween,
        customTimeWindowHours: createDto.customTimeWindowHours,
      },
      include: {
        inventory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async getFrequencyTargeting(publisherId: string, inventoryId: string) {
    await this.verifyInventoryOwnership(publisherId, inventoryId);

    return this.prisma.frequencyTargeting.findMany({
      where: {
        inventoryId: inventoryId,
      },
      include: {
        inventory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async updateFrequencyTargeting(
    publisherId: string,
    id: string,
    updateDto: UpdateFrequencyTargetingDto,
  ) {
    await this.verifyInventoryOwnership(publisherId, updateDto.inventoryId);

    const existingRule = await this.prisma.frequencyTargeting.findFirst({
      where: {
        id: id,
        inventoryId: updateDto.inventoryId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Frequency targeting rule not found');
    }

    return this.prisma.frequencyTargeting.update({
      where: { id },
      data: {
        maxImpressions: updateDto.maxImpressions,
        frequencyWindow: updateDto.frequencyWindow,
        frequencyScope: updateDto.frequencyScope,
        maxClicksPerUser: updateDto.maxClicksPerUser,
        minTimeBetween: updateDto.minTimeBetween,
        customTimeWindowHours: updateDto.customTimeWindowHours,
      },
      include: {
        inventory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async deleteFrequencyTargeting(
    publisherId: string,
    inventoryId: string,
    id: string,
  ) {
    await this.verifyInventoryOwnership(publisherId, inventoryId);

    const existingRule = await this.prisma.frequencyTargeting.findFirst({
      where: {
        id: id,
        inventoryId: inventoryId,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Frequency targeting rule not found');
    }

    await this.prisma.frequencyTargeting.delete({
      where: { id },
    });

    return { message: 'Frequency targeting rule deleted successfully' };
  }

  // ======================
  // GET ALL TARGETING RULES
  // ======================

  async getAllTargetingRules(publisherId: string, inventoryId: string) {
    await this.verifyInventoryOwnership(publisherId, inventoryId);

    const [
      demographic,
      geographic,
      device,
      contextual,
      behavioral,
      time,
      frequency,
    ] = await Promise.all([
      this.prisma.demographicTargeting.findMany({
        where: { inventoryId },
      }),
      this.prisma.geographicTargeting.findMany({
        where: { inventoryId },
      }),
      this.prisma.deviceTargeting.findMany({
        where: { inventoryId },
      }),
      this.prisma.contextualTargeting.findMany({
        where: { inventoryId },
      }),
      this.prisma.behavioralTargeting.findMany({
        where: { inventoryId },
      }),
      this.prisma.timeTargeting.findMany({
        where: { inventoryId },
      }),
      this.prisma.frequencyTargeting.findMany({
        where: { inventoryId },
      }),
    ]);

    return {
      inventoryId,
      targeting: {
        demographic,
        geographic,
        device,
        contextual,
        behavioral,
        time,
        frequency,
      },
    };
  }
}
