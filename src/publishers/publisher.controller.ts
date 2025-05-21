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
  async updateProfile(@Request() req, @Body() updatePublisherDto: UpdatePublisherDto) {
    return this.publisherService.update(req.user.id, updatePublisherDto);
  }

  @Get('inventory')
  @ApiOperation({ summary: 'Get publisher inventory' })
  @ApiResponse({
    status: 200,
    description: 'Publisher inventory retrieved successfully',
  })
  async getInventory(@Request() req) {
    return this.publisherService.getPublisherInventory(req.user.id);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get publisher categories' })
  @ApiResponse({
    status: 200,
    description: 'Publisher categories retrieved successfully',
  })
  async getCategories(@Request() req) {
    return this.publisherService.getPublisherCategories(req.user.id);
  }

  @Get('languages')
  @ApiOperation({ summary: 'Get publisher languages' })
  @ApiResponse({
    status: 200,
    description: 'Publisher languages retrieved successfully',
  })
  async getLanguages(@Request() req) {
    return this.publisherService.getPublisherLanguages(req.user.id);
  }
} 