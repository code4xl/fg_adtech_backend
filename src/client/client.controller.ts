// import {
//   Controller,
//   Get,
//   Param,
//   UseGuards,
//   Request,
//   ParseUUIDPipe,
// } from '@nestjs/common';
// import {
//   ApiTags,
//   ApiOperation,
//   ApiBearerAuth,
//   ApiParam,
// } from '@nestjs/swagger';
// import { ClientGuard } from 'src/common/guards/authorization.guard';
// import {
//   ApiStandardResponse,
//   ApiStandardErrors,
// } from 'src/common/decorators/swagger.decorator';
// import { ClientService } from './client.service';
// import { CampaignSummaryDto } from 'src/client/dto/client-summary.dto';

// @ApiTags('client')
// @ApiBearerAuth()
// @UseGuards(ClientGuard)
// @Controller('client')
// export class ClientController {
//   constructor(private readonly clientService: ClientService) { }

//   @Get('profile')
//   @ApiOperation({
//     summary: 'Get client profile',
//     description: 'Retrieves the authenticated client\'s profile information'
//   })
//   @ApiStandardResponse({
//     description: 'Profile retrieved successfully',
//   })
//   @ApiStandardErrors()
//   async getProfile(@Request() req) {
//     return this.clientService.getClientProfile(req.user.sub);
//   }

//   @Get('campaigns')
//   @ApiOperation({
//     summary: 'Get assigned campaigns',
//     description: 'Retrieves all campaigns assigned to the authenticated client'
//   })
//   @ApiStandardResponse({
//     type: CampaignSummaryDto,
//     description: 'Campaigns retrieved successfully',
//   })
//   @ApiStandardErrors()
//   async getCampaigns(@Request() req) {
//     return this.clientService.getClientCampaigns(req.user.sub);
//   }

//   @Get('campaigns/:campaignId')
//   @ApiOperation({
//     summary: 'Get campaign details',
//     description: 'Retrieves detailed information about a specific assigned campaign'
//   })
//   @ApiParam({
//     name: 'campaignId',
//     description: 'Campaign ID',
//     type: String,
//     example: 'uuid-example'
//   })
//   @ApiStandardResponse({
//     description: 'Campaign details retrieved successfully',
//   })
//   @ApiStandardErrors()
//   async getCampaignById(
//     @Request() req,
//     @Param('campaignId', ParseUUIDPipe) campaignId: string,
//   ) {
//     return this.clientService.getClientCampaignById(req.user.sub, campaignId);
//   }
// }