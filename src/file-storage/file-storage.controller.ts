// src/file-storage/file-storage.controller.ts
import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiConsumes, ApiBody, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FileStorageService } from './file-storage.service';
import { AdvertiserGuard } from '../common/guards/authorization.guard';
import { ApiStandardResponse, ApiStandardErrors } from '../common/decorators/swagger.decorator';
import { Express } from 'express';
import { ResourceNotFoundException } from 'src/common/exceptions/custom.exception';

@ApiTags('file-storage')
@ApiBearerAuth()
@UseGuards(AdvertiserGuard)
@Controller('file-storage')
export class FileStorageController {
  constructor(private readonly fileStorageService: FileStorageService) { }

  @Post('upload')
  @ApiOperation({ summary: 'Upload a CSV file (max 5MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV file to upload (max 5MB)',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  @ApiStandardResponse({
    description: 'File uploaded successfully',
  })
  @ApiStandardErrors()
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: 'text/csv' }),
        ],
      }),
    )
    file: any,
  ) {
    // Validate CSV format
    const isValid = await this.fileStorageService.validateCsvFile(file.filename);
    if (!isValid) {
      throw new BadRequestException('Invalid CSV file format');
    }

    return {
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  @Delete(':filename')
  @ApiOperation({ summary: 'Delete a file' })
  @ApiStandardResponse({
    description: 'File deleted successfully',
  })
  @ApiStandardErrors()
  async deleteFile(@Param('filename') filename: string) {
    const result = await this.fileStorageService.deleteFile(filename);
    if (!result) {
      throw new ResourceNotFoundException('File', filename);
    }

    return {
      message: `File ${filename} deleted successfully`,
    };
  }

  @Get('validate/:filename')
  @ApiOperation({ summary: 'Validate a CSV file' })
  @ApiStandardResponse({
    description: 'File validation result',
  })
  @ApiStandardErrors()
  async validateFile(@Param('filename') filename: string) {
    const isValid = await this.fileStorageService.validateCsvFile(filename);

    return {
      filename,
      isValid,
    };
  }
}