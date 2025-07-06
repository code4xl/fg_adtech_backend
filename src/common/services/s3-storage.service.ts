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
  DeleteObjectsCommand,
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

    // console.log(`AWS_S3_BUCKET_NAME: ${this.bucketName}`);
    // console.log(`AWS_BUCKET_REGION: ${this.region}`);

    if (!this.bucketName) {
      this.logger.error(
        'AWS_S3_BUCKET_NAME is not defined in environment variables',
      );
    }

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS.AWS_ACCESS_KEY_ID')!,
        secretAccessKey: this.configService.get<string>(
          'AWS.AWS_SECRET_ACCESS_KEY',
        )!,
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
    contentType: string = 'application/octet-stream',
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      });

      await this.s3Client.send(command);
      this.logger.debug(`File uploaded successfully to S3: ${key}`);
      return key;
    } catch (error) {
      this.logger.error(
        `Error uploading file to S3: ${error.message}`,
        error.stack,
      );
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
      this.logger.debug(`File deleted successfully from S3: ${key}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Error deleting file from S3: ${error.message}`,
        error.stack,
      );
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
      this.logger.error(
        `Error checking if file exists in S3: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Generate a pre-signed URL for downloading a file
   * @param key The S3 object key
   * @param expiresIn Expiration time in seconds (default: 3600 seconds / 1 hour)
   * @returns The pre-signed URL
   */
  async getPresignedUrl(
    key: string,
    expiresIn: number = 3600,
  ): Promise<string> {
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
        expiresIn,
      });

      this.logger.debug(`Pre-signed URL generated for: ${key}`);
      return presignedUrl;
    } catch (error) {
      this.logger.error(
        `Error generating pre-signed URL: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to generate pre-signed URL: ${error.message}`);
    }
  }

  /**
   * Copy an object from one location to another within the same bucket
   * @param sourceKey Source S3 object key
   * @param destinationKey Destination S3 object key
   * @returns Boolean indicating success
   */
  async copyObject(
    sourceKey: string,
    destinationKey: string,
  ): Promise<boolean> {
    try {
      const command = new CopyObjectCommand({
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${sourceKey}`,
        Key: destinationKey,
      });

      await this.s3Client.send(command);
      this.logger.debug(
        `File copied successfully from ${sourceKey} to ${destinationKey}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Error copying file in S3: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to copy file in S3: ${error.message}`);
    }
  }

  // ========================================
  // CAMPAIGN AND CREATIVE MANAGEMENT
  // ========================================

  /**
   * Create the initial campaign folder structure
   * @param campaignName The name of the campaign
   * @param campaignId The ID of the campaign
   * @returns Boolean indicating success
   */
  async createCampaignFolder(
    campaignName: string,
    campaignId: string,
  ): Promise<boolean> {
    try {
      const sanitizedName = this.sanitizeFileName(campaignName);
      const folderKey = `uploads/campaigns/${sanitizedName}-${campaignId}/`;

      // Create an empty folder by uploading a placeholder file
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: `${folderKey}.keep`,
        Body: Buffer.from('Campaign folder'),
        ContentType: 'text/plain',
      });

      await this.s3Client.send(command);
      this.logger.debug(`Campaign folder created successfully: ${folderKey}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Error creating campaign folder: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to create campaign folder: ${error.message}`);
    }
  }

  /**
   * Generate a key for storing a creative file
   * @param campaignName The name of the campaign
   * @param campaignId The ID of the campaign
   * @param filename The creative filename with extension
   * @returns The S3 key for the creative file
   */
  generateCreativeKey(
    campaignName: string,
    campaignId: string,
    filename: string,
  ): string {
    const sanitizedCampaignName = this.sanitizeFileName(campaignName);
    const sanitizedFilename = this.sanitizeFileName(filename);

    return `uploads/campaigns/${sanitizedCampaignName}-${campaignId}/creatives/${sanitizedFilename}`;
  }

  /**
   * Upload and store a creative file
   * @param fileBuffer The creative file buffer
   * @param campaignName The campaign name
   * @param campaignId The campaign ID
   * @param filename The original filename
   * @param contentType The file content type
   * @returns The S3 key where the file was stored
   */
  async uploadCreativeFile(
    fileBuffer: Buffer,
    campaignName: string,
    campaignId: string,
    filename: string,
    contentType: string,
  ): Promise<string> {
    try {
      // Ensure campaign folder exists
      await this.createCampaignFolder(campaignName, campaignId);

      // Generate the S3 key for the creative
      const s3Key = this.generateCreativeKey(
        campaignName,
        campaignId,
        filename,
      );

      // Upload the file
      await this.uploadFile(fileBuffer, s3Key, contentType);

      this.logger.debug(`Creative uploaded successfully: ${s3Key}`);
      return s3Key;
    } catch (error) {
      this.logger.error(
        `Error uploading creative: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to upload creative: ${error.message}`);
    }
  }

  /**
   * Delete a creative file
   * @param s3Key The S3 key of the file to delete
   * @returns Boolean indicating success
   */
  async deleteCreativeFile(s3Key: string): Promise<boolean> {
    try {
      const deleted = await this.deleteFile(s3Key);

      if (deleted) {
        this.logger.debug(`Creative file deleted successfully: ${s3Key}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(
        `Error deleting creative file: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Delete an entire campaign folder and all its contents
   * @param campaignName The campaign name
   * @param campaignId The campaign ID
   * @returns Boolean indicating success
   */
  async deleteCampaignFolder(
    campaignName: string,
    campaignId: string,
  ): Promise<boolean> {
    try {
      const sanitizedName = this.sanitizeFileName(campaignName);
      const prefix = `uploads/campaigns/${sanitizedName}-${campaignId}/`;

      // List all objects with this prefix
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
      });

      const response = await this.s3Client.send(listCommand);

      if (!response.Contents || response.Contents.length === 0) {
        this.logger.debug(`No objects found in campaign folder: ${prefix}`);
        return true;
      }

      // Delete all objects in batches (S3 allows max 1000 objects per delete)
      const objects = response.Contents.map((obj) => ({ Key: obj.Key }));

      for (let i = 0; i < objects.length; i += 1000) {
        const batch = objects.slice(i, i + 1000);
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: this.bucketName,
          Delete: { Objects: batch },
        });

        await this.s3Client.send(deleteCommand);
      }

      this.logger.debug(`Campaign folder deleted successfully: ${prefix}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Error deleting campaign folder: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Get a list of all creative files in a campaign
   * @param campaignName The campaign name
   * @param campaignId The campaign ID
   * @returns Array of creative file keys
   */
  async listCampaignCreatives(
    campaignName: string,
    campaignId: string,
  ): Promise<string[]> {
    try {
      const sanitizedName = this.sanitizeFileName(campaignName);
      const prefix = `uploads/campaigns/${sanitizedName}-${campaignId}/creatives/`;

      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
      });

      const response = await this.s3Client.send(command);

      if (!response.Contents || response.Contents.length === 0) {
        return [];
      }

      return response.Contents.map((obj) => obj.Key).filter(
        (key): key is string => typeof key === 'string',
      );
    } catch (error) {
      this.logger.error(
        `Error listing campaign creatives: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to list campaign creatives: ${error.message}`);
    }
  }

  /**
   * Move/rename a campaign folder when campaign name changes
   * @param oldCampaignName The old campaign name
   * @param newCampaignName The new campaign name
   * @param campaignId The campaign ID
   * @returns Boolean indicating success
   */
  async renameCampaignFolder(
    oldCampaignName: string,
    newCampaignName: string,
    campaignId: string,
  ): Promise<boolean> {
    try {
      const oldSanitizedName = this.sanitizeFileName(oldCampaignName);
      const newSanitizedName = this.sanitizeFileName(newCampaignName);

      const sourcePrefix = `uploads/campaigns/${oldSanitizedName}-${campaignId}/`;
      const destPrefix = `uploads/campaigns/${newSanitizedName}-${campaignId}/`;

      // If names are the same after sanitization, no need to move
      if (oldSanitizedName === newSanitizedName) {
        return true;
      }

      // List all objects in the source folder
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: sourcePrefix,
      });

      const response = await this.s3Client.send(listCommand);

      if (!response.Contents || response.Contents.length === 0) {
        this.logger.debug(
          `No objects found in campaign folder to move: ${sourcePrefix}`,
        );
        return true;
      }

      // Copy each object to the new location and then delete the original
      for (const object of response.Contents) {
        const sourceKey = object.Key!;
        const relativePath = sourceKey.substring(sourcePrefix.length);
        const destinationKey = `${destPrefix}${relativePath}`;

        // Copy to new location
        await this.copyObject(sourceKey, destinationKey);

        // Delete from old location
        await this.deleteFile(sourceKey);
      }

      this.logger.debug(
        `Campaign folder renamed successfully from ${sourcePrefix} to ${destPrefix}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Error renaming campaign folder: ${error.message}`,
        error.stack,
      );
      return false;
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
   * Get campaign folder statistics
   * @param campaignName The campaign name
   * @param campaignId The campaign ID
   * @returns Object with folder statistics
   */
  async getCampaignFolderStats(
    campaignName: string,
    campaignId: string,
  ): Promise<{
    totalFiles: number;
    totalSize: number;
    creativeCount: number;
  }> {
    try {
      const sanitizedName = this.sanitizeFileName(campaignName);
      const prefix = `uploads/campaigns/${sanitizedName}-${campaignId}/`;

      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
      });

      const response = await this.s3Client.send(command);

      if (!response.Contents || response.Contents.length === 0) {
        return {
          totalFiles: 0,
          totalSize: 0,
          creativeCount: 0,
        };
      }

      const totalFiles = response.Contents.length;
      const totalSize = response.Contents.reduce(
        (sum, obj) => sum + (obj.Size || 0),
        0,
      );
      const creativeCount = response.Contents.filter((obj) =>
        obj.Key?.includes('/creatives/'),
      ).length;

      return {
        totalFiles,
        totalSize,
        creativeCount,
      };
    } catch (error) {
      this.logger.error(
        `Error getting campaign folder stats: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get campaign folder stats: ${error.message}`);
    }
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
      .replace(/-+/g, '-') // Replace multiple hyphens with a single one
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  }
}
