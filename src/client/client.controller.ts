import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpStatus,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ClientService } from './client.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { AdvertiserGuard } from 'src/common/guards/authorization.guard';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@Controller('client')
export class ClientController {
  constructor(private readonly clientService: ClientService) { }

  @UseGuards(AdvertiserGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({
    description: 'Client created successfully',
  })
  @ApiUnauthorizedResponse()
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Client with this email, pan or gstin already exists',
  })
  @Post()
  create(@Body() createClientDto: CreateClientDto, @Req() req) {
    return this.clientService.create(req.user.id, createClientDto);
  }

  @Get()
  @UseGuards(AdvertiserGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all clients for the advertiser (Advertiser only)' })
  @ApiResponse({
    status: 200,
    description: 'List of clients retrieved successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async findAll(@Req() req) {
    return this.clientService.findAllByAdvertiser(req.user.id);
  }

  @Get(':id')
  @UseGuards(AdvertiserGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a client by id (Advertiser only)' })
  @ApiParam({ name: 'id', description: 'Client ID' })
  @ApiResponse({
    status: 200,
    description: 'Client retrieved successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Client not found.' })
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req,
  ) {
    const client = await this.clientService.findOne(req.user.id, id);

    return client;
  }

  @Patch(':id')
  @UseGuards(AdvertiserGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a client (Advertiser only)' })
  @ApiParam({ name: 'id', description: 'Client ID' })
  @ApiResponse({
    status: 200,
    description: 'Client has been successfully updated.',
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Client not found.' })
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateClientDto: UpdateClientDto,
    @Req() req,
  ) {
    return this.clientService.update(req.user.id, id, updateClientDto);
  }


  // @Delete(':id')
  // @UseGuards(AdvertiserGuard)
  // @ApiBearerAuth()
  // @ApiOperation({ summary: 'Delete a client (Advertiser only)' })
  // @ApiParam({ name: 'id', description: 'Client ID' })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Client has been successfully deleted.',
  // })
  // @ApiResponse({ status: 401, description: 'Unauthorized.' })
  // @ApiResponse({ status: 403, description: 'Forbidden.' })
  // @ApiResponse({ status: 404, description: 'Client not found.' })
  // async remove(
  //   @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  //   @Req() req,
  // ) {
  //   return this.clientService.remove(req.user.id, id);
  // }
}
