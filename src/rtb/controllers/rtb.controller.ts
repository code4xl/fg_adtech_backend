// src/rtb/controllers/rtb.controller.ts
import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    Logger,
    HttpStatus,
    BadRequestException,
    NotFoundException
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiBody
} from '@nestjs/swagger';

import { RTBService } from '../services/rtb.service';
import {
    CreateBidRequestDto,
    BidResponseDto,
    AuctionStatusDto,
    HealthCheckDto
} from '../dto';
import { AuctionService } from '../services/auction.service';

/**
 * RTB Controller - Phase 3 Complete Implementation
 * 
 * **Why this structure:**
 * - Preserves existing SDK-integrated endpoints (backward compatibility)
 * - Adds comprehensive error handling and validation
 * - Includes detailed API documentation for monitoring tools
 * - Implements proper HTTP status codes for different scenarios
 * 
 * **Key endpoints:**
 * 1. POST /rtb/bid-request - Main SDK entry point
 * 2. GET /rtb/bid-response/:requestId - SDK polling endpoint  
 * 3. GET /rtb/auction/:requestId/status - Detailed auction status
 * 4. GET /rtb/health - System health monitoring
 * 
 * **Performance considerations:**
 * - bid-request returns immediately (202 Accepted) for async processing
 * - bid-response checks cache first, then database
 * - All endpoints include proper error handling
 */
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

    /**
     * PRESERVE: Main SDK-integrated bid request endpoint
     * 
     * **Why this design:**
     * - Returns immediately (202) to meet SDK timeout requirements
     * - Validates request before processing to catch errors early
     * - Triggers async processing via Kafka for scalability
     * - Provides request ID for tracking
     * 
     * **Flow:**
     * 1. Validate incoming request
     * 2. Store bid request in database
     * 3. Publish to Kafka for async auction processing
     * 4. Return request ID immediately
     */
    @Post('bid-request')
    @ApiOperation({
        summary: 'Process bid request from SDK',
        description: 'Receives bid request from SDK and initiates RTB auction processing. Returns immediately with request ID for polling.'
    })
    @ApiBody({
        type: CreateBidRequestDto,
        description: 'Bid request data from SDK including user context and ad slot information'
    })
    @ApiResponse({
        status: 202,
        description: 'Bid request accepted for processing',
        schema: {
            type: 'object',
            properties: {
                requestId: { type: 'string', example: 'req_abc123_def456' },
                status: { type: 'string', example: 'processing' },
                message: { type: 'string', example: 'Bid request accepted for processing' },
                estimatedResponseTime: { type: 'string', example: '100ms' }
            }
        }
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid bid request data'
    })
    async handleBidRequest(@Body() bidRequestDto: CreateBidRequestDto) {
        this.logger.debug('Bid request received', {
            externalRequestId: bidRequestDto.externalRequestId,
            inventoryId: bidRequestDto.inventoryId,
            publisherId: bidRequestDto.publisherId
        });

        try {
            // Validate request data
            await this.validateBidRequest(bidRequestDto);

            // Process bid request (stores in DB, triggers Kafka processing)
            const result = await this.rtbService.processBidRequest(bidRequestDto);

            this.logger.log('Bid request processed successfully', {
                requestId: result.requestId,
                inventoryId: bidRequestDto.inventoryId
            });

            return {
                requestId: result.requestId,
                status: 'processing',
                message: 'Bid request accepted for processing',
                estimatedResponseTime: '100ms',
                auctionId: result.auctionId // For tracking
            };

        } catch (error) {
            this.logger.error('Bid request processing failed', {
                error: error.message,
                externalRequestId: bidRequestDto.externalRequestId
            });

            if (error instanceof BadRequestException) {
                throw error;
            }

            throw new BadRequestException('Failed to process bid request');
        }
    }

    /**
     * PRESERVE: SDK-integrated bid response polling endpoint
     * 
     * **Why polling design:**
     * - SDK expects to poll for results due to auction processing time
     * - Checks Redis cache first for fast response times
     * - Falls back to database if not cached
     * - Returns structured response with ad markup and tracking URLs
     * 
     * **Response types:**
     * - 200: Auction completed with winner
     * - 204: Auction completed with no bids
     * - 202: Still processing
     * - 404: Request not found
     */
    @Get('bid-response/:requestId')
    @ApiOperation({
        summary: 'Get bid response for request ID',
        description: 'Returns auction results for a specific request ID. SDK polls this endpoint until auction completes.'
    })
    @ApiParam({
        name: 'requestId',
        description: 'Request ID returned from bid-request endpoint',
        example: 'req_abc123_def456'
    })
    @ApiResponse({
        status: 200,
        description: 'Auction completed successfully',
        type: BidResponseDto
    })
    @ApiResponse({
        status: 202,
        description: 'Auction still processing'
    })
    @ApiResponse({
        status: 204,
        description: 'Auction completed with no bids'
    })
    @ApiResponse({
        status: 404,
        description: 'Request ID not found'
    })
    async getBidResponse(@Param('requestId') requestId: string): Promise<BidResponseDto> {
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
                    message: 'Auction in progress'
                };
            }

            // Check if auction completed with no bids
            if (bidResponse.status === 'no_bids') {
                this.logger.debug('Auction completed with no bids', { requestId });
                return {
                    requestId,
                    status: 'no_bids',
                    message: 'No eligible campaigns found'
                };
            }

            // Return successful auction result
            this.logger.log('Bid response returned successfully', {
                requestId,
                hasWinner: !!bidResponse.winningBid
            });

            return bidResponse;

        } catch (error) {
            this.logger.error('Failed to get bid response', {
                error: error.message,
                requestId
            });

            if (error instanceof NotFoundException) {
                throw error;
            }

            throw new BadRequestException('Failed to retrieve bid response');
        }
    }

    /**
     * Enhanced auction status endpoint for debugging and monitoring
     * 
     * **Why this endpoint:**
     * - Provides detailed auction metrics for debugging
     * - Shows processing stages for performance monitoring
     * - Includes cache hit rates and response times
     * - Essential for system monitoring and troubleshooting
     */
    @Get('auction/:requestId/status')
    @ApiOperation({
        summary: 'Get detailed auction status',
        description: 'Returns comprehensive auction status including metrics, processing stages, and performance data'
    })
    @ApiParam({
        name: 'requestId',
        description: 'Request ID to get status for',
        example: 'req_abc123_def456'
    })
    @ApiResponse({
        status: 200,
        description: 'Auction status retrieved successfully',
        type: AuctionStatusDto
    })
    @ApiResponse({
        status: 404,
        description: 'Auction not found'
    })
    async getAuctionStatus(@Param('requestId') requestId: string): Promise<AuctionStatusDto> {
        this.logger.debug('Auction status requested', { requestId });

        try {
            const auctionStatus = await this.auctionService.getAuctionStatus(requestId);

            if (!auctionStatus) {
                throw new NotFoundException('Auction not found');
            }

            return auctionStatus;

        } catch (error) {
            this.logger.error('Failed to get auction status', {
                error: error.message,
                requestId
            });

            if (error instanceof NotFoundException) {
                throw error;
            }

            throw new BadRequestException('Failed to retrieve auction status');
        }
    }

    /**
     * System health check endpoint
     * 
     * **Why this endpoint:**
     * - Load balancers need health checks
     * - Monitoring systems need system status
     * - Shows real-time performance metrics
     * - Indicates component availability (DB, Redis, Kafka)
     */
    @Get('health')
    @ApiOperation({
        summary: 'RTB system health check',
        description: 'Returns comprehensive system health including component status and performance metrics'
    })
    @ApiResponse({
        status: 200,
        description: 'System health retrieved successfully',
        type: HealthCheckDto
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
                    kafka: 'error'
                },
                metrics: {
                    requestsPerSecond: 0,
                    averageLatency: 'unknown',
                    cacheHitRate: 'unknown',
                    errorRate: 'high'
                },
                additionalInfo: {
                    error: error.message
                }
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
    private async validateBidRequest(bidRequestDto: CreateBidRequestDto): Promise<void> {
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

        if (!bidRequestDto.adSlotContext?.width || !bidRequestDto.adSlotContext?.height) {
            throw new BadRequestException('Ad slot dimensions are required');
        }

        // Validate dimensions are reasonable
        const { width, height } = bidRequestDto.adSlotContext;
        if (width < 1 || height < 1 || width > 2000 || height > 2000) {
            throw new BadRequestException('Invalid ad slot dimensions');
        }

        // Validate timeout if provided
        if (bidRequestDto.timeout && (bidRequestDto.timeout < 50 || bidRequestDto.timeout > 1000)) {
            throw new BadRequestException('Timeout must be between 50-1000ms');
        }
    }
}