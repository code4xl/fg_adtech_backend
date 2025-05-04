// inventory-campaign.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Language, InventoryFormat, InventoryPosition, ApprovalStatus, CampaignStatus } from '@prisma/client';
import { ResourceNotFoundException, ForbiddenException, BadRequestException } from '../common/exceptions/custom.exception';
import { AssignInventoryToCampaignDto } from './dto/campaign-inventory.dto';

@Injectable()
export class InventoryCampaignService {
    constructor(private readonly prisma: PrismaService) { }

    // Get all parent categories (categories that are not children of other categories)
    async getAllParentCategories() {
        const parentCategories = await this.prisma.contentCategory.findMany({
            where: {
                parentId: null
            },
            select: {
                id: true,
                name: true,
                description: true,
                childCategories: true,
                _count: {
                    select: {
                        childCategories: true,
                        inventories: true,
                        publishers: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        return {
            categories: parentCategories,
            count: parentCategories.length
        };
    }

    // Get all available languages
    async getAllLanguages() {
        // Return all enum values from Language enum
        const languages = Object.values(Language).map(lang => ({
            code: lang,
            name: this.formatLanguageName(lang)
        }));

        return {
            languages,
            count: languages.length
        };
    }

    // Helper method to format language names
    private formatLanguageName(code: string): string {
        return code.charAt(0).toUpperCase() + code.slice(1).toLowerCase();
    }

    // Get publishers filtered by category and language
    async getPublishersByFilters(
        advertiserId: string,
        categoryId?: string,
        language?: string
    ) {
        const where: any = {
            status: 'ACTIVE', // Only get active publishers
        };

        // Collect category IDs to filter by
        let categoryIds: string[] = [];

        // Process category filter if provided
        if (categoryId) {
            // First check if this is a parent category
            const category = await this.prisma.contentCategory.findUnique({
                where: { id: categoryId },
                select: {
                    id: true,
                    parentId: true
                }
            });

            if (category) {
                categoryIds.push(categoryId);

                // If it's a parent category, also get its children
                if (category.parentId === null) {
                    const childCategories = await this.prisma.contentCategory.findMany({
                        where: { parentId: categoryId },
                        select: { id: true }
                    });

                    // Add child category IDs to the list
                    categoryIds = [...categoryIds, ...childCategories.map(c => c.id)];
                }

                // Filter publishers that have any of these categories
                where.categories = {
                    some: {
                        categoryId: { in: categoryIds }
                    }
                };
            }
        }

        // Add language filter if provided
        if (language) {
            where.languages = {
                some: {
                    language: language as Language
                }
            };
        }

        // Get list of blocked publisher IDs for this advertiser
        const blockedPublishers = await this.prisma.inventoryBlockedAdvertiser.findMany({
            where: {
                advertiserId
            },
            select: {
                inventory: {
                    select: {
                        publisherId: true
                    }
                }
            }
        });

        // Extract unique publisher IDs that have blocked this advertiser
        const blockedPublisherIds = [...new Set(
            blockedPublishers.map(item => item.inventory.publisherId)
        )];

        // Exclude blocked publishers
        if (blockedPublisherIds.length > 0) {
            where.id = {
                notIn: blockedPublisherIds
            };
        }

        // Get publishers with basic category information
        const publishers = await this.prisma.publisher.findMany({
            where,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                domain: true,
                categories: {
                    include: {
                        category: true
                    }
                },
                languages: {
                    select: {
                        language: true
                    }
                },
                _count: {
                    select: {
                        inventories: true
                    }
                }
            },
            orderBy: {
                firstName: 'asc'
            }
        });

        // If we're filtering by category, enrich the response with complete category information
        let enrichedCategories = {};

        if (categoryIds.length > 0) {
            // Fetch complete category information including parent-child relationships
            const categories = await this.prisma.contentCategory.findMany({
                where: {
                    id: { in: categoryIds }
                },
                include: {
                    parentCategory: true,
                    childCategories: {
                        select: {
                            id: true,
                            name: true,
                            description: true
                        }
                    }
                }
            });

            // Create a map for easy lookup
            categories.forEach(cat => {
                enrichedCategories[cat.id] = cat;
            });
        }

        return {
            publishers: publishers.map(publisher => ({
                id: publisher.id,
                name: `${publisher.firstName} ${publisher.lastName}`,
                domain: publisher.domain,
                // Include enriched category information if available
                categories: publisher.categories.map(cat => {
                    if (categoryIds.length > 0 && enrichedCategories[cat.category.id]) {
                        // Return enriched category including parent/child info
                        return enrichedCategories[cat.category.id];
                    }
                    // Otherwise just return the basic category
                    return cat.category;
                }),
                languages: publisher.languages.map(lang => ({
                    code: lang.language,
                    name: this.formatLanguageName(lang.language as string)
                })),
                inventoryCount: publisher._count.inventories
            })),
            count: publishers.length
        };
    }

    // Get inventory for a specific publisher
    async getPublisherInventory(
        advertiserId: string,
        publisherId: string,
        format?: string,
        position?: string
    ) {
        // Check if publisher exists
        const publisher = await this.prisma.publisher.findUnique({
            where: { id: publisherId },
            select: { id: true, firstName: true, lastName: true }
        });

        if (!publisher) {
            throw new ResourceNotFoundException('Publisher', publisherId);
        }

        // Build query filters
        const where: any = {
            publisherId,
            approvalStatus: ApprovalStatus.APPROVED,
            isActive: true,
            // Filter out inventories where this advertiser is blocked
            blockedAdvertisers: {
                none: {
                    advertiserId
                }
            }
        };

        // Apply optional filters
        if (format) {
            where.format = format as InventoryFormat;
        }

        if (position) {
            where.position = position as InventoryPosition;
        }

        // Get inventories
        const inventories = await this.prisma.adInventory.findMany({
            where,
            include: {
                categories: {
                    include: {
                        category: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
                floorPrices: {
                    where: {
                        startDate: { lte: new Date() },
                        OR: [
                            { endDate: { gte: new Date() } },
                            { endDate: null }
                        ]
                    },
                    orderBy: {
                        startDate: 'desc'
                    },
                    take: 1
                },
                _count: {
                    select: {
                        impressions: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        // Format response
        return {
            publisher: {
                id: publisher.id,
                name: `${publisher.firstName} ${publisher.lastName}`
            },
            inventories: inventories.map(inventory => ({
                id: inventory.id,
                name: inventory.name,
                format: inventory.format,
                position: inventory.position,
                width: inventory.width,
                height: inventory.height,
                viewabilityScore: inventory.viewabilityScore || 0,
                categories: inventory.categories.map(cat => cat.category),
                floorPrice: inventory.floorPrices[0]?.basePrice || 0,
                currency: inventory.floorPrices[0]?.currency || 'USD',
                estimatedImpressions: this.estimateImpressions(inventory._count.impressions)
            })),
            count: inventories.length
        };
    }

    // Helper method to estimate impressions
    private estimateImpressions(historicalCount: number): number {
        // Simple algorithm to estimate available impressions based on historical data
        return Math.max(100, Math.round(historicalCount * 0.85));
    }

    // Assign inventory to a campaign
    async assignInventoryToCampaign(
        campaignId: string,
        advertiserId: string,
        dto: AssignInventoryToCampaignDto
    ) {
        // Check if campaign exists and belongs to the advertiser
        const campaign = await this.prisma.campaign.findUnique({
            where: {
                id: campaignId,
                advertiserId
            },
            select: {
                id: true,
                status: true
            }
        });

        if (!campaign) {
            throw new ResourceNotFoundException('Campaign', campaignId);
        }

        // Check if campaign status allows adding inventory
        if (['COMPLETED', 'CANCELED', 'REJECTED'].includes(campaign.status)) {
            throw new BadRequestException(`Cannot add inventory to a campaign with status: ${campaign.status}`);
        }

        // Process each inventory in the assignment request
        const results = await Promise.all(
            dto.inventories.map(async (item) => {
                try {
                    // Check if inventory exists, is approved, active and not blocked for this advertiser
                    const inventory = await this.prisma.adInventory.findFirst({
                        where: {
                            id: item.inventoryId,
                            approvalStatus: ApprovalStatus.APPROVED,
                            isActive: true,
                            blockedAdvertisers: {
                                none: {
                                    advertiserId
                                }
                            }
                        }
                    });

                    if (!inventory) {
                        return {
                            inventoryId: item.inventoryId,
                            success: false,
                            message: 'Inventory not found, not approved, or not available to this advertiser'
                        };
                    }

                    // Check if this inventory is already assigned to this campaign
                    const existingAssignment = await this.prisma.campaignInventory.findUnique({
                        where: {
                            campaignId_inventoryId: {
                                campaignId,
                                inventoryId: item.inventoryId
                            }
                        }
                    });

                    if (existingAssignment) {
                        // Update the existing assignment
                        await this.prisma.campaignInventory.update({
                            where: {
                                campaignId_inventoryId: {
                                    campaignId,
                                    inventoryId: item.inventoryId
                                }
                            },
                            data: {
                                maxBid: item.maxBid
                            }
                        });

                        return {
                            inventoryId: item.inventoryId,
                            success: true,
                            message: 'Inventory settings updated'
                        };
                    } else {
                        // Create a new assignment
                        await this.prisma.campaignInventory.create({
                            data: {
                                campaignId,
                                inventoryId: item.inventoryId,
                                maxBid: item.maxBid
                            }
                        });

                        return {
                            inventoryId: item.inventoryId,
                            success: true,
                            message: 'Inventory assigned successfully'
                        };
                    }
                } catch (error) {
                    return {
                        inventoryId: item.inventoryId,
                        success: false,
                        message: 'Failed to assign inventory: ' + error.message
                    };
                }
            })
        );

        // Update campaign status if applicable (e.g., from DRAFT to SCHEDULED)
        if (campaign.status === 'DRAFT') {
            const now = new Date();
            const campaignDetails = await this.prisma.campaign.findUnique({
                where: { id: campaignId },
                select: { startDate: true }
            });

            await this.prisma.campaign.update({
                where: { id: campaignId },
                data: {
                    status: campaignDetails!.startDate <= now ?
                        CampaignStatus.ACTIVE :
                        CampaignStatus.SCHEDULED
                }
            });
        }

        return {
            campaignId,
            results,
            successCount: results.filter(r => r.success).length,
            failureCount: results.filter(r => !r.success).length
        };
    }

    // Remove inventory from campaign
    async removeInventoryFromCampaign(
        campaignId: string,
        inventoryId: string,
        advertiserId: string
    ) {
        // Check if campaign exists and belongs to the advertiser
        const campaign = await this.prisma.campaign.findUnique({
            where: {
                id: campaignId,
                advertiserId
            }
        });

        if (!campaign) {
            throw new ResourceNotFoundException('Campaign', campaignId);
        }

        // Check if inventory is assigned to this campaign
        const assignment = await this.prisma.campaignInventory.findUnique({
            where: {
                campaignId_inventoryId: {
                    campaignId,
                    inventoryId
                }
            }
        });

        if (!assignment) {
            throw new ResourceNotFoundException('Campaign inventory assignment', `${campaignId}:${inventoryId}`);
        }

        // Remove the assignment
        await this.prisma.campaignInventory.delete({
            where: {
                campaignId_inventoryId: {
                    campaignId,
                    inventoryId
                }
            }
        });

        // Check if campaign still has inventory
        const remainingInventoryCount = await this.prisma.campaignInventory.count({
            where: { campaignId }
        });

        // If no inventory left and campaign is scheduled/active, set it to DRAFT
        if (remainingInventoryCount === 0 &&
            ['SCHEDULED', 'ACTIVE'].includes(campaign.status)) {
            await this.prisma.campaign.update({
                where: { id: campaignId },
                data: { status: CampaignStatus.DRAFT }
            });
        }

        return {
            success: true,
            message: 'Inventory removed from campaign successfully'
        };
    }

    // Update inventory campaign settings
    async updateInventoryCampaignSettings(
        campaignId: string,
        inventoryId: string,
        advertiserId: string,
        maxBid: number
    ) {
        // Check if campaign exists and belongs to the advertiser
        const campaign = await this.prisma.campaign.findUnique({
            where: {
                id: campaignId,
                advertiserId
            }
        });

        if (!campaign) {
            throw new ResourceNotFoundException('Campaign', campaignId);
        }

        // Check if inventory is assigned to this campaign
        const assignment = await this.prisma.campaignInventory.findUnique({
            where: {
                campaignId_inventoryId: {
                    campaignId,
                    inventoryId
                }
            }
        });

        if (!assignment) {
            throw new ResourceNotFoundException('Campaign inventory assignment', `${campaignId}:${inventoryId}`);
        }

        // Update the assignment
        await this.prisma.campaignInventory.update({
            where: {
                campaignId_inventoryId: {
                    campaignId,
                    inventoryId
                }
            },
            data: {
                maxBid
            }
        });

        return {
            success: true,
            message: 'Campaign inventory settings updated successfully',
            data: {
                campaignId,
                inventoryId,
                maxBid
            }
        };
    }

    // Get all inventory assigned to a campaign
    async getCampaignInventory(
        campaignId: string,
        advertiserId: string
    ) {
        // Check if campaign exists and belongs to the advertiser
        const campaign = await this.prisma.campaign.findUnique({
            where: {
                id: campaignId,
                advertiserId
            },
            select: {
                id: true,
                name: true,
                status: true
            }
        });

        if (!campaign) {
            throw new ResourceNotFoundException('Campaign', campaignId);
        }

        // Get all inventory assigned to this campaign
        const inventories = await this.prisma.campaignInventory.findMany({
            where: { campaignId },
            include: {
                inventory: {
                    include: {
                        publisher: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true
                            }
                        },
                        categories: {
                            include: {
                                category: {
                                    select: {
                                        id: true,
                                        name: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        return {
            campaign: {
                id: campaign.id,
                name: campaign.name,
                status: campaign.status
            },
            inventories: inventories.map(item => ({
                id: item.inventoryId,
                name: item.inventory.name,
                format: item.inventory.format,
                position: item.inventory.position,
                width: item.inventory.width,
                height: item.inventory.height,
                publisher: {
                    id: item.inventory.publisher.id,
                    name: `${item.inventory.publisher.firstName} ${item.inventory.publisher.lastName}`
                },
                categories: item.inventory.categories.map(cat => cat.category),
                maxBid: item.maxBid,
                assignedAt: item.createdAt,
                updatedAt: item.updatedAt
            })),
            count: inventories.length
        };
    }

    // Get inventory performance stats for a campaign
    async getCampaignInventoryStats(
        campaignId: string,
        advertiserId: string
    ) {
        // Check if campaign exists and belongs to the advertiser
        const campaign = await this.prisma.campaign.findUnique({
            where: {
                id: campaignId,
                advertiserId
            }
        });

        if (!campaign) {
            throw new ResourceNotFoundException('Campaign', campaignId);
        }

        // Get all inventory assigned to this campaign
        const inventories = await this.prisma.campaignInventory.findMany({
            where: { campaignId },
            select: {
                inventoryId: true,
                maxBid: true,
                inventory: {
                    select: {
                        name: true,
                        format: true,
                        position: true,
                        width: true,
                        height: true,
                        publisher: {
                            select: {
                                firstName: true,
                                lastName: true
                            }
                        }
                    }
                }
            }
        });

        // For each inventory, get performance metrics
        const inventoryStats = await Promise.all(
            inventories.map(async (inventory) => {
                // This would typically fetch from a stats DB or service
                // Here we're just creating sample data
                const impressions = Math.floor(Math.random() * 10000);
                const clicks = Math.floor(impressions * Math.random() * 0.1);
                const spend = parseFloat((clicks * (typeof inventory.maxBid === 'number' ? inventory.maxBid : 0) * Math.random()).toFixed(2));
                const ctr = impressions > 0 ? parseFloat((clicks / impressions * 100).toFixed(2)) : 0;
                const cpc = clicks > 0 ? parseFloat((spend / clicks).toFixed(2)) : 0;

                return {
                    inventoryId: inventory.inventoryId,
                    name: inventory.inventory.name,
                    publisher: `${inventory.inventory.publisher.firstName} ${inventory.inventory.publisher.lastName}`,
                    format: inventory.inventory.format,
                    size: `${inventory.inventory.width}x${inventory.inventory.height}`,
                    position: inventory.inventory.position,
                    maxBid: inventory.maxBid,
                    performance: {
                        impressions,
                        clicks,
                        spend,
                        ctr: `${ctr}%`,
                        cpc,
                        averageDailyImpressions: Math.floor(impressions / 30)
                    }
                };
            })
        );

        // Calculate aggregate statistics
        const totalImpressions = inventoryStats.reduce((sum, item) => sum + item.performance.impressions, 0);
        const totalClicks = inventoryStats.reduce((sum, item) => sum + item.performance.clicks, 0);
        const totalSpend = parseFloat(inventoryStats.reduce((sum, item) => sum + item.performance.spend, 0).toFixed(2));
        const averageCtr = totalImpressions > 0 ? parseFloat((totalClicks / totalImpressions * 100).toFixed(2)) : 0;
        const averageCpc = totalClicks > 0 ? parseFloat((totalSpend / totalClicks).toFixed(2)) : 0;

        // Group by format
        const formatStats = {};
        inventoryStats.forEach(item => {
            const format = item.format;
            if (!formatStats[format]) {
                formatStats[format] = {
                    count: 0,
                    impressions: 0,
                    clicks: 0,
                    spend: 0
                };
            }
            formatStats[format].count++;
            formatStats[format].impressions += item.performance.impressions;
            formatStats[format].clicks += item.performance.clicks;
            formatStats[format].spend += item.performance.spend;
        });

        return {
            campaign: {
                id: campaign.id,
                name: campaign.name,
                status: campaign.status
            },
            inventoryStats,
            summary: {
                totalInventory: inventoryStats.length,
                totalImpressions,
                totalClicks,
                totalSpend,
                averageCtr: `${averageCtr}%`,
                averageCpc,
                formatBreakdown: formatStats
            }
        };
    }

    // Additional methods for inventory management can be added here
    // Get all inventory formats
    async getInventoryFormats() {
        const formats = Object.values(InventoryFormat).map(format => ({
            code: format,
            name: this.formatEnumName(format)
        }));

        return {
            formats,
            count: formats.length
        };
    }

    // Get all inventory positions
    async getInventoryPositions() {
        const positions = Object.values(InventoryPosition).map(position => ({
            code: position,
            name: this.formatEnumName(position)
        }));

        return {
            positions,
            count: positions.length
        };
    }

    // Helper to format enum names
    private formatEnumName(value: string): string {
        // Convert ABOVE_FOLD to Above Fold
        return value
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }
}