import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreativeService } from 'src/creative/creative.service';

@Injectable()
export class InventoryUpdateService {
    private readonly logger = new Logger(InventoryUpdateService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly creativeService: CreativeService
    ) { }

    /**
     * Handle inventory name updates - move associated creatives to new folders
     * This should be called whenever an inventory's name is updated
     */
    async handleInventoryNameUpdate(
        inventoryId: string,
        oldName: string,
        newName: string
    ): Promise<void> {
        try {
            // Find all campaigns that use this inventory
            const campaignInventories = await this.prisma.campaignInventory.findMany({
                where: {
                    inventoryId
                },
                select: {
                    campaignId: true
                }
            });

            if (campaignInventories.length === 0) {
                this.logger.log(`No campaigns found using inventory ${inventoryId}`);
                return;
            }

            // For each campaign, update the creative files in S3
            for (const { campaignId } of campaignInventories) {
                await this.creativeService.handleInventoryNameUpdate(
                    campaignId,
                    inventoryId,
                    oldName,
                    newName
                );
            }

            this.logger.log(`Successfully updated creatives for inventory ${inventoryId} across ${campaignInventories.length} campaigns`);
        } catch (error) {
            this.logger.error(`Error handling inventory name update: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Handle inventory deletion - ensure all creative files are cleaned up
     * This should be called before an inventory is deleted
     */
    async handleInventoryDeletion(inventoryId: string): Promise<void> {
        try {
            // Find all campaigns and creatives that use this inventory
            const campaignInventories = await this.prisma.campaignInventory.findMany({
                where: {
                    inventoryId
                },
                select: {
                    campaignId: true,
                    campaign: {
                        select: {
                            name: true
                        }
                    },
                    inventory: {
                        select: {
                            name: true
                        }
                    }
                }
            });

            // For each combination of campaign and inventory, delete the folder
            for (const { campaignId, campaign, inventory } of campaignInventories) {
                // First, delete all creatives from the database
                await this.prisma.creative.deleteMany({
                    where: {
                        campaignId,
                        inventoryId
                    }
                });

                // Then delete the S3 folder (you'll need to add this method to S3StorageService)
                await this.creativeService['s3StorageService'].deleteInventoryFolder(
                    campaign.name,
                    campaignId,
                    inventory.name,
                    inventoryId
                );
            }

            this.logger.log(`Successfully cleaned up all creative files for inventory ${inventoryId}`);
        } catch (error) {
            this.logger.error(`Error handling inventory deletion: ${error.message}`, error.stack);
            throw error;
        }
    }
}