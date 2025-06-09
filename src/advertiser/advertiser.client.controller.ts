// src/advertiser/client/advertiser-client.controller.ts
import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
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
} from '@nestjs/swagger';
import { AdvertiserGuard } from 'src/common/guards/authorization.guard';
import {
    ApiStandardResponse,
    ApiStandardErrors,
} from 'src/common/decorators/swagger.decorator';
import { AssignCampaignsDto } from './dto/client/assign-campaign.dto';
import { AdvertiserClientService } from './advertiser.client.service';
import { ClientResponseDto } from './dto/client/client-response.dto';
import { CreateClientDto } from './dto/client/create-client.dto';
import { UpdateClientDto } from './dto/client/update-client.dto';


@ApiTags('Advertiser Client')
@ApiBearerAuth()
@UseGuards(AdvertiserGuard)
@Controller('advertiser/client')
export class AdvertiserClientController {
    constructor(private readonly advertiserClientService: AdvertiserClientService) { }

    @Post('create')
    @ApiOperation({
        summary: 'Create a new client',
        description: 'Creates a new client account and sends a password setup email'
    })
    @ApiStandardResponse({
        type: ClientResponseDto,
        description: 'Client created successfully',
        status: 201,
    })
    @ApiStandardErrors()
    @HttpCode(HttpStatus.CREATED)
    async createClient(
        @Request() req,
        @Body() createClientDto: CreateClientDto,
    ) {
        return this.advertiserClientService.createClient(req.user.id, createClientDto);
    }

    @Get('get-clients')
    @ApiOperation({
        summary: 'Get all clients',
        description: 'Retrieves all clients belonging to the current advertiser'
    })
    @ApiStandardResponse({
        type: ClientResponseDto,
        description: 'Clients retrieved successfully',
    })
    @ApiStandardErrors()
    async getAllClients(@Request() req) {
        return this.advertiserClientService.getClientsByAdvertiser(req.user.id);
    }

    @Get(':clientId')
    @ApiOperation({
        summary: 'Get client by ID',
        description: 'Retrieves a specific client with their assigned campaigns'
    })
    @ApiParam({
        name: 'clientId',
        description: 'Client ID',
        type: String,
        example: 'uuid-example'
    })
    @ApiStandardResponse({
        type: ClientResponseDto,
        description: 'Client retrieved successfully',
    })
    @ApiStandardErrors()
    async getClientById(
        @Request() req,
        @Param('clientId', ParseUUIDPipe) clientId: string,
    ) {
        return this.advertiserClientService.getClientById(req.user.id, clientId);
    }

    @Patch(':clientId')
    @ApiOperation({
        summary: 'Update client information',
        description: 'Updates client profile information (excluding email)'
    })
    @ApiParam({
        name: 'clientId',
        description: 'Client ID',
        type: String,
        example: 'uuid-example'
    })
    @ApiStandardResponse({
        type: ClientResponseDto,
        description: 'Client updated successfully',
    })
    @ApiStandardErrors()
    async updateClient(
        @Request() req,
        @Param('clientId', ParseUUIDPipe) clientId: string,
        @Body() updateClientDto: UpdateClientDto,
    ) {
        return this.advertiserClientService.updateClient(req.user.id, clientId, updateClientDto);
    }

    @Post(':clientId/assign-campaigns')
    @ApiOperation({
        summary: 'Assign campaigns to client',
        description: 'Assigns one or more campaigns to a client. Replaces existing assignments.'
    })
    @ApiParam({
        name: 'clientId',
        description: 'Client ID',
        type: String,
        example: 'uuid-example'
    })
    @ApiStandardResponse({
        description: 'Campaigns assigned successfully',
    })
    @ApiStandardErrors()
    @HttpCode(HttpStatus.OK)
    async assignCampaigns(
        @Request() req,
        @Param('clientId', ParseUUIDPipe) clientId: string,
        @Body() assignCampaignsDto: AssignCampaignsDto,
    ) {
        return this.advertiserClientService.assignCampaigns(req.user.id, clientId, assignCampaignsDto);
    }
}