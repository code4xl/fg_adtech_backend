// Updated controller using URL parameters approach
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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiExtension,
  ApiExtraModels,
} from '@nestjs/swagger';
import { PublisherGuard } from 'src/common/guards/authorization.guard';
import { PublisherService } from './publisher.service';

import {
  CreateContextualTargetingDto,
  UpdateContextualTargetingDto,
} from './dto/targeting/contextual-targeting.dto';
import {
  CreateDemographicTargetingDto,
  UpdateDemographicTargetingDto,
} from './dto/targeting/demographic-targeting.dto';
import {
  CreateDeviceTargetingDto,
  UpdateDeviceTargetingDto,
} from './dto/targeting/device-targeting.dto';
import {
  CreateFrequencyTargetingDto,
  UpdateFrequencyTargetingDto,
} from './dto/targeting/frequency-targeting.dto';
import {
  CreateGeographicTargetingDto,
  UpdateGeographicTargetingDto,
} from './dto/targeting/geographic-targeting.dto';
import {
  CreateTimeTargetingDto,
  UpdateTimeTargetingDto,
} from './dto/targeting/time-targeting.dto';
import {
  CreateBehavioralTargetingDto,
  UpdateBehavioralTargetingDto,
} from './dto/targeting/behavourial-targeting.dto';

@ApiTags('Publisher Targeting Rules')
@ApiBearerAuth()
@UseGuards(PublisherGuard)
@Controller('publishers/:publisherId/inventory/:inventoryId/targeting-rules')
export class PublisherTargetingController {
  constructor(private readonly publisherService: PublisherService) {}

  // ======================
  // DEMOGRAPHIC TARGETING
  // ======================
  @Post('demographic')
  @ApiOperation({ summary: 'Add demographic targeting rule to inventory' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
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
    description: 'Inventory not found',
  })
  async addDemographicTargeting(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
    @Body() createDto: CreateDemographicTargetingDto,
  ) {
    createDto.inventoryId = inventoryId;
    return this.publisherService.addDemographicTargeting(
      publisherId,
      createDto,
    );
  }

  @Get('demographic')
  @ApiOperation({ summary: 'Get demographic targeting rules for inventory' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Demographic targeting rules retrieved successfully',
  })
  async getDemographicTargeting(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
  ) {
    return this.publisherService.getDemographicTargeting(
      publisherId,
      inventoryId,
    );
  }

  @Put('demographic/:id')
  @ApiOperation({ summary: 'Update demographic targeting rule' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
  @ApiParam({ name: 'id', description: 'Demographic targeting rule UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Demographic targeting rule updated successfully',
  })
  async updateDemographicTargeting(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateDemographicTargetingDto,
  ) {
    updateDto.inventoryId = inventoryId;
    return this.publisherService.updateDemographicTargeting(
      publisherId,
      id,
      updateDto,
    );
  }

  @Delete('demographic/:id')
  @ApiOperation({ summary: 'Delete demographic targeting rule' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
  @ApiParam({ name: 'id', description: 'Demographic targeting rule UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Demographic targeting rule deleted successfully',
  })
  async deleteDemographicTargeting(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.publisherService.deleteDemographicTargeting(
      publisherId,
      inventoryId,
      id,
    );
  }

  // ======================
  // GEOGRAPHIC TARGETING
  // ======================

  @Post('geographic')
  @ApiOperation({ summary: 'Add geographic targeting rule to inventory' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Geographic targeting rule created successfully',
  })
  async addGeographicTargeting(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
    @Body() createDto: CreateGeographicTargetingDto,
  ) {
    createDto.inventoryId = inventoryId;
    return this.publisherService.addGeographicTargeting(publisherId, createDto);
  }

  @Get('geographic')
  @ApiOperation({ summary: 'Get geographic targeting rules for inventory' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Geographic targeting rules retrieved successfully',
  })
  async getGeographicTargeting(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
  ) {
    return this.publisherService.getGeographicTargeting(
      publisherId,
      inventoryId,
    );
  }
  @Put('geographic/:id')
  @ApiOperation({ summary: 'Update geographic targeting rule' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
  @ApiParam({ name: 'id', description: 'Geographic targeting rule UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Geographic targeting rule updated successfully',
  })
  async updateGeographicTargeting(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateGeographicTargetingDto,
  ) {
    updateDto.inventoryId = inventoryId;
    return this.publisherService.updateGeographicTargeting(
      publisherId,
      id,
      updateDto,
    );
  }

  @Delete('geographic/:id')
  @ApiOperation({ summary: 'Delete Geographic targeting rule' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
  @ApiParam({ name: 'id', description: 'Geographic targeting rule UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Geographic targeting rule deleted successfully',
  })
  async deleteGeographicTargeting(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.publisherService.deleteGeographicTargeting(
      publisherId,
      inventoryId,
      id,
    );
  }

  // ======================
  // DEVICE TARGETING
  // ======================

  @Post('device')
  @ApiOperation({ summary: 'Add device targeting rule to inventory' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Device targeting rule created successfully',
  })
  async addDeviceTargeting(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
    @Body() createDto: CreateDeviceTargetingDto,
  ) {
    createDto.inventoryId = inventoryId;
    return this.publisherService.addDeviceTargeting(publisherId, createDto);
  }

  @Get('device')
  @ApiOperation({ summary: 'Get device targeting rules for inventory' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Device targeting rules retrieved successfully',
  })
  async getDeviceTargeting(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
  ) {
    return this.publisherService.getDeviceTargeting(publisherId, inventoryId);
  }
  @Put('device/:id')
  @ApiOperation({ summary: 'Update demographic targeting rule' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
  @ApiParam({ name: 'id', description: 'Demographic targeting rule UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Demographic targeting rule updated successfully',
  })
  async updateDeviceTargeting(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateDeviceTargetingDto,
  ) {
    updateDto.inventoryId = inventoryId;
    return this.publisherService.updateDeviceTargeting(
      publisherId,
      id,
      updateDto,
    );
  }

  @Delete('device/:id')
  @ApiOperation({ summary: 'Delete Device targeting rule' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
  @ApiParam({ name: 'id', description: 'Device targeting rule UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Device targeting rule deleted successfully',
  })
  async deleteDeviceTargeting(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.publisherService.deleteDeviceTargeting(
      publisherId,
      inventoryId,
      id,
    );
  }

  // ======================
  // CONTEXTUAL TARGETING
  // ======================

  @Post('contextual')
  @ApiOperation({ summary: 'Add contextual targeting rule to inventory' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Contextual targeting rule created successfully',
  })
  async addContextualTargeting(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
    @Body() createDto: CreateContextualTargetingDto,
  ) {
    createDto.inventoryId = inventoryId;
    return this.publisherService.addContextualTargeting(publisherId, createDto);
  }

  @Get('contextual')
  @ApiOperation({ summary: 'Get contextual targeting rules for inventory' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Contextual targeting rules retrieved successfully',
  })
  async getContextualTargeting(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
  ) {
    return this.publisherService.getContextualTargeting(
      publisherId,
      inventoryId,
    );
  }
  @Put('contextual/:id')
  @ApiOperation({ summary: 'Update demographic targeting rule' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
  @ApiParam({ name: 'id', description: 'Demographic targeting rule UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Demographic targeting rule updated successfully',
  })
  async updateContextualTargeting(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateContextualTargetingDto,
  ) {
    updateDto.inventoryId = inventoryId;
    return this.publisherService.updateContextualTargeting(
      publisherId,
      id,
      updateDto,
    );
  }

  @Delete('contextual/:id')
  @ApiOperation({ summary: 'Delete Contextual targeting rule' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
  @ApiParam({ name: 'id', description: 'Contextual targeting rule UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Contextual targeting rule deleted successfully',
  })
  async deleteContextualTargeting(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.publisherService.deleteContextualTargeting(
      publisherId,
      inventoryId,
      id,
    );
  }

  // ======================
  // BEHAVOURIAL TARGETING
  // ======================

  @Post('behavioral')
  @ApiOperation({ summary: 'Add behavioral targeting rule to inventory' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Behavioral targeting rule created successfully',
  })
  async addBehavioralTargeting(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
    @Body() createDto: CreateBehavioralTargetingDto,
  ) {
    createDto.inventoryId = inventoryId;
    return this.publisherService.addBehavioralTargeting(publisherId, createDto);
  }

  @Get('behavioral')
  @ApiOperation({ summary: 'Get behavioral targeting rules for inventory' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Behavioral targeting rules retrieved successfully',
  })
  async getBehavioralTargeting(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
  ) {
    return this.publisherService.getBehavioralTargeting(
      publisherId,
      inventoryId,
    );
  }
  @Put('behavioral/:id')
  @ApiOperation({ summary: 'Update demographic targeting rule' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
  @ApiParam({ name: 'id', description: 'Demographic targeting rule UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Demographic targeting rule updated successfully',
  })
  async updateBehavioralTargeting(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateBehavioralTargetingDto,
  ) {
    updateDto.inventoryId = inventoryId;
    return this.publisherService.updateBehavioralTargeting(
      publisherId,
      id,
      updateDto,
    );
  }

  @Delete('behavioral/:id')
  @ApiOperation({ summary: 'Delete Behavioral targeting rule' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
  @ApiParam({ name: 'id', description: 'Behavioral targeting rule UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Behavioral targeting rule deleted successfully',
  })
  async deleteBehavioralTargeting(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.publisherService.deleteBehavioralTargeting(
      publisherId,
      inventoryId,
      id,
    );
  }

  // ======================
  // TIME TARGETING
  // ======================

  @Post('time')
  @ApiOperation({ summary: 'Add time targeting rule to inventory' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Time targeting rule created successfully',
  })
  async addTimeTargeting(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
    @Body() createDto: CreateTimeTargetingDto,
  ) {
    createDto.inventoryId = inventoryId;
    return this.publisherService.addTimeTargeting(publisherId, createDto);
  }

  @Get('time')
  @ApiOperation({ summary: 'Get time targeting rules for inventory' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Time targeting rules retrieved successfully',
  })
  async getTimeTargeting(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
  ) {
    return this.publisherService.getTimeTargeting(publisherId, inventoryId);
  }
  @Put('time/:id')
  @ApiOperation({ summary: 'Update demographic targeting rule' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
  @ApiParam({ name: 'id', description: 'Demographic targeting rule UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Demographic targeting rule updated successfully',
  })
  async updateTimeTargeting(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateTimeTargetingDto,
  ) {
    updateDto.inventoryId = inventoryId;
    return this.publisherService.updateTimeTargeting(
      publisherId,
      id,
      updateDto,
    );
  }

  @Delete('time/:id')
  @ApiOperation({ summary: 'Delete Time targeting rule' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
  @ApiParam({ name: 'id', description: 'Time targeting rule UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Time targeting rule deleted successfully',
  })
  async deleteTimeTargeting(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.publisherService.deleteTimeTargeting(
      publisherId,
      inventoryId,
      id,
    );
  }

  // ======================
  // FREQUENCY TARGETING
  // ======================

  @Post('frequency')
  @ApiOperation({ summary: 'Add frequency targeting rule to inventory' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Frequency targeting rule created successfully',
  })
  async addFrequencyTargeting(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
    @Body() createDto: CreateFrequencyTargetingDto,
  ) {
    createDto.inventoryId = inventoryId;
    return this.publisherService.addFrequencyTargeting(publisherId, createDto);
  }

  @Get('frequency')
  @ApiOperation({ summary: 'Get frequency targeting rules for inventory' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Frequency targeting rules retrieved successfully',
  })
  async getFrequencyTargeting(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
  ) {
    return this.publisherService.getFrequencyTargeting(
      publisherId,
      inventoryId,
    );
  }
  @Put('frequency/:id')
  @ApiOperation({ summary: 'Update demographic targeting rule' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
  @ApiParam({ name: 'id', description: 'Demographic targeting rule UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Demographic targeting rule updated successfully',
  })
  async updateFrequencyTargeting(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateFrequencyTargetingDto,
  ) {
    updateDto.inventoryId = inventoryId;
    return this.publisherService.updateFrequencyTargeting(
      publisherId,
      id,
      updateDto,
    );
  }

  @Delete('frequency/:id')
  @ApiOperation({ summary: 'Delete Frequency targeting rule' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
  @ApiParam({ name: 'id', description: 'Frequency targeting rule UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Frequency targeting rule deleted successfully',
  })
  async deleteFrequencyTargeting(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.publisherService.deleteFrequencyTargeting(
      publisherId,
      inventoryId,
      id,
    );
  }
  // Continue with similar pattern for all other targeting methods...
  // (device, device, contextual, behavioral, frequency, frequency)

  // ======================
  // GET ALL TARGETING RULES
  // ======================

  @Get()
  @ApiOperation({ summary: 'Get all targeting rules for inventory' })
  @ApiParam({ name: 'publisherId', description: 'Publisher UUID' })
  @ApiParam({ name: 'inventoryId', description: 'Inventory UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'All targeting rules retrieved successfully',
  })
  async getAllTargetingRules(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
    @Param('inventoryId', ParseUUIDPipe) inventoryId: string,
  ) {
    return this.publisherService.getAllTargetingRules(publisherId, inventoryId);
  }
}
