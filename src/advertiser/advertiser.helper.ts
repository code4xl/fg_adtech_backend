import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import sharp from 'sharp';
import { ResourceNotFoundException } from 'src/common/exceptions/custom.exception';
import { CreativeType, InventoryFormat } from '@prisma/client';

@Injectable()
export class AdvertiserHelper {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Validates campaign dates to ensure they are logical and not in the past
     */
    async validateCampaignDates(startDate: Date | string, endDate: Date | string) {
        // Convert to Date objects if strings are provided
        const start = new Date(startDate);
        const end = new Date(endDate);

        // Get current date and set time to beginning of day (00:00:00)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Validate start date is not in the past (allow today)
        if (start < today) {
            throw new BadRequestException('Campaign start date cannot be in the past');
        }

        // Validate end date is after start date
        if (end <= start) {
            throw new BadRequestException('Campaign end date must be after start date');
        }

        // Additional validation: campaign duration should be reasonable (not too short or too long)
        const durationInDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

        if (durationInDays < 1) {
            throw new BadRequestException('Campaign duration must be at least 1 day');
        }

        if (durationInDays > 365) {
            throw new BadRequestException('Campaign duration cannot exceed 365 days');
        }
    }

    /**
     * Validates that a client belongs to the specified advertiser
     */
    async validateClient(clientId: string, advertiserId: string) {
        const client = await this.prisma.client.findUnique({
            where: { id: clientId },
            select: {
                id: true,
                advertiserId: true,
                name: true,
                companyName: true
            }
        });

        if (!client) {
            throw new ResourceNotFoundException('Client', clientId);
        }

        if (client.advertiserId !== advertiserId) {
            throw new ForbiddenException('You do not have access to this client');
        }

        return client;
    }

    /**
     * Validates bid strategy and ensures bid amount is provided when required
     */
    async validateBidStrategy(bidStrategy: string, bidAmount: number | undefined) {
        // If using BID_CAP, COST_CAP, or TARGET_COST, bid amount is required
        if (['BID_CAP', 'COST_CAP', 'TARGET_COST'].includes(bidStrategy) && bidAmount === undefined) {
            throw new BadRequestException(`Bid amount is required for ${bidStrategy} strategy`);
        }

        // Validate bid amount is positive if provided
        if (bidAmount !== undefined && bidAmount <= 0) {
            throw new BadRequestException('Bid amount must be greater than 0');
        }

        // Validate reasonable bid amount limits
        if (bidAmount !== undefined && bidAmount > 1000) {
            throw new BadRequestException('Bid amount cannot exceed $1000');
        }
    }

    /**
     * Validates campaign budget constraints
     */
    async validateBudget(budget: number, dailyBudget?: number) {
        // Validate total budget
        if (budget <= 0) {
            throw new BadRequestException('Campaign budget must be greater than 0');
        }

        if (budget > 1000000) {
            throw new BadRequestException('Campaign budget cannot exceed $1,000,000');
        }

        // Validate daily budget if provided
        if (dailyBudget !== undefined) {
            if (dailyBudget <= 0) {
                throw new BadRequestException('Daily budget must be greater than 0');
            }

            if (dailyBudget > budget) {
                throw new BadRequestException('Daily budget cannot exceed total campaign budget');
            }

            // Minimum daily budget should be reasonable
            if (dailyBudget < 1) {
                throw new BadRequestException('Daily budget must be at least $1');
            }
        }
    }

    /**
     * Verifies campaign ownership by advertiser
     */
    async verifyCampaignOwnership(campaignId: string, advertiserId: string) {
        const campaign = await this.prisma.campaign.findUnique({
            where: { id: campaignId },
            select: {
                id: true,
                name: true,
                advertiserId: true,
                status: true,
                startDate: true,
                endDate: true
            }
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
 * Get image dimensions from buffer
 * @param buffer Image buffer
 * @returns Promise with width and height
 */
    async getImageDimensions(buffer: Buffer) {
        try {
            const metadata = await sharp(buffer).metadata();

            if (!metadata.width || !metadata.height) {
                throw new Error('Unable to extract image dimensions');
            }

            return {
                width: metadata.width,
                height: metadata.height,
            };
        } catch (error) {
            throw new Error(`Failed to get image dimensions: ${error.message}`);
        }
    }

    // src/common/utils/string.helper.ts

    /**
     * Convert string to URL-friendly slug
     * @param text Input string
     * @returns Slugified string
     */
    async slugify(text: string) {
        return text
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')           // Replace spaces with -
            .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
            .replace(/\-\-+/g, '-')         // Replace multiple - with single -
            .replace(/^-+/, '')             // Trim - from start of text
            .replace(/-+$/, '');            // Trim - from end of text
    }

    /**
     * Generate unique filename with timestamp
     * @param originalName Original filename
     * @param prefix Optional prefix
     * @returns Unique filename
     */
    async generateUniqueFilename(originalName: string, prefix?: string) {
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 8);
        const extension = originalName.split('.').pop();
        const nameWithoutExtension = originalName.replace(/\.[^/.]+$/, '');

        const slugifiedName = this.slugify(nameWithoutExtension);
        const prefixPart = prefix ? `${this.slugify(prefix)}-` : '';

        return `${prefixPart}${slugifiedName}-${timestamp}-${randomString}.${extension}`;
    }

    /**
     * Validate image file type
     * @param mimetype File mimetype
     * @returns Boolean indicating if valid image
     */
    async isValidImageType(mimetype: string) {
        const allowedTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/svg+xml'
        ];

        return allowedTypes.includes(mimetype.toLowerCase());
    }

    /**
     * Validate HTML file type
     * @param mimetype File mimetype
     * @returns Boolean indicating if valid HTML
     */
    async isValidHtmlType(mimetype: string) {
        const allowedTypes = [
            'text/html',
            'application/zip', // For HTML5 packages
            'application/x-zip-compressed'
        ];

        return allowedTypes.includes(mimetype.toLowerCase());
    }

    /**
     * Validate video file type
     * @param mimetype File mimetype
     * @returns Boolean indicating if valid video
     */
    async isValidVideoType(mimetype: string) {
        const allowedTypes = [
            'video/mp4',
            'video/webm',
            'video/ogg',
            'video/avi',
            'video/mov',
            'video/wmv'
        ];

        return allowedTypes.includes(mimetype.toLowerCase());
    }

    async validateCreativeCompatibility(creativeType: CreativeType, inventoryFormat: InventoryFormat) {
        const compatibilityMatrix = {
            BANNER: ['IMAGE', 'HTML5', 'HTML', 'RICH_MEDIA'],
            NATIVE: ['IMAGE', 'HTML', 'RICH_MEDIA'],
            VIDEO: ['VIDEO'],
            INTERSTITIAL: ['IMAGE', 'HTML5', 'VIDEO', 'RICH_MEDIA'],
            REWARDED: ['VIDEO', 'RICH_MEDIA']
        };

        return compatibilityMatrix[inventoryFormat]?.includes(creativeType) || false;
    };
}