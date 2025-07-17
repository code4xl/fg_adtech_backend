import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Request,
    Query,
    ParseUUIDPipe,
} from '@nestjs/common';
import { CreateCampaignDto, CampaignResponseDto } from './dto/campaign/campaign.dto';
import { UpdateCampaignDto } from './dto/campaign/campaign.dto';
import { AdvertiserGuard } from '../common/guards/authorization.guard';
import { CampaignQueryDto } from './dto/campaign/campaign-query.dto';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiParam,
    ApiResponse,
} from '@nestjs/swagger';
import {
    ApiStandardResponse,
    ApiStandardErrors
} from '../common/decorators/swagger.decorator';
import { AdvertiserCampaignService } from './advertiser.campaign.service';

@ApiTags('Advertiser - Campaign')
@ApiBearerAuth()
@UseGuards(AdvertiserGuard)
@Controller('advertiser/:advertiserId/campaign')
export class AdvertiserCampaignController {
    constructor(
        private readonly advertiserCampaignService: AdvertiserCampaignService,
    ) { }

    // Create a Campaign
    @Post()
    @ApiOperation({ summary: 'Create a new campaign' })
    @ApiStandardResponse({
        type: CampaignResponseDto,
        description: 'Campaign created successfully'
    })
    @ApiStandardErrors()
    async create(
        @Body() createCampaignDto: CreateCampaignDto,
        @Request() req,
    ) {
        return this.advertiserCampaignService.create(req.user.id, createCampaignDto);
    }

    // Update a Campaign
    @Patch(':campaignId')
    @ApiOperation({ summary: 'Update a campaign' })
    @ApiStandardResponse({
        type: CampaignResponseDto,
        description: 'Campaign updated successfully'
    })
    @ApiStandardErrors()
    async update(
        @Param('campaignId', ParseUUIDPipe) id: string,
        @Body() updateCampaignDto: UpdateCampaignDto,
        @Request() req,
    ) {
        return this.advertiserCampaignService.update(id, req.user.id, updateCampaignDto);
    }

    // Get all advertiser campaigns
    @Get()
    @ApiOperation({ summary: 'Get all advertiser campaigns' })
    @ApiStandardResponse({
        isPaginated: true,
        type: CampaignResponseDto,
        description: 'Campaigns retrieved successfully'
    })
    @ApiStandardErrors()
    findAll(@Request() req, @Query() query: CampaignQueryDto) {
        return this.advertiserCampaignService.findAll(req.user.id, query);
    }

    // Get a campaign details by id
    @Get(':campaignId')
    @ApiOperation({ summary: 'Get campaign details' })
    @ApiParam({ name: 'campaignId', description: 'Campaign ID', type: String })
    @ApiStandardResponse({
        type: CampaignResponseDto,
        description: 'Campaign retrieved successfully'
    })
    @ApiStandardErrors()
    findOne(@Param('campaignId', ParseUUIDPipe) id: string, @Request() req) {
        return this.advertiserCampaignService.findOne(id, req.user.id);
    }

    // Delete a campaign
    @Delete(':campaignId')
    @ApiOperation({ summary: 'Delete a campaign' })
    @ApiParam({ name: 'campaignId', description: 'Campaign ID', type: String })
    @ApiStandardResponse({
        description: 'Campaign deleted successfully'
    })
    @ApiStandardErrors()
    remove(@Param('campaignId', ParseUUIDPipe) id: string, @Request() req) {
        return this.advertiserCampaignService.remove(id, req.user.id);
    }
}