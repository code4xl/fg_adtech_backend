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
    ParseUUIDPipe
  } from '@nestjs/common';
  import { FloorPriceService } from './floor-price.service';
  import { CreateFloorPriceDto, FloorPriceResponseDto } from './dto/floor-price.dto';
  import { PublisherGuard } from '../common/guards/authorization.guard';
  import { InventoryOwnerGuard } from './guards/inventory-owner.guard';
  import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiParam
  } from '@nestjs/swagger';
  import { 
    ApiStandardResponse,
    ApiStandardErrors 
  } from '../common/decorators/swagger.decorator';
  
  @ApiTags('inventory/floor-prices')
  @ApiBearerAuth()
  @UseGuards(PublisherGuard, InventoryOwnerGuard)
  @Controller('inventory/:id/floor-prices')
  export class FloorPriceController {
    constructor(private readonly floorPriceService: FloorPriceService) {}
  
    @Post()
    @ApiOperation({ summary: 'Create floor price rule for inventory' })
    @ApiParam({ name: 'id', description: 'Inventory ID', type: String })
    @ApiStandardResponse({
      type: FloorPriceResponseDto,
      description: 'Floor price rule created successfully'
    })
    @ApiStandardErrors()
    create(
      @Request() req,
      @Param('id', ParseUUIDPipe) inventoryId: string,
      @Body() createFloorPriceDto: CreateFloorPriceDto
    ) {
      return this.floorPriceService.create(inventoryId, req.user.id, createFloorPriceDto);
    }
  
    @Get()
    @ApiOperation({ summary: 'Get all floor price rules for inventory' })
    @ApiParam({ name: 'id', description: 'Inventory ID', type: String })
    @ApiStandardResponse({
      type: FloorPriceResponseDto,
      description: 'Floor price rules retrieved successfully'
    })
    @ApiStandardErrors()
    findAll(@Request() req, @Param('id', ParseUUIDPipe) inventoryId: string) {
      return this.floorPriceService.findAll(inventoryId, req.user.id);
    }
  
    @Get(':priceId')
    @ApiOperation({ summary: 'Get specific floor price rule' })
    @ApiParam({ name: 'id', description: 'Inventory ID', type: String })
    @ApiParam({ name: 'priceId', description: 'Floor Price ID', type: String })
    @ApiStandardResponse({
      type: FloorPriceResponseDto,
      description: 'Floor price rule retrieved successfully'
    })
    @ApiStandardErrors()
    findOne(
      @Request() req,
      @Param('id', ParseUUIDPipe) inventoryId: string,
      @Param('priceId', ParseUUIDPipe) priceId: string
    ) {
      return this.floorPriceService.findOne(priceId, inventoryId, req.user.id);
    }
  
    @Patch(':priceId')
    @ApiOperation({ summary: 'Update floor price rule' })
    @ApiParam({ name: 'id', description: 'Inventory ID', type: String })
    @ApiParam({ name: 'priceId', description: 'Floor Price ID', type: String })
    @ApiStandardResponse({
      type: FloorPriceResponseDto,
      description: 'Floor price rule updated successfully'
    })
    @ApiStandardErrors()
    update(
      @Request() req,
      @Param('id', ParseUUIDPipe) inventoryId: string,
      @Param('priceId', ParseUUIDPipe) priceId: string,
      @Body() updateFloorPriceDto: Partial<CreateFloorPriceDto>
    ) {
      return this.floorPriceService.update(priceId, inventoryId, req.user.id, updateFloorPriceDto);
    }
  
    @Delete(':priceId')
    @ApiOperation({ summary: 'Delete floor price rule' })
    @ApiParam({ name: 'id', description: 'Inventory ID', type: String })
    @ApiParam({ name: 'priceId', description: 'Floor Price ID', type: String })
    @ApiStandardResponse({
      description: 'Floor price rule deleted successfully'
    })
    @ApiStandardErrors()
    remove(
      @Request() req,
      @Param('id', ParseUUIDPipe) inventoryId: string,
      @Param('priceId', ParseUUIDPipe) priceId: string
    ) {
      return this.floorPriceService.remove(priceId, inventoryId, req.user.id);
    }
  }