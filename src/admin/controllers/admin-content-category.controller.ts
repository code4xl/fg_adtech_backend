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
  import { AdminContentCategoryService } from '../services/admin-content-category.service';
  import { CreateContentCategoryDto } from '../dto/create-content-category.dto';
  import { UpdateContentCategoryDto } from '../dto/update-content-category.dto';
  import { AdminQueryDto } from '../dto/admin-query.dto';
  
  @ApiTags('Admin - Content Categories')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Controller('admin/content-categories')
  export class AdminContentCategoryController {
    constructor(
      private readonly contentCategoryService: AdminContentCategoryService
    ) {}
  
    @Post()
    @ApiOperation({ summary: 'Create a new content category' })
    @ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Content category created successfully',
    })
    @ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'Content category with this name already exists',
    })
    create(@Body() createDto: CreateContentCategoryDto) {
      return this.contentCategoryService.create(createDto);
    }
  
    @Get()
    @ApiOperation({ summary: 'Get all content categories with pagination and filters' })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'List of content categories retrieved successfully',
    })
    findAll(@Query() query: AdminQueryDto) {
      return this.contentCategoryService.findAll(query);
    }
  
    @Get(':id')
    @ApiOperation({ summary: 'Get a specific content category by ID' })
    @ApiParam({
      name: 'id',
      description: 'Content category ID',
      type: 'string',
    })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'Content category retrieved successfully',
    })
    @ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Content category not found',
    })
    findOne(@Param('id') id: string) {
      return this.contentCategoryService.findOne(id);
    }
  
    @Patch(':id')
    @ApiOperation({ summary: 'Update a content category' })
    @ApiParam({
      name: 'id',
      description: 'Content category ID',
      type: 'string',
    })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'Content category updated successfully',
    })
    @ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Content category not found',
    })
    @ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'Content category with this name already exists',
    })
    update(
      @Param('id') id: string,
      @Body() updateDto: UpdateContentCategoryDto
    ) {
      return this.contentCategoryService.update(id, updateDto);
    }
  
    @Delete(':id')
    @ApiOperation({ summary: 'Delete a content category' })
    @ApiParam({
      name: 'id',
      description: 'Content category ID',
      type: 'string',
    })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'Content category deleted successfully',
    })
    @ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Content category not found',
    })
    @ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'Cannot delete content category that is in use',
    })
    remove(@Param('id') id: string) {
      return this.contentCategoryService.remove(id);
    }
  
    @Patch(':id/toggle-status')
    @ApiOperation({ summary: 'Toggle content category active status' })
    @ApiParam({
      name: 'id',
      description: 'Content category ID',
      type: 'string',
    })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'Content category status toggled successfully',
    })
    @ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Content category not found',
    })
    toggleStatus(@Param('id') id: string) {
      return this.contentCategoryService.toggleStatus(id);
    }
  }