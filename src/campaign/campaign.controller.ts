import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  BadRequestException
} from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { CreateCampaignDto, CampaignResponseDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { AdvertiserGuard } from '../common/guards/authorization.guard';
import { CampaignQueryDto } from './dto/campaign-query.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiResponse,
  ApiConsumes
} from '@nestjs/swagger';
import {
  ApiStandardResponse,
  ApiStandardErrors
} from '../common/decorators/swagger.decorator';
import { CampaignTargetingDto } from './dto/targetting-rule.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname } from 'path';

@ApiTags('campaign')
@ApiBearerAuth()
@UseGuards(AdvertiserGuard)
@Controller('campaign')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) { }

  // Create a Campaign 
  @Post()
  @ApiOperation({ summary: 'Create a new campaign' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = './uploads/audience-csv';
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        }
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' ||
          file.mimetype === 'application/csv' ||
          file.mimetype === 'application/vnd.ms-excel' ||
          file.originalname.toLowerCase().endsWith('.csv')) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only CSV files are allowed'), false);
        }
      }
    })
  )
  @ApiStandardResponse({
    type: CampaignResponseDto,
    description: 'Campaign created successfully'
  })
  @ApiStandardErrors()
  async create(
    @Body() createCampaignDto: CreateCampaignDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
        ],
        fileIsRequired: false,
      }),
    )
    file?: any,
    @Request() req?,
  ) {
    return this.campaignService.create(req.user.id, createCampaignDto, file);
  }

  // Update a Campaign
  @Patch(':id')
  @ApiOperation({ summary: 'Update a campaign' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = './uploads/audience-csv';
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        }
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' ||
          file.mimetype === 'application/csv' ||
          file.mimetype === 'application/vnd.ms-excel' ||
          file.originalname.toLowerCase().endsWith('.csv')) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only CSV files are allowed'), false);
        }
      }
    })
  )
  @ApiStandardResponse({
    type: CampaignResponseDto,
    description: 'Campaign updated successfully'
  })
  @ApiStandardErrors()
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCampaignDto: UpdateCampaignDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
        ],
        fileIsRequired: false,
      }),
    )
    file?: any,
    @Request() req?,
  ) {
    return this.campaignService.update(id, req.user.id, updateCampaignDto, file);
  }

  // Get all campaigns for specific advertiser
  @Get()
  @ApiOperation({ summary: 'Get all campaigns for current advertiser' })
  @ApiStandardResponse({
    isPaginated: true,
    type: CampaignResponseDto,
    description: 'Campaigns retrieved successfully'
  })
  @ApiStandardErrors()
  findAll(@Request() req, @Query() query: CampaignQueryDto) {
    return this.campaignService.findAll(req.user.id, query);
  }

  // Get a campaign details by id
  @Get(':id')
  @ApiOperation({ summary: 'Get campaign details' })
  @ApiParam({ name: 'id', description: 'Campaign ID', type: String })
  @ApiStandardResponse({
    type: CampaignResponseDto,
    description: 'Campaign retrieved successfully'
  })
  @ApiStandardErrors()
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.campaignService.findOne(id, req.user.id);
  }

  // Delete a campaign
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a campaign' })
  @ApiParam({ name: 'id', description: 'Campaign ID', type: String })
  @ApiStandardResponse({
    description: 'Campaign deleted successfully'
  })
  @ApiStandardErrors()
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.campaignService.remove(id, req.user.id);
  }

  // Update campaign targeting by Id
  @Patch(':id/targeting')
  @ApiOperation({ summary: 'Update campaign targeting' })
  @ApiParam({ name: 'id', description: 'Campaign ID', type: String })
  @ApiStandardResponse({
    description: 'Campaign targeting updated successfully'
  })
  @ApiStandardErrors()
  updateTargeting(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() targetingDto: CampaignTargetingDto,
    @Request() req
  ) {
    return this.campaignService.updateCampaignTargeting(id, req.user.id, targetingDto);
  }

  // Get campaign targeting by Id
  @Get(':id/targeting')
  @ApiOperation({ summary: 'Get campaign targeting' })
  @ApiParam({ name: 'id', description: 'Campaign ID', type: String })
  @ApiStandardResponse({
    description: 'Campaign targeting retrieved successfully'
  })
  @ApiStandardErrors()
  getTargeting(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req
  ) {
    return this.campaignService.getCampaignTargeting(id, req.user.id);
  }


  // Campaign - Inventory Relation Api's

}

