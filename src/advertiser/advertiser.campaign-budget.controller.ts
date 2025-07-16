import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { AdvertiserGuard } from '../common/guards/authorization.guard';
import {
  ApiStandardResponse,
  ApiStandardErrors,
} from '../common/decorators/swagger.decorator';
import { AdvertiserCampaignBudgetService } from './advertiser.campaign-budget.service';
import {
  CreateCampaignBudgetDto,
  UpdateCampaignBudgetDto,
  CampaignBudgetResponseDto,
  DailyBudgetSpendingDto,
  CampaignStatisticsDto,
  CampaignStatisticsQueryDto,
} from './dto/campaign/campaign-budget.dto';

@ApiTags('Advertiser Campaign Budget')
@ApiBearerAuth()
@UseGuards(AdvertiserGuard)
@Controller('advertiser/:advertiserId/campaign/:campaignId/budget')
export class AdvertiserCampaignBudgetController {
  constructor(
    private readonly budgetService: AdvertiserCampaignBudgetService,
  ) {}

  @Post('assign')
  @ApiOperation({ 
    summary: 'Assign budget to campaign',
    description: 'Assigns total and daily budget to a DRAFT campaign. This will activate the campaign if start date has passed.'
  })
  @ApiParam({ name: 'campaignId', description: 'Campaign ID', type: String })
  @ApiStandardResponse({
    type: CampaignBudgetResponseDto,
    description: 'Budget assigned successfully',
  })
  @ApiStandardErrors()
  async assignBudget(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Request() req,
    @Body() createBudgetDto: CreateCampaignBudgetDto,
  ) {
    // Ensure campaignId matches the route parameter
    createBudgetDto.campaignId = campaignId;
    
    return this.budgetService.assignBudget(req.user.id, createBudgetDto);
  }

  @Patch('update')
  @ApiOperation({ 
    summary: 'Update campaign budget',
    description: 'Updates campaign budget. Total budget can only be increased, daily budget can be modified.'
  })
  @ApiParam({ name: 'campaignId', description: 'Campaign ID', type: String })
  @ApiStandardResponse({
    type: CampaignBudgetResponseDto,
    description: 'Budget updated successfully',
  })
  @ApiStandardErrors()
  async updateBudget(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Request() req,
    @Body() updateBudgetDto: UpdateCampaignBudgetDto,
  ) {
    return this.budgetService.updateBudget(campaignId, req.user.id, updateBudgetDto);
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get campaign budget details',
    description: 'Retrieves current budget allocation and spending for the campaign.'
  })
  @ApiParam({ name: 'campaignId', description: 'Campaign ID', type: String })
  @ApiStandardResponse({
    type: CampaignBudgetResponseDto,
    description: 'Budget details retrieved successfully',
  })
  @ApiStandardErrors()
  async getBudget(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Request() req,
  ) {
    return this.budgetService.getBudget(campaignId, req.user.id);
  }

  @Get('daily-spending')
  @ApiOperation({ 
    summary: 'Get daily budget spending',
    description: 'Retrieves daily budget spending information for a specific date or today.'
  })
  @ApiParam({ name: 'campaignId', description: 'Campaign ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Daily spending retrieved successfully',
    type: DailyBudgetSpendingDto,
  })
  @ApiStandardErrors()
  async getDailySpending(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Request() req,
    @Query('date') date?: string,
  ) {
    return this.budgetService.getDailySpending(campaignId, req.user.id, date);
  }

//   @Get('statistics')
//   @ApiOperation({ 
//     summary: 'Get campaign statistics',
//     description: 'Retrieves campaign performance statistics including impressions, clicks, and spending.'
//   })
//   @ApiParam({ name: 'campaignId', description: 'Campaign ID', type: String })
//   @ApiResponse({
//     status: 200,
//     description: 'Campaign statistics retrieved successfully',
//     type: CampaignStatisticsDto,
//   })
//   @ApiStandardErrors()
//   async getCampaignStatistics(
//     @Param('campaignId', ParseUUIDPipe) campaignId: string,
//     @Request() req,
//     @Query() query: CampaignStatisticsQueryDto,
//   ) {
//     return this.budgetService.getCampaignStatistics(campaignId, req.user.id, query);
//   }
}