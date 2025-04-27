import {
    Controller,
    Get,
    Query,
    UseGuards,
    Req
  } from '@nestjs/common';
  import { InventoryService } from './inventory.service';
  import { AdvertiserGuard } from '../common/guards/authorization.guard';
  import { InventorySearchDto } from './dto/inventory-search.dto';
  import { PerformanceQueryDto } from './dto/performance-query.dto';
  import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth
  } from '@nestjs/swagger';
  import { 
    ApiStandardResponse,
    ApiStandardErrors 
  } from '../common/decorators/swagger.decorator';
  
  @ApiTags('advertiser/inventory')
  @ApiBearerAuth()
  @UseGuards(AdvertiserGuard)
  @Controller('advertiser/inventory')
  export class AdvertiserInventoryController {
    constructor(private readonly inventoryService: InventoryService) {}
  
    @Get('available')
    @ApiOperation({ summary: 'Get available ad inventory matching targeting criteria' })
    @ApiStandardResponse({
      isPaginated: true,
      description: 'List of available inventory matching criteria'
    })
    @ApiStandardErrors()
    async getAvailableInventory(@Query() query: InventorySearchDto, @Req() req) {
      return this.inventoryService.findAvailableForAdvertiser(req.user.id, query);
    }
  
    @Get('categories')
    @ApiOperation({ summary: 'Get all inventory categories for targeting' })
    @ApiStandardResponse({
      description: 'List of inventory categories'
    })
    @ApiStandardErrors()
    async getCategories() {
      return this.inventoryService.getAllCategories();
    }
  
    @Get('performance')
    @ApiOperation({ summary: 'Get inventory performance metrics for planning' })
    @ApiStandardResponse({
      description: 'Inventory performance data'
    })
    @ApiStandardErrors()
    async getPerformanceStats(@Query() query: PerformanceQueryDto) {
      return this.inventoryService.getInventoryPerformanceForAdvertisers(query);
    }
  }