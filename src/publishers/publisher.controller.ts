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
  Request,
  ForbiddenException,
  HttpStatus,
} from '@nestjs/common';
import { PublisherService } from './publisher.service';
import { UpdatePublisherDto } from './dto/update-publisher.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PublisherGuard } from 'src/common/guards/authorization.guard';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { CreateFloorPriceDto } from './dto/create-floor-price.dto';
import { UpdateFloorPriceDto } from './dto/update-floor-price.dto';
import { CreateTargetingRuleDto } from './dto/create-targeting-rule.dto';
import { UpdateTargetingRuleDto } from './dto/update-targeting-rule.dto';
import { CreateWebsiteDto } from './dto/create-website.dto';

@ApiTags('publishers')
@Controller('publishers')
@UseGuards(PublisherGuard)
@ApiBearerAuth()
export class PublisherController {
  constructor(private readonly publisherService: PublisherService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get publisher profile' })
  @ApiResponse({
    status: 200,
    description: 'Publisher profile retrieved successfully',
  })
  async getProfile(@Request() req) {
    return this.publisherService.findOne(req.user.id);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update publisher profile' })
  @ApiResponse({
    status: 200,
    description: 'Publisher profile updated successfully',
  })
  async updateProfile(
    @Request() req,
    @Body() updatePublisherDto: UpdatePublisherDto,
  ) {
    return this.publisherService.update(req.user.id, updatePublisherDto);
  }
  @Delete('deactivate')
  @ApiOperation({ summary: 'Deactivate publisher account' })
  @ApiResponse({
    status: 200,
    description: 'Publisher account deactivate successfully',
  })
  async deleteAccount(@Request() req) {
    return this.publisherService.deactivatePublisherAccount(req.user.id);
  }
  // @Get('inventory')
  // @ApiOperation({ summary: 'Get publisher inventory' })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Publisher inventory retrieved successfully',
  // })
  // async getInventory(@Request() req) {
  //   return this.publisherService.getPublisherInventory(req.user.id);
  // }

  // @Get('categories')
  // @ApiOperation({ summary: 'Get publisher categories' })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Publisher categories retrieved successfully',
  // })
  // async getCategories(@Request() req) {
  //   return this.publisherService.getPublisherCategories(req.user.id);
  // }

  // @Get('languages')
  // @ApiOperation({ summary: 'Get publisher languages' })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Publisher languages retrieved successfully',
  // })
  // async getLanguages(@Request() req) {
  //   return this.publisherService.getPublisherLanguages(req.user.id);
  // }

  // // Inventory Management Endpoints
  // @Post('inventory')
  // @ApiOperation({ summary: 'Create new inventory' })
  // @ApiResponse({
  //   status: HttpStatus.CREATED,
  //   description: 'Inventory created successfully',
  // })
  // async createInventory(
  //   @Request() req,
  //   @Body() createInventoryDto: CreateInventoryDto,
  // ) {
  //   return this.publisherService.createInventory(
  //     req.user.id,
  //     createInventoryDto,
  //   );
  // }

  // @Patch('inventory/:id')
  // @ApiOperation({ summary: 'Update inventory' })
  // @ApiResponse({
  //   status: HttpStatus.OK,
  //   description: 'Inventory updated successfully',
  // })
  // async updateInventory(
  //   @Request() req,
  //   @Param('id') inventoryId: string,
  //   @Body() updateInventoryDto: UpdateInventoryDto,
  // ) {
  //   return this.publisherService.updatePublisherInventory(
  //     req.user.id,
  //     inventoryId,
  //     updateInventoryDto,
  //   );
  // }

  // @Delete('inventory/:id')
  // @ApiOperation({ summary: 'Delete inventory' })
  // @ApiResponse({
  //   status: HttpStatus.OK,
  //   description: 'Inventory deleted successfully',
  // })
  // async deleteInventory(@Request() req, @Param('id') inventoryId: string) {
  //   return this.publisherService.deletePublisherInventory(
  //     req.user.id,
  //     inventoryId,
  //   );
  // }

  // @Patch('inventory/:id/status')
  // @ApiOperation({ summary: 'Activate or deactivate inventory' })
  // @ApiResponse({
  //   status: HttpStatus.OK,
  //   description: 'Inventory status updated successfully',
  // })
  // async toggleInventoryStatus(
  //   @Request() req,
  //   @Param('id') inventoryId: string,
  //   @Body('active') active: boolean,
  // ) {
  //   return this.publisherService.toggleInventoryStatus(
  //     req.user.id,
  //     inventoryId,
  //     active,
  //   );
  // }

  // @Get('inventory/:id/metrics')
  // @ApiOperation({ summary: 'Get inventory metrics' })
  // @ApiResponse({
  //   status: HttpStatus.OK,
  //   description: 'Inventory metrics retrieved successfully',
  // })
  // async getInventoryMetrics(
  //   @Request() req,
  //   @Param('id') inventoryId: string,
  //   @Query('startDate') startDate: string,
  //   @Query('endDate') endDate: string,
  // ) {
  //   return this.publisherService.getInventoryMetrics(
  //     req.user.id,
  //     inventoryId,
  //     startDate,
  //     endDate,
  //   );
  // }

  // // Category Management Endpoints
  // @Post('inventory/:id/categories')
  // @ApiOperation({ summary: 'Assign categories to inventory' })
  // @ApiResponse({
  //   status: HttpStatus.OK,
  //   description: 'Categories assigned successfully',
  // })
  // async assignCategoriesToInventory(
  //   @Request() req,
  //   @Param('id') inventoryId: string,
  //   @Body('categoryIds') categoryIds: string[],
  // ) {
  //   return this.publisherService.assignCategoriesToInventory(
  //     req.user.id,
  //     inventoryId,
  //     categoryIds,
  //   );
  // }

  // @Delete('inventory/:id/categories/:categoryId')
  // @ApiOperation({ summary: 'Remove category from inventory' })
  // @ApiResponse({
  //   status: HttpStatus.OK,
  //   description: 'Category removed successfully',
  // })
  // async removeCategoryFromInventory(
  //   @Request() req,
  //   @Param('id') inventoryId: string,
  //   @Param('categoryId') categoryId: string,
  // ) {
  //   return this.publisherService.removeCategoryFromInventory(
  //     req.user.id,
  //     inventoryId,
  //     categoryId,
  //   );
  // }

  // @Post('categories/assign')
  // @ApiOperation({ summary: 'Assign categories to publisher profile' })
  // @ApiResponse({
  //   status: HttpStatus.OK,
  //   description: 'Categories assigned to profile successfully',
  // })
  // async assignCategoriesToProfile(
  //   @Request() req,
  //   @Body('categoryIds') categoryIds: string[],
  // ) {
  //   return this.publisherService.assignCategoriesToProfile(
  //     req.user.id,
  //     categoryIds,
  //   );
  // }

  // // Floor Price Management Endpoints
  // @Post('inventory/:id/floor-prices')
  // @ApiOperation({ summary: 'Create floor price for inventory' })
  // @ApiResponse({
  //   status: HttpStatus.CREATED,
  //   description: 'Floor price created successfully',
  // })
  // async createFloorPrice(
  //   @Request() req,
  //   @Param('id') inventoryId: string,
  //   @Body() createFloorPriceDto: CreateFloorPriceDto,
  // ) {
  //   return this.publisherService.createFloorPrice(
  //     req.user.id,
  //     inventoryId,
  //     createFloorPriceDto,
  //   );
  // }

  // @Patch('inventory/:id/floor-prices/:floorPriceId')
  // @ApiOperation({ summary: 'Update floor price' })
  // @ApiResponse({
  //   status: HttpStatus.OK,
  //   description: 'Floor price updated successfully',
  // })
  // async updateFloorPrice(
  //   @Request() req,
  //   @Param('id') inventoryId: string,
  //   @Param('floorPriceId') floorPriceId: string,
  //   @Body() updateFloorPriceDto: UpdateFloorPriceDto,
  // ) {
  //   return this.publisherService.updateFloorPrice(
  //     req.user.id,
  //     inventoryId,
  //     floorPriceId,
  //     updateFloorPriceDto,
  //   );
  // }

  // @Delete('inventory/:id/floor-prices/:floorPriceId')
  // @ApiOperation({ summary: 'Delete floor price' })
  // @ApiResponse({
  //   status: HttpStatus.OK,
  //   description: 'Floor price deleted successfully',
  // })
  // async deleteFloorPrice(
  //   @Request() req,
  //   @Param('id') inventoryId: string,
  //   @Param('floorPriceId') floorPriceId: string,
  // ) {
  //   return this.publisherService.deleteFloorPrice(
  //     req.user.id,
  //     inventoryId,
  //     floorPriceId,
  //   );
  // }

  // // Targeting Rules Endpoints
  // @Post('inventory/:id/targeting-rules')
  // @ApiOperation({ summary: 'Create targeting rule for inventory' })
  // @ApiResponse({
  //   status: HttpStatus.CREATED,
  //   description: 'Targeting rule created successfully',
  // })
  // async createTargetingRule(
  //   @Request() req,
  //   @Param('id') inventoryId: string,
  //   @Body() createTargetingRuleDto: CreateTargetingRuleDto,
  // ) {
  //   return this.publisherService.createTargetingRule(
  //     req.user.id,
  //     inventoryId,
  //     createTargetingRuleDto,
  //   );
  // }

  // @Patch('inventory/:id/targeting-rules/:ruleId')
  // @ApiOperation({ summary: 'Update targeting rule' })
  // @ApiResponse({
  //   status: HttpStatus.OK,
  //   description: 'Targeting rule updated successfully',
  // })
  // async updateTargetingRule(
  //   @Request() req,
  //   @Param('id') inventoryId: string,
  //   @Param('ruleId') ruleId: string,
  //   @Body() updateTargetingRuleDto: UpdateTargetingRuleDto,
  // ) {
  //   return this.publisherService.updateTargetingRule(
  //     req.user.id,
  //     inventoryId,
  //     ruleId,
  //     updateTargetingRuleDto,
  //   );
  // }

  // @Delete('inventory/:id/targeting-rules/:ruleId')
  // @ApiOperation({ summary: 'Delete targeting rule' })
  // @ApiResponse({
  //   status: HttpStatus.OK,
  //   description: 'Targeting rule deleted successfully',
  // })
  // async deleteTargetingRule(
  //   @Request() req,
  //   @Param('id') inventoryId: string,
  //   @Param('ruleId') ruleId: string,
  // ) {
  //   return this.publisherService.deleteTargetingRule(
  //     req.user.id,
  //     inventoryId,
  //     ruleId,
  //   );
  // }

  // @Get('inventory/:id/targeting-rules')
  // @ApiOperation({ summary: 'Get targeting rules for inventory' })
  // @ApiResponse({
  //   status: HttpStatus.OK,
  //   description: 'Targeting rules retrieved successfully',
  // })
  // async getTargetingRules(@Request() req, @Param('id') inventoryId: string) {
  //   return this.publisherService.getTargetingRules(req.user.id, inventoryId);
  // }

  // // New Flow

  // @Post('website')
  // @ApiOperation({ summary: 'Create new website' })
  // @ApiResponse({
  //   status: HttpStatus.CREATED,
  //   description: 'Website created successfully',
  // })
  // async createWebsite(
  //   @Request() req,
  //   @Body() createWebsiteDto: CreateWebsiteDto,
  // ) {
  //   const publisherId = createWebsiteDto.publisherId;
  //   if (!publisherId) {
  //     throw new ForbiddenException('Publisher ID is required');
  //   }
  //   return this.publisherService.createWebsite(publisherId, createWebsiteDto);
  // }
}
