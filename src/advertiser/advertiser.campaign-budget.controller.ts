// // src/campaign/campaign-budget-tracker.controller.ts

// import {
//     Controller,
//     Get,
//     Post,
//     Body,
//     Patch,
//     Param,
//     Delete,
//     UseGuards,
//     Request,
//     Query,
//     ParseUUIDPipe,
//     HttpStatus,
// } from '@nestjs/common';
// import {
//     ApiTags,
//     ApiOperation,
//     ApiBearerAuth,
//     ApiParam,
//     ApiResponse,
//     ApiQuery,
// } from '@nestjs/swagger';
// import { AdvertiserGuard } from '../common/guards/authorization.guard';
// import {
//     ApiStandardResponse,
//     ApiStandardErrors,
// } from '../common/decorators/swagger.decorator';
// import {
//     CreateCampaignBudgetTrackerDto,
//     UpdateCampaignBudgetTrackerDto,
//     CampaignBudgetTrackerResponseDto,
//     CampaignBudgetTrackerQueryDto,
//     UpdateSpentAmountDto,
// } from './dto/campaign/campaign-budget-tracker.dto';
// import { CampaignBudgetTrackerService } from './advertiser.campaign-budget.service';

// @ApiTags('Advertiser Campaign Budget')
// @ApiBearerAuth()
// @UseGuards(AdvertiserGuard)
// @Controller('advertiser/:advertiserId/campaign/budget-tracker')
// export class CampaignBudgetTrackerController {
//     constructor(
//         private readonly campaignBudgetTrackerService: CampaignBudgetTrackerService,
//     ) { }

//     @Post()
//     @ApiOperation({ summary: 'Create a new campaign budget tracker' })
//     @ApiStandardResponse({
//         type: CampaignBudgetTrackerResponseDto,
//         description: 'Campaign budget tracker created successfully',
//     })
//     @ApiStandardErrors()
//     async create(
//         @Body() createDto: CreateCampaignBudgetTrackerDto,
//         @Request() req,
//     ) {
//         return this.campaignBudgetTrackerService.create(req.user.id, createDto);
//     }

//     @Get()
//     @ApiOperation({ summary: 'Get all campaign budgets' })
//     @ApiStandardResponse({
//         isPaginated: true,
//         type: CampaignBudgetTrackerResponseDto,
//         description: 'Campaign budget trackers retrieved successfully',
//     })
//     @ApiStandardErrors()
//     async findAll(
//         @Request() req,
//         @Query() query: CampaignBudgetTrackerQueryDto,
//     ) {
//         return this.campaignBudgetTrackerService.findAll(req.user.id, query);
//     }

//     @Get(':id')
//     @ApiOperation({ summary: 'Get campaign budget by ID' })
//     @ApiParam({ name: 'id', description: 'Budget tracker ID', type: String })
//     @ApiStandardResponse({
//         type: CampaignBudgetTrackerResponseDto,
//         description: 'Campaign budget tracker retrieved successfully',
//     })
//     @ApiStandardErrors()
//     async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
//         return this.campaignBudgetTrackerService.findOne(req.user.id, id);
//     }

//     @Get('campaign/:campaignId/date/:date')
//     @ApiOperation({ summary: 'Get budget tracker by campaign ID and date' })
//     @ApiParam({ name: 'campaignId', description: 'Campaign ID', type: String })
//     @ApiParam({
//         name: 'date',
//         description: 'Date (YYYY-MM-DD)',
//         type: String,
//         example: '2025-06-04',
//     })
//     @ApiStandardResponse({
//         type: CampaignBudgetTrackerResponseDto,
//         description: 'Campaign budget tracker retrieved successfully',
//     })
//     @ApiStandardErrors()
//     async findByCampaignAndDate(
//         @Param('campaignId', ParseUUIDPipe) campaignId: string,
//         @Param('date') date: string,
//         @Request() req,
//     ) {
//         return this.campaignBudgetTrackerService.findByCampaignAndDate(
//             req.user.id,
//             campaignId,
//             date,
//         );
//     }

//     @Patch(':id')
//     @ApiOperation({ summary: 'Update campaign budget' })
//     @ApiParam({ name: 'id', description: 'Budget tracker ID', type: String })
//     @ApiStandardResponse({
//         type: CampaignBudgetTrackerResponseDto,
//         description: 'Campaign budget tracker updated successfully',
//     })
//     @ApiStandardErrors()
//     async update(
//         @Param('id', ParseUUIDPipe) id: string,
//         @Body() updateDto: UpdateCampaignBudgetTrackerDto,
//         @Request() req,
//     ) {
//         return this.campaignBudgetTrackerService.update(req.user.id, id, updateDto);
//     }

//     @Delete(':id')
//     @ApiOperation({ summary: 'Delete campaign budget' })
//     @ApiParam({ name: 'id', description: 'Budget tracker ID', type: String })
//     @ApiStandardResponse({
//         description: 'Campaign budget tracker deleted successfully',
//     })
//     @ApiStandardErrors()
//     async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
//         return this.campaignBudgetTrackerService.remove(req.user.id, id);
//     }

//     @Patch('campaign/:campaignId/date/:date/spend')
//     @ApiOperation({ summary: 'Update spent amount for a campaign on a specific date' })
//     @ApiParam({ name: 'campaignId', description: 'Campaign ID', type: String })
//     @ApiParam({
//         name: 'date',
//         description: 'Date (YYYY-MM-DD)',
//         type: String,
//         example: '2025-06-04',
//     })
//     @ApiResponse({
//         status: HttpStatus.OK,
//         description: 'Spent amount updated successfully',
//         schema: {
//             type: 'object',
//             properties: {
//                 id: { type: 'string' },
//                 campaignId: { type: 'string' },
//                 date: { type: 'string', format: 'date-time' },
//                 spentToday: { type: 'string' },
//                 remainingBudget: { type: 'string' },
//                 isExhausted: { type: 'boolean' },
//                 lastUpdated: { type: 'string', format: 'date-time' },
//             },
//         },
//     })
//     @ApiStandardErrors()
//     async updateSpentAmount(
//         @Param('campaignId', ParseUUIDPipe) campaignId: string,
//         @Param('date') date: string,
//         @Body() body: UpdateSpentAmountDto,
//         @Request() req,
//     ) {
//         return this.campaignBudgetTrackerService.updateSpentAmount(
//             req.user.id,
//             campaignId,
//             date,
//             body.spentAmount,
//         );
//     }

//     @Get('campaign/:campaignId/summary')
//     @ApiOperation({ summary: 'Get budget summary for a campaign' })
//     @ApiParam({ name: 'campaignId', description: 'Campaign ID', type: String })
//     @ApiQuery({
//         name: 'startDate',
//         required: false,
//         description: 'Start date for summary (YYYY-MM-DD)',
//         example: '2025-06-01',
//     })
//     @ApiQuery({
//         name: 'endDate',
//         required: false,
//         description: 'End date for summary (YYYY-MM-DD)',
//         example: '2025-06-30',
//     })
//     @ApiResponse({
//         status: HttpStatus.OK,
//         description: 'Campaign budget summary retrieved successfully',
//         schema: {
//             type: 'object',
//             properties: {
//                 campaignId: { type: 'string' },
//                 summary: {
//                     type: 'object',
//                     properties: {
//                         totalBudget: { type: 'number' },
//                         totalSpent: { type: 'number' },
//                         totalRemaining: { type: 'number' },
//                         averageDailySpend: { type: 'number' },
//                         daysWithExhaustedBudget: { type: 'number' },
//                         totalDays: { type: 'number' },
//                     },
//                 },
//                 dailyBreakdown: {
//                     type: 'array',
//                     items: {
//                         type: 'object',
//                         properties: {
//                             date: { type: 'string', format: 'date-time' },
//                             totalBudget: { type: 'number' },
//                             dailyBudget: { type: 'number' },
//                             spentToday: { type: 'number' },
//                             remainingBudget: { type: 'number' },
//                             isExhausted: { type: 'boolean' },
//                             utilizationPercentage: { type: 'number' },
//                         },
//                     },
//                 },
//             },
//         },
//     })
//     @ApiStandardErrors()
//     async getCampaignBudgetSummary(
//         @Param('campaignId', ParseUUIDPipe) campaignId: string,
//         @Query('startDate') startDate?: string,
//         @Query('endDate') endDate?: string,
//         @Request() req?,
//     ) {
//         return this.campaignBudgetTrackerService.getCampaignBudgetSummary(
//             req.user.id,
//             campaignId,
//             startDate,
//             endDate,
//         );
//     }
// }
