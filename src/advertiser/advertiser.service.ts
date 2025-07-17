import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateAdvertiserDto } from './dto/create-advertiser.dto';
import { UpdateAdvertiserDto } from './dto/update-advertiser.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  MovedPermanentlyException,
  ResourceNotFoundException,
  ForbiddenException,
} from 'src/common/exceptions/custom.exception';
import { CampaignStatus } from '@prisma/client';
import { AdvertiserHelper } from './advertiser.helper';

@Injectable()
export class AdvertiserService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // Get advertiser profile
  async getProfile(advertiserId: string) {
    const advertiser = await this.prisma.advertiser.findUnique({
      where: { id: advertiserId },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        companyName: true,
        hqLocation: true,
        companySize: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        emailVerifiedAt: true,
      },
    });

    if (!advertiser) {
      throw new ResourceNotFoundException('Advertiser', advertiserId);
    }

    return advertiser;
  }

  // Get campaign counts by status
  async getCampaignCounts(advertiserId: string) {
    const counts = await this.prisma.campaign.groupBy({
      by: ['status'],
      where: { advertiserId },
      _count: {
        id: true,
      },
    });

    // Initialize all statuses with 0 count
    const statusCounts = {
      DRAFT: 0,
      SCHEDULED: 0,
      ACTIVE: 0,
      DAILY_PAUSED: 0,
      PAUSED: 0,
      COMPLETED: 0,
      CANCELED: 0,
      REJECTED: 0,
      BUDGET_EXHAUSTED: 0,
    };

    // Fill in actual counts
    counts.forEach((count) => {
      statusCounts[count.status] = count._count.id;
    });

    // Calculate total
    const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

    return {
      total,
      counts: statusCounts,
    };
  }

  // Get campaigns by status
  async getCampaignsByStatus(advertiserId: string, status: CampaignStatus) {
    // Validate status
    const validStatuses = ['SCHEDULED', 'ACTIVE', 'DAILY_PAUSED', 'COMPLETED', 'BUDGET_EXHAUSTED', 'REJECTED', 'DRAFT', 'PAUSED', 'CANCELED'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`Invalid status. Valid statuses are: ${validStatuses.join(', ')}`);
    }

    const campaigns = await this.prisma.campaign.findMany({
      where: {
        advertiserId,
        status,
      },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
        objective: true,
        bidStrategy: true,
        businessCategory: true,
        websiteUrl: true,
        interests: true,
        createdAt: true,
        updatedAt: true,
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      status,
      count: campaigns.length,
      campaigns,
    };
  }
}