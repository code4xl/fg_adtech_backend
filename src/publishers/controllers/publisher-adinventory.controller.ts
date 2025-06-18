import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    ParseUUIDPipe,
  } from '@nestjs/common';
  import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiBearerAuth,
  } from '@nestjs/swagger';
  import { PublisherGuard } from '../../common/guards/authorization.guard';
  import { PublisherAdInventoryService } from '../services/publisher-adinventory.service';
  import { CreateAdInventoryDto } from '../dto/create-adinventory.dto';
  import { UpdateAdInventoryDto } from '../dto/update-adinventory.dto';
  import { AdInventoryResponseDto } from '../dto/adinventory-response.dto';
  import { AdInventoryQueryDto } from '../dto/adinventory-query.dto';
  
  @ApiTags('Publisher Ad Inventory')
  @ApiBearerAuth()
  @Controller('publishers')
  @UseGuards(PublisherGuard)
  export class PublisherAdInventoryController {
    constructor(
      private readonly adInventoryService: PublisherAdInventoryService,
    ) {}
  
    @Post(':publisherId/websites/:websiteId/adslots')
    @ApiOperation({ summary: 'Create new ad inventory slot' })
    @ApiParam({ name: 'publisherId', type: 'string', format: 'uuid' })
    @ApiParam({ name: 'websiteId', type: 'string', format: 'uuid' })
    @ApiResponse({
      status: 201,
      description: 'Ad inventory created successfully',
      type: AdInventoryResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 403, description: 'Forbidden - Publisher does not own website' })
    @ApiResponse({ status: 404, description: 'Website or template not found' })
    @ApiResponse({ status: 409, description: 'Conflict - Duplicate name' })
    async createAdInventory(
      @Param('publisherId', ParseUUIDPipe) publisherId: string,
      @Param('websiteId', ParseUUIDPipe) websiteId: string,
      @Body() createAdInventoryDto: CreateAdInventoryDto,
    ): Promise<AdInventoryResponseDto> {
      return this.adInventoryService.create(
        publisherId,
        websiteId,
        createAdInventoryDto,
      );
    }
  
    @Get(':publisherId/websites/:websiteId/adslots')
    @ApiOperation({ summary: 'List all ad inventory slots for a website' })
    @ApiParam({ name: 'publisherId', type: 'string', format: 'uuid' })
    @ApiParam({ name: 'websiteId', type: 'string', format: 'uuid' })
    @ApiResponse({
      status: 200,
      description: 'List of ad inventory slots',
      type: [AdInventoryResponseDto],
    })
    @ApiResponse({ status: 403, description: 'Forbidden - Publisher does not own website' })
    @ApiResponse({ status: 404, description: 'Website not found' })
    async getAdInventoryList(
      @Param('publisherId', ParseUUIDPipe) publisherId: string,
      @Param('websiteId', ParseUUIDPipe) websiteId: string,
      @Query() query: AdInventoryQueryDto,
    ): Promise<{
      data: AdInventoryResponseDto[];
      total: number;
      page: number;
      limit: number;
    }> {
      return this.adInventoryService.findAll(publisherId, websiteId, query);
    }
  
    @Get(':publisherId/websites/:websiteId/adslots/:adSlotId')
    @ApiOperation({ summary: 'Get specific ad inventory slot details' })
    @ApiParam({ name: 'publisherId', type: 'string', format: 'uuid' })
    @ApiParam({ name: 'websiteId', type: 'string', format: 'uuid' })
    @ApiParam({ name: 'adSlotId', type: 'string', format: 'uuid' })
    @ApiResponse({
      status: 200,
      description: 'Ad inventory details',
      type: AdInventoryResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden - Publisher does not own website' })
    @ApiResponse({ status: 404, description: 'Ad inventory not found' })
    async getAdInventory(
      @Param('publisherId', ParseUUIDPipe) publisherId: string,
      @Param('websiteId', ParseUUIDPipe) websiteId: string,
      @Param('adSlotId', ParseUUIDPipe) adSlotId: string,
    ): Promise<AdInventoryResponseDto> {
      return this.adInventoryService.findOne(publisherId, websiteId, adSlotId);
    }
  
    @Patch(':publisherId/websites/:websiteId/adslots/:adSlotId')
    @ApiOperation({ summary: 'Update ad inventory slot' })
    @ApiParam({ name: 'publisherId', type: 'string', format: 'uuid' })
    @ApiParam({ name: 'websiteId', type: 'string', format: 'uuid' })
    @ApiParam({ name: 'adSlotId', type: 'string', format: 'uuid' })
    @ApiResponse({
      status: 200,
      description: 'Ad inventory updated successfully',
      type: AdInventoryResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 403, description: 'Forbidden - Publisher does not own website' })
    @ApiResponse({ status: 404, description: 'Ad inventory not found' })
    @ApiResponse({ status: 409, description: 'Conflict - Duplicate name' })
    async updateAdInventory(
      @Param('publisherId', ParseUUIDPipe) publisherId: string,
      @Param('websiteId', ParseUUIDPipe) websiteId: string,
      @Param('adSlotId', ParseUUIDPipe) adSlotId: string,
      @Body() updateAdInventoryDto: UpdateAdInventoryDto,
    ): Promise<AdInventoryResponseDto> {
      return this.adInventoryService.update(
        publisherId,
        websiteId,
        adSlotId,
        updateAdInventoryDto,
      );
    }
  
    @Delete(':publisherId/websites/:websiteId/adslots/:adSlotId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete ad inventory slot' })
    @ApiParam({ name: 'publisherId', type: 'string', format: 'uuid' })
    @ApiParam({ name: 'websiteId', type: 'string', format: 'uuid' })
    @ApiParam({ name: 'adSlotId', type: 'string', format: 'uuid' })
    @ApiResponse({
      status: 204,
      description: 'Ad inventory deleted successfully',
    })
    @ApiResponse({ status: 403, description: 'Forbidden - Publisher does not own website' })
    @ApiResponse({ status: 404, description: 'Ad inventory not found' })
    async deleteAdInventory(
      @Param('publisherId', ParseUUIDPipe) publisherId: string,
      @Param('websiteId', ParseUUIDPipe) websiteId: string,
      @Param('adSlotId', ParseUUIDPipe) adSlotId: string,
    ): Promise<void> {
      return this.adInventoryService.remove(publisherId, websiteId, adSlotId);
    }
  
    @Patch(':publisherId/websites/:websiteId/adslots/:adSlotId/toggle')
    @ApiOperation({ summary: 'Toggle ad inventory active status' })
    @ApiParam({ name: 'publisherId', type: 'string', format: 'uuid' })
    @ApiParam({ name: 'websiteId', type: 'string', format: 'uuid' })
    @ApiParam({ name: 'adSlotId', type: 'string', format: 'uuid' })
    @ApiResponse({
      status: 200,
      description: 'Ad inventory status toggled successfully',
      type: AdInventoryResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden - Publisher does not own website' })
    @ApiResponse({ status: 404, description: 'Ad inventory not found' })
    async toggleAdInventoryStatus(
      @Param('publisherId', ParseUUIDPipe) publisherId: string,
      @Param('websiteId', ParseUUIDPipe) websiteId: string,
      @Param('adSlotId', ParseUUIDPipe) adSlotId: string,
    ): Promise<AdInventoryResponseDto> {
      return this.adInventoryService.toggleStatus(
        publisherId,
        websiteId,
        adSlotId,
      );
    }
  }