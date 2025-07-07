import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ICdnStorageOptions,
  ICdnStorageMetadata,
  ICdnFileMetadata,
} from '../interfaces';
import { CDN_PATHS, CDN_CONTENT_TYPES } from '../constants/cdn.constants';

/**
 * Interface for S3 client (to be implemented with actual AWS SDK)
 */
interface IS3Client {
  putObject(params: {
    Bucket: string;
    Key: string;
    Body: Buffer | string;
    ContentType: string;
    CacheControl?: string;
    Metadata?: Record<string, string>;
  }): Promise<{ ETag: string }>;

  getObject(params: {
    Bucket: string;
    Key: string;
  }): Promise<{ Body: Buffer; Metadata?: Record<string, string> }>;

  deleteObject(params: { Bucket: string; Key: string }): Promise<void>;

  headObject(params: {
    Bucket: string;
    Key: string;
  }): Promise<{ ContentLength: number; LastModified: Date; ETag: string }>;
}

/**
 * Service responsible for storing and retrieving CDN files
 * Supports both local filesystem and S3 storage
 */
@Injectable()
export class CdnStorageService {
  private readonly logger = new Logger(CdnStorageService.name);
  private readonly storageType: 'local' | 's3';
  private readonly basePath: string;
  private readonly s3Config?: {
    bucket: string;
    region: string;
    accessKey: string;
    secretKey: string;
  };
  private s3Client?: IS3Client;

  constructor(private readonly configService: ConfigService) {
    this.storageType = this.configService.get<'local' | 's3'>('CDN_STORAGE_TYPE', 'local');
    this.basePath = this.configService.get<string>('cdn.storagePath', './cdn-files');

    if (this.storageType === 's3') {
      this.s3Config = {
        bucket: this.configService.get<string>('AWS_S3_BUCKET', ''),
        region: this.configService.get<string>('AWS_S3_REGION', 'us-east-1'),
        accessKey: this.configService.get<string>('AWS_S3_ACCESS_KEY', ''),
        secretKey: this.configService.get<string>('AWS_S3_SECRET_KEY', ''),
      };

      // Initialize S3 client (placeholder - implement with actual AWS SDK)
      // this.s3Client = new S3Client(this.s3Config);
      
      this.logger.debug('CDN Storage initialized with S3');
    } else {
      this.logger.debug(`CDN Storage initialized with local filesystem at ${this.basePath}`);
    }
  }

  /**
   * Store CDN file
   */
  async storeFile(
    publisherId: string,
    content: string,
    metadata: ICdnFileMetadata,
    options?: {
      environment?: string;
      overwrite?: boolean;
    },
  ): Promise<ICdnStorageMetadata> {
    const filePath = this.buildFilePath(publisherId, options?.environment);

    if (this.storageType === 's3') {
      return this.storeFileS3(filePath, content, metadata);
    } else {
      return this.storeFileLocal(
        filePath,
        content,
        metadata,
        options?.overwrite,
      );
    }
  }

  /**
   * Retrieve CDN file
   */
  async retrieveFile(
    publisherId: string,
    environment?: string,
  ): Promise<{ content: string; metadata: ICdnStorageMetadata }> {
    const filePath = this.buildFilePath(publisherId, environment);

    if (this.storageType === 's3') {
      return this.retrieveFileS3(filePath);
    } else {
      return this.retrieveFileLocal(filePath);
    }
  }

  /**
   * Delete CDN file and cleanup associated data
   */
  async deleteFile(publisherId: string, environment?: string): Promise<void> {
    const filePath = this.buildFilePath(publisherId, environment);

    if (this.storageType === 's3') {
      await this.deleteFileS3(filePath);
    } else {
      await this.deleteFileLocal(filePath);
    }

    // Also delete metadata
    try {
      const metadataPath = this.buildMetadataPath(publisherId, environment);
      if (this.storageType === 's3') {
        await this.deleteFileS3(metadataPath);
      } else {
        await this.deleteFileLocal(metadataPath);
      }
    } catch (error) {
      this.logger.warn(`Could not delete metadata for publisher ${publisherId}: ${error.message}`);
    }

    this.logger.debug(`✅ Deleted CDN file and metadata for publisher ${publisherId}`);
  }

  /**
   * Check if file exists
   */
  async fileExists(
    publisherId: string,
    environment?: string,
  ): Promise<boolean> {
    const filePath = this.buildFilePath(publisherId, environment);

    if (this.storageType === 's3') {
      return this.fileExistsS3(filePath);
    } else {
      return this.fileExistsLocal(filePath);
    }
  }

  /**
   * Store metadata file
   */
  async storeMetadata(
    publisherId: string,
    metadata: ICdnFileMetadata,
    environment?: string,
  ): Promise<void> {
    const metadataPath = this.buildMetadataPath(publisherId, environment);
    const content = JSON.stringify(metadata, null, 2);

    if (this.storageType === 's3') {
      await this.storeMetadataS3(metadataPath, content);
    } else {
      await this.storeMetadataLocal(metadataPath, content);
    }
  }

  /**
   * Retrieve metadata file
   */
  async retrieveMetadata(
    publisherId: string,
    environment?: string,
  ): Promise<ICdnFileMetadata | null> {
    const metadataPath = this.buildMetadataPath(publisherId, environment);

    try {
      if (this.storageType === 's3') {
        return await this.retrieveMetadataS3(metadataPath);
      } else {
        return await this.retrieveMetadataLocal(metadataPath);
      }
    } catch (error) {
      this.logger.debug(`Metadata not found for publisher ${publisherId}`);
      return null;
    }
  }

  /**
   * List all stored publishers
   */
  async listPublishers(environment?: string): Promise<string[]> {
    if (this.storageType === 's3') {
      return this.listPublishersS3(environment);
    } else {
      return this.listPublishersLocal(environment);
    }
  }

  /**
   * Store file locally with robust validation and atomic operations
   */
  private async storeFileLocal(
    filePath: string,
    content: string,
    metadata: ICdnFileMetadata,
    overwrite = true,
  ): Promise<ICdnStorageMetadata> {
    const fullPath = path.join(this.basePath, filePath);
    const dir = path.dirname(fullPath);
    const tempPath = fullPath + '.tmp';

    try {
      this.logger.debug(`Attempting to store CDN file: ${filePath}`);
      this.logger.debug(`Full path: ${fullPath}`);
      this.logger.debug(`Directory: ${dir}`);
      
      // Validate content before writing
      if (!content || content.length === 0) {
        throw new Error('Cannot store empty content');
      }

      if (content.length < 1000) {
        this.logger.warn(`Content seems unusually small: ${content.length} bytes`);
      }

      // Validate JavaScript syntax
      try {
        new Function(content);
      } catch (syntaxError) {
        throw new Error(`Content has JavaScript syntax errors: ${syntaxError.message}`);
      }

      // Force create directory structure with maximum permissions
      this.logger.debug(`Creating directory structure: ${dir}`);
      await fs.mkdir(dir, { recursive: true, mode: 0o755 });
      
      // Verify directory was created
      try {
        const dirStats = await fs.stat(dir);
        this.logger.debug(`Directory created successfully: ${dir} (${dirStats.isDirectory()})`);
      } catch (dirError) {
        throw new Error(`Failed to verify directory creation: ${dirError.message}`);
      }

      // Check if file exists and overwrite is false
      if (!overwrite) {
        try {
          await fs.access(fullPath);
          throw new Error(`File already exists: ${filePath}`);
        } catch (error) {
          if (error.code !== 'ENOENT') {
            throw error;
          }
        }
      }

      this.logger.debug(`Writing content to temporary file: ${tempPath}`);
      
      // Write to temporary file first (atomic operation) with explicit encoding
      await fs.writeFile(tempPath, content, { 
        encoding: 'utf8', 
        flag: 'w',
        mode: 0o644
      });

      // Verify the written content
      this.logger.debug(`Verifying written content...`);
      const writtenContent = await fs.readFile(tempPath, 'utf8');
      if (writtenContent.length !== content.length) {
        throw new Error(
          `File write verification failed: expected ${content.length} bytes, got ${writtenContent.length} bytes`
        );
      }

      // Verify JavaScript syntax of written file
      try {
        new Function(writtenContent);
        this.logger.debug(`JavaScript syntax validation passed`);
      } catch (syntaxError) {
        throw new Error(`Written file has syntax errors: ${syntaxError.message}`);
      }

      // Remove existing file if it exists (for atomic replacement)
      try {
        await fs.unlink(fullPath);
        this.logger.debug(`Removed existing file: ${fullPath}`);
      } catch (unlinkError) {
        if (unlinkError.code !== 'ENOENT') {
          this.logger.warn(`Could not remove existing file: ${unlinkError.message}`);
        }
      }

      // Atomic move to final location
      this.logger.debug(`Moving temporary file to final location: ${fullPath}`);
      await fs.rename(tempPath, fullPath);

      // Verify final file exists and get stats
      const stats = await fs.stat(fullPath);
      this.logger.debug(`Final verification: File exists with size ${stats.size} bytes`);

      // Double-check we can read the final file
      const finalContent = await fs.readFile(fullPath, 'utf8');
      if (finalContent.length !== content.length) {
        throw new Error(
          `Final file verification failed: expected ${content.length} bytes, got ${finalContent.length} bytes`
        );
      }

      this.logger.debug(`✅ CDN file stored successfully: ${filePath} (${stats.size} bytes)`);

      return {
        path: filePath,
        size: stats.size,
        contentType: CDN_CONTENT_TYPES.JAVASCRIPT,
        etag: metadata.integrity,
        lastModified: stats.mtime,
        metadata: {
          publisherId: metadata.publisherId,
          websiteId: metadata.websiteId || (metadata.websiteIds && metadata.websiteIds[0]),
          ...(metadata.websiteIds && { websiteIds: JSON.stringify(metadata.websiteIds) }),
          version: metadata.version,
          buildId: metadata.buildId,
        },
      };
    } catch (error) {
      // Cleanup temporary file if it exists
      try {
        await fs.unlink(tempPath);
        this.logger.debug(`Cleaned up temporary file: ${tempPath}`);
      } catch (cleanupError) {
        this.logger.warn(`Could not cleanup temporary file: ${cleanupError.message}`);
      }

      this.logger.error(`❌ Failed to store CDN file: ${error.message}`);
      this.logger.error(`Error details:`, error);
      throw error;
    }
  }

  /**
   * Retrieve file locally
   */
  private async retrieveFileLocal(
    filePath: string,
  ): Promise<{ content: string; metadata: ICdnStorageMetadata }> {
    const fullPath = path.join(this.basePath, filePath);

    const content = await fs.readFile(fullPath, 'utf8');
    const stats = await fs.stat(fullPath);

    // Try to get metadata
    const metadataPath = filePath.replace(/\.js$/, '.metadata.json');
    let fileMetadata: Record<string, string> = {};

    try {
      const metadataContent = await fs.readFile(
        path.join(this.basePath, metadataPath),
        'utf8',
      );
      fileMetadata = JSON.parse(metadataContent);
    } catch (error) {
      // Metadata file might not exist
    }

    return {
      content,
      metadata: {
        path: filePath,
        size: stats.size,
        contentType: CDN_CONTENT_TYPES.JAVASCRIPT,
        etag: '',
        lastModified: stats.mtime,
        metadata: fileMetadata,
      },
    };
  }

  /**
   * Delete file locally
   */
  private async deleteFileLocal(filePath: string): Promise<void> {
    const fullPath = path.join(this.basePath, filePath);
    await fs.unlink(fullPath);

    // Also delete metadata file if exists
    const metadataPath = fullPath.replace(/\.js$/, '.metadata.json');
    try {
      await fs.unlink(metadataPath);
    } catch (error) {
      // Metadata file might not exist
    }
  }

  /**
   * Check if file exists locally
   */
  private async fileExistsLocal(filePath: string): Promise<boolean> {
    const fullPath = path.join(this.basePath, filePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Store metadata locally
   */
  private async storeMetadataLocal(
    metadataPath: string,
    content: string,
  ): Promise<void> {
    const fullPath = path.join(this.basePath, metadataPath);
    const dir = path.dirname(fullPath);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf8');
  }

  /**
   * Retrieve metadata locally
   */
  private async retrieveMetadataLocal(
    metadataPath: string,
  ): Promise<ICdnFileMetadata> {
    const fullPath = path.join(this.basePath, metadataPath);
    const content = await fs.readFile(fullPath, 'utf8');
    return JSON.parse(content);
  }

  /**
   * List publishers locally
   */
  private async listPublishersLocal(environment?: string): Promise<string[]> {
    const basePath = environment
      ? path.join(
          this.basePath,
          environment,
          CDN_PATHS.PUBLISHER_PATH.substring(1),
        )
      : path.join(this.basePath, CDN_PATHS.PUBLISHER_PATH.substring(1));

    try {
      const dirs = await fs.readdir(basePath, { withFileTypes: true });
      return dirs
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);
    } catch {
      return [];
    }
  }

  /**
   * S3 storage methods (placeholders - implement with actual AWS SDK)
   */
  private async storeFileS3(
    filePath: string,
    content: string,
    metadata: ICdnFileMetadata,
  ): Promise<ICdnStorageMetadata> {
    // Implement S3 storage
    throw new Error('S3 storage not implemented');
  }

  private async retrieveFileS3(
    filePath: string,
  ): Promise<{ content: string; metadata: ICdnStorageMetadata }> {
    // Implement S3 retrieval
    throw new Error('S3 retrieval not implemented');
  }

  private async deleteFileS3(filePath: string): Promise<void> {
    // Implement S3 deletion
    throw new Error('S3 deletion not implemented');
  }

  private async fileExistsS3(filePath: string): Promise<boolean> {
    // Implement S3 existence check
    throw new Error('S3 existence check not implemented');
  }

  private async storeMetadataS3(
    metadataPath: string,
    content: string,
  ): Promise<void> {
    // Implement S3 metadata storage
    throw new Error('S3 metadata storage not implemented');
  }

  private async retrieveMetadataS3(
    metadataPath: string,
  ): Promise<ICdnFileMetadata> {
    // Implement S3 metadata retrieval
    throw new Error('S3 metadata retrieval not implemented');
  }

  private async listPublishersS3(environment?: string): Promise<string[]> {
    // Implement S3 listing
    throw new Error('S3 listing not implemented');
  }

  /**
   * Build file path for CDN file
   */
  private buildFilePath(publisherId: string, environment?: string): string {
    const parts = [];

    if (environment && environment !== 'production') {
      parts.push(environment);
    }

    parts.push(
      CDN_PATHS.PUBLISHER_PATH.substring(1),
      publisherId,
      CDN_PATHS.INIT_SCRIPT,
    );

    return parts.join('/');
  }

  /**
   * Build metadata file path
   */
  private buildMetadataPath(publisherId: string, environment?: string): string {
    const parts = [];

    if (environment && environment !== 'production') {
      parts.push(environment);
    }

    parts.push(
      CDN_PATHS.PUBLISHER_PATH.substring(1),
      publisherId,
      CDN_PATHS.METADATA_FILE,
    );

    return parts.join('/');
  }
}
