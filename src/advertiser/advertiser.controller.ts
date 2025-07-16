import {
  Controller,
  Get,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { AdvertiserService } from './advertiser.service';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import {
  ApiStandardErrors,
  ApiStandardResponse,
} from 'src/common/decorators/swagger.decorator';
import { AdvertiserGuard } from 'src/common/guards/authorization.guard';
import { CampaignStatus } from '@prisma/client';

@ApiTags('Advertiser')
@ApiBearerAuth()
@UseGuards(AdvertiserGuard)
@Controller('advertiser')
export class AdvertiserController {
  constructor(private readonly advertiserService: AdvertiserService) {}

  // Get advertiser profile
  @Get('profile')
  @ApiOperation({ summary: 'Get advertiser profile' })
  @ApiStandardResponse({
    description: 'Advertiser profile retrieved successfully',
  })
  @ApiStandardErrors()
  getProfile(@Request() req) {
    return this.advertiserService.getProfile(req.user.id);
  }

  // Get campaign counts by status
  @Get('campaigns/counts')
  @ApiOperation({ summary: 'Get campaign counts by status' })
  @ApiStandardResponse({
    description: 'Campaign counts retrieved successfully',
  })
  @ApiStandardErrors()
  getCampaignCounts(@Request() req) {
    return this.advertiserService.getCampaignCounts(req.user.id);
  }

  // Get campaigns by status
  @Get('campaigns/status')
  @ApiOperation({ 
    summary: 'Get campaigns by status',
    description: 'Get campaigns filtered by status. Valid statuses: SCHEDULED, ACTIVE, DAILY_PAUSED, COMPLETED, BUDGET_EXHAUSTED, REJECTED'
  })
  @ApiQuery({
    name: 'status',
    enum: ['SCHEDULED', 'ACTIVE', 'DAILY_PAUSED', 'COMPLETED', 'BUDGET_EXHAUSTED', 'REJECTED'],
    description: 'Campaign status to filter by',
    required: true,
  })
  @ApiStandardResponse({
    description: 'Campaigns retrieved successfully',
  })
  @ApiStandardErrors()
  getCampaignsByStatus(@Request() req, @Query('status') status: string) {
    return this.advertiserService.getCampaignsByStatus(req.user.id, status as CampaignStatus);
  }
}