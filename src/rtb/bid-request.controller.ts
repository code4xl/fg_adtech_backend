// src/rtb/bid-request.controller.ts
import { Controller, Post, Body, HttpStatus, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BidRequestService } from './bid-request.service';
import { CreateBidRequestDto } from './dto/create-bid-request.dto';
import { Request } from 'express';

@ApiTags('RTB')
@Controller('bid-request')
export class BidRequestController {
  constructor(private readonly bidRequestService: BidRequestService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new bid request' })
  @ApiResponse({ status: 201, description: 'Bid request created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 404, description: 'Publisher or inventory not found' })
  async create(
    @Body() createBidRequestDto: CreateBidRequestDto,
    @Req() req: Request,
  ) {
    console.log('Received bid request:', createBidRequestDto);

    const result = await this.bidRequestService.create(
      createBidRequestDto,
      req,
    );

    return {
      status: HttpStatus.CREATED,
      data: {
        requestId: result,
        status: 'processing',
      },
    };
  }
}
