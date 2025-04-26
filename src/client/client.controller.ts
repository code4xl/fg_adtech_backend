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
} from '@nestjs/common';
import { ClientService } from './client.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { AdvertiserGuard } from 'src/common/guards/authorization.guard';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Http } from 'winston/lib/winston/transports';

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
  // @Post()
  // create(@Body() createClientDto: CreateClientDto) {
  //   return this.clientService.create(createClientDto);
  // }

  @Get()
  findAll() {
    return this.clientService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateClientDto: UpdateClientDto) {
    return this.clientService.update(+id, updateClientDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.clientService.remove(+id);
  }
}
