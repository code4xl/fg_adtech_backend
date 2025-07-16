import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublisherGuard } from 'src/common/guards/authorization.guard';
import { PublisherService } from './publisher.service';
import { CreateFloorPriceDto } from './dto/floor-price.dto';
import { UpdateFloorPriceDto } from './dto/update-floor-price.dto';

@ApiTags('Publisher - Floor Price Rules')
@Controller('publishers/floorprice')
@UseGuards(PublisherGuard)
@ApiBearerAuth()
export class PublisherFloorPriceController {
  constructor(private readonly publisherService: PublisherService) {}

  @Post('')
  @ApiOperation({ summary: 'Create a new floor price rule for a website' })
  async createFloorPriceRule(@Body() createFloorPriceDto: CreateFloorPriceDto) {
    const floorPriceRule =
      await this.publisherService.createFloorPriceRule(createFloorPriceDto);
    return {
      message: 'Floor price rule created successfully',
      data: floorPriceRule,
    };
  }
  @Get(':publisherId/:adSlotId')
  @ApiOperation({ summary: 'Get all floor price rules for a adslot' })
  async getAllFloorPriceRules(
    @Param('publisherId') publisherId: string,
    @Param('adSlotId') adSlotId: string,
  ) {
    const floorPriceRules = await this.publisherService.getAllFloorPriceRules(
      publisherId,
      adSlotId,
    );
    return {
      message: 'Floor price rules retrieved successfully',
      data: floorPriceRules,
    };
  }
  @Get(':publisherId/:adSlotId/:floorPriceId')
  @ApiOperation({ summary: 'Get single floor price rule for a adslot' })
  async getSingleFloorPriceRule(
    @Param('publisherId') publisherId: string,
    @Param('adSlotId') adSlotId: string,
    @Param('floorPriceId') floorPriceId: string,
  ) {
    const floorPriceRules = await this.publisherService.getSingleFloorPriceRule(
      publisherId,
      adSlotId,
      floorPriceId,
    );
    return {
      message: 'Floor price rule retrieved successfully',
      data: floorPriceRules,
    };
  }

  @Put('')
  @ApiOperation({ summary: 'Update a floor price rule' })
  async updateFloorPriceRule(@Body() updateFloorPriceDto: UpdateFloorPriceDto) {
    const updatedFloorPriceRule =
      await this.publisherService.updateFloorPriceRule(updateFloorPriceDto);
    return {
      message: 'Floor price rule updated successfully',
      data: updatedFloorPriceRule,
    };
  }

  @Delete(':publisherId/:floorPriceId')
  @ApiOperation({ summary: 'Delete a floor price rule' })
  async deleteFloorPriceRule(
    @Param('publisherId') publisherId: string,
    @Param('floorPriceId') floorPriceId: string,
  ) {
    const data = await this.publisherService.deleteFloorPriceRule(
      publisherId,
      floorPriceId,
    );
    return {
      message: 'Floor price rule deleted successfully',
      data,
    };
  }
}
