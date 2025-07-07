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
    Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';  
import { SSETrackerService } from '../sse/services/sse-tracker.service';

import { AuctionStatusDto, BidResponseDto, CreateBidRequestDto, SdkBidRequestDto } from '../dto';
import { RtbHelper } from '../utils/helpers';
import { RtbService } from '../services/rtb.service';
import { AuctionService } from '../services/auction.service';
import { BidRequestResponseDto } from '../dto/bid-request-response.dto';

@ApiTags('RTB')
@Controller('rtb')
export class RTBController {
  private readonly logger = new Logger(RTBController.name);

    constructor(
        private readonly rtbService: RtbService,
        private readonly auctionService: AuctionService,
        private readonly rtbHelper: RtbHelper,
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,  
        private readonly sseTracker: SSETrackerService, 
    ) {
        this.logger.debug('RTB Controller initialized - Phase 3 Complete');
    }

    @Post('bid-request')
    @ApiOperation({
        summary: 'Process bid request from SDK',
        description: 'Receives bid request from SDK and initiates RTB auction processing. Returns immediately with request ID for polling or SSE streaming.'
    })
    @ApiResponse({
        status: 202,
        description: 'Bid request accepted for processing',
        type: BidRequestResponseDto,  
    })
    async handleBidRequest(
        @Body() requestBody: any,
        @Req() req: Request
    ): Promise<BidRequestResponseDto> {
        // Handle both SDK format and legacy format
        let bidRequestDto: CreateBidRequestDto;
        
        if (requestBody.meta && requestBody.slots && requestBody.context) {
            // SDK format - convert to legacy format
            bidRequestDto = await this.convertSdkToLegacyFormat(requestBody);
        } else {
            // Legacy format - use as is
            bidRequestDto = requestBody as CreateBidRequestDto;
        }  
        this.logger.debug('Bid request received', {
            externalRequestId: bidRequestDto.externalRequestId,
            inventoryId: bidRequestDto.inventoryId,
            publisherId: bidRequestDto.publisherId,
            enableSSE: bidRequestDto.enableSSE, // LOG SSE MODE
            sseTimeout: bidRequestDto.sseTimeout, // LOG SSE TIMEOUT
            requestFormat: requestBody.meta ? 'SDK' : 'Legacy',
            originalSseTimeout: requestBody.sseTimeout, // Original from SDK
        });

        try {
            // Validate request data
            await this.validateBidRequest(bidRequestDto);

      // Process bid request (stores in DB, triggers Kafka processing)
      const result = await this.rtbService.processBidRequest(bidRequestDto);

            // Check if SSE is enabled for this request
            const sseEnabled = bidRequestDto.enableSSE || 
                              bidRequestDto.responseMode === 'sse';

            // Prepare response - SDK expects simple format with requestId at root level
            const response: BidRequestResponseDto = {
                requestId: result.requestId,
                auctionId: result.auctionId,
                status: 'processing',
                message: 'Bid request accepted for processing',
                estimatedResponseTime: '100ms',
            };

            // If SSE is enabled, add SSE URL and track the request
            if (sseEnabled) {
                // Try to get base URL from config first
                let baseUrl = this.configService.get<string>('APP_URL');
                
                // If not configured, generate from request
                if (!baseUrl) {
                const protocol = req.protocol || 'https';
                const host = req.get('host') || 'localhost:3000';
                baseUrl = `${protocol}://${host}`;
                
                this.logger.debug('Generated base URL from request', { 
                protocol, 
                host, 
                baseUrl 
                });
                }
                
                // Include timeout in SSE URL
                const sseTimeoutValue = bidRequestDto.sseTimeout || 15000;
                response.sseUrl = `${baseUrl}/rtb/stream/${result.requestId}?timeout=${sseTimeoutValue}`;
            response.sseEnabled = true;
            response.sseTimeout = sseTimeoutValue;

                // Track SSE request for the SSE service
                await this.sseTracker.trackRequest({
                    requestId: result.requestId,
                    publisherId: bidRequestDto.publisherId,
                    websiteId: bidRequestDto.websiteId,
                    inventoryId: bidRequestDto.inventoryId,
                    metadata: {
                        auctionId: result.auctionId,
                        enableSSE: true,
                        sseTimeout: response.sseTimeout,
                        requestedAt: new Date().toISOString(),
                    }
                });

                this.logger.debug('SSE enabled for bid request', {
                    requestId: result.requestId,
                    sseUrl: response.sseUrl,
                });
            }

            this.logger.debug('Bid request processed successfully', {
                requestId: result.requestId,
                inventoryId: bidRequestDto.inventoryId,
                sseEnabled,
            });

            return response;

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
            this.logger.debug('Bid response returned successfully', {
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
    
    /**
     * Validate bid request before processing
     * 
     * Ensures all required relationships exist and are valid
     */
    private async validateBidRequest(bidRequest: CreateBidRequestDto): Promise<void> {
        // Check if publisher exists and is active
        const publisher = await this.prisma.publisher.findUnique({
            where: { id: bidRequest.publisherId },
            select: { id: true, status: true }
        });

        if (!publisher) {
            throw new BadRequestException('Invalid publisher ID');
        }

        if (publisher.status !== 'ACTIVE') {
            throw new BadRequestException('Publisher is not active');
        }

        // Check if website exists and belongs to publisher
        const website = await this.prisma.website.findFirst({
            where: {
                id: bidRequest.websiteId,
                publisherId: bidRequest.publisherId,
                isActive: true
            },
            select: { id: true }
        });

        if (!website) {
            throw new BadRequestException('Invalid website ID or website not active');
        }

        // Check if inventory exists and belongs to website
        const inventory = await this.prisma.adInventory.findFirst({
            where: {
                id: bidRequest.inventoryId,
                websiteId: bidRequest.websiteId,
                isActive: true
            },
            select: { id: true }
        });

        if (!inventory) {
            throw new BadRequestException('Invalid inventory ID or inventory not active');
        }

        // Validate floor price if provided
        if (bidRequest.floorPrice !== undefined && bidRequest.floorPrice < 0) {
            throw new BadRequestException('Floor price must be non-negative');
        }

        // Validate SSE timeout if provided
        if (bidRequest.sseTimeout !== undefined) {
            if (bidRequest.sseTimeout < 250 || bidRequest.sseTimeout > 30000) {
                throw new BadRequestException('SSE timeout must be between 250ms and 30000ms');
            }
        }

        this.logger.debug('Bid request validation passed', {
            publisherId: bidRequest.publisherId,
            websiteId: bidRequest.websiteId,
            inventoryId: bidRequest.inventoryId
        });
    }

    /**
     * Convert SDK format bid request to legacy format
     * 
     * SDK sends: { meta, slots, context, capabilities }
     * Legacy expects: { externalRequestId, inventoryId, publisherId, websiteId, userContext, adSlotContext }
     */
    private async convertSdkToLegacyFormat(sdkRequest: any): Promise<CreateBidRequestDto> {
        const { meta, slots, context } = sdkRequest;
        
        // For now, we'll process the first slot only
        // TODO: Handle multiple slots properly
        const firstSlot = slots[0];
        
        if (!firstSlot) {
            throw new BadRequestException('No slots provided in SDK request');
        }

        // Get inventory details from database
        const inventory = await this.prisma.adInventory.findFirst({
            where: {
                id: firstSlot.inventoryId,
                websiteId: meta.websiteId,
                isActive: true
            },
            include: {
                adSlotTemplate: true
            }
        });

        if (!inventory) {
            throw new BadRequestException(`Inventory ${firstSlot.inventoryId} not found or not active`);
        }

        // Convert user context
        const userContext = {
            userAgent: context.device.userAgent,
            ipAddress: '127.0.0.1', // TODO: Get from request headers
            deviceType: context.device.type,
            browserType: context.device.browser,
            osType: context.device.os,
            country: 'IN', // TODO: Get from geo context
            region: undefined,
            city: undefined,
            additionalData: {}
        };

        // Convert ad slot context using inventory data
        const adSlotContext = {
            width: inventory.adSlotTemplate?.width || 800,
            height: inventory.adSlotTemplate?.height || 600,
            format: inventory.adSlotTemplate?.format || 'BANNER',
            position: inventory.adSlotTemplate?.position || 'ABOVE_FOLD',
            pageUrl: context.page.url,
            referrerUrl: context.page.referrer,
            pageKeywords: []
        };

        return {
            externalRequestId: meta.requestId,
            inventoryId: firstSlot.inventoryId,
            publisherId: meta.publisherId,
            websiteId: meta.websiteId,
            userContext,
            adSlotContext,
            enableSSE: sdkRequest.enableSSE !== false, // Default to true for SDK requests
            sseTimeout: sdkRequest.sseTimeout || 15000 // Use SDK timeout or default to 15 seconds
        };
    }
}
