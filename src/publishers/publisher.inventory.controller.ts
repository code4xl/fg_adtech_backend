import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PublisherGuard } from 'src/common/guards/authorization.guard';
import { PublisherService } from './publisher.service';

@Controller('publishers/adslots')
@ApiTags('publishers/adslots')
@UseGuards(PublisherGuard)
@ApiBearerAuth()
export class PublisherInventoryController {
  constructor(private readonly publisherService: PublisherService) {}

  @Get('/get-available-ad-slot-templates')
  @ApiResponse({
    status: 200,
    description: 'Returns available ad slot templates for the publisher',
  })
  async getAvailableAdSlotTemplates() {
    const adSlotTypes =
      await this.publisherService.getAvailableAdSlotTemplates();
    return adSlotTypes;
  }

  @Post()
  @ApiResponse({
    status: 201,
    description: 'Creates a new ad slot for the publisher',
  })
  async createAdSlot(@Body() createAdSlotDto: CreateAdSlotDto) {}
}
