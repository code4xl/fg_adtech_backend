import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { AdvertiserService } from './advertiser.service';
import { CreateAdvertiserDto } from './dto/create-advertiser.dto';
import { UpdateAdvertiserDto } from './dto/update-advertiser.dto';
import {
  ApiAcceptedResponse,
  ApiBadGatewayResponse,
  ApiMovedPermanentlyResponse,
} from '@nestjs/swagger';
import {
  ApiStandardErrors,
  ApiStandardResponse,
} from 'src/common/decorators/swagger.decorator';
import { ErrorResponseDto } from 'src/common/dto/api-response.dto';

@Controller('advertiser')
export class AdvertiserController {
  constructor(private readonly advertiserService: AdvertiserService) {}

  @Get()
  findAll() {
    return this.advertiserService.findAll();
  }

  @Get(':id')
  @ApiStandardResponse()
  @ApiMovedPermanentlyResponse({
    description: 'Advertiser moved permanently',
  })
  findOne(@Param('id') id: string) {
    return this.advertiserService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAdvertiserDto: UpdateAdvertiserDto,
  ) {
    return this.advertiserService.update(+id, updateAdvertiserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.advertiserService.remove(+id);
  }
}
