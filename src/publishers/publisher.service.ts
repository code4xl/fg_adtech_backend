import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePublisherDto } from './dto/create-publisher.dto';
import { UpdatePublisherDto } from './dto/update-publisher.dto';
import {
  Language,
  PublisherStatus,
  InventoryFormat,
  TargetingRuleType,
} from '@prisma/client';
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
  TargetingRuleResponseDto,
  TargetingRulesListResponseDto,
  DemographicTargeting,
  GeographicTargeting,
  DeviceTargeting,
  ContextualTargeting,
  BehavioralTargeting,
  TimeTargeting,
  FrequencyTargeting,
  CreateTargetingRuleDto,
  UpdateTargetingRuleDto,
  TimeTargetingDto,
  ContextualTargetingDto,
  BehavioralTargetingDto,
  DemographicTargetingDto,
  DeviceTargetingDto,
  FrequencyTargetingDto,
  GeographicTargetingDto,
} from './dto/targeting-rules.dto';

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
        targetingRules: {},
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
        targetingRules: true,
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
        targetingRules: true,
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
        targetingRules: true,
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
        targetingRules: true,
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
        currency: 'USD',
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
        currency: 'USD',
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

  async addTargetingRule(
    inventoryId: string,
    createTargetingRuleDto: CreateTargetingRuleDto,
  ): Promise<TargetingRuleResponseDto> {
    // Verify inventory exists
    const inventory = await this.prisma.adInventory.findFirst({
      where: {
        id: inventoryId,
      },
    });

    if (!inventory) {
      throw new NotFoundException('Inventory not found.');
    }

    // Validate rule data based on rule type
    this.validateTargetingRuleData(
      createTargetingRuleDto.ruleType,
      createTargetingRuleDto.ruleData,
    );

    // Create targeting rule
    const targetingRule = await this.prisma.inventoryTargetingRule.create({
      data: {
        inventoryId,
        ruleType: createTargetingRuleDto.ruleType,
        ruleData: JSON.stringify(createTargetingRuleDto.ruleData),
      },
    });

    return this.mapToTargetingRuleResponse(targetingRule);
  }

  /**
   * Get targeting rules for inventory
   */
  async getTargetingRules(
    inventoryId: string,
    ruleType?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<TargetingRulesListResponseDto> {
    // Verify inventory ownership
    const inventory = await this.prisma.adInventory.findFirst({
      where: {
        id: inventoryId,
      },
    });

    if (!inventory) {
      throw new NotFoundException('Inventory not found');
    }

    const skip = (page - 1) * limit;
    const where: any = { inventoryId };

    if (
      ruleType &&
      Object.values(TargetingRuleType).includes(ruleType as TargetingRuleType)
    ) {
      where.ruleType = ruleType as TargetingRuleType;
    }

    const [targetingRules, total] = await Promise.all([
      this.prisma.inventoryTargetingRule.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inventoryTargetingRule.count({ where }),
    ]);

    return {
      targetingRules: targetingRules.map((rule) =>
        this.mapToTargetingRuleResponse(rule),
      ),
      total,
      page,
      limit,
    };
  }

  /**
   * Get specific targeting rule
   */
  async getTargetingRule(
    inventoryId: string,
    targetingRuleId: string,
  ): Promise<TargetingRuleResponseDto> {
    // Verify inventory ownership and get targeting rule

    const targetingRule = await this.prisma.inventoryTargetingRule.findFirst({
      where: {
        id: targetingRuleId,
        inventoryId,
        inventory: {
          id: inventoryId,
        },
      },
      include: {
        inventory: true,
      },
    });

    if (!targetingRule) {
      throw new NotFoundException('Targeting rule not found');
    }

    return this.mapToTargetingRuleResponse(targetingRule);
  }

  /**
   * Update targeting rule
   */
  async updateTargetingRule(
    inventoryId: string,
    targetingRuleId: string,
    updateTargetingRuleDto: UpdateTargetingRuleDto,
  ): Promise<TargetingRuleResponseDto> {
    // Verify targeting rule exists and inventory ownership
    const existingRule = await this.prisma.inventoryTargetingRule.findFirst({
      where: {
        id: targetingRuleId,
        inventoryId,
        inventory: {
          id: inventoryId,
        },
      },
      include: {
        inventory: true,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Targeting rule not found');
    }

    // Validate rule data if provided
    if (updateTargetingRuleDto.ruleData && updateTargetingRuleDto.ruleType) {
      this.validateTargetingRuleData(
        updateTargetingRuleDto.ruleType,
        updateTargetingRuleDto.ruleData,
      );
    }

    // Update targeting rule
    const updatedRule = await this.prisma.inventoryTargetingRule.update({
      where: { id: targetingRuleId },
      data: {
        ...(updateTargetingRuleDto.ruleType && {
          ruleType: updateTargetingRuleDto.ruleType,
        }),
        ...(updateTargetingRuleDto.ruleData && {
          ruleData: JSON.stringify(updateTargetingRuleDto.ruleData),
        }),
      },
    });

    return this.mapToTargetingRuleResponse(updatedRule);
  }

  /**
   * Delete targeting rule
   */
  async deleteTargetingRule(
    inventoryId: string,
    targetingRuleId: string,
  ): Promise<void> {
    // Verify targeting rule exists and inventory ownership
    const existingRule = await this.prisma.inventoryTargetingRule.findFirst({
      where: {
        id: targetingRuleId,
        inventoryId,
        inventory: {
          id: inventoryId,
        },
      },
      include: {
        inventory: true,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Targeting rule not found');
    }

    // Delete targeting rule
    await this.prisma.inventoryTargetingRule.delete({
      where: { id: targetingRuleId },
    });
  }

  /**
   * Validate targeting rule data based on rule type
   */
  private validateTargetingRuleData(
    ruleType: TargetingRuleType,
    ruleData: any,
  ): void {
    if (!ruleData || typeof ruleData !== 'object') {
      throw new BadRequestException('Rule data must be a valid object');
    }

    switch (ruleType) {
      case TargetingRuleType.DEMOGRAPHIC:
        this.validateDemographicRule(ruleData);
        break;
      case TargetingRuleType.GEOGRAPHIC:
        this.validateGeographicRule(ruleData);
        break;
      case TargetingRuleType.DEVICE:
        this.validateDeviceRule(ruleData);
        break;
      case TargetingRuleType.CONTEXTUAL:
        this.validateContextualRule(ruleData);
        break;
      case TargetingRuleType.BEHAVIORAL:
        this.validateBehavioralRule(ruleData);
        break;
      case TargetingRuleType.TIME:
        this.validateTimeRule(ruleData);
        break;
      case TargetingRuleType.FREQUENCY:
        this.validateFrequencyRule(ruleData);
        break;
      default:
        throw new BadRequestException('Invalid targeting rule type');
    }
  }

  /**
   * Validate demographic targeting rule
   */
  private validateDemographicRule(data: DemographicTargeting): void {
    if (data.ageMin !== undefined && (data.ageMin < 13 || data.ageMin > 100)) {
      throw new BadRequestException('Age minimum must be between 13 and 100');
    }
    if (data.ageMax !== undefined && (data.ageMax < 13 || data.ageMax > 100)) {
      throw new BadRequestException('Age maximum must be between 13 and 100');
    }
    if (data.ageMin && data.ageMax && data.ageMin > data.ageMax) {
      throw new BadRequestException(
        'Age minimum cannot be greater than age maximum',
      );
    }
    if (
      data.genders &&
      (!Array.isArray(data.genders) || data.genders.length === 0)
    ) {
      throw new BadRequestException('Genders must be a non-empty array');
    }
    if (
      data.languages &&
      (!Array.isArray(data.languages) || data.languages.length === 0)
    ) {
      throw new BadRequestException('Languages must be a non-empty array');
    }
  }

  /**
   * Validate geographic targeting rule
   */
  private validateGeographicRule(data: GeographicTargeting): void {
    if (
      data.countries &&
      (!Array.isArray(data.countries) || data.countries.length === 0)
    ) {
      throw new BadRequestException('Countries must be a non-empty array');
    }
    if (
      data.regions &&
      (!Array.isArray(data.regions) || data.regions.length === 0)
    ) {
      throw new BadRequestException('Regions must be a non-empty array');
    }
    if (
      data.cities &&
      (!Array.isArray(data.cities) || data.cities.length === 0)
    ) {
      throw new BadRequestException('Cities must be a non-empty array');
    }
    if (data.radius !== undefined && (data.radius < 1 || data.radius > 1000)) {
      throw new BadRequestException(
        'Radius must be between 1 and 1000 kilometers',
      );
    }
    if (data.coordinates) {
      if (
        typeof data.coordinates.lat !== 'number' ||
        typeof data.coordinates.lng !== 'number'
      ) {
        throw new BadRequestException(
          'Coordinates must have valid lat and lng numbers',
        );
      }
      if (data.coordinates.lat < -90 || data.coordinates.lat > 90) {
        throw new BadRequestException('Latitude must be between -90 and 90');
      }
      if (data.coordinates.lng < -180 || data.coordinates.lng > 180) {
        throw new BadRequestException('Longitude must be between -180 and 180');
      }
    }
  }

  /**
   * Validate device targeting rule
   */
  private validateDeviceRule(data: DeviceTargeting): void {
    if (
      data.deviceTypes &&
      (!Array.isArray(data.deviceTypes) || data.deviceTypes.length === 0)
    ) {
      throw new BadRequestException('Device types must be a non-empty array');
    }
    if (
      data.operatingSystems &&
      (!Array.isArray(data.operatingSystems) ||
        data.operatingSystems.length === 0)
    ) {
      throw new BadRequestException(
        'Operating systems must be a non-empty array',
      );
    }
    if (
      data.browsers &&
      (!Array.isArray(data.browsers) || data.browsers.length === 0)
    ) {
      throw new BadRequestException('Browsers must be a non-empty array');
    }
    if (
      data.connectionTypes &&
      (!Array.isArray(data.connectionTypes) ||
        data.connectionTypes.length === 0)
    ) {
      throw new BadRequestException(
        'Connection types must be a non-empty array',
      );
    }
  }

  /**
   * Validate contextual targeting rule
   */
  private validateContextualRule(data: ContextualTargeting): void {
    if (
      data.keywords &&
      (!Array.isArray(data.keywords) || data.keywords.length === 0)
    ) {
      throw new BadRequestException('Keywords must be a non-empty array');
    }
    if (
      data.categories &&
      (!Array.isArray(data.categories) || data.categories.length === 0)
    ) {
      throw new BadRequestException('Categories must be a non-empty array');
    }
    if (
      data.domains &&
      (!Array.isArray(data.domains) || data.domains.length === 0)
    ) {
      throw new BadRequestException('Domains must be a non-empty array');
    }
    if (
      data.blockedDomains &&
      (!Array.isArray(data.blockedDomains) || data.blockedDomains.length === 0)
    ) {
      throw new BadRequestException(
        'Blocked domains must be a non-empty array',
      );
    }
  }

  /**
   * Validate behavioral targeting rule
   */
  private validateBehavioralRule(data: BehavioralTargeting): void {
    if (
      data.interests &&
      (!Array.isArray(data.interests) || data.interests.length === 0)
    ) {
      throw new BadRequestException('Interests must be a non-empty array');
    }
    if (
      data.behaviors &&
      (!Array.isArray(data.behaviors) || data.behaviors.length === 0)
    ) {
      throw new BadRequestException('Behaviors must be a non-empty array');
    }
    if (
      data.purchaseIntent &&
      (!Array.isArray(data.purchaseIntent) || data.purchaseIntent.length === 0)
    ) {
      throw new BadRequestException(
        'Purchase intent must be a non-empty array',
      );
    }
  }

  /**
   * Validate time targeting rule
   */
  private validateTimeRule(data: TimeTargeting): void {
    const validDays = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ];

    if (
      data.daysOfWeek &&
      (!Array.isArray(data.daysOfWeek) || data.daysOfWeek.length === 0)
    ) {
      throw new BadRequestException('Days of week must be a non-empty array');
    }
    if (
      data.daysOfWeek &&
      !data.daysOfWeek.every((day) => validDays.includes(day.toLowerCase()))
    ) {
      throw new BadRequestException('Invalid day of week provided');
    }
    if (
      data.hoursOfDay &&
      (!Array.isArray(data.hoursOfDay) || data.hoursOfDay.length === 0)
    ) {
      throw new BadRequestException('Hours of day must be a non-empty array');
    }
    if (
      data.hoursOfDay &&
      !data.hoursOfDay.every((hour) => hour >= 0 && hour <= 23)
    ) {
      throw new BadRequestException('Hours must be between 0 and 23');
    }
    if (
      data.startDate &&
      data.endDate &&
      new Date(data.startDate) > new Date(data.endDate)
    ) {
      throw new BadRequestException('Start date cannot be after end date');
    }
  }

  /**
   * Validate frequency targeting rule
   */
  private validateFrequencyRule(data: FrequencyTargeting): void {
    if (data.maxImpressions !== undefined && data.maxImpressions < 1) {
      throw new BadRequestException('Max impressions must be at least 1');
    }
    if (
      data.timeWindow &&
      !['1h', '24h', '7d', '30d'].includes(data.timeWindow)
    ) {
      throw new BadRequestException(
        'Time window must be one of: 1h, 24h, 7d, 30d',
      );
    }
    if (data.capType && !['user', 'device', 'ip'].includes(data.capType)) {
      throw new BadRequestException(
        'Cap type must be one of: user, device, ip',
      );
    }
  }

  /**
   * Map database model to response DTO
   */
  private mapToTargetingRuleResponse(
    targetingRule: any,
  ): TargetingRuleResponseDto {
    return {
      id: targetingRule.id,
      inventoryId: targetingRule.inventoryId,
      ruleType: targetingRule.ruleType,
      ruleData: targetingRule.ruleData,
      createdAt: targetingRule.createdAt,
      updatedAt: targetingRule.updatedAt,
    };
  }

  /**
   * Get targeting rules summary for inventory (helper method)
   */
  async getTargetingRulesSummary(
    inventoryId: string,
    publisherId: string,
  ): Promise<{
    total: number;
    byType: Record<string, number>;
  }> {
    // Verify inventory ownership
    const inventory = await this.prisma.adInventory.findFirst({
      where: {
        id: inventoryId,
        publisherId: publisherId,
      },
    });

    if (!inventory) {
      throw new NotFoundException(
        'Inventory not found or not owned by publisher',
      );
    }

    const [total, groupedByType] = await Promise.all([
      this.prisma.inventoryTargetingRule.count({
        where: { inventoryId },
      }),
      this.prisma.inventoryTargetingRule.groupBy({
        by: ['ruleType'],
        where: { inventoryId },
        _count: {
          id: true,
        },
      }),
    ]);

    const byType: Record<string, number> = {};
    groupedByType.forEach((group) => {
      byType[group.ruleType] = group._count.id;
    });

    return {
      total,
      byType,
    };
  }

  /**
   * Bulk delete targeting rules for inventory
   */
  async bulkDeleteTargetingRules(
    inventoryId: string,
    targetingRuleIds: string[],
    publisherId: string,
  ): Promise<{ deletedCount: number }> {
    // Verify inventory ownership
    const inventory = await this.prisma.adInventory.findFirst({
      where: {
        id: inventoryId,
        publisherId: publisherId,
      },
    });

    if (!inventory) {
      throw new NotFoundException(
        'Inventory not found or not owned by publisher',
      );
    }

    // Delete targeting rules
    const result = await this.prisma.inventoryTargetingRule.deleteMany({
      where: {
        id: { in: targetingRuleIds },
        inventoryId,
      },
    });

    return { deletedCount: result.count };
  }

  /**
   * Check if targeting rule conflicts with existing rules
   */
  async checkTargetingRuleConflicts(
    inventoryId: string,
    ruleType: TargetingRuleType,
    ruleData: any,
    excludeRuleId?: string,
  ): Promise<{ hasConflicts: boolean; conflictingRules: string[] }> {
    const where: any = {
      inventoryId,
      ruleType,
      ...(excludeRuleId && { id: { not: excludeRuleId } }),
    };

    const existingRules = await this.prisma.inventoryTargetingRule.findMany({
      where,
      select: { id: true, ruleData: true },
    });

    // Simple conflict detection logic (can be enhanced based on business rules)
    const conflictingRules: string[] = [];

    for (const existingRule of existingRules) {
      if (this.hasRuleDataConflict(ruleType, ruleData, existingRule.ruleData)) {
        conflictingRules.push(existingRule.id);
      }
    }

    return {
      hasConflicts: conflictingRules.length > 0,
      conflictingRules,
    };
  }

  /**
   * Check if two rule data objects conflict
   */
  private hasRuleDataConflict(
    ruleType: TargetingRuleType,
    newData: any,
    existingData: any,
  ): boolean {
    // Basic conflict detection - can be enhanced based on specific business logic
    switch (ruleType) {
      case TargetingRuleType.DEMOGRAPHIC:
        return this.checkDemographicConflict(newData, existingData);
      case TargetingRuleType.GEOGRAPHIC:
        return this.checkGeographicConflict(newData, existingData);
      case TargetingRuleType.TIME:
        return this.checkTimeConflict(newData, existingData);
      default:
        return false; // No conflict detection for other types by default
    }
  }

  private checkDemographicConflict(
    newData: DemographicTargeting,
    existingData: DemographicTargeting,
  ): boolean {
    // Check if age ranges overlap
    if (
      newData.ageMin &&
      newData.ageMax &&
      existingData.ageMin &&
      existingData.ageMax
    ) {
      return !(
        newData.ageMax < existingData.ageMin ||
        newData.ageMin > existingData.ageMax
      );
    }
    return false;
  }

  private checkGeographicConflict(
    newData: GeographicTargeting,
    existingData: GeographicTargeting,
  ): boolean {
    // Check if there are overlapping countries/regions/cities
    if (newData.countries && existingData.countries) {
      return newData.countries.some((country) =>
        existingData.countries?.includes(country),
      );
    }
    return false;
  }

  private checkTimeConflict(
    newData: TimeTargeting,
    existingData: TimeTargeting,
  ): boolean {
    // Check if time ranges overlap
    if (newData.daysOfWeek && existingData.daysOfWeek) {
      return newData.daysOfWeek.some((day) =>
        existingData.daysOfWeek?.includes(day),
      );
    }
    return false;
  }
}
