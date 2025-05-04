// src/file-storage/file-storage.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly basePath: string;

  constructor(private configService: ConfigService) {
    this.basePath = configService.get<string>('UPLOAD_PATH', './uploads/audience-csv');
    this.ensureDirectoryExists(this.basePath);
  }

  private ensureDirectoryExists(directoryPath: string): void {
    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath, { recursive: true });
      this.logger.log(`Created directory: ${directoryPath}`);
    }
  }

  getFilePath(filename: string): string {
    return path.join(this.basePath, filename);
  }

  async deleteFile(filename: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.log(`File deleted: ${filename}`);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(`Error deleting file ${filename}:`, error);
      return false;
    }
  }

  // Method to validate a CSV file (additional validation if needed)
  async validateCsvFile(filePath: string): Promise<boolean> {
    try {
      if (!filePath) {
        this.logger.warn('No file path provided');
        return false;
      }

      // Check if file exists and has content
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        this.logger.warn(`File at ${filePath} is empty`);
        return false;
      }

      // Read first few bytes to validate CSV format
      const buffer = Buffer.alloc(1024);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buffer, 0, 1024, 0);
      fs.closeSync(fd);

      const content = buffer.toString().trim();
      return content.includes(',');
    } catch (error) {
      this.logger.error(`Error validating CSV file at ${filePath}:`, error);
      return false;
    }
  }
}