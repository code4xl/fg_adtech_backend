import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FileStorageService {
    private readonly logger = new Logger(FileStorageService.name);
    private readonly basePath: string;

    constructor(private configService: ConfigService) {
        this.basePath = configService.get<string>('UPLOAD_PATH', './uploads');
        this.ensureDirectoryExists(this.basePath);
    }

    // Core file operations - designed to be S3-compatible in the future
    async saveFile(fileBuffer: Buffer, filePath: string): Promise<string> {
        try {
            const fullPath = path.join(this.basePath, filePath);
            this.ensureDirectoryExists(path.dirname(fullPath));

            await fs.promises.writeFile(fullPath, fileBuffer);
            this.logger.debug(`File saved: ${filePath}`);
            return filePath;
        } catch (error) {
            this.logger.error(`Error saving file ${filePath}:`, error);
            throw new Error(`Failed to save file: ${error.message}`);
        }
    }

    async getFile(filePath: string): Promise<Buffer> {
        try {
            const fullPath = path.join(this.basePath, filePath);
            return await fs.promises.readFile(fullPath);
        } catch (error) {
            this.logger.error(`Error reading file ${filePath}:`, error);
            throw new Error(`Failed to read file: ${error.message}`);
        }
    }

    async deleteFile(filePath: string): Promise<boolean> {
        try {
            const fullPath = path.join(this.basePath, filePath);
            if (fs.existsSync(fullPath)) {
                await fs.promises.unlink(fullPath);
                this.logger.debug(`File deleted: ${filePath}`);
                return true;
            }
            return false;
        } catch (error) {
            this.logger.error(`Error deleting file ${filePath}:`, error);
            return false;
        }
    }

    // Helper methods
    private ensureDirectoryExists(directoryPath: string): void {
        if (!fs.existsSync(directoryPath)) {
            fs.mkdirSync(directoryPath, { recursive: true });
            this.logger.debug(`Created directory: ${directoryPath}`);
        }
    }

    // Method to get the relative path from absolute path
    getRelativePath(absolutePath: string): string {
        return absolutePath.replace(this.basePath, '').replace(/^\/+/, '');
    }

    getAbsolutePath(relativePath: string): string {
        return path.join(this.basePath, relativePath);
    }

    // This method will be useful for S3 transition later
    getPublicUrl(filePath: string): string {
        // In S3 implementation, this would return the S3 URL
        return `/uploads/${filePath}`;
    }
}