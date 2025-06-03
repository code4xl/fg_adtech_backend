import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Publisher } from '@prisma/client';
import { PublisherGuard } from 'src/common/guards/authorization.guard';
import { PublisherService } from './publisher.service';

import {
  CreateTargetingRuleDto,
  TargetingRuleResponseDto,
  TargetingRulesListResponseDto,
  UpdateTargetingRuleDto,
} from './dto/targeting-rules.dto';

@ApiTags('Publisher Targeting Rules')
@ApiBearerAuth()
@Controller('publishers/inventory/:inventoryId/targeting-rules')
@UseGuards(PublisherGuard)
export class PublisherTargetingRulesController {
  constructor(private readonly publisherService: PublisherService) {}

  @Post()
  @ApiOperation({
    summary: 'Add targeting rule to inventory',
    description: 'Create a new targeting rule for specific ad inventory',
  })
  @ApiParam({
    name: 'inventoryId',
    description: 'Inventory ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiBody({ type: CreateTargetingRuleDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Targeting rule created successfully',
    type: TargetingRuleResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Inventory not found or not owned by publisher',
  })
  async addTargetingRule(
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,

    @Body(ValidationPipe) createTargetingRuleDto: CreateTargetingRuleDto,
  ): Promise<TargetingRuleResponseDto> {
    return this.publisherService.addTargetingRule(
      inventoryId,
      createTargetingRuleDto,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Get targeting rules for inventory',
    description: 'Retrieve all targeting rules for specific ad inventory',
  })
  @ApiParam({
    name: 'inventoryId',
    description: 'Inventory ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10, max: 100)',
    example: 10,
  })
  @ApiQuery({
    name: 'ruleType',
    required: false,
    enum: [
      'DEMOGRAPHIC',
      'GEOGRAPHIC',
      'DEVICE',
      'CONTEXTUAL',
      'BEHAVIORAL',
      'TIME',
      'FREQUENCY',
    ],
    description: 'Filter by rule type',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Targeting rules retrieved successfully',
    type: TargetingRulesListResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Inventory not found or not owned by publisher',
  })
  async getTargetingRules(
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
    @Query('ruleType') ruleType?: string,
  ): Promise<TargetingRulesListResponseDto> {
    return await this.publisherService.getTargetingRules(inventoryId, ruleType);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get specific targeting rule',
    description: 'Retrieve details of a specific targeting rule',
  })
  @ApiParam({
    name: 'inventoryId',
    description: 'Inventory ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiParam({
    name: 'id',
    description: 'Targeting rule ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Targeting rule retrieved successfully',
    type: TargetingRuleResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Targeting rule not found',
  })
  async getTargetingRule(
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TargetingRuleResponseDto> {
    return this.publisherService.getTargetingRule(inventoryId, id);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update targeting rule',
    description: 'Update an existing targeting rule',
  })
  @ApiParam({
    name: 'inventoryId',
    description: 'Inventory ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiParam({
    name: 'id',
    description: 'Targeting rule ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateTargetingRuleDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Targeting rule updated successfully',
    type: TargetingRuleResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Targeting rule not found',
  })
  async updateTargetingRule(
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateTargetingRuleDto: UpdateTargetingRuleDto,
  ): Promise<TargetingRuleResponseDto> {
    return this.publisherService.updateTargetingRule(
      inventoryId,
      id,
      updateTargetingRuleDto,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete targeting rule',
    description: 'Delete a targeting rule from inventory',
  })
  @ApiParam({
    name: 'inventoryId',
    description: 'Inventory ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiParam({
    name: 'id',
    description: 'Targeting rule ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Targeting rule deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Targeting rule deleted successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Targeting rule not found',
  })
  async deleteTargetingRule(
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.publisherService.deleteTargetingRule(inventoryId, id);

    return {
      success: true,
      message: 'Targeting rule deleted successfully',
    };
  }
}
