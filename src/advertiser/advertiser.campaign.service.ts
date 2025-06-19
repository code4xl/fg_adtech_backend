import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto, CampaignResponseDto } from './dto/campaign/campaign.dto';
import { UpdateCampaignDto } from './dto/campaign/campaign.dto';
import { CampaignQueryDto } from './dto/campaign/campaign-query.dto';
import { CampaignStatus, Prisma } from '@prisma/client';
import {
    ResourceNotFoundException,
    BadRequestException,
    ForbiddenException,
} from '../common/exceptions/custom.exception';
import { AdvertiserHelper } from './advertiser.helper';
import { CampaignEligibilityService } from 'src/rtb/services/campaign-eligibility.service';

@Injectable()
export class AdvertiserCampaignService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly advertiserHelper: AdvertiserHelper,
        private readonly campaignEligibilityService: CampaignEligibilityService,
    ) { }

    /**
     * Create a new campaign
     */
    async create(advertiserId: string, createCampaignDto: CreateCampaignDto) {
        // Validate campaign dates
        await this.advertiserHelper.validateCampaignDates(
            createCampaignDto.startDate,
            createCampaignDto.endDate
        );

        // Validate client belongs to advertiser
        await this.advertiserHelper.validateClient(createCampaignDto.clientId, advertiserId);

        // Validate bid strategy and bid amount
        await this.advertiserHelper.validateBidStrategy(
            createCampaignDto.bidStrategy || 'LOWEST_COST',
            createCampaignDto.bidAmount
        );

        // Determine initial status based on start date
        const startDate = new Date(createCampaignDto.startDate);
        const endDate = new Date(createCampaignDto.endDate);
        const now = new Date();
        const initialStatus = startDate <= now ? CampaignStatus.ACTIVE : CampaignStatus.SCHEDULED;

        // Create campaign with transaction to ensure all operations succeed
        const campaign = await this.prisma.$transaction(async (tx) => {
            // Create the campaign
            const campaign = await tx.campaign.create({
                data: {
                    name: createCampaignDto.name,
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
                    advertiserId,
                    clientId: createCampaignDto.clientId,
                },
                include: {
                    client: true,
                },
            });


            return campaign;
        });

        return campaign;
    }

    /**
     * Update an existing campaign
     */
    async update(campaignId: string, advertiserId: string, updateCampaignDto: UpdateCampaignDto) {
        // Check if campaign exists and belongs to the advertiser
        const campaign = await this.prisma.campaign.findUnique({
            where: { id: campaignId },
            select: {
                id: true,
                name: true,
                advertiserId: true,
                clientId: true,
                status: true,
                startDate: true,
                endDate: true,
                bidStrategy: true,
            },
        });

        if (!campaign) {
            throw new ResourceNotFoundException('Campaign', campaignId);
        }

        if (campaign.advertiserId !== advertiserId) {
            throw new ForbiddenException('You do not have access to this campaign');
        }

        // Validate that we aren't trying to update a completed or canceled campaign
        if (['COMPLETED', 'CANCELED', 'REJECTED'].includes(campaign.status)) {
            throw new BadRequestException(
                `Cannot update a campaign with status: ${campaign.status}`
            );
        }

        // Validate campaign dates if provided
        if (updateCampaignDto.startDate || updateCampaignDto.endDate) {
            const startDate = updateCampaignDto.startDate
                ? new Date(updateCampaignDto.startDate)
                : campaign.startDate;
            const endDate = updateCampaignDto.endDate
                ? new Date(updateCampaignDto.endDate)
                : campaign.endDate;

            await this.advertiserHelper.validateCampaignDates(startDate, endDate);
        }

        // Validate client if provided
        if (updateCampaignDto.clientId) {
            await this.advertiserHelper.validateClient(updateCampaignDto.clientId, advertiserId);
        }

        // Validate bid strategy and amount if provided
        if (updateCampaignDto.bidStrategy || updateCampaignDto.bidAmount) {
            await this.advertiserHelper.validateBidStrategy(
                updateCampaignDto.bidStrategy || campaign.bidStrategy,
                updateCampaignDto.bidAmount
            );
        }

        // Update campaign
        const updatedCampaign = await this.prisma.campaign.update({
            where: { id: campaignId },
            data: {
                name: updateCampaignDto.name,
                startDate: updateCampaignDto.startDate
                    ? new Date(updateCampaignDto.startDate)
                    : undefined,
                endDate: updateCampaignDto.endDate
                    ? new Date(updateCampaignDto.endDate)
                    : undefined,
                objective: updateCampaignDto.objective,
                bidStrategy: updateCampaignDto.bidStrategy,
                bidAmount: updateCampaignDto.bidAmount,
                pacing: updateCampaignDto.pacing,
                businessCategory: updateCampaignDto.businessCategory,
                websiteUrl: updateCampaignDto.websiteUrl,
                interests: updateCampaignDto.interests,
                clientId: updateCampaignDto.clientId,
            },
            include: {
                client: true,
            },
        });

        await this.campaignEligibilityService.invalidateCampaignPoolCache();

        return updatedCampaign;
    }

    /**
     * Get all campaigns for a specific advertiser with pagination and filtering
     */
    async findAll(advertiserId: string, query: CampaignQueryDto) {
        const {
            status,
            objective,
            clientId,
            search,
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc',
        } = query;

        // Build where clause
        const where: Prisma.CampaignWhereInput = {
            advertiserId,
        };

        if (status) where.status = status;
        if (objective) where.objective = objective;
        if (clientId) where.clientId = clientId;
        if (search) {
            where.name = {
                contains: search,
                mode: 'insensitive',
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
                    [sortBy]: sortOrder,
                },
                include: {
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
            }),
        ]);

        return {
            items: campaigns,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get a single campaign by ID
     */
    async findOne(campaignId: string, advertiserId: string) {
        const campaign = await this.prisma.campaign.findUnique({
            where: { id: campaignId },
            include: {
                client: true,
                creatives: true,
                statistics: {
                    orderBy: {
                        date: 'desc',
                    },
                    take: 7, // Last 7 days of statistics
                },
                // Include targeting rules
                demographicTargeting: true,
                geographicTargeting: true,
                deviceTargeting: true,
                contextualTargeting: true,
                behavioralTargeting: true,
                timeTargeting: true,
                frequencyTargeting: true,
            },
        });

        if (!campaign) {
            throw new ResourceNotFoundException('Campaign', campaignId);
        }

        // Verify ownership
        if (campaign.advertiserId !== advertiserId) {
            throw new ForbiddenException('You do not have access to this campaign');
        }

        return campaign;
    }

    /**
     * Delete a campaign
     */
    async remove(campaignId: string, advertiserId: string) {
        // Check if campaign exists and belongs to the advertiser
        const campaign = await this.prisma.campaign.findUnique({
            where: { id: campaignId },
            select: {
                id: true,
                name: true,
                advertiserId: true,
                clientId: true,
                status: true,
            },
        });

        if (!campaign) {
            throw new ResourceNotFoundException('Campaign', campaignId);
        }

        if (campaign.advertiserId !== advertiserId) {
            throw new ForbiddenException('You do not have access to this campaign');
        }

        // If campaign is active, we should cancel it instead of deleting
        if (campaign.status === CampaignStatus.ACTIVE) {
            throw new BadRequestException(
                'Cannot delete an active campaign. Please cancel it first.'
            );
        }

        // Delete campaign
        await this.prisma.campaign.delete({
            where: { id: campaignId },
        });

        return { message: 'Campaign deleted successfully' };
    }
}