import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreativeStatus, CreativeType } from '@prisma/client';
import { ResourceNotFoundException } from '../common/exceptions/custom.exception';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import * as mime from 'mime-types';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import sharp from 'sharp'; // Add sharp for image processing

// Convert callback-based fs functions to Promise-based
const mkdir = util.promisify(fs.mkdir);
const writeFile = util.promisify(fs.writeFile);
const stat = util.promisify(fs.stat);

@Injectable()
export class CreativeHelperService {
    private readonly logger = new Logger(CreativeHelperService.name);
    private readonly baseUploadPath: string;
    private readonly serverUrl: string;

    // Configuration constants - made public so they can be accessed from service
    public readonly MAX_FILE_SIZES = {
        IMAGE: 500 * 1024, // 500KB for images
        VIDEO: 5 * 1024 * 1024, // 5MB for videos
        HTML: 1024 * 1024, // 1MB for HTML creatives
        RICH_MEDIA: 2 * 1024 * 1024, // 2MB for rich media
        NATIVE: 500 * 1024, // 500KB for native ads
    };

    public readonly ALLOWED_FILE_TYPES = {
        IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        VIDEO: ['video/mp4', 'video/webm', 'video/ogg'],
        HTML: ['text/html', 'application/zip'],
        RICH_MEDIA: ['application/zip', 'text/html'],
        NATIVE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    };

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService
    ) {
        // Initialize base upload path and ensure it exists
        this.baseUploadPath = path.join(process.cwd(), 'uploads');
        this.serverUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';

        // Create base upload directory if it doesn't exist
        if (!fs.existsSync(this.baseUploadPath)) {
            fs.mkdirSync(this.baseUploadPath, { recursive: true });
        }
    }

    /**
 * Store the creative file in the appropriate location with descriptive folder names
 */
    async storeCreativeFile(
        file: Express.Multer.File,
        campaignId: string,
        campaignName: string,
        inventoryId: string,
        inventoryName: string
    ): Promise<string> {
        // Sanitize names for filesystem use
        const safeCampaignName = this.slugify(campaignName);
        const safeInventoryName = this.slugify(inventoryName);

        // Create directory structure: uploads/campaign-name-campaignId/inventory-name-inventoryId/
        const dirPath = path.join(
            this.baseUploadPath,
            `${safeCampaignName}-${campaignId}`,
            `${safeInventoryName}-${inventoryId}`
        );

        await mkdir(dirPath, { recursive: true });

        // Generate unique filename
        const timestamp = Date.now();
        const fileExt = mime.extension(file.mimetype) || path.extname(file.originalname).substring(1);
        const filename = `creative-${timestamp}.${fileExt}`;
        const filePath = path.join(dirPath, filename);

        // Write file to disk
        await writeFile(filePath, file.buffer);

        // Return the URL relative to the server
        return `${this.serverUrl}/uploads/${safeCampaignName}-${campaignId}/${safeInventoryName}-${inventoryId}/${filename}`;
    }

    /**
     * Get dimensions from an uploaded image file
     */
    async getImageDimensions(file: Express.Multer.File): Promise<{ width: number, height: number }> {
        try {
            // Use sharp to extract image metadata
            const metadata = await sharp(file.buffer).metadata();

            if (!metadata.width || !metadata.height) {
                throw new BadRequestException('Could not determine image dimensions');
            }

            return {
                width: metadata.width,
                height: metadata.height
            };
        } catch (error) {
            this.logger.error(`Error extracting image dimensions: ${error.message}`);
            throw new BadRequestException(`Unable to process image: ${error.message}`);
        }
    }

    /**
     * Comprehensive creative validation process
     */
    async validateCreativeContent(creativeId: string) {
        try {
            const creative = await this.prisma.creative.findUnique({
                where: { id: creativeId },
                include: {
                    inventory: true,
                    campaign: {
                        include: {
                            advertiser: true
                        }
                    }
                }
            });

            if (!creative) {
                throw new ResourceNotFoundException('Creative', creativeId);
            }

            this.logger.log(`Starting content validation for creative: ${creativeId}`);

            // Perform performance validation
            await this.validatePerformance(creative);

            // Perform content safety analysis
            await this.validateContentSafety(creative);

            // Perform brand safety verification
            await this.validateBrandSafety(creative);

            // If all validations pass, update to APPROVED status
            return await this.prisma.creative.update({
                where: { id: creativeId },
                data: {
                    status: CreativeStatus.APPROVED,
                    reviewNotes: 'Automatically approved by system'
                }
            });
        } catch (error) {
            this.logger.error(`Validation failed for creative ${creativeId}: ${error.message}`);

            // Update creative with rejection reason
            await this.prisma.creative.update({
                where: { id: creativeId },
                data: {
                    status: CreativeStatus.REJECTED,
                    reviewNotes: `Rejected: ${error.message}`
                }
            });
        }
    }

    /**
     * Validate performance aspects of the creative
     */
    private async validatePerformance(creative: any): Promise<void> {
        try {
            // Extract the file path from URL
            const fileUrl = creative.fileUrl;

            // For simplicity, we'll just check if the file exists and is accessible
            // In a production environment, you'd use more sophisticated load time testing

            // If it's a local file
            if (fileUrl.startsWith(this.serverUrl)) {
                const localPath = fileUrl.replace(this.serverUrl, process.cwd());
                const fileStats = await stat(localPath);

                // Simple check: file should exist and be non-empty
                if (!fileStats.isFile() || fileStats.size === 0) {
                    throw new BadRequestException('Creative file is not accessible or empty');
                }
            } else {
                // If it's a remote file, try to access it
                const response = await axios.head(fileUrl, { timeout: 5000 });

                if (response.status !== 200) {
                    throw new BadRequestException('Creative file is not accessible');
                }
            }

            this.logger.log(`Performance validation passed for creative: ${creative.id}`);
        } catch (error) {
            throw new BadRequestException(`Performance validation failed: ${error.message}`);
        }
    }

    /**
     * Validate content safety aspects of the creative
     */
    private async validateContentSafety(creative: any): Promise<void> {
        try {
            // NOTE: In a production environment, you would integrate with a content
            // moderation API like Google Cloud Vision API, Amazon Rekognition, etc.

            // For demonstration, we'll implement a basic check
            const fileUrl = creative.fileUrl;

            // Basic check: validate the landing URL 
            if (creative.landingUrl) {
                // Check if the landing URL is valid
                const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;

                if (!urlPattern.test(creative.landingUrl)) {
                    throw new BadRequestException('Invalid landing URL format');
                }

                // Check for commonly blocked domains (example)
                const blockedDomains = ['malware.com', 'phishing.com', 'scam.com'];
                const urlDomain = new URL(creative.landingUrl).hostname;

                if (blockedDomains.some(domain => urlDomain.includes(domain))) {
                    throw new BadRequestException('Landing URL domain is blocked');
                }
            }

            this.logger.log(`Content safety validation passed for creative: ${creative.id}`);
        } catch (error) {
            throw new BadRequestException(`Content safety validation failed: ${error.message}`);
        }
    }

    /**
     * Validate brand safety aspects of the creative
     */
    private async validateBrandSafety(creative: any): Promise<void> {
        try {
            // NOTE: In a production environment, you would integrate with brand
            // safety verification services or have more sophisticated checks

            // For demonstration, we'll implement a basic check based on advertiser reputation
            const advertiser = creative.campaign.advertiser;

            // Example: Check if advertiser is properly verified
            if (!advertiser) {
                throw new BadRequestException('Advertiser information not found');
            }

            // Example risk score calculation - in real system this would be based on historical data
            const riskScore = 0.2; // Low risk score (0-1 scale)

            if (riskScore > 0.8) {
                throw new BadRequestException('Advertiser has high risk score');
            }

            this.logger.log(`Brand safety validation passed for creative: ${creative.id}`);
        } catch (error) {
            throw new BadRequestException(`Brand safety validation failed: ${error.message}`);
        }
    }

    slugify(text: string): string {
        return text
            .toString()                  // Convert to string
            .toLowerCase()               // Convert to lowercase
            .trim()                      // Remove whitespace from both ends
            .replace(/\s+/g, '-')        // Replace spaces with -
            .replace(/[^\w\-]+/g, '')    // Remove all non-word chars
            .replace(/\-\-+/g, '-')      // Replace multiple - with single -
            .replace(/^-+/, '')          // Trim - from start of text
            .replace(/-+$/, '');         // Trim - from end of text
    }

    truncate(text: string, maxLength: number): string {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substr(0, maxLength) + '...';
    }


    randomString(length: number): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
}