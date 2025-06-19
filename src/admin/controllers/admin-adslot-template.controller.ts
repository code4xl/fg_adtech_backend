import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Query,
    UseGuards,
    HttpStatus,
  } from '@nestjs/common';
  import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiBearerAuth,
  } from '@nestjs/swagger';
  import { AdminGuard } from '../../common/guards/authorization.guard';
  import { AdminAdSlotTemplateService } from '../services/admin-adslot-template.service';
  import { CreateAdSlotTemplateDto } from '../dto/create-adslot-template.dto';
  import { UpdateAdSlotTemplateDto } from '../dto/update-adslot-template.dto';
  import { AdminQueryDto } from '../dto/admin-query.dto';
  
  @ApiTags('Admin - Ad Slot Templates')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Controller('api/admin/adslot-templates')
  export class AdminAdSlotTemplateController {
    constructor(
      private readonly adSlotTemplateService: AdminAdSlotTemplateService
    ) {}
  
    @Post()
    @ApiOperation({ summary: 'Create a new ad slot template' })
    @ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Ad slot template created successfully',
    })
    @ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'Ad slot template with this name already exists',
    })
    create(@Body() createDto: CreateAdSlotTemplateDto) {
      return this.adSlotTemplateService.create(createDto);
    }
  
    @Get()
    @ApiOperation({ summary: 'Get all ad slot templates with pagination and filters' })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'List of ad slot templates retrieved successfully',
    })
    findAll(@Query() query: AdminQueryDto) {
      return this.adSlotTemplateService.findAll(query);
    }
  
    @Get(':id')
    @ApiOperation({ summary: 'Get a specific ad slot template by ID' })
    @ApiParam({
      name: 'id',
      description: 'Ad slot template ID',
      type: 'string',
    })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'Ad slot template retrieved successfully',
    })
    @ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Ad slot template not found',
    })
    findOne(@Param('id') id: string) {
      return this.adSlotTemplateService.findOne(id);
    }
  
    @Patch(':id')
    @ApiOperation({ summary: 'Update an ad slot template' })
    @ApiParam({
      name: 'id',
      description: 'Ad slot template ID',
      type: 'string',
    })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'Ad slot template updated successfully',
    })
    @ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Ad slot template not found',
    })
    @ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'Ad slot template with this name already exists',
    })
    update(
      @Param('id') id: string,
      @Body() updateDto: UpdateAdSlotTemplateDto
    ) {
      return this.adSlotTemplateService.update(id, updateDto);
    }
  
    @Delete(':id')
    @ApiOperation({ summary: 'Delete an ad slot template' })
    @ApiParam({
      name: 'id',
      description: 'Ad slot template ID',
      type: 'string',
    })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'Ad slot template deleted successfully',
    })
    @ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Ad slot template not found',
    })
    @ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'Cannot delete ad slot template that is in use',
    })
    remove(@Param('id') id: string) {
      return this.adSlotTemplateService.remove(id);
    }
  
    @Patch(':id/toggle-status')
    @ApiOperation({ summary: 'Toggle ad slot template active status' })
    @ApiParam({
      name: 'id',
      description: 'Ad slot template ID',
      type: 'string',
    })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'Ad slot template status toggled successfully',
    })
    @ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Ad slot template not found',
    })
    toggleStatus(@Param('id') id: string) {
      return this.adSlotTemplateService.toggleStatus(id);
    }
  }