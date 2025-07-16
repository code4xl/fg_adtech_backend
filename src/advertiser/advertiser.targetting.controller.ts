import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpStatus,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AdvertiserGuard } from 'src/common/guards/authorization.guard';

import { AdvertiserTargetingService } from './advertiser.targeting.service';
import {
  CreateCampaignDemographicTargetingDto,
  UpdateCampaignDemographicTargetingDto,
} from './dto/targeting/demographic-targeting.dto';
import {
  CreateCampaignGeographicTargetingDto,
  UpdateCampaignGeographicTargetingDto,
} from './dto/targeting/geographic-targeting.dto';
import {
  CreateCampaignDeviceTargetingDto,
  UpdateCampaignDeviceTargetingDto,
} from './dto/targeting/device-targeting.dto';
import {
  CreateCampaignContextualTargetingDto,
  UpdateCampaignContextualTargetingDto,
} from './dto/targeting/contextual-targeting.dto';
import {
  CreateCampaignBehavioralTargetingDto,
  UpdateCampaignBehavioralTargetingDto,
} from './dto/targeting/behavioral-targeting.dto';
import {
  CreateCampaignTimeTargetingDto,
  UpdateCampaignTimeTargetingDto,
} from './dto/targeting/time-targeting.dto';
import {
  CreateCampaignFrequencyTargetingDto,
  UpdateCampaignFrequencyTargetingDto,
} from './dto/targeting/frequency-targeting.dto';

@ApiTags('Advertiser - Targeting Rules')
@ApiBearerAuth()
@UseGuards(AdvertiserGuard)
@Controller('campaign/:campaignId/targeting-rules')
export class AdvertiserTargetingController {
  constructor(
    private readonly advertiserTargetingService: AdvertiserTargetingService,
  ) {}

  // ======================
  // DEMOGRAPHIC TARGETING
  // ======================
  @Post('demographic')
  @ApiOperation({ summary: 'Add demographic targeting rule to campaign' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Demographic targeting rule created successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Campaign not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied to this campaign',
  })
  async addDemographicTargeting(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body() createDto: CreateCampaignDemographicTargetingDto,
    @Request() req: any,
  ) {
    createDto.campaignId = campaignId;
    return this.advertiserTargetingService.addDemographicTargeting(
      req.user.id,
      createDto,
    );
  }

  @Get('demographic')
  @ApiOperation({ summary: 'Get demographic targeting rules for campaign' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Demographic targeting rules retrieved successfully',
  })
  async getDemographicTargeting(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Request() req: any,
  ) {
    return this.advertiserTargetingService.getDemographicTargeting(
      req.user.id,
      campaignId,
    );
  }

  @Put('demographic/:id')
  @ApiOperation({ summary: 'Update demographic targeting rule' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiParam({ name: 'id', description: 'Demographic targeting rule UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Demographic targeting rule updated successfully',
  })
  async updateDemographicTargeting(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateCampaignDemographicTargetingDto,
    @Request() req: any,
  ) {
    updateDto.campaignId = campaignId;
    return this.advertiserTargetingService.updateDemographicTargeting(
      req.user.id,
      id,
      updateDto,
    );
  }

  @Delete('demographic/:id')
  @ApiOperation({ summary: 'Delete demographic targeting rule' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiParam({ name: 'id', description: 'Demographic targeting rule UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Demographic targeting rule deleted successfully',
  })
  async deleteDemographicTargeting(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    return this.advertiserTargetingService.deleteDemographicTargeting(
      req.user.id,
      campaignId,
      id,
    );
  }

  // ======================
  // GEOGRAPHIC TARGETING
  // ======================
  @Post('geographic')
  @ApiOperation({ summary: 'Add geographic targeting rule to campaign' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Geographic targeting rule created successfully',
  })
  async addGeographicTargeting(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body() createDto: CreateCampaignGeographicTargetingDto,
    @Request() req: any,
  ) {
    createDto.campaignId = campaignId;
    return this.advertiserTargetingService.addGeographicTargeting(
      req.user.id,
      createDto,
    );
  }

  @Get('geographic')
  @ApiOperation({ summary: 'Get geographic targeting rules for campaign' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Geographic targeting rules retrieved successfully',
  })
  async getGeographicTargeting(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Request() req: any,
  ) {
    return this.advertiserTargetingService.getGeographicTargeting(
      req.user.id,
      campaignId,
    );
  }

  @Put('geographic/:id')
  @ApiOperation({ summary: 'Update geographic targeting rule' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiParam({ name: 'id', description: 'Geographic targeting rule UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Geographic targeting rule updated successfully',
  })
  async updateGeographicTargeting(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateCampaignGeographicTargetingDto,
    @Request() req: any,
  ) {
    updateDto.campaignId = campaignId;
    return this.advertiserTargetingService.updateGeographicTargeting(
      req.user.id,
      id,
      updateDto,
    );
  }

  @Delete('geographic/:id')
  @ApiOperation({ summary: 'Delete geographic targeting rule' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiParam({ name: 'id', description: 'Geographic targeting rule UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Geographic targeting rule deleted successfully',
  })
  async deleteGeographicTargeting(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    return this.advertiserTargetingService.deleteGeographicTargeting(
      req.user.id,
      campaignId,
      id,
    );
  }

  // ======================
  // DEVICE TARGETING
  // ======================
  @Post('device')
  @ApiOperation({ summary: 'Add device targeting rule to campaign' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Device targeting rule created successfully',
  })
  async addDeviceTargeting(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body() createDto: CreateCampaignDeviceTargetingDto,
    @Request() req: any,
  ) {
    createDto.campaignId = campaignId;
    return this.advertiserTargetingService.addDeviceTargeting(
      req.user.id,
      createDto,
    );
  }

  @Get('device')
  @ApiOperation({ summary: 'Get device targeting rules for campaign' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Device targeting rules retrieved successfully',
  })
  async getDeviceTargeting(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Request() req: any,
  ) {
    return this.advertiserTargetingService.getDeviceTargeting(
      req.user.id,
      campaignId,
    );
  }

  @Put('device/:id')
  @ApiOperation({ summary: 'Update device targeting rule' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiParam({ name: 'id', description: 'Device targeting rule UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Device targeting rule updated successfully',
  })
  async updateDeviceTargeting(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateCampaignDeviceTargetingDto,
    @Request() req: any,
  ) {
    updateDto.campaignId = campaignId;
    return this.advertiserTargetingService.updateDeviceTargeting(
      req.user.id,
      id,
      updateDto,
    );
  }

  @Delete('device/:id')
  @ApiOperation({ summary: 'Delete device targeting rule' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiParam({ name: 'id', description: 'Device targeting rule UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Device targeting rule deleted successfully',
  })
  async deleteDeviceTargeting(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    return this.advertiserTargetingService.deleteDeviceTargeting(
      req.user.id,
      campaignId,
      id,
    );
  }

  // ======================
  // CONTEXTUAL TARGETING
  // ======================
  @Post('contextual')
  @ApiOperation({ summary: 'Add contextual targeting rule to campaign' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Contextual targeting rule created successfully',
  })
  async addContextualTargeting(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body() createDto: CreateCampaignContextualTargetingDto,
    @Request() req: any,
  ) {
    createDto.campaignId = campaignId;
    return this.advertiserTargetingService.addContextualTargeting(
      req.user.id,
      createDto,
    );
  }

  @Get('contextual')
  @ApiOperation({ summary: 'Get contextual targeting rules for campaign' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Contextual targeting rules retrieved successfully',
  })
  async getContextualTargeting(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Request() req: any,
  ) {
    return this.advertiserTargetingService.getContextualTargeting(
      req.user.id,
      campaignId,
    );
  }

  @Put('contextual/:id')
  @ApiOperation({ summary: 'Update contextual targeting rule' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiParam({ name: 'id', description: 'Contextual targeting rule UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Contextual targeting rule updated successfully',
  })
  async updateContextualTargeting(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateCampaignContextualTargetingDto,
    @Request() req: any,
  ) {
    updateDto.campaignId = campaignId;
    return this.advertiserTargetingService.updateContextualTargeting(
      req.user.id,
      id,
      updateDto,
    );
  }

  @Delete('contextual/:id')
  @ApiOperation({ summary: 'Delete contextual targeting rule' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiParam({ name: 'id', description: 'Contextual targeting rule UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Contextual targeting rule deleted successfully',
  })
  async deleteContextualTargeting(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    return this.advertiserTargetingService.deleteContextualTargeting(
      req.user.id,
      campaignId,
      id,
    );
  }

  // ======================
  // BEHAVIORAL TARGETING
  // ======================
  @Post('behavioral')
  @ApiOperation({ summary: 'Add behavioral targeting rule to campaign' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Behavioral targeting rule created successfully',
  })
  async addBehavioralTargeting(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body() createDto: CreateCampaignBehavioralTargetingDto,
    @Request() req: any,
  ) {
    createDto.campaignId = campaignId;
    return this.advertiserTargetingService.addBehavioralTargeting(
      req.user.id,
      createDto,
    );
  }

  @Get('behavioral')
  @ApiOperation({ summary: 'Get behavioral targeting rules for campaign' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Behavioral targeting rules retrieved successfully',
  })
  async getBehavioralTargeting(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Request() req: any,
  ) {
    return this.advertiserTargetingService.getBehavioralTargeting(
      req.user.id,
      campaignId,
    );
  }

  @Put('behavioral/:id')
  @ApiOperation({ summary: 'Update behavioral targeting rule' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiParam({ name: 'id', description: 'Behavioral targeting rule UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Behavioral targeting rule updated successfully',
  })
  async updateBehavioralTargeting(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateCampaignBehavioralTargetingDto,
    @Request() req: any,
  ) {
    updateDto.campaignId = campaignId;
    return this.advertiserTargetingService.updateBehavioralTargeting(
      req.user.id,
      id,
      updateDto,
    );
  }

  @Delete('behavioral/:id')
  @ApiOperation({ summary: 'Delete behavioral targeting rule' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiParam({ name: 'id', description: 'Behavioral targeting rule UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Behavioral targeting rule deleted successfully',
  })
  async deleteBehavioralTargeting(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    return this.advertiserTargetingService.deleteBehavioralTargeting(
      req.user.id,
      campaignId,
      id,
    );
  }

  // ======================
  // TIME TARGETING
  // ======================
  @Post('time')
  @ApiOperation({ summary: 'Add time targeting rule to campaign' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Time targeting rule created successfully',
  })
  async addTimeTargeting(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body() createDto: CreateCampaignTimeTargetingDto,
    @Request() req: any,
  ) {
    createDto.campaignId = campaignId;
    return this.advertiserTargetingService.addTimeTargeting(
      req.user.id,
      createDto,
    );
  }

  @Get('time')
  @ApiOperation({ summary: 'Get time targeting rules for campaign' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Time targeting rules retrieved successfully',
  })
  async getTimeTargeting(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Request() req: any,
  ) {
    return this.advertiserTargetingService.getTimeTargeting(
      req.user.id,
      campaignId,
    );
  }

  @Put('time/:id')
  @ApiOperation({ summary: 'Update time targeting rule' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiParam({ name: 'id', description: 'Time targeting rule UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Time targeting rule updated successfully',
  })
  async updateTimeTargeting(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateCampaignTimeTargetingDto,
    @Request() req: any,
  ) {
    updateDto.campaignId = campaignId;
    return this.advertiserTargetingService.updateTimeTargeting(
      req.user.id,
      id,
      updateDto,
    );
  }

  @Delete('time/:id')
  @ApiOperation({ summary: 'Delete time targeting rule' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiParam({ name: 'id', description: 'Time targeting rule UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Time targeting rule deleted successfully',
  })
  async deleteTimeTargeting(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    return this.advertiserTargetingService.deleteTimeTargeting(
      req.user.id,
      campaignId,
      id,
    );
  }

  // ======================
  // FREQUENCY TARGETING
  // ======================
  @Post('frequency')
  @ApiOperation({ summary: 'Add frequency targeting rule to campaign' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Frequency targeting rule created successfully',
  })
  async addFrequencyTargeting(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body() createDto: CreateCampaignFrequencyTargetingDto,
    @Request() req: any,
  ) {
    createDto.campaignId = campaignId;
    return this.advertiserTargetingService.addFrequencyTargeting(
      req.user.id,
      createDto,
    );
  }

  @Get('frequency')
  @ApiOperation({ summary: 'Get frequency targeting rules for campaign' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Frequency targeting rules retrieved successfully',
  })
  async getFrequencyTargeting(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Request() req: any,
  ) {
    return this.advertiserTargetingService.getFrequencyTargeting(
      req.user.id,
      campaignId,
    );
  }

  @Put('frequency/:id')
  @ApiOperation({ summary: 'Update frequency targeting rule' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiParam({ name: 'id', description: 'Frequency targeting rule UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Frequency targeting rule updated successfully',
  })
  async updateFrequencyTargeting(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateCampaignFrequencyTargetingDto,
    @Request() req: any,
  ) {
    updateDto.campaignId = campaignId;
    return this.advertiserTargetingService.updateFrequencyTargeting(
      req.user.id,
      id,
      updateDto,
    );
  }

  @Delete('frequency/:id')
  @ApiOperation({ summary: 'Delete frequency targeting rule' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiParam({ name: 'id', description: 'Frequency targeting rule UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Frequency targeting rule deleted successfully',
  })
  async deleteFrequencyTargeting(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    return this.advertiserTargetingService.deleteFrequencyTargeting(
      req.user.id,
      campaignId,
      id,
    );
  }

  // ======================
  // GET ALL TARGETING RULES
  // ======================
  @Get()
  @ApiOperation({ summary: 'Get all targeting rules for campaign' })
  @ApiParam({ name: 'campaignId', description: 'Campaign UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'All targeting rules retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        campaignId: { type: 'string' },
        targeting: {
          type: 'object',
          properties: {
            demographic: { type: 'array' },
            geographic: { type: 'array' },
            device: { type: 'array' },
            contextual: { type: 'array' },
            behavioral: { type: 'array' },
            time: { type: 'array' },
            frequency: { type: 'array' },
          },
        },
      },
    },
  })
  async getAllTargetingRules(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Request() req: any,
  ) {
    return this.advertiserTargetingService.getAllTargetingRules(
      req.user.id,
      campaignId,
    );
  }
}
