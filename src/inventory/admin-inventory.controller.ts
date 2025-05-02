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
  ParseUUIDPipe
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateInventoryDto, CreateInventoryResponseDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { AdminGuard } from '../common/guards/authorization.guard';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiQuery
} from '@nestjs/swagger';
import { 
  ApiStandardResponse,
  ApiStandardErrors 
} from '../common/decorators/swagger.decorator';

@ApiTags('admin/inventory')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/inventory')
export class AdminInventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post(':publisherId')
  @ApiOperation({ summary: 'Create new ad inventory for a publisher' })
  @ApiParam({ name: 'publisherId', description: 'Publisher ID' })
  @ApiStandardResponse({
    type: CreateInventoryResponseDto,
    description: 'Inventory created successfully'
  })
  @ApiStandardErrors()
  create(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Body() createInventoryDto: CreateInventoryDto
  ) {
    return this.inventoryService.create(publisherId, createInventoryDto);
  }

  @Get('publisher/:publisherId')
  @ApiOperation({ summary: 'Get all ad inventories for a specific publisher' })
  @ApiParam({ name: 'publisherId', description: 'Publisher ID' })
  @ApiStandardResponse({
    isPaginated: true,
    type: CreateInventoryResponseDto,
    description: 'List of inventories retrieved successfully'
  })
  @ApiStandardErrors()
  findAllForPublisher(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Query() query: InventoryQueryDto
  ) {
    return this.inventoryService.findAll(publisherId, query);
  }

  @Get()
  @ApiOperation({ summary: 'Get all ad inventories across all publishers' })
  @ApiStandardResponse({
    isPaginated: true,
    type: CreateInventoryResponseDto,
    description: 'List of all inventories retrieved successfully'
  })
  @ApiStandardErrors()
  findAll(@Query() query: InventoryQueryDto) {
    return this.inventoryService.findAllAcrossPublishers(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get specific ad inventory details' })
  @ApiParam({ name: 'id', description: 'Inventory ID' })
  @ApiStandardResponse({
    type: CreateInventoryResponseDto,
    description: 'Inventory details retrieved successfully'
  })
  @ApiStandardErrors()
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.findOneAsAdmin(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update ad inventory details' })
  @ApiParam({ name: 'id', description: 'Inventory ID' })
  @ApiStandardResponse({
    type: CreateInventoryResponseDto,
    description: 'Inventory updated successfully'
  })
  @ApiStandardErrors()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateInventoryDto: UpdateInventoryDto
  ) {
    return this.inventoryService.updateAsAdmin(id, updateInventoryDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete ad inventory' })
  @ApiParam({ name: 'id', description: 'Inventory ID' })
  @ApiStandardResponse({
    description: 'Inventory deleted successfully'
  })
  @ApiStandardErrors()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.removeAsAdmin(id);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate ad inventory' })
  @ApiParam({ name: 'id', description: 'Inventory ID' })
  @ApiStandardResponse({
    type: CreateInventoryResponseDto,
    description: 'Inventory activated successfully'
  })
  @ApiStandardErrors()
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.activateAsAdmin(id);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate ad inventory' })
  @ApiParam({ name: 'id', description: 'Inventory ID' })
  @ApiStandardResponse({
    type: CreateInventoryResponseDto,
    description: 'Inventory deactivated successfully'
  })
  @ApiStandardErrors()
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.deactivateAsAdmin(id);
  }

  @Post(':id/categories')
  @ApiOperation({ summary: 'Assign a category to inventory' })
  @ApiParam({ name: 'id', description: 'Inventory ID' })
  @ApiStandardResponse({
    description: 'Category assigned successfully'
  })
  @ApiStandardErrors()
  assignCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { categoryId: string } 
  ) {
    return this.inventoryService.assignCategoryAsAdmin(id, body.categoryId);
  }

  @Delete(':id/categories/:categoryId')
  @ApiOperation({ summary: 'Remove a category from inventory' })
  @ApiParam({ name: 'id', description: 'Inventory ID' })
  @ApiParam({ name: 'categoryId', description: 'Category ID' })
  @ApiStandardResponse({
    description: 'Category removed successfully'
  })
  @ApiStandardErrors()
  removeCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string
  ) {
    return this.inventoryService.removeCategoryAsAdmin(id, categoryId);
  }

  @Get(':id/performance')
  @ApiOperation({ summary: 'Get inventory performance metrics' })
  @ApiParam({ name: 'id', description: 'Inventory ID' })
  @ApiStandardResponse({
    description: 'Performance metrics retrieved successfully'
  })
  @ApiStandardErrors()
  getPerformance(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.getPerformanceMetricsAsAdmin(id);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve inventory' })
  @ApiParam({ name: 'id', description: 'Inventory ID' })
  @ApiStandardResponse({
    description: 'Inventory approved successfully'
  })
  @ApiStandardErrors()
  approveInventory(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.updateApprovalStatus(id, 'APPROVED');
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject inventory' })
  @ApiParam({ name: 'id', description: 'Inventory ID' })
  @ApiStandardResponse({
    description: 'Inventory rejected successfully'
  })
  @ApiStandardErrors()
  rejectInventory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() rejectDto: { reason: string }
  ) {
    return this.inventoryService.updateApprovalStatus(id, 'REJECTED', rejectDto.reason);
  }
}