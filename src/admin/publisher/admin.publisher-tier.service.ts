// src/admin/admin.publisher-tier.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  DuplicateResourceException,
  ResourceNotFoundException,
} from 'src/common/exceptions/custom.exception';
import { Decimal } from '@prisma/client/runtime/library';
import { CreatePublisherTierDto, UpdatePublisherTierDto, AssignPublisherTierDto } from '../dto/create-publisher-tier.dto';

@Injectable()
export class AdminPublisherTierService {
  private readonly logger = new Logger(AdminPublisherTierService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new publisher tier
   */
  async createTier(adminId: string, createPublisherTierDto: CreatePublisherTierDto) {
    this.logger.debug(`Admin ${adminId} creating publisher tier: ${createPublisherTierDto.name}`);

    // Verify admin exists
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new ResourceNotFoundException('Admin', adminId);
    }

    // Check for duplicate tier name
    const existingTier = await this.prisma.publisherTier.findUnique({
      where: { name: createPublisherTierDto.name },
    });

    if (existingTier) {
      throw new DuplicateResourceException(
        'Publisher Tier',
        'name',
        createPublisherTierDto.name,
      );
    }

    // Validate commission rate
    if (createPublisherTierDto.commissionRate < 0 || createPublisherTierDto.commissionRate > 1) {
      throw new BadRequestException('Commission rate must be between 0 and 1');
    }

    const tier = await this.prisma.publisherTier.create({
      data: {
        name: createPublisherTierDto.name,
        commissionRate: new Decimal(createPublisherTierDto.commissionRate),
      },
      include: {
        publishers: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true,
          },
        },
      },
    });

    this.logger.debug(`Publisher tier created successfully: ${tier.id}`);

    return {
      message: 'Publisher tier created successfully',
      data: {
        id: tier.id,
        name: tier.name,
        commissionRate: Number(tier.commissionRate),
        createdAt: tier.createdAt,
        publishersCount: tier.publishers.length,
        publishers: tier.publishers,
      },
    };
  }

  /**
   * Get all publisher tiers
   */
  async getAllTiers() {
    this.logger.debug('Fetching all publisher tiers');

    const tiers = await this.prisma.publisherTier.findMany({
      include: {
        publishers: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true,
          },
        },
      },
      orderBy: {
        commissionRate: 'desc', // Order by commission rate, highest first
      },
    });

    return {
      message: 'Publisher tiers retrieved successfully',
      data: tiers.map(tier => ({
        id: tier.id,
        name: tier.name,
        commissionRate: Number(tier.commissionRate),
        createdAt: tier.createdAt,
        publishersCount: tier.publishers.length,
        publishers: tier.publishers,
      })),
    };
  }

  /**
   * Get publisher tier by ID
   */
  async getTierById(tierId: string) {
    this.logger.debug(`Fetching publisher tier: ${tierId}`);

    const tier = await this.prisma.publisherTier.findUnique({
      where: { id: tierId },
      include: {
        publishers: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!tier) {
      throw new ResourceNotFoundException('Publisher Tier', tierId);
    }

    return {
      message: 'Publisher tier retrieved successfully',
      data: {
        id: tier.id,
        name: tier.name,
        commissionRate: Number(tier.commissionRate),
        createdAt: tier.createdAt,
        publishersCount: tier.publishers.length,
        publishers: tier.publishers,
      },
    };
  }

  /**
   * Update publisher tier
   */
  async updateTier(
    adminId: string,
    tierId: string,
    updatePublisherTierDto: UpdatePublisherTierDto,
  ) {
    this.logger.debug(`Admin ${adminId} updating publisher tier: ${tierId}`);

    // Verify admin exists
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new ResourceNotFoundException('Admin', adminId);
    }

    // Check if tier exists
    const existingTier = await this.prisma.publisherTier.findUnique({
      where: { id: tierId },
    });

    if (!existingTier) {
      throw new ResourceNotFoundException('Publisher Tier', tierId);
    }

    // Check for duplicate name if name is being updated
    if (updatePublisherTierDto.name && updatePublisherTierDto.name !== existingTier.name) {
      const duplicateTier = await this.prisma.publisherTier.findUnique({
        where: { name: updatePublisherTierDto.name },
      });

      if (duplicateTier) {
        throw new DuplicateResourceException(
          'Publisher Tier',
          'name',
          updatePublisherTierDto.name,
        );
      }
    }

    // Validate commission rate if provided
    if (updatePublisherTierDto.commissionRate !== undefined) {
      if (updatePublisherTierDto.commissionRate < 0 || updatePublisherTierDto.commissionRate > 1) {
        throw new BadRequestException('Commission rate must be between 0 and 1');
      }
    }

    const updateData: any = {};
    if (updatePublisherTierDto.name) {
      updateData.name = updatePublisherTierDto.name;
    }
    if (updatePublisherTierDto.commissionRate !== undefined) {
      updateData.commissionRate = new Decimal(updatePublisherTierDto.commissionRate);
    }

    const updatedTier = await this.prisma.publisherTier.update({
      where: { id: tierId },
      data: updateData,
      include: {
        publishers: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true,
          },
        },
      },
    });

    this.logger.debug(`Publisher tier updated successfully: ${tierId}`);

    return {
      message: 'Publisher tier updated successfully',
      data: {
        id: updatedTier.id,
        name: updatedTier.name,
        commissionRate: Number(updatedTier.commissionRate),
        createdAt: updatedTier.createdAt,
        publishersCount: updatedTier.publishers.length,
        publishers: updatedTier.publishers,
      },
    };
  }

  /**
   * Delete publisher tier
   */
  async deleteTier(adminId: string, tierId: string) {
    this.logger.debug(`Admin ${adminId} deleting publisher tier: ${tierId}`);

    // Verify admin exists
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new ResourceNotFoundException('Admin', adminId);
    }

    // Check if tier exists and has publishers
    const tier = await this.prisma.publisherTier.findUnique({
      where: { id: tierId },
      include: {
        publishers: true,
      },
    });

    if (!tier) {
      throw new ResourceNotFoundException('Publisher Tier', tierId);
    }

    if (tier.publishers.length > 0) {
      throw new BadRequestException(
        `Cannot delete tier "${tier.name}" as it has ${tier.publishers.length} publishers assigned to it. Please reassign publishers to other tiers first.`,
      );
    }

    await this.prisma.publisherTier.delete({
      where: { id: tierId },
    });

    this.logger.debug(`Publisher tier deleted successfully: ${tierId}`);

    return {
      message: `Publisher tier "${tier.name}" deleted successfully`,
    };
  }

  /**
   * Assign publisher tier to publisher
   */
  async assignTierToPublisher(adminId: string, assignPublisherTierDto: AssignPublisherTierDto) {
    this.logger.debug(
      `Admin ${adminId} assigning tier ${assignPublisherTierDto.tierId} to publisher ${assignPublisherTierDto.publisherId}`,
    );

    // Verify admin exists
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new ResourceNotFoundException('Admin', adminId);
    }

    // Verify publisher exists
    const publisher = await this.prisma.publisher.findUnique({
      where: { id: assignPublisherTierDto.publisherId },
      include: {
        tier: true,
      },
    });

    if (!publisher) {
      throw new ResourceNotFoundException('Publisher', assignPublisherTierDto.publisherId);
    }

    // Verify tier exists
    const tier = await this.prisma.publisherTier.findUnique({
      where: { id: assignPublisherTierDto.tierId },
    });

    if (!tier) {
      throw new ResourceNotFoundException('Publisher Tier', assignPublisherTierDto.tierId);
    }

    // Update publisher's tier
    const updatedPublisher = await this.prisma.publisher.update({
      where: { id: assignPublisherTierDto.publisherId },
      data: {
        tierId: assignPublisherTierDto.tierId,
      },
      include: {
        tier: true,
      },
    });

    this.logger.debug(
      `Publisher tier assigned successfully. Publisher: ${publisher.email}, New Tier: ${tier.name}`,
    );

    return {
      message: `Publisher tier "${tier.name}" assigned successfully to ${publisher.firstName} ${publisher.lastName} (${publisher.email})`,
      data: {
        publisher: {
          id: updatedPublisher.id,
          firstName: updatedPublisher.firstName,
          lastName: updatedPublisher.lastName,
          email: updatedPublisher.email,
          status: updatedPublisher.status,
        },
        previousTier: publisher.tier ? {
          id: publisher.tier.id,
          name: publisher.tier.name,
          commissionRate: Number(publisher.tier.commissionRate),
        } : null,
        newTier: {
          id: tier.id,
          name: tier.name,
          commissionRate: Number(tier.commissionRate),
        },
      },
    };
  }

  /**
   * Remove tier assignment from publisher (assign default Standard tier)
   */
  async unassignTierFromPublisher(adminId: string, publisherId: string) {
    this.logger.debug(`Admin ${adminId} removing tier assignment from publisher ${publisherId}`);

    // Verify admin exists
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new ResourceNotFoundException('Admin', adminId);
    }

    // Verify publisher exists
    const publisher = await this.prisma.publisher.findUnique({
      where: { id: publisherId },
      include: {
        tier: true,
      },
    });

    if (!publisher) {
      throw new ResourceNotFoundException('Publisher', publisherId);
    }

    // Get or create Standard tier as default
    let standardTier = await this.prisma.publisherTier.findUnique({
      where: { name: 'Standard' },
    });

    if (!standardTier) {
      // Create Standard tier if it doesn't exist
      standardTier = await this.prisma.publisherTier.create({
        data: {
          name: 'Standard',
          commissionRate: new Decimal(0.4),
        },
      });
    }

    // Update publisher to Standard tier
    const updatedPublisher = await this.prisma.publisher.update({
      where: { id: publisherId },
      data: {
        tierId: standardTier.id,
      },
      include: {
        tier: true,
      },
    });

    this.logger.debug(`Publisher tier assignment removed. Publisher: ${publisher.email}, assigned to Standard tier`);

    return {
      message: `Publisher tier assignment removed. ${publisher.firstName} ${publisher.lastName} (${publisher.email}) has been assigned to Standard tier`,
      data: {
        publisher: {
          id: updatedPublisher.id,
          firstName: updatedPublisher.firstName,
          lastName: updatedPublisher.lastName,
          email: updatedPublisher.email,
          status: updatedPublisher.status,
        },
        previousTier: publisher.tier ? {
          id: publisher.tier.id,
          name: publisher.tier.name,
          commissionRate: Number(publisher.tier.commissionRate),
        } : null,
        newTier: {
          id: standardTier.id,
          name: standardTier.name,
          commissionRate: Number(standardTier.commissionRate),
        },
      },
    };
  }

  /**
   * Get publisher's current tier
   */
  async getPublisherTier(publisherId: string) {
    this.logger.debug(`Fetching tier for publisher: ${publisherId}`);

    const publisher = await this.prisma.publisher.findUnique({
      where: { id: publisherId },
      include: {
        tier: true,
      },
    });

    if (!publisher) {
      throw new ResourceNotFoundException('Publisher', publisherId);
    }

    return {
      message: 'Publisher tier retrieved successfully',
      data: {
        publisher: {
          id: publisher.id,
          firstName: publisher.firstName,
          lastName: publisher.lastName,
          email: publisher.email,
          status: publisher.status,
        },
        tier: publisher.tier ? {
          id: publisher.tier.id,
          name: publisher.tier.name,
          commissionRate: Number(publisher.tier.commissionRate),
          createdAt: publisher.tier.createdAt,
        } : null,
      },
    };
  }

  /**
   * Get all publishers assigned to a specific tier
   */
  async getPublishersInTier(tierId: string) {
    this.logger.debug(`Fetching publishers in tier: ${tierId}`);

    const tier = await this.prisma.publisherTier.findUnique({
      where: { id: tierId },
      include: {
        publishers: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true,
            createdAt: true,
            paymentThreshold: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!tier) {
      throw new ResourceNotFoundException('Publisher Tier', tierId);
    }

    return {
      message: 'Publishers in tier retrieved successfully',
      data: {
        tier: {
          id: tier.id,
          name: tier.name,
          commissionRate: Number(tier.commissionRate),
          createdAt: tier.createdAt,
        },
        publishersCount: tier.publishers.length,
        publishers: tier.publishers.map(publisher => ({
          id: publisher.id,
          firstName: publisher.firstName,
          lastName: publisher.lastName,
          email: publisher.email,
          status: publisher.status,
          createdAt: publisher.createdAt,
          paymentThreshold: Number(publisher.paymentThreshold),
        })),
      },
    };
  }

  /**
   * Initialize default publisher tiers
   */
  async initializeDefaultTiers(adminId: string) {
    this.logger.debug(`Admin ${adminId} initializing default publisher tiers`);

    // Verify admin exists
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new ResourceNotFoundException('Admin', adminId);
    }

    const defaultTiers = [
      { name: 'Premium', commissionRate: 0.5 },
      { name: 'Standard', commissionRate: 0.4 },
      { name: 'Basic', commissionRate: 0.3 },
    ];

    const createdTiers = [];
    const existingTiers = [];

    for (const tierData of defaultTiers) {
      // Check if tier already exists
      const existingTier = await this.prisma.publisherTier.findUnique({
        where: { name: tierData.name },
      });

      if (existingTier) {
        existingTiers.push({
          name: existingTier.name,
          commissionRate: Number(existingTier.commissionRate),
        });
      } else {
        // Create the tier
        const newTier = await this.prisma.publisherTier.create({
          data: {
            name: tierData.name,
            commissionRate: new Decimal(tierData.commissionRate),
          },
        });

        createdTiers.push({
          name: newTier.name,
          commissionRate: Number(newTier.commissionRate),
        });
      }
    }

    // Assign all publishers without tiers to Standard tier
    const standardTier = await this.prisma.publisherTier.findUnique({
      where: { name: 'Standard' },
    });

    if (standardTier) {
      const publishersWithoutTiers = await this.prisma.publisher.findMany({
        where: { tierId: null },
      });

      if (publishersWithoutTiers.length > 0) {
        await this.prisma.publisher.updateMany({
          where: { tierId: null },
          data: { tierId: standardTier.id },
        });

        this.logger.debug(`Assigned ${publishersWithoutTiers.length} publishers without tiers to Standard tier`);
      }
    }

    this.logger.debug(`Default tiers initialization completed. Created: ${createdTiers.length}, Existing: ${existingTiers.length}`);

    return {
      message: 'Default publisher tiers initialization completed',
      data: {
        created: createdTiers,
        existing: existingTiers,
        summary: {
          totalCreated: createdTiers.length,
          totalExisting: existingTiers.length,
          publishersAssignedToStandard: standardTier ? (await this.prisma.publisher.count({
            where: { tierId: standardTier.id }
          })) : 0,
        },
      },
    };
  }
}