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
import { AuctionType } from '@prisma/client';

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
            this.logger.log('=== SDK BID REQUEST RECEIVED ===');
            this.logger.log('Incoming SDK Request Data:', {
                meta: requestBody.meta,
                slotsCount: requestBody.slots?.length,
                hasContext: !!requestBody.context,
                enableSSE: requestBody.enableSSE,
                responseMode: requestBody.responseMode,
                sseTimeout: requestBody.sseTimeout
            });
            
            bidRequestDto = await this.convertSdkToLegacyFormat(requestBody);
            
            this.logger.log('=== CONVERTED TO LEGACY FORMAT ===');
            this.logger.log('Legacy Request Data:', {
                externalRequestId: bidRequestDto.externalRequestId,
                inventoryId: bidRequestDto.inventoryId,
                publisherId: bidRequestDto.publisherId,
                websiteId: bidRequestDto.websiteId,
                userContext: bidRequestDto.userContext,
                adSlotContext: bidRequestDto.adSlotContext,
                floorPrice: bidRequestDto.floorPrice,
                auctionType: bidRequestDto.auctionType,
                timeout: bidRequestDto.timeout,
                enableSSE: bidRequestDto.enableSSE,
                responseMode: bidRequestDto.responseMode,
                sseTimeout: bidRequestDto.sseTimeout
            });
        } else {
            // Legacy format - use as is
            this.logger.log('=== LEGACY BID REQUEST RECEIVED ===');
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

            this.logger.log('🎯 FINAL DATA BEING PASSED TO RTB SERVICE:');
            this.logger.log('Complete Bid Request:', JSON.stringify(bidRequestDto, null, 2));

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
     * Legacy expects: { externalRequestId, inventoryId, publisherId, websiteId, userContext, adSlotContext, floorPrice, auctionType, timeout }
     */
    private async convertSdkToLegacyFormat(sdkRequest: any): Promise<CreateBidRequestDto> {
        const { meta, slots, context } = sdkRequest;
        
        this.logger.log('🔄 Starting SDK to Legacy conversion...');
        this.logger.log('SDK Input Summary:', {
            requestId: meta?.requestId,
            publisherId: meta?.publisherId,
            websiteId: meta?.websiteId,
            slotsCount: slots?.length,
            deviceType: context?.device?.type,
            pageUrl: context?.page?.url
        });
        
        // For now, we'll process the first slot only
        // TODO: Handle multiple slots properly
        const firstSlot = slots[0];
        
        if (!firstSlot) {
            throw new BadRequestException('No slots provided in SDK request');
        }

        this.logger.log('📊 Fetching inventory and floor price data from database...');
        
        // Get inventory details from database with floor prices
        const inventory = await this.prisma.adInventory.findFirst({
            where: {
                id: firstSlot.inventoryId,
                websiteId: meta.websiteId,
                isActive: true
            },
            include: {
                adSlotTemplate: true,
                floorPrices: {
                    where: {
                        startDate: { lte: new Date() },
                        OR: [
                            { endDate: null },
                            { endDate: { gte: new Date() } }
                        ]
                    },
                    orderBy: {
                        startDate: 'desc'
                    },
                    take: 1
                }
            }
        });

        if (!inventory) {
            this.logger.error('❌ Inventory not found:', {
                inventoryId: firstSlot.inventoryId,
                websiteId: meta.websiteId
            });
            throw new BadRequestException(`Inventory ${firstSlot.inventoryId} not found or not active`);
        }

        // Get floor price - use the most recent active floor price or default
        const currentFloorPrice = inventory.floorPrices?.[0]?.basePrice || 0.5;
        
        this.logger.log('💰 Floor Price Retrieved:', {
            inventoryId: firstSlot.inventoryId,
            floorPrice: Number(currentFloorPrice),
            source: inventory.floorPrices?.[0] ? 'database' : 'default',
            adSlotTemplate: {
                width: inventory.adSlotTemplate?.width,
                height: inventory.adSlotTemplate?.height,
                format: inventory.adSlotTemplate?.format,
                position: inventory.adSlotTemplate?.position
            }
        });

        // Generate default userId if not available
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Use sessionId from context or generate default
        const sessionId = context.user?.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        this.logger.log('👤 User Context Building:', {
            userId: userId,
            sessionId: sessionId,
            sessionSource: context.user?.sessionId ? 'SDK' : 'generated',
            deviceType: context.device?.type,
            browser: context.device?.browser,
            os: context.device?.os
        });

        // Convert user context with enhanced data and defaults
        const userContext = {
            userId: userId,
            sessionId: sessionId,
            userAgent: context.device?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ipAddress: '127.0.0.1', // TODO: Get from request headers
            deviceType: (context.device?.type?.toUpperCase() as any) || 'DESKTOP',
            browserType: context.device?.browser || 'chrome',
            osType: context.device?.os || 'windows',
            country: 'IN', // TODO: Get from geo context or default
            region: 'Maharashtra', // Default region
            city: 'Mumbai', // Default city
            additionalData: {
                interests: ['tech', 'sports'], // Default interests
                ageGroup: '25-34' // Default age group
            }
        };

        // Extract page keywords from title and URL
        const pageKeywords = this.extractPageKeywords(context.page?.title, context.page?.url);
        const pageCategory = this.determinePageCategory(context.page?.title, context.page?.url, pageKeywords);
        
        this.logger.log('📄 Page Analysis Results:', {
            pageTitle: context.page?.title,
            pageUrl: context.page?.url,
            extractedKeywords: pageKeywords,
            determinedCategory: pageCategory
        });

        // Convert ad slot context using inventory data with enhanced fields
        const adSlotContext = {
            width: inventory.adSlotTemplate?.width || 800,
            height: inventory.adSlotTemplate?.height || 600,
            format: inventory.adSlotTemplate?.format || 'BANNER',
            position: inventory.adSlotTemplate?.position || 'ABOVE_FOLD',
            pageUrl: context.page?.url || 'https://example.com',
            pageCategory: pageCategory,
            referrerUrl: context.page?.referrer || 'https://google.com/search',
            pageKeywords: pageKeywords
        };

        const finalRequest = {
            externalRequestId: meta.requestId,
            inventoryId: firstSlot.inventoryId,
            publisherId: meta.publisherId,
            websiteId: meta.websiteId,
            userContext,
            adSlotContext,
            floorPrice: Number(currentFloorPrice), // Convert Decimal to number
            auctionType: AuctionType.SECOND_PRICE, // Default auction type
            timeout: 200, // Default timeout in ms
            enableSSE: sdkRequest.enableSSE !== false, // Default to true for SDK requests
            responseMode: sdkRequest.responseMode || 'sse', // Preserve response mode
            sseTimeout: sdkRequest.sseTimeout || 15000 // Use SDK timeout or default to 15 seconds
        };
        
        this.logger.log('✅ FINAL CONVERTED REQUEST DATA:');
        this.logger.log('📋 Basic Info:', {
            externalRequestId: finalRequest.externalRequestId,
            inventoryId: finalRequest.inventoryId,
            publisherId: finalRequest.publisherId,
            websiteId: finalRequest.websiteId
        });
        this.logger.log('👤 User Context:', finalRequest.userContext);
        this.logger.log('🎯 Ad Slot Context:', finalRequest.adSlotContext);
        this.logger.log('💰 Auction Settings:', {
            floorPrice: finalRequest.floorPrice,
            auctionType: finalRequest.auctionType,
            timeout: finalRequest.timeout
        });
        this.logger.log('🔗 SSE Settings:', {
            enableSSE: finalRequest.enableSSE,
            responseMode: finalRequest.responseMode,
            sseTimeout: finalRequest.sseTimeout
        });

        return finalRequest;
    }

    /**
     * Extract keywords from page title and URL
     */
    private extractPageKeywords(title?: string, url?: string): string[] {
        const keywords: string[] = [];
        
        // Extract from title
        if (title) {
            const titleWords = title.toLowerCase()
                .replace(/[^a-z0-9\s]/g, ' ')
                .split(/\s+/)
                .filter(word => word.length > 3);
            keywords.push(...titleWords.slice(0, 3)); // Take first 3 meaningful words
        }
        
        // Extract from URL path
        if (url) {
            try {
                const urlPath = new URL(url).pathname;
                const pathWords = urlPath.split('/')
                    .filter(segment => segment.length > 2)
                    .map(segment => segment.replace(/[^a-z0-9]/gi, ''))
                    .filter(word => word.length > 0);
                keywords.push(...pathWords.slice(0, 2)); // Take first 2 path segments
            } catch (e) {
                // Invalid URL, skip
            }
        }
        
        // Default keywords if none found
        if (keywords.length === 0) {
            return ['technology', 'innovation', 'digital'];
        }
        
        return [...new Set(keywords)].slice(0, 5); // Remove duplicates and limit to 5
    }

    /**
     * Determine page category based on title, URL, and keywords
     */
    private determinePageCategory(title?: string, url?: string, keywords?: string[]): string {
        const content = `${title || ''} ${url || ''} ${keywords?.join(' ') || ''}`.toLowerCase();
        
        // Category mapping
        const categoryMap = {
            'technology': ['tech', 'software', 'ai', 'computer', 'digital', 'programming'],
            'sports': ['sport', 'football', 'cricket', 'game', 'player', 'match'],
            'news': ['news', 'article', 'breaking', 'update', 'report'],
            'business': ['business', 'finance', 'market', 'company', 'corporate'],
            'entertainment': ['movie', 'film', 'music', 'celebrity', 'entertainment'],
            'health': ['health', 'medical', 'fitness', 'wellness', 'doctor'],
            'education': ['education', 'learn', 'course', 'study', 'university'],
            'travel': ['travel', 'hotel', 'flight', 'vacation', 'trip']
        };
        
        for (const [category, terms] of Object.entries(categoryMap)) {
            if (terms.some(term => content.includes(term))) {
                return category;
            }
        }
        
        return 'general'; // Default category
    }
}
