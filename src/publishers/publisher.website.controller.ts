import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PublisherGuard } from 'src/common/guards/authorization.guard';
import { PublisherService } from './publisher.service';
import { CreateWebsiteDto } from './dto/create-website.dto';

@ApiTags('Publisher - Websites')
@Controller('publishers/websites')
@UseGuards(PublisherGuard)
@ApiBearerAuth()
export class PublisherWebsiteController {
  constructor(private readonly publisherService: PublisherService) {}
  @Post()
  @ApiResponse({
    status: 201,
    description: 'Website created successfully',
  })
  @ApiOperation({
    summary: 'Create a new website for the publisher',
    description: 'Creates a new website associated with the authenticated publisher.',
  })
  async createWebsite(@Body() createWebsiteDto: CreateWebsiteDto) {
    const data = await this.publisherService.createWebsite(createWebsiteDto);
    return data;
  }

  @Get(':id')
  @ApiResponse({
    status: 200,
    description: 'List of websites for the publisher',
  })
  @ApiOperation({
    summary: 'Get all websites for a publisher',
    description: 'Retrieves all websites associated with the authenticated publisher',
  })
  async getWebsites(@Param('id') id: string) {
    const websites = await this.publisherService.getAllWebsites(id);
    return websites;
  }

  @Get(':publisherId/:data')
  @ApiResponse({
    status: 200,
    description: 'Get a specific website by ID/URL',
  })
  @ApiOperation({
    summary: 'Get a specific website by ID or URL',
    description:
      'Retrieves a website by its ID or URL for the specified publisher. Use "type" query parameter to specify the search type.',
  })
  async getWebsiteByIdOrUrl(
    @Param('publisherId') publisherId: string,
    @Query('type') type: 'url' | 'id',
    @Param('data') data: string,
  ) {
    let website;
    if (type === 'id') {
      website = await this.publisherService.getWebsiteById(publisherId, data);
      if (!website) {
        throw new Error('Website not found');
      }
    } else if (type === 'url') {
      website = await this.publisherService.getWebsiteByURL(publisherId, data);
      if (!website) {
        throw new Error('Website not found');
      }
    }
    return website;
  }

  @Get('activate/:publisherId/:websiteId')
  @ApiResponse({
    status: 200,
    description: 'Deactivate a website by ID',
  })
  @ApiOperation({
    summary: 'Activate a website by ID',
    description: 'Activates a website for the specified publisher.',
  })
  async activateWebsite(
    @Param('websiteId') websiteId: string,
    @Param('publisherId') publisherId: string,
  ) {
    const result = await this.publisherService.activateWebsite(
      publisherId,
      websiteId,
    );
    if (!result) {
      throw new Error('Website not found');
    }
    return { message: 'Website activated successfully' };
  }



  @Delete(':publisherId/:websiteId')
  @ApiResponse({
    status: 200,
    description: 'Delete a website by ID',
  })
  @ApiOperation({
    summary: 'Delete a website by ID',
    description: 'Deletes a website for the specified publisher.',
  })
  async deleteWebsite(
    @Param('websiteId') id: string,
    @Param('publisherId') publisherId: string,
  ) {
    const result = await this.publisherService.deleteWebsite(publisherId, id);
    if (!result) {
      throw new Error('Website not found');
    }
    return { message: 'Website deleted successfully' };
  }
}
