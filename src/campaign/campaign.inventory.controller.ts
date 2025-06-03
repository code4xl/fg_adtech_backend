// // inventory.campaign.controller.ts
// import {
//     Controller,
//     Get,
//     Post,
//     Body,
//     Param,
//     Delete,
//     UseGuards,
//     Query,
//     ParseUUIDPipe,
//     Patch,
//     Request
// } from '@nestjs/common';
// import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
// import { AdvertiserGuard } from '../common/guards/authorization.guard';
// import { ApiStandardErrors, ApiStandardResponse } from '../common/decorators/swagger.decorator';
// import { AssignInventoryToCampaignDto, updateInventoryCampaignSettings } from './dto/campaign-inventory.dto';
// import { InventoryCampaignService } from './campaign.inventory.service';

// @ApiTags('campaign/inventory')
// @ApiBearerAuth()
// @UseGuards(AdvertiserGuard)
// @Controller('campaign/inventory')
// export class InventoryCampaignController {
//     constructor(private readonly inventoryCampaignService: InventoryCampaignService) { }

//     // Get all the parent categories (including the child categories as well)
//     @Get('categories')
//     @ApiOperation({ summary: 'Get all parent categories' })
//     @ApiStandardResponse({
//         description: 'All parent categories retrieved successfully'
//     })
//     @ApiStandardErrors()
//     getAllParentCategories() {
//         return this.inventoryCampaignService.getAllParentCategories();
//     }

//     // Get all the languages
//     @Get('languages')
//     @ApiOperation({ summary: 'Get all available languages' })
//     @ApiStandardResponse({
//         description: 'All languages retrieved successfully'
//     })
//     @ApiStandardErrors()
//     getAllLanguages() {
//         return this.inventoryCampaignService.getAllLanguages();
//     }

//     // Get all the publishers filtered by category and language
//     @Get('publishers')
//     @ApiOperation({ summary: 'Get publishers filtered by category and language' })
//     @ApiQuery({ name: 'categoryId', required: false, description: 'Filter by category ID' })
//     @ApiQuery({ name: 'language', required: false, description: 'Filter by language code' })
//     @ApiStandardResponse({
//         description: 'Publishers retrieved successfully'
//     })
//     @ApiStandardErrors()
//     getPublishersByFilters(
//         @Query('categoryId') categoryId?: string,
//         @Query('language') language?: string,
//         @Request() req?: any
//     ) {
//         return this.inventoryCampaignService.getPublishersByFilters(
//             req.user.id,
//             categoryId,
//             language
//         );
//     }

//     @Get('publisher/:publisherId')
//     @ApiOperation({ summary: 'Get available inventory for a publisher' })
//     @ApiParam({ name: 'publisherId', description: 'Publisher ID' })
//     @ApiQuery({ name: 'format', required: false, description: 'Filter by format' })
//     @ApiQuery({ name: 'position', required: false, description: 'Filter by position' })
//     @ApiStandardResponse({
//         description: 'Publisher inventory retrieved successfully'
//     })
//     @ApiStandardErrors()
//     getPublisherInventory(
//         @Param('publisherId', ParseUUIDPipe) publisherId: string,
//         @Query('format') format?: string,
//         @Query('position') position?: string,
//         @Request() req?: any
//     ) {
//         return this.inventoryCampaignService.getPublisherInventory(
//             req.user.id,
//             publisherId,
//             format,
//             position
//         );
//     }

//     @Post('campaign/:campaignId/assign')
//     @ApiOperation({ summary: 'Assign inventory to campaign' })
//     @ApiParam({ name: 'campaignId', description: 'Campaign ID' })
//     @ApiStandardResponse({
//         description: 'Inventory assigned to campaign successfully'
//     })
//     @ApiStandardErrors()
//     assignInventoryToCampaign(
//         @Param('campaignId', ParseUUIDPipe) campaignId: string,
//         @Body() assignInventoryDto: AssignInventoryToCampaignDto,
//         @Request() req
//     ) {
//         return this.inventoryCampaignService.assignInventoryToCampaign(
//             campaignId,
//             req.user.id,
//             assignInventoryDto
//         );
//     }

//     @Delete('campaign/:campaignId/inventory/:inventoryId')
//     @ApiOperation({ summary: 'Remove inventory from campaign' })
//     @ApiParam({ name: 'campaignId', description: 'Campaign ID' })
//     @ApiParam({ name: 'inventoryId', description: 'Inventory ID' })
//     @ApiStandardResponse({
//         description: 'Inventory removed from campaign successfully'
//     })
//     @ApiStandardErrors()
//     removeInventoryFromCampaign(
//         @Param('campaignId', ParseUUIDPipe) campaignId: string,
//         @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
//         @Request() req
//     ) {
//         return this.inventoryCampaignService.removeInventoryFromCampaign(
//             campaignId,
//             inventoryId,
//             req.user.id
//         );
//     }

//     @Patch('campaign/:campaignId/inventory/:inventoryId')
//     @ApiOperation({ summary: 'Update inventory settings for a campaign' })
//     @ApiParam({ name: 'campaignId', description: 'Campaign ID' })
//     @ApiParam({ name: 'inventoryId', description: 'Inventory ID' })
//     @ApiStandardResponse({
//         description: 'Inventory settings updated successfully'
//     })
//     @ApiStandardErrors()
//     updateInventoryCampaignSettings(
//         @Param('campaignId', ParseUUIDPipe) campaignId: string,
//         @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
//         @Body() updateDto: updateInventoryCampaignSettings,
//         @Request() req
//     ) {
//         return this.inventoryCampaignService.updateInventoryCampaignSettings(
//             campaignId,
//             inventoryId,
//             req.user.id,
//             updateDto.maxBid
//         );
//     }

//     @Get('campaign/:campaignId/inventory')
//     @ApiOperation({ summary: 'Get all inventory assigned to a campaign' })
//     @ApiParam({ name: 'campaignId', description: 'Campaign ID' })
//     @ApiStandardResponse({
//         description: 'Campaign inventory retrieved successfully'
//     })
//     @ApiStandardErrors()
//     getCampaignInventory(
//         @Param('campaignId', ParseUUIDPipe) campaignId: string,
//         @Request() req
//     ) {
//         return this.inventoryCampaignService.getCampaignInventory(
//             campaignId,
//             req.user.id
//         );
//     }

//     @Get('campaign/:campaignId/inventory/stats')
//     @ApiOperation({ summary: 'Get inventory performance stats for a campaign' })
//     @ApiParam({ name: 'campaignId', description: 'Campaign ID' })
//     @ApiStandardResponse({
//         description: 'Campaign inventory stats retrieved successfully'
//     })
//     @ApiStandardErrors()
//     getCampaignInventoryStats(
//         @Param('campaignId', ParseUUIDPipe) campaignId: string,
//         @Request() req
//     ) {
//         return this.inventoryCampaignService.getCampaignInventoryStats(
//             campaignId,
//             req.user.id
//         );
//     }

//     // Additional methods can be added here as needed
//     @Get('categories/:categoryId/publishers')
//     @ApiOperation({ summary: 'Get publishers by category' })
//     @ApiParam({ name: 'categoryId', description: 'Category ID' })
//     @ApiStandardResponse({
//         description: 'Publishers retrieved successfully'
//     })
//     @ApiStandardErrors()
//     getPublishersByCategory(
//         @Param('categoryId', ParseUUIDPipe) categoryId: string,
//         @Request() req
//     ) {
//         return this.inventoryCampaignService.getPublishersByFilters(
//             req.user.id,
//             categoryId
//         );
//     }

//     @Get('languages/:language/publishers')
//     @ApiOperation({ summary: 'Get publishers by language' })
//     @ApiParam({ name: 'language', description: 'Language code (e.g., ENGLISH)' })
//     @ApiStandardResponse({
//         description: 'Publishers retrieved successfully'
//     })
//     @ApiStandardErrors()
//     getPublishersByLanguage(
//         @Param('language') language: string,
//         @Request() req
//     ) {
//         return this.inventoryCampaignService.getPublishersByFilters(
//             req.user.id,
//             undefined,
//             language
//         );
//     }

//     @Get('formats')
//     @ApiOperation({ summary: 'Get all available inventory formats' })
//     @ApiStandardResponse({
//         description: 'Inventory formats retrieved successfully'
//     })
//     @ApiStandardErrors()
//     getInventoryFormats() {
//         return this.inventoryCampaignService.getInventoryFormats();
//     }

//     @Get('positions')
//     @ApiOperation({ summary: 'Get all available inventory positions' })
//     @ApiStandardResponse({
//         description: 'Inventory positions retrieved successfully'
//     })
//     @ApiStandardErrors()
//     getInventoryPositions() {
//         return this.inventoryCampaignService.getInventoryPositions();
//     }
// }
