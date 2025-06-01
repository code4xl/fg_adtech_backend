import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import {
  CreateInventoryDto,
  CreateInventoryResponseDto,
} from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { PublisherGuard } from '../common/guards/authorization.guard';
import { InventoryOwnerGuard } from './guards/inventory-owner.guard';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import {
  ApiStandardResponse,
  ApiStandardErrors,
} from '../common/decorators/swagger.decorator';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(PublisherGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  @ApiOperation({ summary: 'Create new ad inventory' })
  @ApiStandardResponse({
    type: CreateInventoryResponseDto,
    description: 'Inventory created successfully',
  })
  @ApiStandardErrors()
  create(@Request() req, @Body() createInventoryDto: CreateInventoryDto) {
    return this.inventoryService.create(req.user.id, createInventoryDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all ad inventories for current publisher' })
  @ApiStandardResponse({
    isPaginated: true,
    type: CreateInventoryResponseDto,
    description: 'List of inventories retrieved successfully',
  })
  @ApiStandardErrors()
  findAll(@Request() req, @Query() query: InventoryQueryDto) {
    return this.inventoryService.findAll(req.user.id, query);
  }

  @Get(':id')
  @UseGuards(InventoryOwnerGuard)
  @ApiOperation({ summary: 'Get specific ad inventory details' })
  @ApiParam({ name: 'id', description: 'Inventory ID', type: String })
  @ApiStandardResponse({
    type: CreateInventoryResponseDto,
    description: 'Inventory details retrieved successfully',
  })
  @ApiStandardErrors()
  findOne(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.findOne(id, req.user.id);
  }

  @Patch(':id')
  @UseGuards(InventoryOwnerGuard)
  @ApiOperation({ summary: 'Update ad inventory details' })
  @ApiParam({ name: 'id', description: 'Inventory ID', type: String })
  @ApiStandardResponse({
    type: CreateInventoryResponseDto,
    description: 'Inventory updated successfully',
  })
  @ApiStandardErrors()
  update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateInventoryDto: UpdateInventoryDto,
  ) {
    return this.inventoryService.update(id, req.user.id, updateInventoryDto);
  }

  @Delete(':id')
  @UseGuards(InventoryOwnerGuard)
  @ApiOperation({ summary: 'Delete ad inventory' })
  @ApiParam({ name: 'id', description: 'Inventory ID', type: String })
  @ApiStandardResponse({
    description: 'Inventory deleted successfully',
  })
  @ApiStandardErrors()
  remove(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.remove(id, req.user.id);
  }

  @Post(':id/activate')
  @UseGuards(InventoryOwnerGuard)
  @ApiOperation({ summary: 'Activate ad inventory' })
  @ApiParam({ name: 'id', description: 'Inventory ID', type: String })
  @ApiStandardResponse({
    type: CreateInventoryResponseDto,
    description: 'Inventory activated successfully',
  })
  @ApiStandardErrors()
  activate(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.activate(id, req.user.id);
  }

  @Post(':id/deactivate')
  @UseGuards(InventoryOwnerGuard)
  @ApiOperation({ summary: 'Deactivate ad inventory' })
  @ApiParam({ name: 'id', description: 'Inventory ID', type: String })
  @ApiStandardResponse({
    type: CreateInventoryResponseDto,
    description: 'Inventory deactivated successfully',
  })
  @ApiStandardErrors()
  deactivate(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.deactivate(id, req.user.id);
  }

  @Get(':id/performance')
  @UseGuards(InventoryOwnerGuard)
  @ApiOperation({ summary: 'Get inventory performance metrics' })
  @ApiParam({ name: 'id', description: 'Inventory ID', type: String })
  @ApiStandardResponse({
    description: 'Performance metrics retrieved successfully',
  })
  @ApiStandardErrors()
  getPerformance(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.getPerformanceMetrics(id, req.user.id);
  }
}
