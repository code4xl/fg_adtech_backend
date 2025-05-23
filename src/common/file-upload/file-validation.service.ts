import { Injectable, Logger } from '@nestjs/common';
import { FileStorageService } from './file-storage.service';
import * as fs from 'fs';
import { parse as csvParse } from 'csv-parse/sync';

@Injectable()
export class FileValidationService {
    private readonly logger = new Logger(FileValidationService.name);

    constructor(private fileStorageService: FileStorageService) { }

    // Comprehensive CSV validation
    // async validateCsvFile(filePath: string, options: {
    //     requiredHeaders?: string[],
    //     maxRows?: number,
    //     minRows?: number,
    //     validateDataTypes?: Record<string, 'string' | 'number' | 'boolean' | 'date'>,
    //     maxFileSizeBytes?: number
    // } = {}): Promise<{
    //     valid: boolean,
    //     data?: any[],
    //     headers?: string[],
    //     rowCount?: number,
    //     errors?: any[]
    // }> {
    //     try {
    //         const fullPath = this.fileStorageService.getAbsolutePath(filePath);

    //         // Check if file exists
    //         if (!fs.existsSync(fullPath)) {
    //             return {
    //                 valid: false,
    //                 errors: [{
    //                     type: 'file_not_found',
    //                     message: `File not found: ${filePath}`
    //                 }]
    //             };
    //         }

    //         // Check file size
    //         const stats = fs.statSync(fullPath);
    //         if (stats.size === 0) {
    //             return {
    //                 valid: false,
    //                 errors: [{
    //                     type: 'empty_file',
    //                     message: 'File is empty'
    //                 }]
    //             };
    //         }

    //         if (options.maxFileSizeBytes && stats.size > options.maxFileSizeBytes) {
    //             return {
    //                 valid: false,
    //                 errors: [{
    //                     type: 'file_too_large',
    //                     message: `File size (${stats.size} bytes) exceeds maximum allowed (${options.maxFileSizeBytes} bytes)`
    //                 }]
    //             };
    //         }

    //         // Read file content
    //         const fileContent = fs.readFileSync(fullPath, 'utf8');

    //         // Parse CSV
    //         const errors: any = [];
    //         let parseResult;

    //         try {
    //             parseResult = csvParse(fileContent, {
    //                 columns: true,
    //                 skip_empty_lines: true,
    //                 trim: true
    //             });
    //         } catch (error) {
    //             return {
    //                 valid: false,
    //                 errors: [{
    //                     type: 'parse_error',
    //                     message: `Failed to parse CSV: ${error.message}`,
    //                     details: error
    //                 }]
    //             };
    //         }

    //         // Validate row count
    //         const rowCount = parseResult.length;
    //         if (options.minRows && rowCount < options.minRows) {
    //             errors.push({
    //                 type: 'insufficient_rows',
    //                 message: `CSV has only ${rowCount} rows, minimum required is ${options.minRows}`
    //             });
    //         }

    //         if (options.maxRows && rowCount > options.maxRows) {
    //             errors.push({
    //                 type: 'too_many_rows',
    //                 message: `CSV has ${rowCount} rows, maximum allowed is ${options.maxRows}`
    //             });
    //         }

    //         // Validate headers
    //         const headers = parseResult.length > 0 ? Object.keys(parseResult[0]) : [];

    //         if (options.requiredHeaders && options.requiredHeaders.length > 0) {
    //             const missingHeaders = options.requiredHeaders.filter(
    //                 header => !headers.includes(header)
    //             );

    //             if (missingHeaders.length > 0) {
    //                 errors.push({
    //                     type: 'missing_headers',
    //                     message: `Missing required headers: ${missingHeaders.join(', ')}`,
    //                     missing: missingHeaders,
    //                     available: headers
    //                 });
    //             }
    //         }

    //         // Validate data types
    //         if (options.validateDataTypes && parseResult.length > 0) {
    //             const dataTypeErrors: any = [];

    //             parseResult.forEach((row, rowIndex) => {
    //                 Object.entries(options.validateDataTypes!).forEach(([column, expectedType]) => {
    //                     if (headers.includes(column) && row[column] !== undefined) {
    //                         const value = row[column];
    //                         let isValid = false;

    //                         switch (expectedType) {
    //                             case 'number':
    //                                 isValid = !isNaN(Number(value));
    //                                 break;
    //                             case 'boolean':
    //                                 isValid = value === 'true' || value === 'false' ||
    //                                     value === '1' || value === '0' ||
    //                                     value === 'yes' || value === 'no';
    //                                 break;
    //                             case 'date':
    //                                 isValid = !isNaN(Date.parse(value));
    //                                 break;
    //                             case 'string':
    //                                 isValid = true; // All values can be strings
    //                                 break;
    //                         }

    //                         if (!isValid) {
    //                             dataTypeErrors.push({
    //                                 row: rowIndex + 2, // +2 to account for header row and 0-indexing
    //                                 column,
    //                                 value,
    //                                 expectedType,
    //                                 message: `Invalid value in row ${rowIndex + 2}, column "${column}": Expected ${expectedType}, got "${value}"`
    //                             });
    //                         }
    //                     }
    //                 });
    //             });

    //             if (dataTypeErrors.length > 0) {
    //                 errors.push({
    //                     type: 'data_type_errors',
    //                     count: dataTypeErrors.length,
    //                     details: dataTypeErrors
    //                 });
    //             }
    //         }

    //         return {
    //             valid: errors.length === 0,
    //             data: parseResult,
    //             headers,
    //             rowCount,
    //             errors: errors.length > 0 ? errors : undefined
    //         };

    //     } catch (error) {
    //         this.logger.error(`Error validating CSV file at ${filePath}:`, error);
    //         return {
    //             valid: false,
    //             errors: [{
    //                 type: 'validation_error',
    //                 message: `Error validating CSV file: ${error.message}`,
    //                 details: error
    //             }]
    //         };
    //     }
    // }


    /**
 * Validates if a buffer contains CSV data
 * @param buffer The file buffer to validate
 * @returns boolean indicating if the buffer contains valid CSV data
 */
    async validateCsvBuffer(buffer: Buffer): Promise<boolean> {
        try {
            if (!buffer || buffer.length === 0) {
                this.logger.warn('Empty buffer provided');
                return false;
            }

            // Read up to the first 1024 bytes for validation
            const sampleSize = Math.min(buffer.length, 1024);
            const sample = buffer.slice(0, sampleSize);

            // Convert to string and check for CSV characteristics
            const content = sample.toString().trim();

            // Basic CSV validation: check if it contains commas
            // You could add more sophisticated checks here if needed
            if (!content.includes(',')) {
                this.logger.warn('Buffer does not contain comma-separated values');
                return false;
            }

            // Optional: You could also check for newlines to ensure multiple rows
            if (!content.includes('\n') && buffer.length > 100) {
                this.logger.warn('CSV appears to have only one line, might not be valid');
                // Still return true since single-line CSVs are technically valid
            }

            // Optional: Check for a reasonable number of commas
            const commaCount = (content.match(/,/g) || []).length;
            if (commaCount < 1) {
                this.logger.warn('CSV contains very few columns, might not be valid');
                // Still return true as it technically has commas
            }

            return true;
        } catch (error) {
            this.logger.error(`Error validating CSV buffer:`, error);
            return false;
        }
    }

    // General file existence check
    async validateFileExists(filePath: string): Promise<boolean> {
        try {
            const fullPath = this.fileStorageService.getAbsolutePath(filePath);
            return fs.existsSync(fullPath);
        } catch (error) {
            this.logger.error(`Error checking file existence ${filePath}:`, error);
            return false;
        }
    }

    // Image validation
    async validateImageDimensions(filePath: string, options: {
        minWidth?: number,
        maxWidth?: number,
        minHeight?: number,
        maxHeight?: number,
        exactWidth?: number,
        exactHeight?: number
    } = {}): Promise<{
        valid: boolean,
        width?: number,
        height?: number,
        errors?: any[]
    }> {
        try {
            // This is a placeholder. In a real implementation, you would:
            // 1. Use sharp or another image library to get dimensions
            // 2. Validate against provided options
            // For now, we'll just return true
            return { valid: true, width: 800, height: 600 };
        } catch (error) {
            this.logger.error(`Error validating image dimensions ${filePath}:`, error);
            return {
                valid: false,
                errors: [{
                    type: 'image_validation_error',
                    message: `Error validating image: ${error.message}`,
                    details: error
                }]
            };
        }
    }
}