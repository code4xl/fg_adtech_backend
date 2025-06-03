import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PublisherGuard } from 'src/common/guards/authorization.guard';
import { PublisherService } from './publisher.service';
import {
  ActivateInventoryDto,
  CreateAdInventoryDto,
} from './dto/inventory.dto';

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
  async createAdSlot(@Body() createAdSlotDto: CreateAdInventoryDto) {
    const adSlot = await this.publisherService.createAdSlot(createAdSlotDto);
    return {
      message: 'Ad slot created successfully',
      data: adSlot,
    };
  }

  @Get('/adslots/:publisherId')
  @ApiResponse({
    status: 200,
    description: 'Returns all ad slots for the publisher',
  })
  async getAdSlotsForPublisher(@Param('publisherId') publisherId: string) {
    const adSlots =
      await this.publisherService.getAdSlotsForPublisher(publisherId);
    return {
      message: 'Ad slots retrieved successfully',
      data: adSlots,
    };
  }
  @Get('/adslots/:publisherId/:websiteId')
  @ApiResponse({
    status: 200,
    description: 'Returns all ad slots of a specific website for the publisher',
  })
  async getAdSlotsForWebsite(
    @Param('publisherId') publisherId: string,
    @Param('websiteId') websiteId: string,
  ) {
    const adSlots = await this.publisherService.getAdSlotsForWebsite(
      publisherId,
      websiteId,
    );
    return {
      message: 'Ad slots retrieved successfully',
      data: adSlots,
    };
  }
  @Get('/adslots/:publisherId/:websiteId/:adSlotId')
  @ApiResponse({
    status: 200,
    description:
      'Returns specific ad slot of a specific website for the publisher',
  })
  async getSpecificAdSlot(
    @Param('publisherId') publisherId: string,
    @Param('websiteId') websiteId: string,
    @Param('adSlotId') adSlotId: string,
  ) {
    const adSlot = await this.publisherService.getSpecificAdSlot(
      publisherId,
      adSlotId,
      websiteId,
    );
    return {
      message: 'Ad slot retrieved successfully',
      data: adSlot,
    };
  }

  @Post('/adslots/toggle-activation-status')
  @ApiResponse({
    status: 200,
    description:
      'Toggles activation status an ad slot of a website for publisher',
  })
  async toggleActivationStatus(@Body() activateSlotDto: ActivateInventoryDto) {
    const updatedAdSlot =
      await this.publisherService.toggleActivationStatus(activateSlotDto);
    return {
      message: 'Ad slot activation status updated successfully',
      data: updatedAdSlot,
    };
  }
  @Delete('/adslots/:publisherId/:websiteId/:adSlotId')
  @ApiResponse({
    status: 200,
    description:
      'Deletes a specific ad slot of a specific website for the publisher',
  })
  async deleteAdSlot(
    @Param('publisherId') publisherId: string,
    @Param('websiteId') websiteId: string,
    @Param('adSlotId') adSlotId: string,
  ) {
    const data = await this.publisherService.deleteAdSlot(
      publisherId,
      adSlotId,
      websiteId,
    );
    return {
      message: 'Ad slot deleted successfully',
      data,
    };
  }
}
