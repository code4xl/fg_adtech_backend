import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
    GetObjectCommand,
    CopyObjectCommand,
    ListObjectsV2Command,
    DeleteObjectsCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3StorageService {
    private readonly logger = new Logger(S3StorageService.name);
    private readonly s3Client: S3Client;
    private readonly bucketName: string;
    private readonly region: string;

    constructor(private configService: ConfigService) {
        this.region = this.configService.get<string>('AWS.AWS_BUCKET_REGION')!;
        this.bucketName = this.configService.get<string>('AWS.AWS_S3_BUCKET_NAME')!;

        console.log(`AWS_S3_BUCKET_NAME: ${this.bucketName}`);
        console.log(`AWS_BUCKET_REGION: ${this.region}`);

        if (!this.bucketName) {
            this.logger.error('AWS_S3_BUCKET_NAME is not defined in environment variables');
        }

        this.s3Client = new S3Client({
            region: this.region,
            credentials: {
                accessKeyId: this.configService.get<string>('AWS.AWS_ACCESS_KEY_ID')!,
                secretAccessKey: this.configService.get<string>('AWS.AWS_SECRET_ACCESS_KEY')!,
            },
        });
    }

    /**
     * Upload a file to S3
     * @param fileBuffer The file buffer to upload
     * @param key The S3 object key (path + filename)
     * @param contentType The content type of the file
     * @returns The S3 object key
     */
    async uploadFile(
        fileBuffer: Buffer,
        key: string,
        contentType: string = 'text/csv'
    ): Promise<string> {
        try {
            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: fileBuffer,
                ContentType: contentType,
            });

            await this.s3Client.send(command);
            this.logger.log(`File uploaded successfully to S3: ${key}`);
            return key;
        } catch (error) {
            this.logger.error(`Error uploading file to S3: ${error.message}`, error.stack);
            throw new Error(`Failed to upload file to S3: ${error.message}`);
        }
    }

    /**
     * Delete a file from S3
     * @param key The S3 object key to delete
     * @returns Boolean indicating success
     */
    async deleteFile(key: string): Promise<boolean> {
        try {
            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });

            await this.s3Client.send(command);
            this.logger.log(`File deleted successfully from S3: ${key}`);
            return true;
        } catch (error) {
            this.logger.error(`Error deleting file from S3: ${error.message}`, error.stack);
            return false;
        }
    }

    /**
     * Check if a file exists in S3
     * @param key The S3 object key to check
     * @returns Boolean indicating if the file exists
     */
    async fileExists(key: string): Promise<boolean> {
        try {
            const command = new HeadObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });

            await this.s3Client.send(command);
            return true;
        } catch (error) {
            if (error.name === 'NotFound') {
                return false;
            }
            this.logger.error(`Error checking if file exists in S3: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Generate a pre-signed URL for downloading a file
     * @param key The S3 object key
     * @param expiresIn Expiration time in seconds (default: 3600 seconds / 1 hour)
     * @returns The pre-signed URL
     */
    async getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
        try {
            // Check if file exists before generating presigned URL
            const exists = await this.fileExists(key);

            if (!exists) {
                throw new Error(`File does not exist in S3: ${key}`);
            }

            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });

            const presignedUrl = await getSignedUrl(this.s3Client, command, {
                expiresIn
            });

            this.logger.log(`Pre-signed URL generated for: ${key}`);
            return presignedUrl;
        } catch (error) {
            this.logger.error(`Error generating pre-signed URL: ${error.message}`, error.stack);
            throw new Error(`Failed to generate pre-signed URL: ${error.message}`);
        }
    }

    /**
     * Generate a key for storing a campaign audience file
     * @param campaignName The name of the campaign
     * @param campaignId The ID of the campaign
     * @returns The S3 key for the audience file
     */
    generateCampaignAudienceKey(campaignName: string, campaignId: string): string {
        // Sanitize the campaign name to make it suitable for use in a file path
        const sanitizedName = this.sanitizeFileName(campaignName);
        return `uploads/campaigns/${sanitizedName}-${campaignId}/audience.csv`;
    }

    /**
     * Copy an object from one location to another within the same bucket
     * @param sourceKey Source S3 object key
     * @param destinationKey Destination S3 object key
     * @returns Boolean indicating success
     */
    async copyObject(sourceKey: string, destinationKey: string): Promise<boolean> {
        try {
            const command = new CopyObjectCommand({
                Bucket: this.bucketName,
                CopySource: `${this.bucketName}/${sourceKey}`,
                Key: destinationKey,
            });

            await this.s3Client.send(command);
            this.logger.log(`File copied successfully from ${sourceKey} to ${destinationKey}`);
            return true;
        } catch (error) {
            this.logger.error(`Error copying file in S3: ${error.message}`, error.stack);
            throw new Error(`Failed to copy file in S3: ${error.message}`);
        }
    }

    /**
     * Generate a key for storing a creative file
     * @param campaignName The name of the campaign 
     * @param campaignId The ID of the campaign
     * @param inventoryName The name of the inventory
     * @param inventoryId The ID of the inventory
     * @param filename The creative filename
     * @returns The S3 key for the creative file
     */
    generateCreativeKey(
        campaignName: string,
        campaignId: string,
        inventoryName: string,
        inventoryId: string,
        filename: string
    ): string {
        const sanitizedCampaignName = this.sanitizeFileName(campaignName);
        const sanitizedInventoryName = this.sanitizeFileName(inventoryName);

        return `uploads/campaigns/${sanitizedCampaignName}-${campaignId}/inventories/${sanitizedInventoryName}-${inventoryId}/${filename}`;
    }

    /**
     * Check if an inventory folder is empty
     * @param campaignName The name of the campaign
     * @param campaignId The ID of the campaign
     * @param inventoryName The name of the inventory
     * @param inventoryId The ID of the inventory
     * @returns Boolean indicating if the folder is empty
     */
    async isInventoryFolderEmpty(
        campaignName: string,
        campaignId: string,
        inventoryName: string,
        inventoryId: string
    ): Promise<boolean> {
        try {
            const sanitizedCampaignName = this.sanitizeFileName(campaignName);
            const sanitizedInventoryName = this.sanitizeFileName(inventoryName);
            const prefix = `uploads/campaigns/${sanitizedCampaignName}-${campaignId}/inventories/${sanitizedInventoryName}-${inventoryId}/`;

            const command = new ListObjectsV2Command({
                Bucket: this.bucketName,
                Prefix: prefix,
                MaxKeys: 2 // We only need to know if there's at least one object
            });

            const response = await this.s3Client.send(command);

            // If there are no contents or the only content is the folder itself, the folder is empty
            return !response.Contents || response.Contents.length === 0 ||
                (response.Contents.length === 1 && response.Contents[0].Key === prefix);
        } catch (error) {
            this.logger.error(`Error checking if inventory folder is empty: ${error.message}`, error.stack);
            throw new Error(`Failed to check if inventory folder is empty: ${error.message}`);
        }
    }

    /**
     * Delete an inventory folder and all its contents
     * @param campaignName The name of the campaign
     * @param campaignId The ID of the campaign
     * @param inventoryName The name of the inventory
     * @param inventoryId The ID of the inventory
     * @returns Boolean indicating success
     */
    async deleteInventoryFolder(
        campaignName: string,
        campaignId: string,
        inventoryName: string,
        inventoryId: string
    ): Promise<boolean> {
        try {
            const sanitizedCampaignName = this.sanitizeFileName(campaignName);
            const sanitizedInventoryName = this.sanitizeFileName(inventoryName);
            const prefix = `uploads/campaigns/${sanitizedCampaignName}-${campaignId}/inventories/${sanitizedInventoryName}-${inventoryId}/`;

            // First, list all objects in the folder
            const listCommand = new ListObjectsV2Command({
                Bucket: this.bucketName,
                Prefix: prefix
            });

            const response = await this.s3Client.send(listCommand);

            if (!response.Contents || response.Contents.length === 0) {
                this.logger.log(`No objects found in inventory folder: ${prefix}`);
                return true;
            }

            // Create an array of objects to delete
            const objects = response.Contents.map(obj => ({ Key: obj.Key }));

            const deleteCommand = new DeleteObjectsCommand({
                Bucket: this.bucketName,
                Delete: { Objects: objects }
            });

            await this.s3Client.send(deleteCommand);
            this.logger.log(`Inventory folder deleted successfully: ${prefix}`);

            return true;
        } catch (error) {
            this.logger.error(`Error deleting inventory folder: ${error.message}`, error.stack);
            return false;
        }
    }

    /**
     * Move all creatives from one inventory folder to another
     * @param campaignName The name of the campaign
     * @param campaignId The ID of the campaign
     * @param oldInventoryName The old inventory name
     * @param inventoryId The inventory ID
     * @param newInventoryName The new inventory name
     * @returns Boolean indicating success
     */
    async moveInventoryFolder(
        campaignName: string,
        campaignId: string,
        oldInventoryName: string,
        inventoryId: string,
        newInventoryName: string
    ): Promise<boolean> {
        try {
            const sanitizedCampaignName = this.sanitizeFileName(campaignName);
            const sanitizedOldInventoryName = this.sanitizeFileName(oldInventoryName);
            const sanitizedNewInventoryName = this.sanitizeFileName(newInventoryName);

            const sourcePrefix = `uploads/campaigns/${sanitizedCampaignName}-${campaignId}/inventories/${sanitizedOldInventoryName}-${inventoryId}/`;
            const destPrefix = `uploads/campaigns/${sanitizedCampaignName}-${campaignId}/inventories/${sanitizedNewInventoryName}-${inventoryId}/`;

            // List all objects in the source folder
            const listCommand = new ListObjectsV2Command({
                Bucket: this.bucketName,
                Prefix: sourcePrefix
            });

            const response = await this.s3Client.send(listCommand);

            if (!response.Contents || response.Contents.length === 0) {
                this.logger.log(`No objects found in inventory folder to move: ${sourcePrefix}`);
                return true;
            }

            // Copy each object to the new location and then delete the original
            for (const object of response.Contents) {
                const sourceKey = object.Key!;
                const filename = sourceKey.split('/').pop();
                const destinationKey = `${destPrefix}${filename}`;

                // Copy to new location
                await this.copyObject(sourceKey, destinationKey);

                // Delete from old location
                await this.deleteFile(sourceKey);
            }

            this.logger.log(`Inventory folder moved successfully from ${sourcePrefix} to ${destPrefix}`);
            return true;
        } catch (error) {
            this.logger.error(`Error moving inventory folder: ${error.message}`, error.stack);
            return false;
        }
    }

    /**
     * Get a list of all creative files in an inventory folder
     * @param campaignName The name of the campaign
     * @param campaignId The ID of the campaign
     * @param inventoryName The name of the inventory
     * @param inventoryId The ID of the inventory
     * @returns Array of file keys
     */
    async listCreativeFiles(
        campaignName: string,
        campaignId: string,
        inventoryName: string,
        inventoryId: string
    ): Promise<string[]> {
        try {
            const sanitizedCampaignName = this.sanitizeFileName(campaignName);
            const sanitizedInventoryName = this.sanitizeFileName(inventoryName);
            const prefix = `uploads/campaigns/${sanitizedCampaignName}-${campaignId}/inventories/${sanitizedInventoryName}-${inventoryId}/`;

            const command = new ListObjectsV2Command({
                Bucket: this.bucketName,
                Prefix: prefix
            });

            const response = await this.s3Client.send(command);

            if (!response.Contents || response.Contents.length === 0) {
                return [];
            }

            return response.Contents
                .map(obj => obj.Key)
                .filter((key): key is string => typeof key === 'string');
        } catch (error) {
            this.logger.error(`Error listing creative files: ${error.message}`, error.stack);
            throw new Error(`Failed to list creative files: ${error.message}`);
        }
    }

    /**
     * Generate a public URL for a creative file
     * @param key The S3 object key
     * @returns The public URL
     */
    getPublicUrl(key: string): string {
        const cdnDomain = this.configService.get<string>('AWS.CLOUDFRONT_DOMAIN');

        if (cdnDomain) {
            // If we have a CloudFront distribution, use that
            return `https://${cdnDomain}/${key}`;
        }

        // Otherwise, use the direct S3 URL
        return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
    }

    /**
     * Sanitize a filename to make it suitable for use in S3 key
     * @param filename The filename to sanitize
     * @returns The sanitized filename
     */
    private sanitizeFileName(filename: string): string {
        return filename
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric chars with hyphens
            .replace(/-+/g, '-')        // Replace multiple hyphens with a single one
            .replace(/^-|-$/g, '');     // Remove leading/trailing hyphens
    }
}