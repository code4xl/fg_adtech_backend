// src/common/file-upload/multer-config.service.ts
import { Injectable } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FileValidationError } from './file-validation.error';

@Injectable()
export class MulterConfigService {
    static createMulterOptions(
        configService: ConfigService,
        customDestination?: string
    ): MulterOptions {
        const baseDestination = customDestination || './uploads/files';

        // Ensure directory exists
        if (!existsSync(baseDestination)) {
            mkdirSync(baseDestination, { recursive: true });
        }

        return {
            storage: diskStorage({
                destination: (req, file, cb) => {
                    // Extract file type from the request for dynamic paths
                    const fileType = req.params.fileType ||
                        req.query.fileType ||
                        this.getFileTypeFromMimetype(file.mimetype);

                    // Create appropriate directory based on file type
                    const uploadPath = `${baseDestination}/${fileType}`;
                    if (!existsSync(uploadPath)) {
                        mkdirSync(uploadPath, { recursive: true });
                    }

                    cb(null, uploadPath);
                },
                filename: (req, file, cb) => {
                    // Create unique filename
                    const uniqueId = uuidv4();
                    const dateString = new Date().toISOString().replace(/[:.]/g, '-');
                    const originalExt = extname(file.originalname);

                    const filename = `${dateString}-${uniqueId}${originalExt}`;
                    cb(null, filename);
                },
            }),
            limits: {
                fileSize: configService.get<number>('MAX_FILE_SIZE') || 10 * 1024 * 1024, // 10MB default
            },
            fileFilter: (req, file, cb) => {
                try {
                    // Extract validation type from request or use default
                    const validationType = req.params.validationType ||
                        req.query.validationType ||
                        this.getValidationTypeFromMimetype(file.mimetype);

                    // Apply validation based on file type
                    if (validationType === 'csv') {
                        this.validateCsvFile(file, cb);
                    } else if (validationType === 'image') {
                        this.validateImageFile(file, cb);
                    } else if (validationType === 'video') {
                        this.validateVideoFile(file, cb);
                    } else {
                        // General validation for other files
                        cb(null, true);
                    }
                } catch (error) {
                    cb(new FileValidationError('File validation failed', error), false);
                }
            },
        };
    }

    // Helper methods to determine file types and validation
    private static getFileTypeFromMimetype(mimetype: string): string {
        if (mimetype.includes('csv') || mimetype.includes('excel')) return 'csv';
        if (mimetype.includes('image')) return 'images';
        if (mimetype.includes('video')) return 'videos';
        return 'misc';
    }

    private static getValidationTypeFromMimetype(mimetype: string): string {
        if (mimetype.includes('csv') || mimetype.includes('excel')) return 'csv';
        if (mimetype.includes('image')) return 'image';
        if (mimetype.includes('video')) return 'video';
        return 'general';
    }

    private static validateCsvFile(file, cb) {
        const validTypes = ['text/csv', 'application/csv', 'application/vnd.ms-excel'];
        const validExtensions = ['.csv'];

        const isValidMime = validTypes.includes(file.mimetype);
        const isValidExt = validExtensions.some(ext =>
            file.originalname.toLowerCase().endsWith(ext)
        );

        if (isValidMime || isValidExt) {
            cb(null, true);
        } else {
            cb(new FileValidationError(
                'Invalid CSV file format',
                {
                    provided: { mimetype: file.mimetype, filename: file.originalname },
                    expected: { mimetypes: validTypes, extensions: validExtensions }
                }
            ), false);
        }
    }

    private static validateImageFile(file, cb) {
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

        const isValidMime = validTypes.includes(file.mimetype);
        const isValidExt = validExtensions.some(ext =>
            file.originalname.toLowerCase().endsWith(ext)
        );

        if (isValidMime || isValidExt) {
            cb(null, true);
        } else {
            cb(new FileValidationError(
                'Invalid image file format',
                {
                    provided: { mimetype: file.mimetype, filename: file.originalname },
                    expected: { mimetypes: validTypes, extensions: validExtensions }
                }
            ), false);
        }
    }

    private static validateVideoFile(file, cb) {
        const validTypes = ['video/mp4', 'video/mpeg', 'video/webm'];
        const validExtensions = ['.mp4', '.mpeg', '.webm'];

        const isValidMime = validTypes.includes(file.mimetype);
        const isValidExt = validExtensions.some(ext =>
            file.originalname.toLowerCase().endsWith(ext)
        );

        if (isValidMime || isValidExt) {
            cb(null, true);
        } else {
            cb(new FileValidationError(
                'Invalid video file format',
                {
                    provided: { mimetype: file.mimetype, filename: file.originalname },
                    expected: { mimetypes: validTypes, extensions: validExtensions }
                }
            ), false);
        }
    }
}