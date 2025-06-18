import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    ConflictException,
    BadRequestException,
  } from '@nestjs/common';
  import { PrismaService } from '../../prisma/prisma.service';
  import { CreateAdInventoryDto } from '../dto/create-adinventory.dto';
  import { UpdateAdInventoryDto } from '../dto/update-adinventory.dto';
  import { AdInventoryResponseDto } from '../dto/adinventory-response.dto';
  import { AdInventoryQueryDto } from '../dto/adinventory-query.dto';
  import { ApprovalStatus, Prisma } from '@prisma/client';
  
  @Injectable()
  export class PublisherAdInventoryService {
    constructor(private readonly prisma: PrismaService) {}
  
    async create(
      publisherId: string,
      websiteId: string,
      createAdInventoryDto: CreateAdInventoryDto,
    ): Promise<AdInventoryResponseDto> {
      // Verify publisher owns the website
      await this.verifyWebsiteOwnership(publisherId, websiteId);
  
      // Verify adSlotTemplate exists and is active
      const template = await this.prisma.adSlotTemplate.findFirst({
        where: {
          id: createAdInventoryDto.adSlotTemplateId,
          isActive: true,
        },
      });
  
      if (!template) {
        throw new NotFoundException(
          'Ad slot template not found or is inactive',
        );
      }
  
      // Check for duplicate names within the same website
      const existingInventory = await this.prisma.adInventory.findFirst({
        where: {
          websiteId,
          name: createAdInventoryDto.name,
        },
      });
  
      if (existingInventory) {
        throw new ConflictException(
          `Ad inventory with name "${createAdInventoryDto.name}" already exists for this website`,
        );
      }
  
      // Create the ad inventory
      const adInventory = await this.prisma.adInventory.create({
        data: {
          name: createAdInventoryDto.name,
          publisherId,
          websiteId,
          adSlotTemplateId: createAdInventoryDto.adSlotTemplateId,
          viewabilityScore: createAdInventoryDto.viewabilityScore ?? 0.8,
          approvalStatus: ApprovalStatus.PENDING,
          isActive: true,
        },
        include: {
          adSlotTemplate: true,
        },
      });
  
      // If floor price override is provided, create floor price entry
      if (createAdInventoryDto.floorPriceOverride !== undefined) {
        await this.prisma.floorPrice.create({
          data: {
            inventoryId: adInventory.id,
            basePrice: createAdInventoryDto.floorPriceOverride,
            currency: 'INR', // Default currency
            startDate: new Date(),
          },
        });
      }
  
      return this.mapToResponseDto(adInventory);
    }
  
    async findAll(
      publisherId: string,
      websiteId: string,
      query: AdInventoryQueryDto,
    ): Promise<{
      data: AdInventoryResponseDto[];
      total: number;
      page: number;
      limit: number;
    }> {
      // Verify publisher owns the website
      await this.verifyWebsiteOwnership(publisherId, websiteId);
  
      const { page = 1, limit = 10, isActive, approvalStatus, sortBy = 'createdAt', sortOrder = 'desc' } = query;
      const skip = (page - 1) * limit;
  
      // Build where clause
      const where: Prisma.AdInventoryWhereInput = {
        websiteId,
        publisherId,
      };
  
      if (isActive !== undefined) {
        where.isActive = isActive;
      }
  
      if (approvalStatus) {
        where.approvalStatus = approvalStatus as ApprovalStatus;
      }
  
      // Execute queries
      const [adInventories, total] = await Promise.all([
        this.prisma.adInventory.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            [sortBy]: sortOrder,
          },
          include: {
            adSlotTemplate: true,
          },
        }),
        this.prisma.adInventory.count({ where }),
      ]);
  
      return {
        data: adInventories.map(this.mapToResponseDto),
        total,
        page,
        limit,
      };
    }
  
    async findOne(
      publisherId: string,
      websiteId: string,
      adSlotId: string,
    ): Promise<AdInventoryResponseDto> {
      // Verify publisher owns the website
      await this.verifyWebsiteOwnership(publisherId, websiteId);
  
      const adInventory = await this.prisma.adInventory.findFirst({
        where: {
          id: adSlotId,
          websiteId,
          publisherId,
        },
        include: {
          adSlotTemplate: true,
        },
      });
  
      if (!adInventory) {
        throw new NotFoundException('Ad inventory not found');
      }
  
      return this.mapToResponseDto(adInventory);
    }
  
    async update(
      publisherId: string,
      websiteId: string,
      adSlotId: string,
      updateAdInventoryDto: UpdateAdInventoryDto,
    ): Promise<AdInventoryResponseDto> {
      // Verify publisher owns the website
      await this.verifyWebsiteOwnership(publisherId, websiteId);
  
      // Verify ad inventory exists
      const existingInventory = await this.prisma.adInventory.findFirst({
        where: {
          id: adSlotId,
          websiteId,
          publisherId,
        },
      });
  
      if (!existingInventory) {
        throw new NotFoundException('Ad inventory not found');
      }
  
      // If name is being updated, check for duplicates
      if (updateAdInventoryDto.name && updateAdInventoryDto.name !== existingInventory.name) {
        const duplicateName = await this.prisma.adInventory.findFirst({
          where: {
            websiteId,
            name: updateAdInventoryDto.name,
            id: { not: adSlotId },
          },
        });
  
        if (duplicateName) {
          throw new ConflictException(
            `Ad inventory with name "${updateAdInventoryDto.name}" already exists for this website`,
          );
        }
      }
  
      // If adSlotTemplateId is being updated, verify it exists and is active
      if (updateAdInventoryDto.adSlotTemplateId) {
        const template = await this.prisma.adSlotTemplate.findFirst({
          where: {
            id: updateAdInventoryDto.adSlotTemplateId,
            isActive: true,
          },
        });
  
        if (!template) {
          throw new NotFoundException(
            'Ad slot template not found or is inactive',
          );
        }
      }
  
      // Update the ad inventory
      const updatedInventory = await this.prisma.adInventory.update({
        where: { id: adSlotId },
        data: {
          name: updateAdInventoryDto.name,
          adSlotTemplateId: updateAdInventoryDto.adSlotTemplateId,
          viewabilityScore: updateAdInventoryDto.viewabilityScore,
          isActive: updateAdInventoryDto.isActive,
        },
        include: {
          adSlotTemplate: true,
        },
      });
  
            // Update floor price if provided
      if (updateAdInventoryDto.floorPriceOverride !== undefined) {
        const existingFloorPrice = await this.prisma.floorPrice.findFirst({
          where: { inventoryId: adSlotId },
        });

        if (existingFloorPrice) {
          await this.prisma.floorPrice.update({
            where: { id: existingFloorPrice.id },
            data: { basePrice: updateAdInventoryDto.floorPriceOverride },
          });
        } else {
          await this.prisma.floorPrice.create({
            data: {
              inventoryId: adSlotId,
              basePrice: updateAdInventoryDto.floorPriceOverride,
              currency: 'INR',
              startDate: new Date(),
            },
          });
        }
      }
  
      return this.mapToResponseDto(updatedInventory);
    }
  
    async remove(
      publisherId: string,
      websiteId: string,
      adSlotId: string,
    ): Promise<void> {
      // Verify publisher owns the website
      await this.verifyWebsiteOwnership(publisherId, websiteId);
  
      // Verify ad inventory exists
      const adInventory = await this.prisma.adInventory.findFirst({
        where: {
          id: adSlotId,
          websiteId,
          publisherId,
        },
      });
  
      if (!adInventory) {
        throw new NotFoundException('Ad inventory not found');
      }
  
      // Delete the ad inventory (cascade will handle related records)
      await this.prisma.adInventory.delete({
        where: { id: adSlotId },
      });
    }
  
    async toggleStatus(
      publisherId: string,
      websiteId: string,
      adSlotId: string,
    ): Promise<AdInventoryResponseDto> {
      // Verify publisher owns the website
      await this.verifyWebsiteOwnership(publisherId, websiteId);
  
      // Verify ad inventory exists
      const adInventory = await this.prisma.adInventory.findFirst({
        where: {
          id: adSlotId,
          websiteId,
          publisherId,
        },
      });
  
      if (!adInventory) {
        throw new NotFoundException('Ad inventory not found');
      }
  
      // Toggle the status
      const updatedInventory = await this.prisma.adInventory.update({
        where: { id: adSlotId },
        data: {
          isActive: !adInventory.isActive,
        },
        include: {
          adSlotTemplate: true,
        },
      });
  
      return this.mapToResponseDto(updatedInventory);
    }
  
    private async verifyWebsiteOwnership(
      publisherId: string,
      websiteId: string,
    ): Promise<void> {
      const website = await this.prisma.website.findFirst({
        where: {
          id: websiteId,
          publisherId,
        },
      });
  
      if (!website) {
        throw new ForbiddenException(
          'Website not found or you do not have permission to access it',
        );
      }
    }
  
    private mapToResponseDto(adInventory: any): AdInventoryResponseDto {
      return {
        id: adInventory.id,
        name: adInventory.name,
        publisherId: adInventory.publisherId,
        websiteId: adInventory.websiteId,
        isActive: adInventory.isActive,
        viewabilityScore: adInventory.viewabilityScore,
        approvalStatus: adInventory.approvalStatus,
        adSlotTemplate: {
          id: adInventory.adSlotTemplate.id,
          name: adInventory.adSlotTemplate.name,
          width: adInventory.adSlotTemplate.width,
          height: adInventory.adSlotTemplate.height,
          format: adInventory.adSlotTemplate.format,
          position: adInventory.adSlotTemplate.position,
        },
        createdAt: adInventory.createdAt,
        updatedAt: adInventory.updatedAt,
      };
    }
  }