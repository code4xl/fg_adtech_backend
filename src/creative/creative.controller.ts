import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Request,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  Patch,
  Query
} from '@nestjs/common';
import { CreativeService } from './creative.service';
import { AdvertiserGuard } from '../common/guards/authorization.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody
} from '@nestjs/swagger';
import {
  ApiStandardResponse,
  ApiStandardErrors
} from '../common/decorators/swagger.decorator';
import { CreateCreativeDto } from './dto/create-creative.dto';
import { UpdateCreativeDto } from './dto/update-creative.dto';

@ApiTags('campaign/creative')
@ApiBearerAuth()
@UseGuards(AdvertiserGuard)
@Controller('campaign/:campaignId/creative')
export class CreativeController {
  constructor(private readonly creativeService: CreativeService) { }

  @Post()
  @ApiOperation({ summary: 'Add a new creative to a campaign' })
  @ApiParam({ name: 'campaignId', description: 'Campaign ID', type: String })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Creative name' },
        type: { type: 'string', enum: ['IMAGE', 'VIDEO', 'HTML', 'RICH_MEDIA', 'NATIVE'], description: 'Creative type' },
        inventoryId: { type: 'string', description: 'Inventory ID' },
        landingUrl: { type: 'string', description: 'Landing page URL' },
        file: {
          type: 'string',
          format: 'binary',
          description: 'Creative file to upload (dimensions will be auto-detected)'
        }
      },
      required: ['name', 'type', 'inventoryId', 'landingUrl', 'file']
    }
  })
  @ApiStandardResponse({
    description: 'Creative added successfully'
  })
  @ApiStandardErrors()
  @UseInterceptors(FileInterceptor('file'))
  addCreative(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Request() req,
    @Body() createCreativeDto: CreateCreativeDto,
    @UploadedFile() file: Express.Multer.File
  ) {
    return this.creativeService.addCreative(
      campaignId,
      req.user.id,
      createCreativeDto,
      file
    );
  }

  @Patch(':creativeId')
  @ApiOperation({ summary: 'Update a creative' })
  @ApiParam({ name: 'campaignId', description: 'Campaign ID', type: String })
  @ApiParam({ name: 'creativeId', description: 'Creative ID', type: String })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Creative name' },
        landingUrl: { type: 'string', description: 'Landing page URL' },
        file: {
          type: 'string',
          format: 'binary',
          description: 'Creative file to upload (optional)',
        }
      }
    }
  })
  @ApiStandardResponse({
    description: 'Creative updated successfully'
  })
  @ApiStandardErrors()
  @UseInterceptors(FileInterceptor('file'))
  updateCreative(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('creativeId', ParseUUIDPipe) creativeId: string,
    @Request() req,
    @Body() updateCreativeDto: UpdateCreativeDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this.creativeService.updateCreative(
      creativeId,
      campaignId,
      req.user.id,
      updateCreativeDto,
      file
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all creatives for a campaign' })
  @ApiParam({ name: 'campaignId', description: 'Campaign ID', type: String })
  @ApiStandardResponse({
    description: 'Creatives retrieved successfully'
  })
  @ApiStandardErrors()
  findAll(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Request() req
  ) {
    return this.creativeService.getCreatives(campaignId, req.user.id);
  }

  @Get(':creativeId')
  @ApiOperation({ summary: 'Get a specific creative' })
  @ApiParam({ name: 'campaignId', description: 'Campaign ID', type: String })
  @ApiParam({ name: 'creativeId', description: 'Creative ID', type: String })
  @ApiStandardResponse({
    description: 'Creative retrieved successfully'
  })
  @ApiStandardErrors()
  findOne(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('creativeId', ParseUUIDPipe) id: string,
    @Request() req
  ) {
    return this.creativeService.getCreative(id, campaignId, req.user.id);
  }

  @Delete(':creativeId')
  @ApiOperation({ summary: 'Remove a creative' })
  @ApiParam({ name: 'campaignId', description: 'Campaign ID', type: String })
  @ApiParam({ name: 'creativeId', description: 'Creative ID', type: String })
  @ApiStandardResponse({
    description: 'Creative removed successfully'
  })
  @ApiStandardErrors()
  remove(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('creativeId', ParseUUIDPipe) id: string,
    @Request() req
  ) {
    return this.creativeService.removeCreative(id, campaignId, req.user.id);
  }

  @Get(':creativeId/presigned-url')
  @ApiOperation({ summary: 'Get a pre-signed URL for accessing a creative' })
  @ApiParam({ name: 'campaignId', description: 'Campaign ID', type: String })
  @ApiParam({ name: 'creativeId', description: 'Creative ID', type: String })
  @ApiStandardResponse({
    description: 'Pre-signed URL generated successfully'
  })
  @ApiStandardErrors()
  async getCreativePresignedUrl(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('creativeId', ParseUUIDPipe) creativeId: string,
    @Request() req,
    @Query('expiresIn') expiresIn: number = 3600
  ) {
    return this.creativeService.getCreativePresignedUrl(
      creativeId,
      campaignId,
      req.user.id,
      expiresIn
    );
  }
}