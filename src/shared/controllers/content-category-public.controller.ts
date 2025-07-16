import {
    Controller,
    Get,
    Param,
    Query,
    UseGuards,
    HttpStatus,
    NotFoundException,
  } from '@nestjs/common';
  import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiBearerAuth,
    ApiExcludeController,
  } from '@nestjs/swagger';
  import { PublisherGuard, AdvertiserGuard } from '../../common/guards/authorization.guard';
  import { PrismaService } from '../../prisma/prisma.service';
  import { IsOptional, IsNumber, IsString, Min, Max } from 'class-validator';
  import { Transform } from 'class-transformer';
  import { ApiPropertyOptional } from '@nestjs/swagger';
  import { Prisma } from '@prisma/client';
  
  class PublicCategoryQueryDto {
    @ApiPropertyOptional({
      description: 'Page number for pagination',
      example: 1,
      minimum: 1,
    })
    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    @IsNumber()
    @Min(1)
    page?: number = 1;
  
    @ApiPropertyOptional({
      description: 'Number of items per page',
      example: 20,
      minimum: 1,
      maximum: 100,
    })
    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    @IsNumber()
    @Min(1)
    @Max(100)
    limit?: number = 20;
  
    @ApiPropertyOptional({
      description: 'Search term for filtering by name or description',
      example: 'technology',
    })
    @IsOptional()
    @IsString()
    search?: string;
  }
  
  @ApiExcludeController()
  @ApiTags('Public - Content Categories')
  @Controller('api/content-categories')
  export class ContentCategoryPublicController {
    constructor(private readonly prisma: PrismaService) {}
  
    @Get()
    @ApiOperation({ summary: 'Get all active content categories' })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'List of active content categories retrieved successfully',
    })
    async findAll(@Query() query: PublicCategoryQueryDto) {
      const { page, limit, search } = query;
      const skip = (page - 1) * limit;
  
      const where: Prisma.ContentCategoryWhereInput = {
        isActive: true,
      };
  
      if (search) {
        where.OR = [
          {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: search,
              mode: 'insensitive',
            },
          },
        ];
      }
  
      const [data, total] = await Promise.all([
        this.prisma.contentCategory.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            name: 'asc',
          },
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        this.prisma.contentCategory.count({ where }),
      ]);
  
      return {
        data,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    }
  
    @Get(':id')
    @ApiOperation({ summary: 'Get a specific active content category by ID' })
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
      description: 'Content category not found or inactive',
    })
    async findOne(@Param('id') id: string) {
      const category = await this.prisma.contentCategory.findFirst({
        where: {
          id,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
        },
      });
  
      if (!category) {
        throw new NotFoundException('Content category not found or inactive');
      }
  
      return category;
    }
  }
  
  // Protected endpoints for authenticated publishers
  @ApiExcludeController()
  @ApiTags('Publishers - Content Categories')
  @ApiBearerAuth()
  @Controller('api/publisher/content-categories')
  export class ContentCategoryPublisherController {
    constructor(private readonly prisma: PrismaService) {}
  
    @Get()
    @UseGuards(PublisherGuard)
    @ApiOperation({ summary: 'Get all active content categories for publishers' })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'List of active content categories retrieved successfully',
    })
    async findAllForPublisher(@Query() query: PublicCategoryQueryDto) {
      const controller = new ContentCategoryPublicController(this.prisma);
      return controller.findAll(query);
    }
  
    @Get(':id')
    @UseGuards(PublisherGuard)
    @ApiOperation({ summary: 'Get a specific active content category for publishers' })
    @ApiParam({
      name: 'id',
      description: 'Content category ID',
      type: 'string',
    })
    async findOneForPublisher(@Param('id') id: string) {
      const controller = new ContentCategoryPublicController(this.prisma);
      return controller.findOne(id);
    }
  }

  // Protected endpoints for authenticated advertisers
  @ApiExcludeController()
  @ApiTags('Advertisers - Content Categories')
  @ApiBearerAuth()
  @Controller('api/advertiser/content-categories')
  export class ContentCategoryAdvertiserController {
    constructor(private readonly prisma: PrismaService) {}

    @Get()
    @UseGuards(AdvertiserGuard)
    @ApiOperation({ summary: 'Get all active content categories for advertisers' })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'List of active content categories retrieved successfully',
    })
    async findAllForAdvertiser(@Query() query: PublicCategoryQueryDto) {
      const controller = new ContentCategoryPublicController(this.prisma);
      return controller.findAll(query);
    }
  
    @Get(':id')
    @UseGuards(AdvertiserGuard)
    @ApiOperation({ summary: 'Get a specific active content category for advertisers' })
    @ApiParam({
      name: 'id',
      description: 'Content category ID',
      type: 'string',
    })
    async findOneForAdvertiser(@Param('id') id: string) {
      const controller = new ContentCategoryPublicController(this.prisma);
      return controller.findOne(id);
    }
  }