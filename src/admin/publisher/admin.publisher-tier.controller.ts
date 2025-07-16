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
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { AdminGuard } from 'src/common/guards/authorization.guard';
import {
  ApiStandardResponse,
  ApiStandardErrors,
} from 'src/common/decorators/swagger.decorator';
import { AdminPublisherTierService } from './admin.publisher-tier.service';
import { PublisherTierResponseDto, CreatePublisherTierDto, UpdatePublisherTierDto, AssignPublisherTierDto } from '../dto/create-publisher-tier.dto';

@ApiTags('Admin - Publisher Tier')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/publisher-tier')
export class AdminPublisherTierController {
  constructor(
    private readonly adminPublisherTierService: AdminPublisherTierService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new publisher tier',
    description: 'Creates a new publisher tier with specified commission rate',
  })
  @ApiStandardResponse({
    type: PublisherTierResponseDto,
    description: 'Publisher tier created successfully',
    status: 201,
  })
  @ApiStandardErrors()
  @HttpCode(HttpStatus.CREATED)
  async createTier(
    @Request() req,
    @Body() createPublisherTierDto: CreatePublisherTierDto,
  ) {
    return this.adminPublisherTierService.createTier(
      req.user.id,
      createPublisherTierDto,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Get all publisher tiers',
    description: 'Retrieves all available publisher tiers with their details',
  })
  @ApiStandardResponse({
    type: PublisherTierResponseDto,
    description: 'Publisher tiers retrieved successfully',
  })
  @ApiStandardErrors()
  async getAllTiers() {
    return this.adminPublisherTierService.getAllTiers();
  }

  @Get(':tierId')
  @ApiOperation({
    summary: 'Get publisher tier by ID',
    description: 'Retrieves a specific publisher tier with its details and assigned publishers',
  })
  @ApiParam({
    name: 'tierId',
    description: 'Publisher Tier ID',
    type: String,
    example: 'uuid-example',
  })
  @ApiStandardResponse({
    type: PublisherTierResponseDto,
    description: 'Publisher tier retrieved successfully',
  })
  @ApiStandardErrors()
  async getTierById(
    @Param('tierId', ParseUUIDPipe) tierId: string,
  ) {
    return this.adminPublisherTierService.getTierById(tierId);
  }

  @Patch(':tierId')
  @ApiOperation({
    summary: 'Update publisher tier',
    description: 'Updates a publisher tier\'s name and/or commission rate',
  })
  @ApiParam({
    name: 'tierId',
    description: 'Publisher Tier ID',
    type: String,
    example: 'uuid-example',
  })
  @ApiStandardResponse({
    type: PublisherTierResponseDto,
    description: 'Publisher tier updated successfully',
  })
  @ApiStandardErrors()
  async updateTier(
    @Request() req,
    @Param('tierId', ParseUUIDPipe) tierId: string,
    @Body() updatePublisherTierDto: UpdatePublisherTierDto,
  ) {
    return this.adminPublisherTierService.updateTier(
      req.user.id,
      tierId,
      updatePublisherTierDto,
    );
  }

  @Delete(':tierId')
  @ApiOperation({
    summary: 'Delete publisher tier',
    description: 'Deletes a publisher tier (only if no publishers are assigned to it)',
  })
  @ApiParam({
    name: 'tierId',
    description: 'Publisher Tier ID',
    type: String,
    example: 'uuid-example',
  })
  @ApiResponse({
    status: 200,
    description: 'Publisher tier deleted successfully',
  })
  @ApiStandardErrors()
  async deleteTier(
    @Request() req,
    @Param('tierId', ParseUUIDPipe) tierId: string,
  ) {
    return this.adminPublisherTierService.deleteTier(req.user.id, tierId);
  }

  @Post('assign')
  @ApiOperation({
    summary: 'Assign publisher tier to publisher',
    description: 'Assigns a specific publisher tier to a publisher by publisher ID',
  })
  @ApiStandardResponse({
    description: 'Publisher tier assigned successfully',
  })
  @ApiStandardErrors()
  @HttpCode(HttpStatus.OK)
  async assignTierToPublisher(
    @Request() req,
    @Body() assignPublisherTierDto: AssignPublisherTierDto,
  ) {
    return this.adminPublisherTierService.assignTierToPublisher(
      req.user.id,
      assignPublisherTierDto,
    );
  }

  @Post('unassign/:publisherId')
  @ApiOperation({
    summary: 'Remove publisher tier assignment',
    description: 'Removes tier assignment from a publisher (assigns default Standard tier)',
  })
  @ApiParam({
    name: 'publisherId',
    description: 'Publisher ID',
    type: String,
    example: 'uuid-example',
  })
  @ApiStandardResponse({
    description: 'Publisher tier assignment removed successfully',
  })
  @ApiStandardErrors()
  @HttpCode(HttpStatus.OK)
  async unassignTierFromPublisher(
    @Request() req,
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
  ) {
    return this.adminPublisherTierService.unassignTierFromPublisher(
      req.user.id,
      publisherId,
    );
  }

  @Get('publisher/:publisherId/tier')
  @ApiOperation({
    summary: 'Get publisher\'s current tier',
    description: 'Retrieves the current tier assigned to a specific publisher',
  })
  @ApiParam({
    name: 'publisherId',
    description: 'Publisher ID',
    type: String,
    example: 'uuid-example',
  })
  @ApiStandardResponse({
    type: PublisherTierResponseDto,
    description: 'Publisher tier retrieved successfully',
  })
  @ApiStandardErrors()
  async getPublisherTier(
    @Param('publisherId', ParseUUIDPipe) publisherId: string,
  ) {
    return this.adminPublisherTierService.getPublisherTier(publisherId);
  }

  @Get('tier/:tierId/publishers')
  @ApiOperation({
    summary: 'Get all publishers assigned to a tier',
    description: 'Retrieves all publishers that are assigned to a specific tier',
  })
  @ApiParam({
    name: 'tierId',
    description: 'Publisher Tier ID',
    type: String,
    example: 'uuid-example',
  })
  @ApiStandardResponse({
    description: 'Publishers in tier retrieved successfully',
  })
  @ApiStandardErrors()
  async getPublishersInTier(
    @Param('tierId', ParseUUIDPipe) tierId: string,
  ) {
    return this.adminPublisherTierService.getPublishersInTier(tierId);
  }

  @Post('initialize-default-tiers')
  @ApiOperation({
    summary: 'Initialize default publisher tiers',
    description: 'Creates the default publisher tiers (Premium, Standard, Basic) if they don\'t exist',
  })
  @ApiResponse({
    status: 200,
    description: 'Default tiers initialized successfully',
  })
  @ApiStandardErrors()
  @HttpCode(HttpStatus.OK)
  async initializeDefaultTiers(@Request() req) {
    return this.adminPublisherTierService.initializeDefaultTiers(req.user.id);
  }
}