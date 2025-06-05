// src/campaign/campaign-budget-tracker.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
    CreateCampaignBudgetTrackerDto,
    UpdateCampaignBudgetTrackerDto,
    CampaignBudgetTrackerQueryDto,
} from './dto/campaign/campaign-budget-tracker.dto';
import {
    ResourceNotFoundException,
    ForbiddenException,
    BadRequestException,
    DuplicateResourceException,
} from '../common/exceptions/custom.exception';
import { Prisma } from '@prisma/client';

@Injectable()
export class CampaignBudgetTrackerService {
    private readonly logger = new Logger(CampaignBudgetTrackerService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Create a new budget tracker entry
     */
    async create(
        advertiserId: string,
        createDto: CreateCampaignBudgetTrackerDto,
    ) {
        // Verify campaign exists and belongs to the advertiser
        await this.validateCampaignOwnership(advertiserId, createDto.campaignId);

        // Check if budget tracker already exists for this campaign and date
        const existingTracker = await this.prisma.campaignBudgetTracker.findUnique({
            where: {
                campaignId_date: {
                    campaignId: createDto.campaignId,
                    date: new Date(createDto.date),
                },
            },
        });

        if (existingTracker) {
            throw new DuplicateResourceException(
                'Campaign Budget Tracker',
                'campaignId and date combination',
                `${createDto.campaignId}-${createDto.date}`,
            );
        }

        // Validate budget logic
        this.validateBudgetLogic({
            totalBudget: createDto.totalBudget,
            dailyBudget: createDto.dailyBudget,
            spentToday: createDto.spentToday ?? 0,
            remainingBudget: createDto.remainingBudget,
        });

        const budgetTracker = await this.prisma.campaignBudgetTracker.create({
            data: {
                campaignId: createDto.campaignId,
                date: new Date(createDto.date),
                totalBudget: createDto.totalBudget,
                dailyBudget: createDto.dailyBudget,
                spentToday: createDto.spentToday || 0,
                remainingBudget: createDto.remainingBudget,
                isExhausted: createDto.isExhausted || false,
            },
            include: {
                campaign: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                    },
                },
            },
        });

        this.logger.log(
            `Created budget tracker for campaign ${createDto.campaignId} on ${createDto.date}`,
        );

        return budgetTracker;
    }

    /**
     * Get all budget trackers with filtering and pagination
     */
    async findAll(advertiserId: string, query: CampaignBudgetTrackerQueryDto) {
        const {
            campaignId,
            date,
            startDate,
            endDate,
            isExhausted,
            page = 1,
            limit = 10,
            sortBy = 'date',
            sortOrder = 'desc',
        } = query;

        // Build where clause
        const where: Prisma.CampaignBudgetTrackerWhereInput = {
            campaign: {
                advertiserId: advertiserId,
            },
        };

        if (campaignId) {
            where.campaignId = campaignId;
        }

        if (date) {
            where.date = new Date(date);
        } else if (startDate || endDate) {
            where.date = {};
            if (startDate) {
                where.date.gte = new Date(startDate);
            }
            if (endDate) {
                where.date.lte = new Date(endDate);
            }
        }

        if (typeof isExhausted === 'boolean') {
            where.isExhausted = isExhausted;
        }

        // Get total count and paginated results
        const [total, budgetTrackers] = await Promise.all([
            this.prisma.campaignBudgetTracker.count({ where }),
            this.prisma.campaignBudgetTracker.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: {
                    [sortBy]: sortOrder,
                },
                include: {
                    campaign: {
                        select: {
                            id: true,
                            name: true,
                            status: true,
                        },
                    },
                },
            }),
        ]);

        return {
            items: budgetTrackers,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get a specific budget tracker by ID
     */
    async findOne(advertiserId: string, id: string) {
        const budgetTracker = await this.prisma.campaignBudgetTracker.findUnique({
            where: { id },
            include: {
                campaign: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        advertiserId: true,
                    },
                },
            },
        });

        if (!budgetTracker) {
            throw new ResourceNotFoundException('Campaign Budget Tracker', id);
        }

        // Verify ownership
        if (budgetTracker.campaign.advertiserId !== advertiserId) {
            throw new ForbiddenException(
                'You do not have access to this budget tracker',
            );
        }

        return budgetTracker;
    }

    /**
     * Get budget tracker by campaign ID and date
     */
    async findByCampaignAndDate(
        advertiserId: string,
        campaignId: string,
        date: string,
    ) {
        // Verify campaign ownership
        await this.validateCampaignOwnership(advertiserId, campaignId);

        const budgetTracker = await this.prisma.campaignBudgetTracker.findUnique({
            where: {
                campaignId_date: {
                    campaignId,
                    date: new Date(date),
                },
            },
            include: {
                campaign: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                    },
                },
            },
        });

        if (!budgetTracker) {
            throw new ResourceNotFoundException(
                'Campaign Budget Tracker',
                `${campaignId}-${date}`,
            );
        }

        return budgetTracker;
    }

    /**
     * Update a budget tracker
     */
    async update(
        advertiserId: string,
        id: string,
        updateDto: UpdateCampaignBudgetTrackerDto,
    ) {
        // Check if budget tracker exists and verify ownership
        const existingTracker = await this.findOne(advertiserId, id);

        // Validate budget logic if financial fields are being updated
        if (
            updateDto.totalBudget !== undefined ||
            updateDto.dailyBudget !== undefined ||
            updateDto.spentToday !== undefined ||
            updateDto.remainingBudget !== undefined
        ) {
            const mergedData = {
                ...existingTracker,
                ...updateDto,
            };
            this.validateBudgetLogic({
                totalBudget: Number(mergedData.totalBudget),
                dailyBudget: Number(mergedData.dailyBudget),
                spentToday: Number(mergedData.spentToday),
                remainingBudget: Number(mergedData.remainingBudget),
            });
        }

        const updatedBudgetTracker = await this.prisma.campaignBudgetTracker.update({
            where: { id },
            data: {
                totalBudget: updateDto.totalBudget,
                dailyBudget: updateDto.dailyBudget,
                spentToday: updateDto.spentToday,
                remainingBudget: updateDto.remainingBudget,
                isExhausted: updateDto.isExhausted,
                lastUpdated: new Date(),
            },
            include: {
                campaign: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                    },
                },
            },
        });

        this.logger.log(`Updated budget tracker ${id}`);

        return updatedBudgetTracker;
    }

    /**
     * Delete a budget tracker
     */
    async remove(advertiserId: string, id: string) {
        // Check if budget tracker exists and verify ownership
        await this.findOne(advertiserId, id);

        await this.prisma.campaignBudgetTracker.delete({
            where: { id },
        });

        this.logger.log(`Deleted budget tracker ${id}`);

        return { message: 'Budget tracker deleted successfully' };
    }

    /**
     * Update spent amount for a specific campaign and date
     */
    async updateSpentAmount(
        advertiserId: string,
        campaignId: string,
        date: string,
        spentAmount: number,
    ) {
        // Verify campaign ownership
        await this.validateCampaignOwnership(advertiserId, campaignId);

        const budgetTracker = await this.prisma.campaignBudgetTracker.findUnique({
            where: {
                campaignId_date: {
                    campaignId,
                    date: new Date(date),
                },
            },
        });

        if (!budgetTracker) {
            throw new ResourceNotFoundException(
                'Campaign Budget Tracker',
                `${campaignId}-${date}`,
            );
        }

        const newSpentToday = Number(budgetTracker.spentToday) + spentAmount;
        const newRemainingBudget = Number(budgetTracker.totalBudget) - newSpentToday;
        const isExhausted = newRemainingBudget <= 0 || newSpentToday >= Number(budgetTracker.dailyBudget);

        const updatedTracker = await this.prisma.campaignBudgetTracker.update({
            where: {
                campaignId_date: {
                    campaignId,
                    date: new Date(date),
                },
            },
            data: {
                spentToday: newSpentToday,
                remainingBudget: newRemainingBudget,
                isExhausted,
                lastUpdated: new Date(),
            },
        });

        this.logger.log(
            `Updated spent amount for campaign ${campaignId} on ${date}: +${spentAmount}`,
        );

        return updatedTracker;
    }

    /**
     * Get budget summary for a campaign across a date range
     */
    async getCampaignBudgetSummary(
        advertiserId: string,
        campaignId: string,
        startDate?: string,
        endDate?: string,
    ) {
        // Verify campaign ownership
        await this.validateCampaignOwnership(advertiserId, campaignId);

        const where: Prisma.CampaignBudgetTrackerWhereInput = {
            campaignId,
        };

        if (startDate || endDate) {
            where.date = {};
            if (startDate) {
                where.date.gte = new Date(startDate);
            }
            if (endDate) {
                where.date.lte = new Date(endDate);
            }
        }

        const budgetTrackers = await this.prisma.campaignBudgetTracker.findMany({
            where,
            orderBy: { date: 'asc' },
        });

        if (budgetTrackers.length === 0) {
            return {
                campaignId,
                summary: {
                    totalBudget: 0,
                    totalSpent: 0,
                    totalRemaining: 0,
                    averageDailySpend: 0,
                    daysWithExhaustedBudget: 0,
                    totalDays: 0,
                },
                dailyBreakdown: [],
            };
        }

        const totalBudget = budgetTrackers.reduce(
            (sum, tracker) => sum + Number(tracker.totalBudget),
            0,
        );
        const totalSpent = budgetTrackers.reduce(
            (sum, tracker) => sum + Number(tracker.spentToday),
            0,
        );
        const totalRemaining = budgetTrackers.reduce(
            (sum, tracker) => sum + Number(tracker.remainingBudget),
            0,
        );
        const averageDailySpend = totalSpent / budgetTrackers.length;
        const daysWithExhaustedBudget = budgetTrackers.filter(
            (tracker) => tracker.isExhausted,
        ).length;

        return {
            campaignId,
            summary: {
                totalBudget: Number(totalBudget.toFixed(2)),
                totalSpent: Number(totalSpent.toFixed(2)),
                totalRemaining: Number(totalRemaining.toFixed(2)),
                averageDailySpend: Number(averageDailySpend.toFixed(2)),
                daysWithExhaustedBudget,
                totalDays: budgetTrackers.length,
            },
            dailyBreakdown: budgetTrackers.map((tracker) => ({
                date: tracker.date,
                totalBudget: Number(tracker.totalBudget),
                dailyBudget: Number(tracker.dailyBudget),
                spentToday: Number(tracker.spentToday),
                remainingBudget: Number(tracker.remainingBudget),
                isExhausted: tracker.isExhausted,
                utilizationPercentage: Number(
                    ((Number(tracker.spentToday) / Number(tracker.dailyBudget)) * 100).toFixed(2),
                ),
            })),
        };
    }

    /**
     * Validate campaign ownership
     */
    private async validateCampaignOwnership(
        advertiserId: string,
        campaignId: string,
    ) {
        const campaign = await this.prisma.campaign.findUnique({
            where: { id: campaignId },
            select: { id: true, advertiserId: true },
        });

        if (!campaign) {
            throw new ResourceNotFoundException('Campaign', campaignId);
        }

        if (campaign.advertiserId !== advertiserId) {
            throw new ForbiddenException('You do not have access to this campaign');
        }

        return campaign;
    }

    /**
     * Validate budget logic
     */
    private validateBudgetLogic(data: {
        totalBudget: number;
        dailyBudget: number;
        spentToday: number;
        remainingBudget: number;
    }) {
        const { totalBudget, dailyBudget, spentToday, remainingBudget } = data;

        if (dailyBudget > totalBudget) {
            throw new BadRequestException(
                'Daily budget cannot be greater than total budget',
            );
        }

        if (spentToday > dailyBudget) {
            this.logger.warn(
                `Spent today (${spentToday}) exceeds daily budget (${dailyBudget})`,
            );
        }

        if (spentToday > totalBudget) {
            throw new BadRequestException(
                'Spent today cannot be greater than total budget',
            );
        }

        const expectedRemaining = totalBudget - spentToday;
        if (Math.abs(remainingBudget - expectedRemaining) > 0.01) {
            throw new BadRequestException(
                `Remaining budget (${remainingBudget}) does not match expected value (${expectedRemaining})`,
            );
        }

        if (remainingBudget < 0) {
            throw new BadRequestException('Remaining budget cannot be negative');
        }
    }
}