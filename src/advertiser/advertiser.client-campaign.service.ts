import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { CampaignStatus } from "@prisma/client";
import { ResourceNotFoundException } from "src/common/exceptions/custom.exception";
import { MailService } from "src/mail/mail.service";
import { CampaignNotificationService } from "src/notification/services/campaign.notification.service";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class ClientCampaignService {
    private readonly logger = new Logger(ClientCampaignService.name);

    constructor(
        private prisma: PrismaService,
        private mailService: MailService,
        private readonly campaignNotificationService: CampaignNotificationService
    ) { }

    /**
 * Get all campaigns assigned to a client with pagination and filters
 * This method should be called by CLIENT, not advertiser
 */
    async getAssignedCampaigns(
        clientId: string,
        filters: {
            page?: number;
            limit?: number;
            status?: string;
            search?: string;
        }
    ) {
        const { page = 1, limit = 10, status, search } = filters;
        const skip = (page - 1) * limit;

        // Build where condition
        const whereCondition: any = {
            assignedCampaigns: {
                some: {
                    clientId: clientId,
                },
            },
        };

        // Add status filter
        if (status) {
            whereCondition.status = status as CampaignStatus;
        }

        // Add search filter
        if (search) {
            whereCondition.name = {
                contains: search,
                mode: 'insensitive',
            };
        }

        // Get campaigns with pagination
        const [campaigns, totalCount] = await Promise.all([
            this.prisma.campaign.findMany({
                where: whereCondition,
                include: {
                    advertiser: {
                        select: {
                            id: true,
                            name: true,
                            companyName: true,
                            email: true,
                        },
                    },
                    ClientCampaign: {
                        where: { clientId },
                        select: {
                            assignedAt: true,
                            assignedBy: true,
                        },
                    },
                    campaignBudget: {
                        select: {
                            totalBudget: true,
                            dailyBudget: true,
                            spentAmount: true,
                            lastUpdated: true,
                        },
                    },
                    _count: {
                        select: {
                            creatives: true,
                        },
                    },
                },
                orderBy: { updatedAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.campaign.count({
                where: whereCondition,
            }),
        ]);

        // Format response
        const formattedCampaigns = campaigns.map((campaign) => ({
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            objective: campaign.objective,
            startDate: campaign.startDate,
            endDate: campaign.endDate,
            websiteUrl: campaign.websiteUrl,
            bidStrategy: campaign.bidStrategy,
            bidAmount: campaign.bidAmount,
            businessCategory: campaign.businessCategory,
            interests: campaign.interests,
            advertiser: campaign.advertiser,
            stats: {
                creativesCount: campaign._count.creatives,
            },
            createdAt: campaign.createdAt,
            updatedAt: campaign.updatedAt,
        }));

        return {
            campaigns: formattedCampaigns,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages: Math.ceil(totalCount / limit),
                hasNextPage: page < Math.ceil(totalCount / limit),
                hasPreviousPage: page > 1,
            },
        };
    }

    /**
     * Get detailed information about a specific assigned campaign
     */
    async getAssignedCampaignById(clientId: string, campaignId: string) {
        // First verify the campaign is assigned to this client
        const assignment = await this.prisma.clientCampaign.findFirst({
            where: {
                clientId,
                campaignId,
            },
        });

        if (!assignment) {
            throw new ForbiddenException(
                'You do not have access to this campaign or campaign not found'
            );
        }

        // Get detailed campaign information
        const campaign = await this.prisma.campaign.findUnique({
            where: { id: campaignId },
            include: {
                advertiser: {
                    select: {
                        id: true,
                        name: true,
                        companyName: true,
                        email: true,
                        mobile: true,
                    },
                },
                campaignBudget: {
                    select: {
                        id: true,
                        totalBudget: true,
                        dailyBudget: true,
                        spentAmount: true,
                        lastUpdated: true,
                    },
                },
                creatives: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        status: true,
                        createdAt: true,
                    },
                },
                ClientCampaign: {
                    where: { clientId },
                    select: {
                        assignedAt: true,
                        assignedBy: true,
                    },
                },
                _count: {
                    select: {
                        creatives: true,
                    },
                },
            },
        });

        if (!campaign) {
            throw new ResourceNotFoundException('Campaign', campaignId);
        }

        return campaign;
    }

    /**
   * Get detailed budget information for a campaign
   */
    async getCampaignBudget(clientId: string, campaignId: string) {
        // Verify access
        const assignment = await this.prisma.clientCampaign.findFirst({
            where: {
                clientId,
                campaignId,
            },
        });

        if (!assignment) {
            throw new ForbiddenException(
                'You do not have access to this campaign or campaign not found'
            );
        }

        // Get budget details
        const budget = await this.prisma.campaignBudget.findFirst({
            where: {
                Campaign: {
                    some: {
                        id: campaignId
                    }
                }
            },
            include: {
                Campaign: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        startDate: true,
                        endDate: true,
                    },
                    where: {
                        id: campaignId
                    }
                },
            },
        });

        if (!budget || !budget.Campaign || budget.Campaign.length === 0) {
            throw new ResourceNotFoundException('Budget', `for campaign ${campaignId}`);
        }

        const campaign = budget.Campaign[0]; // Get the first (and should be only) campaign

        // Calculate budget utilization
        const totalBudgetNumber = typeof budget.totalBudget === 'string'
            ? parseFloat(budget.totalBudget)
            : Number(budget.totalBudget);
        const spentAmountNumber = typeof budget.spentAmount === 'string'
            ? parseFloat(budget.spentAmount)
            : Number(budget.spentAmount);

        const utilizationPercentage = totalBudgetNumber > 0
            ? (spentAmountNumber / totalBudgetNumber) * 100
            : 0;

        const remainingPercentage = 100 - utilizationPercentage;

        // Calculate daily spend rate - Fixed the reference error
        const campaignDays = campaign.endDate && campaign.startDate
            ? Math.ceil(
                (campaign.endDate.getTime() - campaign.startDate.getTime()) /
                (1000 * 60 * 60 * 24)
            )
            : 0;

        const avgDailySpend = campaignDays > 0 ? spentAmountNumber / campaignDays : 0;

        // Calculate remaining amount
        const remainingAmount = totalBudgetNumber - spentAmountNumber;

        return {
            budget: {
                id: budget.id,
                campaignId: campaignId,
                totalBudget: totalBudgetNumber,
                dailyBudget: typeof budget.dailyBudget === 'string'
                    ? parseFloat(budget.dailyBudget)
                    : Number(budget.dailyBudget),
                spentAmount: spentAmountNumber,
                remainingAmount: remainingAmount,
                isExhausted: budget.isExhausted,
                lastUpdated: budget.lastUpdated,
                utilizationPercentage: Math.round(utilizationPercentage * 100) / 100,
                remainingPercentage: Math.round(remainingPercentage * 100) / 100,
                avgDailySpend: Math.round(avgDailySpend * 100) / 100,
                campaignDuration: campaignDays,
                campaign: campaign,
            },
        };
    }

    /**
     * Get dashboard summary for client campaigns
     */
    async getCampaignsDashboard(clientId: string) {
        // Get all assigned campaigns with their budgets
        const campaigns = await this.prisma.campaign.findMany({
            where: {
                ClientCampaign: {
                    some: {
                        clientId,
                    },
                },
            },
            include: {
                campaignBudget: {
                    select: {
                        totalBudget: true,
                        spentAmount: true,
                        dailyBudget: true,
                        isExhausted: true,
                    },
                },
            },
        });

        // Helper function to convert Decimal to number
        const toNumber = (value: any): number => {
            if (typeof value === 'string') {
                return parseFloat(value);
            }
            return Number(value) || 0;
        };

        // Calculate summary statistics
        const stats = {
            totalCampaigns: campaigns.length,
            activeCampaigns: campaigns.filter(c => c.status === CampaignStatus.ACTIVE).length,
            pausedCampaigns: campaigns.filter(c => c.status === CampaignStatus.PAUSED).length,
            completedCampaigns: campaigns.filter(c => c.status === CampaignStatus.COMPLETED).length,
            draftCampaigns: campaigns.filter(c => c.status === CampaignStatus.DRAFT).length,
            totalBudget: campaigns.reduce((sum, c) => sum + toNumber(c.campaignBudget?.totalBudget), 0),
            totalSpent: campaigns.reduce((sum, c) => sum + toNumber(c.campaignBudget?.spentAmount), 0),
            totalRemaining: campaigns.reduce((sum, c) => {
                const budget = c.campaignBudget;
                if (budget) {
                    const remaining = toNumber(budget.totalBudget) - toNumber(budget.spentAmount);
                    return sum + remaining;
                }
                return sum;
            }, 0),
        };

        // Get recent campaigns (last 5)
        const recentCampaigns = campaigns
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            .slice(0, 5)
            .map((campaign) => ({
                id: campaign.id,
                name: campaign.name,
                status: campaign.status,
                startDate: campaign.startDate,
                endDate: campaign.endDate,
                budget: campaign.campaignBudget ? {
                    totalBudget: toNumber(campaign.campaignBudget.totalBudget),
                    spentAmount: toNumber(campaign.campaignBudget.spentAmount),
                    remainingAmount: toNumber(campaign.campaignBudget.totalBudget) - toNumber(campaign.campaignBudget.spentAmount),
                    dailyBudget: toNumber(campaign.campaignBudget.dailyBudget),
                    isExhausted: campaign.campaignBudget.isExhausted,
                } : null,
                updatedAt: campaign.updatedAt,
            }));

        return {
            stats,
            recentCampaigns,
        };
    }
}