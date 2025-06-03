// import {
//   Controller,
//   Get,
//   Post,
//   Body,
//   Patch,
//   Param,
//   Delete,
//   UseGuards,
//   Request,
//   Query,
//   ParseUUIDPipe,
//   UseInterceptors,
//   UploadedFile,
//   ParseFilePipe,
//   MaxFileSizeValidator,
//   FileTypeValidator,
//   BadRequestException
// } from '@nestjs/common';
// import { CampaignService } from './campaign.service';
// import { CreateCampaignDto, CampaignResponseDto } from './dto/create-campaign.dto';
// import { UpdateCampaignDto } from './dto/update-campaign.dto';
// import { AdvertiserGuard } from '../common/guards/authorization.guard';
// import { CampaignQueryDto } from './dto/campaign-query.dto';
// import {
//   ApiTags,
//   ApiOperation,
//   ApiBearerAuth,
//   ApiParam,
//   ApiResponse,
//   ApiConsumes,
//   ApiOkResponse
// } from '@nestjs/swagger';
// import {
//   ApiStandardResponse,
//   ApiStandardErrors
// } from '../common/decorators/swagger.decorator';
// import { CampaignTargetingDto } from './dto/targetting-rule.dto';
// import { FileInterceptor } from '@nestjs/platform-express';
// import { existsSync, mkdirSync } from 'fs';
// import { diskStorage, memoryStorage } from 'multer';
// import { extname } from 'path';
// import { FileValidationService } from 'src/common/file-upload/file-validation.service';

// @ApiTags('campaign')
// @ApiBearerAuth()
// @UseGuards(AdvertiserGuard)
// @Controller('campaign')
// export class CampaignController {
//   constructor(private readonly campaignService: CampaignService,
//     private readonly fileValidationService: FileValidationService,
//   ) { }

//   // Create a Campaign
//   @Post()
//   @ApiOperation({ summary: 'Create a new campaign' })
//   @ApiConsumes('multipart/form-data')
//   @UseInterceptors(
//     FileInterceptor('file', {
//       storage: memoryStorage(),
//     })
//   )
//   @ApiStandardResponse({
//     type: CampaignResponseDto,
//     description: 'Campaign created successfully'
//   })
//   @ApiStandardErrors()
//   async create(
//     @Body() createCampaignDto: CreateCampaignDto,
//     @UploadedFile(
//       new ParseFilePipe({
//         validators: [
//           new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
//         ],
//         fileIsRequired: false,
//       }),
//     )
//     file?: Express.Multer.File,
//     @Request() req?,
//   ) {
//     if (file) {
//       const validationResult = await this.fileValidationService.validateCsvBuffer(file.buffer);

//       console.log('File validation result:', validationResult);

//       if (!validationResult) {
//         throw new BadRequestException({
//           message: 'Invalid CSV file format',
//         });
//       }

//       console.log("File Plss" + file.buffer);

//       // Continue with campaign creation
//       return this.campaignService.create(req.user.id, createCampaignDto, file);
//     }
//   }

//   // Update a Campaign
//   @Patch(':id')
//   @ApiOperation({ summary: 'Update a campaign' })
//   @ApiConsumes('multipart/form-data')
//   @UseInterceptors(
//     FileInterceptor('file', {
//       storage: memoryStorage(),
//     })
//   )
//   @ApiStandardResponse({
//     type: CampaignResponseDto,
//     description: 'Campaign updated successfully'
//   })
//   @ApiStandardErrors()
//   async update(
//     @Param('id', ParseUUIDPipe) id: string,
//     @Body() updateCampaignDto: UpdateCampaignDto,
//     @UploadedFile(
//       new ParseFilePipe({
//         validators: [
//           new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
//         ],
//         fileIsRequired: false,
//       }),
//     )
//     file?: Express.Multer.File,
//     @Request() req?,
//   ) {
//     if (file) {
//       const validationResult = await this.fileValidationService.validateCsvBuffer(file.buffer);

//       console.log('File validation result:', validationResult);

//       if (!validationResult) {
//         throw new BadRequestException({
//           message: 'Invalid CSV file format',
//         });
//       }

//       return this.campaignService.update(id, req.user.id, updateCampaignDto, file);
//     }

//     return this.campaignService.update(id, req.user.id, updateCampaignDto);
//   }

//   // Get all campaigns for specific advertiser
//   @Get()
//   @ApiOperation({ summary: 'Get all campaigns for current advertiser' })
//   @ApiStandardResponse({
//     isPaginated: true,
//     type: CampaignResponseDto,
//     description: 'Campaigns retrieved successfully'
//   })
//   @ApiStandardErrors()
//   findAll(@Request() req, @Query() query: CampaignQueryDto) {
//     return this.campaignService.findAll(req.user.id, query);
//   }

//   // Get a campaign details by id
//   @Get(':id')
//   @ApiOperation({ summary: 'Get campaign details' })
//   @ApiParam({ name: 'id', description: 'Campaign ID', type: String })
//   @ApiStandardResponse({
//     type: CampaignResponseDto,
//     description: 'Campaign retrieved successfully'
//   })
//   @ApiStandardErrors()
//   findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
//     return this.campaignService.findOne(id, req.user.id);
//   }

//   // Delete a campaign
//   @Delete(':id')
//   @ApiOperation({ summary: 'Delete a campaign' })
//   @ApiParam({ name: 'id', description: 'Campaign ID', type: String })
//   @ApiStandardResponse({
//     description: 'Campaign deleted successfully'
//   })
//   @ApiStandardErrors()
//   remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
//     return this.campaignService.remove(id, req.user.id);
//   }

//   // Update campaign targeting by Id
//   @Patch(':id/targeting')
//   @ApiOperation({ summary: 'Update campaign targeting' })
//   @ApiParam({ name: 'id', description: 'Campaign ID', type: String })
//   @ApiStandardResponse({
//     description: 'Campaign targeting updated successfully'
//   })
//   @ApiStandardErrors()
//   updateTargeting(
//     @Param('id', ParseUUIDPipe) id: string,
//     @Body() targetingDto: CampaignTargetingDto,
//     @Request() req
//   ) {
//     return this.campaignService.updateCampaignTargeting(id, req.user.id, targetingDto);
//   }

//   // Get campaign targeting by Id
//   @Get(':id/targeting')
//   @ApiOperation({ summary: 'Get campaign targeting' })
//   @ApiParam({ name: 'id', description: 'Campaign ID', type: String })
//   @ApiStandardResponse({
//     description: 'Campaign targeting retrieved successfully'
//   })
//   @ApiStandardErrors()
//   getTargeting(
//     @Param('id', ParseUUIDPipe) id: string,
//     @Request() req
//   ) {
//     return this.campaignService.getCampaignTargeting(id, req.user.id);
//   }

//   // Get Campaign Audience URI
//   @Get(':id/audience-file')
//   @ApiOperation({ summary: 'Get a pre-signed URL to download campaign audience file' })
//   @ApiParam({ name: 'id', description: 'Campaign ID', type: String })
//   @ApiOkResponse({
//     description: 'Pre-signed URL to download the audience file',
//     schema: {
//       type: 'object',
//       properties: {
//         url: {
//           type: 'string',
//           description: 'Pre-signed URL with temporary access to download the file',
//           example: 'https://bucket-name.s3.region.amazonaws.com/path/to/file.csv?params'
//         }
//       }
//     }
//   })
//   @ApiStandardErrors()
//   async getAudienceFile(
//     @Param('id', ParseUUIDPipe) id: string,
//     @Request() req
//   ) {
//     const url = await this.campaignService.getAudienceFileUrl(id, req.user.id);
//     return { url };
//   }
// }
