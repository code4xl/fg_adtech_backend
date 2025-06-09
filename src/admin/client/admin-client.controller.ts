import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpStatus,
    ParseUUIDPipe,
    ValidationPipe,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiQuery,
    ApiBearerAuth,
    ApiBody,
} from '@nestjs/swagger';
import { AdminGuard } from 'src/common/guards/authorization.guard';
import { ClientListResponseDto, ClientFilterDto, ClientResponseDto, CreateClientDto, UpdateClientDto, ClientCampaignSummaryDto, ClientStatisticsDto, BulkActionDto } from '../dto/client.dto';
import { AdminClientService } from './admin-client.service';
import { ClientStatus } from '@prisma/client';


@ApiTags('Admin - Client Management')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/clients')
export class AdminClientController {
    constructor(private readonly adminClientService: AdminClientService) { }

    @Get()
    @ApiOperation({
        summary: 'Get all clients with pagination and filters',
        description: 'Retrieve a paginated list of all clients with optional filtering and sorting',
    })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10)' })
    @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by name, email, or company' })
    @ApiQuery({ name: 'advertiserId', required: false, type: String, description: 'Filter by advertiser ID' })
    @ApiQuery({ name: 'companySize', required: false, enum: ['SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE'], description: 'Filter by company size' })
    @ApiQuery({ name: 'sortBy', required: false, type: String, description: 'Sort field (default: createdAt)' })
    @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'], description: 'Sort order (default: desc)' })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Clients retrieved successfully',
        type: ClientListResponseDto,
    })
    async getAllClients(@Query() filters: ClientFilterDto) {
        return this.adminClientService.getAllClients(filters);
    }

    @Get(':id')
    @ApiOperation({
        summary: 'Get client by ID',
        description: 'Retrieve a specific client with detailed information including associated advertiser and campaigns',
    })
    @ApiParam({ name: 'id', type: String, description: 'Client UUID' })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Client retrieved successfully',
        type: ClientResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Client not found',
    })
    async getClientById(@Param('id', ParseUUIDPipe) id: string) {
        return this.adminClientService.getClientById(id);
    }

    @Delete(':id')
    @ApiOperation({
        summary: 'Delete client',
        description: 'Delete a client and handle associated campaigns',
    })
    @ApiParam({ name: 'id', type: String, description: 'Client UUID' })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Client deleted successfully',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Client not found',
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: 'Cannot delete client with active campaigns',
    })
    async deleteClient(@Param('id', ParseUUIDPipe) id: string) {
        return this.adminClientService.deleteClient(id);
    }


    @Put(':id/advertiser')
    @ApiOperation({
        summary: 'Associate client with advertiser',
        description: 'Associate or change the advertiser for a client',
    })
    @ApiParam({ name: 'id', type: String, description: 'Client UUID' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                advertiserId: { type: 'string', format: 'uuid', description: 'Advertiser UUID' },
            },
            required: ['advertiserId'],
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Client associated with advertiser successfully',
        type: ClientResponseDto,
    })
    async associateAdvertiser(
        @Param('id', ParseUUIDPipe) id: string,
        @Body('advertiserId', ParseUUIDPipe) advertiserId: string,
    ) {
        return this.adminClientService.associateAdvertiser(id, advertiserId);
    }

    @Delete(':id/advertiser')
    @ApiOperation({
        summary: 'Remove advertiser association',
        description: 'Remove the advertiser association from a client',
    })
    @ApiParam({ name: 'id', type: String, description: 'Client UUID' })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Advertiser association removed successfully',
        type: ClientResponseDto,
    })
    async removeAdvertiserAssociation(@Param('id', ParseUUIDPipe) id: string) {
        return this.adminClientService.removeAdvertiserAssociation(id);
    }

    @Put(':id/status')
    @ApiOperation({
        summary: 'Update client status',
        description: 'Activate or deactivate a client account',
    })
    @ApiParam({ name: 'id', type: String, description: 'Client UUID' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'], description: 'Client status' },
            },
            required: ['status'],
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Client status updated successfully',
        type: ClientResponseDto,
    })
    async updateClientStatus(
        @Param('id', ParseUUIDPipe) id: string,
        @Body('status') status: ClientStatus,
    ) {
        return this.adminClientService.updateClientStatus(id, status);
    }
}