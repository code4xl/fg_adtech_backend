import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignStatus } from '@prisma/client';
import {
    ResourceNotFoundException,
    BadRequestException,
} from '../common/exceptions/custom.exception';
import {
    CreateCampaignBudgetDto,
    UpdateCampaignBudgetDto,
    CampaignBudgetResponseDto,
    DailyBudgetSpendingDto,
    CampaignStatisticsDto,
    CampaignStatisticsQueryDto,
} from './dto/campaign/campaign-budget.dto';
import { AdvertiserHelper } from './advertiser.helper';
import { BudgetInitializationService } from 'src/tracking/services/budget-initialization.service';

@Injectable()
export class AdvertiserCampaignBudgetService {
    private readonly logger = new Logger(AdvertiserCampaignBudgetService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly advertiserHelper: AdvertiserHelper,
        private readonly budgetInitializationService: BudgetInitializationService,
    ) { }

    /**
     * Assign budget to a campaign -- Done
     */
    async assignBudget(
        advertiserId: string,
        createBudgetDto: CreateCampaignBudgetDto,
    ): Promise<CampaignBudgetResponseDto> {
        this.logger.debug(`Assigning budget to campaign: ${createBudgetDto.campaignId}`);

        // Verify campaign ownership
        const campaign = await this.advertiserHelper.verifyCampaignOwnership(
            createBudgetDto.campaignId,
            advertiserId,
        );

        // Validate budget assignment conditions --> (It checks for status and creatives count)
        this.validateBudgetAssignment(campaign);

        // Validate budget amounts
        this.validateBudgetAmounts(createBudgetDto.totalBudget, createBudgetDto.dailyBudget);

        // Check if budget already exists
        const existingBudget = await this.prisma.campaignBudget.findFirst({
            where: { campaignId: createBudgetDto.campaignId },
        });

        if (existingBudget) {
            throw new BadRequestException('Campaign already has a budget assigned');
        }

        // Create budget in transaction
        const result = await this.prisma.$transaction(async (tx) => {
            // Create campaign budget (Not daily budget yet)
            const budget = await tx.campaignBudget.create({
                data: {
                    campaignId: createBudgetDto.campaignId,
                    totalBudget: createBudgetDto.totalBudget,
                    dailyBudget: createBudgetDto.dailyBudget,
                    isExhausted: false,
                },
            });

            // Update campaign status based on start date
            const now = new Date();
            const startDate = new Date(campaign.startDate);

            let newStatus: CampaignStatus;
            if (startDate <= now) {
                newStatus = CampaignStatus.ACTIVE;
            } else {
                newStatus = CampaignStatus.SCHEDULED;
            }

            // Update campaign status and budget ID
            const updatedCampaign = await tx.campaign.update({
                where: { id: createBudgetDto.campaignId },
                data: {
                    status: newStatus,
                    campaignBudgetId: budget.id,
                },
                include: {
                    client: true,
                },
            });

            // Initialize daily budget
            await tx.campaignDailyBudget.create({
                data: {
                    campaignId: createBudgetDto.campaignId,
                    date: startDate, // Critical Edge Case
                    spentToday: 0,
                    remainingToday: createBudgetDto.dailyBudget,
                    isExhausted: false,
                },
            });

            return { budget, campaign: updatedCampaign };
        });

        this.logger.debug(`Budget assigned successfully to campaign: ${createBudgetDto.campaignId}`);

        return this.formatBudgetResponse(result.budget, result.campaign);
    }

    /**
     * Update campaign budget -- Done
     */
    async updateBudget(
        campaignId: string,
        advertiserId: string,
        updateBudgetDto: UpdateCampaignBudgetDto,
    ): Promise<CampaignBudgetResponseDto> {
        this.logger.debug(`Updating budget for campaign: ${campaignId}`);

        // Verify campaign ownership
        const campaign = await this.advertiserHelper.verifyCampaignOwnership(campaignId, advertiserId);

        // Get existing budget
        const existingBudget = await this.prisma.campaignBudget.findFirst({
            where: { campaignId },
        });

        if (!existingBudget) {
            throw new ResourceNotFoundException('Campaign budget', campaignId);
        }

        // Validate update conditions
        this.validateBudgetUpdate(campaign, existingBudget, updateBudgetDto);

        // Prepare update data
        const updateData: any = {};

        if (updateBudgetDto.totalBudget !== undefined) {
            this.validateTotalBudgetIncrease(existingBudget, updateBudgetDto.totalBudget);
            updateData.totalBudget = updateBudgetDto.totalBudget;
        }

        if (updateBudgetDto.dailyBudget !== undefined) {
            const totalBudget = updateBudgetDto.totalBudget || Number(existingBudget.totalBudget);
            this.validateBudgetAmounts(totalBudget, updateBudgetDto.dailyBudget);
            updateData.dailyBudget = updateBudgetDto.dailyBudget;
        }

        // Update budget
        const updatedBudget = await this.prisma.campaignBudget.update({
            where: { id: existingBudget.id },
            data: {
                ...updateData,
                lastUpdated: new Date(),
            },
        });

        this.logger.debug(`Budget updated successfully for campaign: ${campaignId}`);

        return this.formatBudgetResponse(updatedBudget, campaign);
    }

    /**
     * Get campaign budget details -- Done
     */
    async getBudget(
        campaignId: string,
        advertiserId: string,
    ): Promise<CampaignBudgetResponseDto> {
        // Verify campaign ownership
        const campaign = await this.advertiserHelper.verifyCampaignOwnership(campaignId, advertiserId);

        const budget = await this.prisma.campaignBudget.findFirst({
            where: { campaignId },
        });

        if (!budget) {
            throw new ResourceNotFoundException('Campaign budget', campaignId);
        }

        return this.formatBudgetResponse(budget, campaign);
    }

    /**
     * Get daily budget spending for a campaign -- Done
     */
    async getDailySpending(
        campaignId: string,
        advertiserId: string,
        date?: string,
    ): Promise<DailyBudgetSpendingDto> {
        // Verify campaign ownership
        await this.advertiserHelper.verifyCampaignOwnership(campaignId, advertiserId);

        const targetDate = date ? new Date(date) : new Date();
        targetDate.setHours(0, 0, 0, 0); // Start of day

        const dailyBudget = await this.prisma.campaignDailyBudget.findFirst({
            where: {
                campaignId,
                date: targetDate,
            },
        });

        // Rare case: if no daily budget exists for the date, create one (It won't happen, bcz daily budget cron job runs daily)
        if (!dailyBudget) {
            // If no daily budget record exists, create one
            const campaign = await this.prisma.campaign.findUnique({
                where: { id: campaignId },
                include: { campaignBudget: true },
            });

            if (!campaign?.campaignBudget) {
                throw new ResourceNotFoundException('Campaign budget', campaignId);
            }

            const newDailyBudget = await this.prisma.campaignDailyBudget.create({
                data: {
                    campaignId,
                    date: targetDate,
                    spentToday: 0,
                    remainingToday: campaign.campaignBudget.dailyBudget,
                    isExhausted: false,
                },
            });

            return this.formatDailySpendingResponse(newDailyBudget);
        }

        return this.formatDailySpendingResponse(dailyBudget);
    }

    /**
     * Get campaign statistics -- NEED TO BE IMPLEMENTED
     */
    // async getCampaignStatistics(
    //     campaignId: string,
    //     advertiserId: string,
    //     query: CampaignStatisticsQueryDto,
    // ): Promise<CampaignStatisticsDto> {
    //     // Verify campaign ownership
    //     await this.advertiserHelper.verifyCampaignOwnership(campaignId, advertiserId);

    //     // Default date range - last 30 days if not specified
    //     const endDate = query.endDate ? new Date(query.endDate) : new Date();
    //     const startDate = query.startDate
    //         ? new Date(query.startDate)
    //         : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    //     // Get aggregated statistics
    //     const stats = await this.prisma.campaignStatistics.aggregate({
    //         where: {
    //             campaignId,
    //             date: {
    //                 gte: startDate,
    //                 lte: endDate,
    //             },
    //         },
    //         _sum: {
    //             impressions: true,
    //             clicks: true,
    //             conversions: true,
    //             spend: true,
    //         },
    //     });

    //     const totalImpressions = stats._sum.impressions || 0;
    //     const totalClicks = stats._sum.clicks || 0;
    //     const totalConversions = stats._sum.conversions || 0;
    //     const totalSpend = Number(stats._sum.spend || 0);

    //     // Calculate metrics
    //     const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    //     const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    //     const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
    //     const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

    //     let dailyBreakdown: any[] = [];

    //     if (query.includeDailyBreakdown) {
    //         const dailyStats = await this.prisma.campaignStatistics.findMany({
    //             where: {
    //                 campaignId,
    //                 date: {
    //                     gte: startDate,
    //                     lte: endDate,
    //                 },
    //             },
    //             orderBy: { date: 'asc' },
    //         });

    //         dailyBreakdown = dailyStats.map((stat) => ({
    //             date: stat.date.toISOString().split('T')[0],
    //             impressions: stat.impressions,
    //             clicks: stat.clicks,
    //             conversions: stat.conversions,
    //             spend: stat.spend.toString(),
    //             ctr: stat.impressions > 0 ? (stat.clicks / stat.impressions) * 100 : 0,
    //             cpc: stat.clicks > 0 ? Number(stat.spend) / stat.clicks : 0,
    //         }));
    //     }

    //     return {
    //         campaignId,
    //         dateRange: {
    //             startDate: startDate.toISOString().split('T')[0],
    //             endDate: endDate.toISOString().split('T')[0],
    //         },
    //         totalImpressions,
    //         totalClicks,
    //         totalConversions,
    //         totalSpend: totalSpend.toFixed(2),
    //         ctr: Math.round(ctr * 100) / 100,
    //         cpc: cpc.toFixed(2),
    //         cpm: cpm.toFixed(2),
    //         conversionRate: Math.round(conversionRate * 100) / 100,
    //         dailyBreakdown,
    //     };
    // }

    // Done
    private validateBudgetAssignment(campaign: any) {
        // Only DRAFT campaigns can have budget assigned
        if (campaign.status !== CampaignStatus.DRAFT) {
            throw new BadRequestException(
                `Cannot assign budget to campaign with status: ${campaign.status}. Only DRAFT campaigns can have budgets assigned.`
            );
        }

        // Campaign must have at least one creative
        if (!campaign._count?.creatives || campaign._count.creatives === 0) {
            throw new BadRequestException(
                'Cannot assign budget to campaign without creatives. Please add at least one approved creative first.'
            );
        }
    }

    // Done
    private validateBudgetAmounts(totalBudget: number, dailyBudget: number) {
        if (dailyBudget > totalBudget) {
            throw new BadRequestException('Daily budget cannot exceed total budget');
        }

        // In validateBudgetAmounts method
        if (totalBudget < 500) { // Change from 10 to 500 (more realistic for INR)
            throw new BadRequestException('Minimum total budget is ₹500');
        }

        if (dailyBudget < 50) { // Change from 1 to 50 (more realistic for INR)
            throw new BadRequestException('Minimum daily budget is ₹50');
        }

        // Check reasonable daily budget distribution
        const campaignDays = Math.ceil(totalBudget / dailyBudget);
        if (campaignDays < 2) {
            throw new BadRequestException(
                'Daily budget is too high relative to total budget. Campaign should run for at least 2 days.'
            );
        }
    }

    // Done
    private validateBudgetUpdate(campaign: any, existingBudget: any, updateDto: UpdateCampaignBudgetDto) {
        // Cannot update budget for completed or canceled campaigns
        const restrictedStatuses = [
            CampaignStatus.COMPLETED,
            CampaignStatus.CANCELED,
        ];

        if (restrictedStatuses.includes(campaign.status)) {
            throw new BadRequestException(
                `Cannot update budget for campaign with status: ${campaign.status}`
            );
        }
    }

    // Done - According to the industry standards
    private validateTotalBudgetIncrease(existingBudget: any, newTotalBudget: number) {
        const currentTotalBudget = Number(existingBudget.totalBudget);

        if (newTotalBudget < currentTotalBudget) {
            throw new BadRequestException(
                'Total budget can only be increased, not decreased. Current budget: ' + currentTotalBudget.toFixed(2)
            );
        }
    }

    // Done
    private async formatBudgetResponse(budget: any, campaign: any): Promise<CampaignBudgetResponseDto> {
        // Calculate total spent from daily budgets
        const spentAggregate = await this.prisma.campaignDailyBudget.aggregate({
            where: { campaignId: budget.campaignId },
            _sum: { spentToday: true },
        });

        const totalSpent = Number(spentAggregate._sum.spentToday || 0);
        const totalBudget = Number(budget.totalBudget);
        const remainingBudget = Math.max(0, totalBudget - totalSpent);

        return {
            id: budget.id,
            campaignId: budget.campaignId,
            totalBudget: budget.totalBudget.toString(),
            dailyBudget: budget.dailyBudget.toString(),
            totalSpent: totalSpent.toFixed(2),
            remainingBudget: remainingBudget.toFixed(2),
            isExhausted: budget.isExhausted,
            lastUpdated: budget.lastUpdated,
            campaign: {
                id: campaign.id,
                name: campaign.name,
                status: campaign.status,
                startDate: campaign.startDate,
                endDate: campaign.endDate,
            },
        };
    }

    // Done
    private formatDailySpendingResponse(dailyBudget: any): DailyBudgetSpendingDto {
        const spentToday = Number(dailyBudget.spentToday);
        const dailyBudgetAmount = Number(dailyBudget.remainingToday) + spentToday;
        const spentPercentage = dailyBudgetAmount > 0 ? (spentToday / dailyBudgetAmount) * 100 : 0;

        return {
            date: dailyBudget.date.toISOString().split('T')[0],
            dailyBudget: dailyBudgetAmount.toFixed(2),
            spentToday: spentToday.toFixed(2),
            remainingToday: dailyBudget.remainingToday.toString(),
            isExhausted: dailyBudget.isExhausted,
            spentPercentage: Math.round(spentPercentage * 100) / 100,
        };
    }
}