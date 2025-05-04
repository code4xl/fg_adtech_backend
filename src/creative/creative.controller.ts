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
  UploadedFile
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

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific creative' })
  @ApiParam({ name: 'campaignId', description: 'Campaign ID', type: String })
  @ApiParam({ name: 'id', description: 'Creative ID', type: String })
  @ApiStandardResponse({
    description: 'Creative retrieved successfully'
  })
  @ApiStandardErrors()
  findOne(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req
  ) {
    return this.creativeService.getCreative(id, campaignId, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a creative' })
  @ApiParam({ name: 'campaignId', description: 'Campaign ID', type: String })
  @ApiParam({ name: 'id', description: 'Creative ID', type: String })
  @ApiStandardResponse({
    description: 'Creative removed successfully'
  })
  @ApiStandardErrors()
  remove(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req
  ) {
    return this.creativeService.removeCreative(id, campaignId, req.user.id);
  }
}