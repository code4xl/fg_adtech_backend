// src/rtb/controllers/bid-request.controller.ts
import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BidRequestService } from '../services/bid-request.service';
import { BidResponseDto } from '../dto/bid-response.dto';
import { CreateBidRequestDto } from '../dto/create-bid-request.dto';

@ApiTags('RTB')
@Controller('rtb')
export class BidRequestController {
  private readonly logger = new Logger(BidRequestController.name);

  constructor(private readonly bidRequestService: BidRequestService) {}

  /**
   * CRITICAL: This endpoint preserves the existing API signature for SDK compatibility
   * Internal processing is enhanced but the external interface remains unchanged
   */
  @Post('bid-request')
  @ApiOperation({ summary: 'Process RTB bid request' })
  @ApiResponse({
    status: 200,
    description: 'Bid response with creative or no-bid',
    type: BidResponseDto,
  })
  async createBidRequest(
    @Body() createBidRequestDto: CreateBidRequestDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.debug(
        `Processing bid request: ${createBidRequestDto.externalRequestId}`,
      );

      // PRESERVE EXISTING API: Process bid request with enhanced internal logic
      const bidResponse = await this.bidRequestService.processBidRequest(
        createBidRequestDto,
        {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          requestTimestamp: new Date(),
        },
      );

      const processingTime = Date.now() - startTime;

      // Enhanced response with performance metrics
      const response: BidResponseDto = {
        ...bidResponse,
        processingTime,
      };

      // Return response in the format SDK expects
      res.status(HttpStatus.OK).json(response);

      this.logger.debug(
        `Bid request processed in ${processingTime}ms: ${createBidRequestDto.externalRequestId}`,
      );
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(
        `Error processing bid request: ${createBidRequestDto.externalRequestId}`,
        error,
      );

      // Return no-bid response to maintain API compatibility
      const errorResponse: BidResponseDto = {
        bidRequestId: createBidRequestDto.externalRequestId,
        hasBids: false,
        processingTime,
      };

      res.status(HttpStatus.OK).json(errorResponse);
    }
  }

  /**
   * Health check endpoint for RTB system
   */
  @Post('health')
  @ApiOperation({ summary: 'RTB system health check' })
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
