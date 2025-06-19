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
  } from '@nestjs/swagger';
  import { PublisherGuard, AdvertiserGuard } from '../../common/guards/authorization.guard';
  import { PrismaService } from '../../prisma/prisma.service';
  import { IsOptional, IsNumber, IsString, Min, Max } from 'class-validator';
  import { Transform } from 'class-transformer';
  import { ApiPropertyOptional } from '@nestjs/swagger';
  import { Prisma } from '@prisma/client';
  
  class PublicQueryDto {
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
      description: 'Search term for filtering by name',
      example: 'banner',
    })
    @IsOptional()
    @IsString()
    search?: string;
  
    @ApiPropertyOptional({
      description: 'Filter by ad format',
      example: 'BANNER',
    })
    @IsOptional()
    @IsString()
    format?: string;
  
    @ApiPropertyOptional({
      description: 'Filter by position',
      example: 'ABOVE_FOLD',
    })
    @IsOptional()
    @IsString()
    position?: string;
  }
  
  @ApiTags('Public - Ad Slot Templates')
  @Controller('api/adslot-templates')
  export class AdSlotTemplatePublicController {
    constructor(private readonly prisma: PrismaService) {}
  
    @Get()
    @ApiOperation({ summary: 'Get all active ad slot templates' })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'List of active ad slot templates retrieved successfully',
    })
    async findAll(@Query() query: PublicQueryDto) {
      const { page, limit, search, format, position } = query;
      const skip = (page - 1) * limit;
  
      const where: Prisma.AdSlotTemplateWhereInput = {};
      (where as any).isActive = true;
  
      if (search) {
        where.name = {
          contains: search,
          mode: 'insensitive',
        };
      }
  
      if (format) {
        where.format = format as any;
      }
  
      if (position) {
        where.position = position as any;
      }
  
      const [data, total] = await Promise.all([
        this.prisma.adSlotTemplate.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            name: 'asc',
          },
          select: {
            id: true,
            name: true,
            width: true,
            height: true,
            format: true,
            position: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        this.prisma.adSlotTemplate.count({ where }),
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
    @ApiOperation({ summary: 'Get a specific active ad slot template by ID' })
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
      description: 'Ad slot template not found or inactive',
    })
    async findOne(@Param('id') id: string) {
      const template = await this.prisma.adSlotTemplate.findFirst({
        where: {
          id,
          isActive: true,
        } as any,
        select: {
          id: true,
          name: true,
          width: true,
          height: true,
          format: true,
          position: true,
          createdAt: true,
          updatedAt: true,
        },
      });
  
      if (!template) {
        throw new NotFoundException('Ad slot template not found or inactive');
      }
  
      return template;
    }
  }
  
  // Protected endpoints for authenticated publishers
  @ApiTags('Publishers - Ad Slot Templates')
  @ApiBearerAuth()
  @Controller('api/publisher/adslot-templates')
  export class AdSlotTemplatePublisherController {
    constructor(private readonly prisma: PrismaService) {}
  
    @Get()
    @UseGuards(PublisherGuard)
    @ApiOperation({ summary: 'Get all active ad slot templates for publishers' })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'List of active ad slot templates retrieved successfully',
    })
    async findAllForPublisher(@Query() query: PublicQueryDto) {
      const controller = new AdSlotTemplatePublicController(this.prisma);
      return controller.findAll(query);
    }
  
    @Get(':id')
    @UseGuards(PublisherGuard)
    @ApiOperation({ summary: 'Get a specific active ad slot template for publishers' })
    @ApiParam({
      name: 'id',
      description: 'Ad slot template ID',
      type: 'string',
    })
    async findOneForPublisher(@Param('id') id: string) {
      const controller = new AdSlotTemplatePublicController(this.prisma);
      return controller.findOne(id);
    }
  }

  // Protected endpoints for authenticated advertisers
  @ApiTags('Advertisers - Ad Slot Templates')
  @ApiBearerAuth()
  @Controller('api/advertiser/adslot-templates')
  export class AdSlotTemplateAdvertiserController {
    constructor(private readonly prisma: PrismaService) {}

    @Get()
    @UseGuards(AdvertiserGuard)
    @ApiOperation({ summary: 'Get all active ad slot templates for advertisers' })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'List of active ad slot templates retrieved successfully',
    })
    async findAllForAdvertiser(@Query() query: PublicQueryDto) {
      const controller = new AdSlotTemplatePublicController(this.prisma);
      return controller.findAll(query);
    }
  
    @Get(':id')
    @UseGuards(AdvertiserGuard)
    @ApiOperation({ summary: 'Get a specific active ad slot template for advertisers' })
    @ApiParam({
      name: 'id',
      description: 'Ad slot template ID',
      type: 'string',
    })
    async findOneForAdvertiser(@Param('id') id: string) {
      const controller = new AdSlotTemplatePublicController(this.prisma);
      return controller.findOne(id);
    }
  }