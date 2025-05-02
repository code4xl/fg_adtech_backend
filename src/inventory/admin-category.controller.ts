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
  import { CategoryService } from './category.service';
  import { CreateCategoryDto } from './dto/create-category.dto';
  import { UpdateCategoryDto } from './dto/update-category.dto';
  import { AdminGuard } from '../common/guards/authorization.guard';
  import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiParam,
    ApiQuery
  } from '@nestjs/swagger';
  import { 
    ApiStandardResponse,
    ApiStandardErrors 
  } from '../common/decorators/swagger.decorator';
  
  @ApiTags('admin/categories')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Controller('admin/categories')
  export class AdminCategoryController {
    constructor(private readonly categoryService: CategoryService) {}
  
    @Post()
    @ApiOperation({ summary: 'Create a new content category' })
    @ApiStandardResponse({
      description: 'Category created successfully'
    })
    @ApiStandardErrors()
    create(@Body() createCategoryDto: CreateCategoryDto) {
      return this.categoryService.create(createCategoryDto);
    }
  
    @Get()
    @ApiOperation({ summary: 'Get all content categories' })
    @ApiQuery({ name: 'parentId', required: false, description: 'Filter by parent category ID' })
    @ApiQuery({ name: 'search', required: false, description: 'Search by category name' })
    @ApiStandardResponse({
      description: 'Categories retrieved successfully'
    })
    @ApiStandardErrors()
    findAll(@Query() query: { parentId?: string; search?: string }) {
      return this.categoryService.findAll(query);
    }
  
    @Get(':id')
    @ApiOperation({ summary: 'Get a specific category by ID' })
    @ApiParam({ name: 'id', description: 'Category ID' })
    @ApiStandardResponse({
      description: 'Category retrieved successfully'
    })
    @ApiStandardErrors()
    findOne(@Param('id', ParseUUIDPipe) id: string) {
      return this.categoryService.findOne(id);
    }
  
    @Patch(':id')
    @ApiOperation({ summary: 'Update a category' })
    @ApiParam({ name: 'id', description: 'Category ID' })
    @ApiStandardResponse({
      description: 'Category updated successfully'
    })
    @ApiStandardErrors()
    update(
      @Param('id', ParseUUIDPipe) id: string,
      @Body() updateCategoryDto: UpdateCategoryDto
    ) {
      return this.categoryService.update(id, updateCategoryDto);
    }
  
    @Delete(':id')
    @ApiOperation({ summary: 'Delete a category' })
    @ApiParam({ name: 'id', description: 'Category ID' })
    @ApiStandardResponse({
      description: 'Category deleted successfully'
    })
    @ApiStandardErrors()
    remove(@Param('id', ParseUUIDPipe) id: string) {
      return this.categoryService.remove(id);
    }
  
    @Get(':id/inventory')
    @ApiOperation({ summary: 'Get all inventory items associated with a category' })
    @ApiParam({ name: 'id', description: 'Category ID' })
    @ApiStandardResponse({
      description: 'Inventory items retrieved successfully'
    })
    @ApiStandardErrors()
    getInventory(@Param('id', ParseUUIDPipe) id: string) {
      return this.categoryService.getInventoryByCategory(id);
    }
  
    @Get(':id/publishers')
    @ApiOperation({ summary: 'Get all publishers associated with a category' })
    @ApiParam({ name: 'id', description: 'Category ID' })
    @ApiStandardResponse({
      description: 'Publishers retrieved successfully'
    })
    @ApiStandardErrors()
    getPublishers(@Param('id', ParseUUIDPipe) id: string) {
      return this.categoryService.getPublishersByCategory(id);
    }
  }