// src/publishers/publisher.controller.ts - Add these new endpoints

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
import { PublisherTierResponseDto, UpdatePublisherTierDto } from 'src/admin/dto/create-publisher-tier.dto';


@ApiTags('Publishers')
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

  // New tier-related endpoints
  @Get('tiers')
  @ApiOperation({ summary: 'Get all available publisher tiers' })
  @ApiResponse({
    status: 200,
    description: 'Publisher tiers retrieved successfully',
    type: [PublisherTierResponseDto],
  })
  async getAllTiers() {
    return this.publisherService.getAllPublisherTiers();
  }

  @Get('tier')
  @ApiOperation({ summary: 'Get current publisher tier information' })
  @ApiResponse({
    status: 200,
    description: 'Publisher tier information retrieved successfully',
  })
  async getCurrentTier(@Request() req) {
    const publisher = await this.publisherService.findOne(req.user.id);
    return {
      tier: publisher.tier,
      paymentThreshold: publisher.paymentThreshold,
    };
  }
}
