import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Logger,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

import { RTBService } from '../services/rtb.service';
import {
  CreateBidRequestDto,
  BidResponseDto,
  AuctionStatusDto,
  HealthCheckDto,
} from '../dto';
import { AuctionService } from '../services/auction.service';

@ApiTags('RTB')
@Controller('rtb')
export class RTBController {
  private readonly logger = new Logger(RTBController.name);

  constructor(
    private readonly rtbService: RTBService,
    private readonly auctionService: AuctionService,
  ) {
    this.logger.log('RTB Controller initialized - Phase 3 Complete');
  }

  @Post('bid-request')
  @ApiOperation({
    summary: 'Process bid request from SDK',
    description:
      'Receives bid request from SDK and initiates RTB auction processing. Returns immediately with request ID for polling.',
  })
  @ApiBody({
    type: CreateBidRequestDto,
    description:
      'Bid request data from SDK including user context and ad slot information',
  })
  @ApiResponse({
    status: 202,
    description: 'Bid request accepted for processing',
    schema: {
      type: 'object',
      properties: {
        requestId: { type: 'string', example: 'req_abc123_def456' },
        status: { type: 'string', example: 'processing' },
        message: {
          type: 'string',
          example: 'Bid request accepted for processing',
        },
        estimatedResponseTime: { type: 'string', example: '100ms' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid bid request data',
  })
  async handleBidRequest(@Body() bidRequestDto: CreateBidRequestDto) {
    this.logger.debug('Bid request received', {
      externalRequestId: bidRequestDto.externalRequestId,
      inventoryId: bidRequestDto.inventoryId,
      publisherId: bidRequestDto.publisherId,
    });

    try {
      // Validate request data
      await this.validateBidRequest(bidRequestDto);

      // Process bid request (stores in DB, triggers Kafka processing)
      const result = await this.rtbService.processBidRequest(bidRequestDto);

      this.logger.log('Bid request processed successfully', {
        requestId: result.requestId,
        inventoryId: bidRequestDto.inventoryId,
      });

      return {
        requestId: result.requestId,
        status: 'processing',
        message: 'Bid request accepted for processing',
        estimatedResponseTime: '100ms',
        auctionId: result.auctionId, // For tracking
      };
    } catch (error) {
      this.logger.error('Bid request processing failed', {
        error: error.message,
        externalRequestId: bidRequestDto.externalRequestId,
      });

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Failed to process bid request');
    }
  }

  @Get('bid-response/:requestId')
  @ApiOperation({
    summary: 'Get bid response for request ID',
    description:
      'Returns auction results for a specific request ID. SDK polls this endpoint until auction completes.',
  })
  @ApiParam({
    name: 'requestId',
    description: 'Request ID returned from bid-request endpoint',
    example: '',
  })
  @ApiResponse({
    status: 200,
    description: 'Auction completed successfully',
    type: BidResponseDto,
  })
  @ApiResponse({
    status: 202,
    description: 'Auction still processing',
  })
  @ApiResponse({
    status: 204,
    description: 'Auction completed with no bids',
  })
  @ApiResponse({
    status: 404,
    description: 'Request ID not found',
  })
  async getBidResponse(
    @Param('requestId') requestId: string,
  ): Promise<BidResponseDto> {
    this.logger.debug('Bid response requested', { requestId });

    try {
      // Get bid response from service (checks cache first, then DB)
      const bidResponse = await this.rtbService.getBidResponse(requestId);

      if (!bidResponse) {
        this.logger.warn('Bid request not found', { requestId });
        throw new NotFoundException('Bid request not found');
      }

      // Check if auction is still processing
      if (bidResponse.status === 'processing') {
        this.logger.debug('Auction still processing', { requestId });
        return {
          requestId,
          status: 'processing',
          message: 'Auction in progress',
        };
      }

      // Check if auction completed with no bids
      if (bidResponse.status === 'no_bids') {
        this.logger.debug('Auction completed with no bids', { requestId });
        return {
          requestId,
          status: 'no_bids',
          message: 'No eligible campaigns found',
        };
      }

      // Return successful auction result
      this.logger.log('Bid response returned successfully', {
        requestId,
        hasWinner: !!bidResponse.winningBid,
      });

      return bidResponse;
    } catch (error) {
      this.logger.error('Failed to get bid response', {
        error: error.message,
        requestId,
      });

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new BadRequestException('Failed to retrieve bid response');
    }
  }

  @Get('auction/:requestId/status')
  @ApiOperation({
    summary: 'Get detailed auction status',
    description:
      'Returns comprehensive auction status including metrics, processing stages, and performance data',
  })
  @ApiParam({
    name: 'requestId',
    description: 'Request ID to get status for',
    example: 'req_abc123_def456',
  })
  @ApiResponse({
    status: 200,
    description: 'Auction status retrieved successfully',
    type: AuctionStatusDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Auction not found',
  })
  async getAuctionStatus(
    @Param('requestId') requestId: string,
  ): Promise<AuctionStatusDto> {
    this.logger.debug('Auction status requested', { requestId });

    try {
      const auctionStatus =
        await this.auctionService.getAuctionStatus(requestId);

      if (!auctionStatus) {
        throw new NotFoundException('Auction not found');
      }

      return auctionStatus;
    } catch (error) {
      this.logger.error('Failed to get auction status', {
        error: error.message,
        requestId,
      });

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new BadRequestException('Failed to retrieve auction status');
    }
  }

  @Get('health')
  @ApiOperation({
    summary: 'RTB system health check',
    description:
      'Returns comprehensive system health including component status and performance metrics',
  })
  @ApiResponse({
    status: 200,
    description: 'System health retrieved successfully',
    type: HealthCheckDto,
  })
  async getHealth(): Promise<HealthCheckDto> {
    this.logger.debug('Health check requested');

    try {
      const healthStatus = await this.rtbService.getSystemHealth();

      return healthStatus;
    } catch (error) {
      this.logger.error('Health check failed', { error: error.message });

      // Return degraded status instead of throwing error
      return {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        version: '1.0.0-phase3',
        components: {
          database: 'error',
          redis: 'error',
          kafka: 'error',
        },
        metrics: {
          requestsPerSecond: 0,
          averageLatency: 'unknown',
          cacheHitRate: 'unknown',
          errorRate: 'high',
        },
        additionalInfo: {
          error: error.message,
        },
      };
    }
  }

  /**
   * Private validation method for bid requests
   *
   * **Why separate validation:**
   * - Keeps controller methods clean
   * - Allows for complex validation logic
   * - Easy to unit test separately
   * - Provides detailed error messages
   */
  private async validateBidRequest(
    bidRequestDto: CreateBidRequestDto,
  ): Promise<void> {
    // Validate required fields
    if (!bidRequestDto.externalRequestId) {
      throw new BadRequestException('External request ID is required');
    }

    if (!bidRequestDto.inventoryId) {
      throw new BadRequestException('Inventory ID is required');
    }

    if (!bidRequestDto.userContext?.userAgent) {
      throw new BadRequestException('User agent is required');
    }

    if (
      !bidRequestDto.adSlotContext?.width ||
      !bidRequestDto.adSlotContext?.height
    ) {
      throw new BadRequestException('Ad slot dimensions are required');
    }
  }
}
