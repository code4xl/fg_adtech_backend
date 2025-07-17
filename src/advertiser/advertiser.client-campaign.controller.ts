import {
  Controller,
  Get,
  UseGuards,
  Request,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ClientGuard } from 'src/common/guards/authorization.guard';
import {
  ApiStandardResponse,
  ApiStandardErrors,
} from 'src/common/decorators/swagger.decorator';
import { ClientCampaignService } from './advertiser.client-campaign.service';


@ApiTags('Client - Campaigns')
@ApiBearerAuth()
@UseGuards(ClientGuard)
@Controller('client/campaigns')
export class ClientCampaignController {
  constructor(private readonly clientCampaignService: ClientCampaignService) {}

  @Get('assigned')
  @ApiOperation({
    summary: 'Get all assigned campaigns',
    description: 'Retrieves all campaigns assigned to the authenticated client with pagination'
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10)' })
  @ApiQuery({ name: 'status', required: false, enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED'], description: 'Filter by campaign status' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by campaign name' })
  @ApiStandardResponse({
    description: 'Assigned campaigns retrieved successfully',
  })
  @ApiStandardErrors()
  async getAssignedCampaigns(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.clientCampaignService.getAssignedCampaigns(
      req.user.id,
      { page, limit, status, search }
    );
  }

  @Get('assigned/:campaignId')
  @ApiOperation({
    summary: 'Get assigned campaign details',
    description: 'Retrieves detailed information about a specific assigned campaign including budget information'
  })
  @ApiParam({
    name: 'campaignId',
    description: 'Campaign ID',
    type: String,
  })
  @ApiStandardResponse({
    description: 'Campaign details retrieved successfully',
  })
  @ApiStandardErrors()
  async getAssignedCampaignById(
    @Request() req,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ) {
    return this.clientCampaignService.getAssignedCampaignById(
      req.user.id,
      campaignId
    );
  }

  @Get('assigned/:campaignId/budget')
  @ApiOperation({
    summary: 'Get campaign budget details',
    description: 'Retrieves detailed budget information for a specific assigned campaign'
  })
  @ApiParam({
    name: 'campaignId',
    description: 'Campaign ID',
    type: String,
  })
  @ApiStandardResponse({
    description: 'Campaign budget details retrieved successfully',
  })
  @ApiStandardErrors()
  async getCampaignBudget(
    @Request() req,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
  ) {
    return this.clientCampaignService.getCampaignBudget(
      req.user.id,
      campaignId
    );
  }

  @Get('dashboard/summary')
  @ApiOperation({
    summary: 'Get campaigns dashboard summary',
    description: 'Retrieves a summary of all assigned campaigns for dashboard display'
  })
  @ApiStandardResponse({
    description: 'Dashboard summary retrieved successfully',
  })
  @ApiStandardErrors()
  async getCampaignsDashboard(@Request() req) {
    return this.clientCampaignService.getCampaignsDashboard(req.user.id);
  }
}