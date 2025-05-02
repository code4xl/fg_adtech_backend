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
  Query,
  ParseUUIDPipe
} from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { CreateCampaignDto, CampaignResponseDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { AddInventoryToCampaignDto, CampaignInventoryResponseDto } from './dto/campaign-inventory.dto';
import { CreateCreativeDto, CreativeResponseDto, GetAvailableInventoriesForCreativeDto } from './dto/creative.dto';
import { AdvertiserGuard } from '../common/guards/authorization.guard';
import { CampaignQueryDto } from './dto/campaign-query.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiResponse
} from '@nestjs/swagger';
import {
  ApiStandardResponse,
  ApiStandardErrors
} from '../common/decorators/swagger.decorator';
import { CampaignTargetingDto } from './dto/targetting-rule.dto';

@ApiTags('campaign')
@ApiBearerAuth()
@UseGuards(AdvertiserGuard)
@Controller('campaign')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) { }

  @Post()
  @ApiOperation({ summary: 'Create a new campaign' })
  @ApiStandardResponse({
    type: CampaignResponseDto,
    description: 'Campaign created successfully'
  })
  @ApiStandardErrors()
  create(@Body() createCampaignDto: CreateCampaignDto, @Request() req) {
    return this.campaignService.create(req.user.id, createCampaignDto);
  }

  @Patch(':id/targeting')
  @ApiOperation({ summary: 'Update campaign targeting' })
  @ApiParam({ name: 'id', description: 'Campaign ID', type: String })
  @ApiStandardResponse({
    description: 'Campaign targeting updated successfully'
  })
  @ApiStandardErrors()
  updateTargeting(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() targetingDto: CampaignTargetingDto,
    @Request() req
  ) {
    return this.campaignService.updateCampaignTargeting(id, req.user.id, targetingDto);
  }

  @Get(':id/targeting')
  @ApiOperation({ summary: 'Get campaign targeting' })
  @ApiParam({ name: 'id', description: 'Campaign ID', type: String })
  @ApiStandardResponse({
    description: 'Campaign targeting retrieved successfully'
  })
  @ApiStandardErrors()
  getTargeting(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req
  ) {
    return this.campaignService.getCampaignTargeting(id, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all campaigns for current advertiser' })
  @ApiStandardResponse({
    isPaginated: true,
    type: CampaignResponseDto,
    description: 'Campaigns retrieved successfully'
  })
  @ApiStandardErrors()
  findAll(@Request() req, @Query() query: CampaignQueryDto) {
    return this.campaignService.findAll(req.user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get campaign details' })
  @ApiParam({ name: 'id', description: 'Campaign ID', type: String })
  @ApiStandardResponse({
    type: CampaignResponseDto,
    description: 'Campaign retrieved successfully'
  })
  @ApiStandardErrors()
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.campaignService.findOne(id, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update campaign details' })
  @ApiParam({ name: 'id', description: 'Campaign ID', type: String })
  @ApiStandardResponse({
    type: CampaignResponseDto,
    description: 'Campaign updated successfully'
  })
  @ApiStandardErrors()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCampaignDto: UpdateCampaignDto,
    @Request() req
  ) {
    return this.campaignService.update(id, req.user.id, updateCampaignDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a campaign' })
  @ApiParam({ name: 'id', description: 'Campaign ID', type: String })
  @ApiStandardResponse({
    description: 'Campaign deleted successfully'
  })
  @ApiStandardErrors()
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.campaignService.remove(id, req.user.id);
  }

  // Campaign inventory management
  @Post(':id/inventory')
  @ApiOperation({ summary: 'Add inventory to campaign' })
  @ApiParam({ name: 'id', description: 'Campaign ID', type: String })
  @ApiStandardResponse({
    description: 'Inventory added to campaign successfully'
  })
  @ApiStandardErrors()
  addInventory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() addInventoryDto: AddInventoryToCampaignDto,
    @Request() req
  ) {
    return this.campaignService.addInventory(id, req.user.id, addInventoryDto);
  }

  @Delete(':id/inventory/:inventoryId')
  @ApiOperation({ summary: 'Remove inventory from campaign' })
  @ApiParam({ name: 'id', description: 'Campaign ID', type: String })
  @ApiParam({ name: 'inventoryId', description: 'Inventory ID', type: String })
  @ApiStandardResponse({
    description: 'Inventory removed from campaign successfully'
  })
  @ApiStandardErrors()
  removeInventory(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
    @Request() req
  ) {
    return this.campaignService.removeInventory(id, inventoryId, req.user.id);
  }

  // Creative management
  // Creative management
  @Post(':id/creative')
  @ApiOperation({ summary: 'Add creative to campaign' })
  @ApiParam({ name: 'id', description: 'Campaign ID', type: String })
  @ApiStandardResponse({
    type: CreativeResponseDto,
    description: 'Creative added to campaign successfully'
  })
  @ApiStandardErrors()
  addCreative(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createCreativeDto: CreateCreativeDto,
    @Request() req
  ) {
    return this.campaignService.addCreative(id, req.user.id, createCreativeDto);
  }

  @Get(':id/available-inventories')
  @ApiOperation({ summary: 'Get available inventories for creative creation' })
  @ApiParam({ name: 'id', description: 'Campaign ID', type: String })
  @ApiStandardResponse({
    isPaginated: true,
    description: 'Available inventories retrieved successfully'
  })
  @ApiStandardErrors()
  getAvailableInventories(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetAvailableInventoriesForCreativeDto,
    @Request() req
  ) {
    return this.campaignService.getAvailableInventoriesForCreative(id, req.user.id, query);
  }

  @Get(':id/creative')
  @ApiOperation({ summary: 'Get all creatives for a campaign' })
  @ApiParam({ name: 'id', description: 'Campaign ID', type: String })
  @ApiStandardResponse({
    description: 'Campaign creatives retrieved successfully'
  })
  @ApiStandardErrors()
  getCreatives(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req
  ) {
    return this.campaignService.getCreatives(id, req.user.id);
  }

  @Delete(':id/creative/:creativeId')
  @ApiOperation({ summary: 'Remove creative from campaign' })
  @ApiParam({ name: 'id', description: 'Campaign ID', type: String })
  @ApiParam({ name: 'creativeId', description: 'Creative ID', type: String })
  @ApiStandardResponse({
    description: 'Creative removed from campaign successfully'
  })
  @ApiStandardErrors()
  removeCreative(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('creativeId', ParseUUIDPipe) creativeId: string,
    @Request() req
  ) {
    return this.campaignService.removeCreative(id, creativeId, req.user.id);
  }

  // Campaign status management
  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate a campaign' })
  @ApiParam({ name: 'id', description: 'Campaign ID', type: String })
  @ApiStandardResponse({
    type: CampaignResponseDto,
    description: 'Campaign activated successfully'
  })
  @ApiStandardErrors()
  activate(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.campaignService.updateStatus(id, req.user.id, 'ACTIVE');
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause a campaign' })
  @ApiParam({ name: 'id', description: 'Campaign ID', type: String })
  @ApiStandardResponse({
    type: CampaignResponseDto,
    description: 'Campaign paused successfully'
  })
  @ApiStandardErrors()
  pause(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.campaignService.updateStatus(id, req.user.id, 'PAUSED');
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a campaign' })
  @ApiParam({ name: 'id', description: 'Campaign ID', type: String })
  @ApiStandardResponse({
    type: CampaignResponseDto,
    description: 'Campaign canceled successfully'
  })
  @ApiStandardErrors()
  cancel(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.campaignService.updateStatus(id, req.user.id, 'CANCELED');
  }

  // Campaign statistics
  @Get(':id/statistics')
  @ApiOperation({ summary: 'Get campaign performance statistics' })
  @ApiParam({ name: 'id', description: 'Campaign ID', type: String })
  @ApiStandardResponse({
    description: 'Campaign statistics retrieved successfully'
  })
  @ApiStandardErrors()
  getStatistics(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req
  ) {
    return this.campaignService.getCampaignStatistics(id, req.user.id);
  }
}