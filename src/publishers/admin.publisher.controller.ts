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
  import { PublisherService } from './publisher.service';
  import { CreatePublisherDto } from './dto/create-publisher.dto';
  import { UpdatePublisherDto } from './dto/update-publisher.dto';
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
  import { AssignCategoryDto } from './dto/assign-category.dto';
  import { AssignLanguageDto } from './dto/assign-language.dto';
  
  @ApiTags('admin/publishers')
  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Controller('admin/publishers')
  export class AdminPublisherController {
    constructor(private readonly publisherService: PublisherService) {}
  
    @Post()
    @ApiOperation({ summary: 'Create a new publisher' })
    @ApiStandardResponse({
      description: 'Publisher created successfully'
    })
    @ApiStandardErrors()
    create(@Body() createPublisherDto: CreatePublisherDto) {
      return this.publisherService.create(createPublisherDto);
    }
  
    @Get()
    @ApiOperation({ summary: 'Get all publishers' })
    @ApiQuery({ name: 'status', required: false, description: 'Filter by publisher status' })
    @ApiQuery({ name: 'search', required: false, description: 'Search by name or email' })
    @ApiStandardResponse({
      description: 'Publishers retrieved successfully'
    })
    @ApiStandardErrors()
    findAll(@Query() query: { status?: string; search?: string }) {
      return this.publisherService.findAll(query);
    }
  
    @Get(':id')
    @ApiOperation({ summary: 'Get a specific publisher by ID' })
    @ApiParam({ name: 'id', description: 'Publisher ID' })
    @ApiStandardResponse({
      description: 'Publisher retrieved successfully'
    })
    @ApiStandardErrors()
    findOne(@Param('id', ParseUUIDPipe) id: string) {
      return this.publisherService.findOne(id);
    }
  
    @Patch(':id')
    @ApiOperation({ summary: 'Update a publisher' })
    @ApiParam({ name: 'id', description: 'Publisher ID' })
    @ApiStandardResponse({
      description: 'Publisher updated successfully'
    })
    @ApiStandardErrors()
    update(
      @Param('id', ParseUUIDPipe) id: string,
      @Body() updatePublisherDto: UpdatePublisherDto
    ) {
      return this.publisherService.update(id, updatePublisherDto);
    }
  
    @Delete(':id')
    @ApiOperation({ summary: 'Delete a publisher' })
    @ApiParam({ name: 'id', description: 'Publisher ID' })
    @ApiStandardResponse({
      description: 'Publisher deleted successfully'
    })
    @ApiStandardErrors()
    remove(@Param('id', ParseUUIDPipe) id: string) {
      return this.publisherService.remove(id);
    }
    

    @Get('publishers/filter')
    @ApiQuery({ name: 'categoryId', required: false })
    @ApiQuery({ name: 'language', required: false })
    async getFilteredPublishers(
      @Query('categoryId') categoryId?: string,
      @Query('language') language?: string
    ) {
      return this.publisherService.getPublishersByCategoryAndLanguage(categoryId, language);
    }
    @Get(':id/inventory')
    @ApiOperation({ summary: 'Get all inventory items for a publisher' })
    @ApiParam({ name: 'id', description: 'Publisher ID' })
    @ApiStandardResponse({
      description: 'Inventory items retrieved successfully'
    })
    @ApiStandardErrors()
    getInventory(@Param('id', ParseUUIDPipe) id: string) {
      return this.publisherService.getPublisherInventory(id);
    }
  
    @Get(':id/categories')
    @ApiOperation({ summary: 'Get all categories assigned to a publisher' })
    @ApiParam({ name: 'id', description: 'Publisher ID' })
    @ApiStandardResponse({
      description: 'Categories retrieved successfully'
    })
    @ApiStandardErrors()
    getCategories(@Param('id', ParseUUIDPipe) id: string) {
      return this.publisherService.getPublisherCategories(id);
    }
  
    @Post(':id/categories')
    @ApiOperation({ summary: 'Assign a category to a publisher' })
    @ApiParam({ name: 'id', description: 'Publisher ID' })
    @ApiStandardResponse({
      description: 'Category assigned successfully'
    })
    @ApiStandardErrors()
    assignCategory(
      @Param('id', ParseUUIDPipe) id: string,
      @Body() assignCategoryDto: AssignCategoryDto
    ) {
      return this.publisherService.assignCategory(id, assignCategoryDto.categoryId);
    }
  
    @Delete(':id/categories/:categoryId')
    @ApiOperation({ summary: 'Remove a category from a publisher' })
    @ApiParam({ name: 'id', description: 'Publisher ID' })
    @ApiParam({ name: 'categoryId', description: 'Category ID' })
    @ApiStandardResponse({
      description: 'Category removed successfully'
    })
    @ApiStandardErrors()
    removeCategory(
      @Param('id', ParseUUIDPipe) id: string,
      @Param('categoryId', ParseUUIDPipe) categoryId: string
    ) {
      return this.publisherService.removeCategory(id, categoryId);
    }
  
    @Get(':id/languages')
    @ApiOperation({ summary: 'Get all languages assigned to a publisher' })
    @ApiParam({ name: 'id', description: 'Publisher ID' })
    @ApiStandardResponse({
      description: 'Languages retrieved successfully'
    })
    @ApiStandardErrors()
    getLanguages(@Param('id', ParseUUIDPipe) id: string) {
      return this.publisherService.getPublisherLanguages(id);
    }
  
    @Post(':id/languages')
    @ApiOperation({ summary: 'Assign a language to a publisher' })
    @ApiParam({ name: 'id', description: 'Publisher ID' })
    @ApiStandardResponse({
      description: 'Language assigned successfully'
    })
    @ApiStandardErrors()
    assignLanguage(
      @Param('id', ParseUUIDPipe) id: string,
      @Body() assignLanguageDto: AssignLanguageDto
    ) {
      return this.publisherService.assignLanguage(id, assignLanguageDto.language);
    }
  
    @Delete(':id/languages/:language')
    @ApiOperation({ summary: 'Remove a language from a publisher' })
    @ApiParam({ name: 'id', description: 'Publisher ID' })
    @ApiParam({ name: 'language', description: 'Language code' })
    @ApiStandardResponse({
      description: 'Language removed successfully'
    })
    @ApiStandardErrors()
    removeLanguage(
      @Param('id', ParseUUIDPipe) id: string,
      @Param('language') language: string
    ) {
      return this.publisherService.removeLanguage(id, language);
    }
  }