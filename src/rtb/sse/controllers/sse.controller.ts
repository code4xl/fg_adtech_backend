import {
    Controller,
    Get,
    Param,
    Res,
    Logger,
    UseGuards,
    Headers,
    Query,
    BadRequestException,
    NotFoundException,
    HttpStatus,
  } from '@nestjs/common';
  import {
    ApiTags,
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiHeader,
    ApiQuery,
    ApiExcludeController,
  } from '@nestjs/swagger';
  import { Response } from 'express';
  import { SSEService } from '../services/sse.service';
  import { SSETrackerService } from '../services/sse-tracker.service';
  import { SSETimeoutGuard } from '../guards/sse-timeout.guard';
  import { SSE_CONFIG } from '../constants/sse.constants';
  
  /**
   * SSE Controller
   * 
   * Handles Server-Sent Events streaming for real-time RTB updates.
   * Designed to handle slow RTB responses (5-6 seconds) gracefully.
   */
  @ApiExcludeController()
  @ApiTags('RTB SSE')
  @Controller('rtb/stream')
  export class SSEController {
    private readonly logger = new Logger(SSEController.name);
  
    constructor(
      private readonly sseService: SSEService,
      private readonly trackerService: SSETrackerService,
    ) {
      this.logger.debug('SSE Controller initialized');
    }
  
    /**
     * Stream SSE updates for a bid request
     * 
     * **Flow:**
     * 1. Validate request exists and is pending/processing
     * 2. Set up SSE headers and connection
     * 3. Subscribe to Redis pub/sub for real-time updates
     * 4. Stream events as they arrive
     * 5. Handle timeout (250ms initial, up to 10s for slow RTB)
     * 6. Clean up connection on close
     */
    @Get(':requestId')
    @UseGuards(SSETimeoutGuard)
    @ApiOperation({
      summary: 'Stream real-time bid updates via SSE',
      description: 'Establishes an SSE connection to receive real-time updates for a bid request'
    })
    @ApiParam({
      name: 'requestId',
      description: 'Unique request identifier',
      example: 'b169383a-2369-4422-9094-bf0752ceed65'
    })
    @ApiQuery({
      name: 'timeout',
      required: false,
      description: 'Custom timeout in milliseconds (max 10000)',
      example: 5000
    })
    @ApiHeader({
      name: 'Last-Event-ID',
      required: false,
      description: 'Resume from specific event ID'
    })
    @ApiResponse({
      status: 200,
      description: 'SSE stream established',
      headers: {
        'Content-Type': {
          description: 'text/event-stream',
        },
        'Cache-Control': {
          description: 'no-cache',
        },
        'Connection': {
          description: 'keep-alive',
        },
      },
    })
    @ApiResponse({
      status: 404,
      description: 'Request not found',
    })
    @ApiResponse({
      status: 400,
      description: 'Invalid request',
    })
    async streamBidUpdates(
      @Param('requestId') requestId: string,
      @Res() res: Response,
      @Headers('last-event-id') lastEventId?: string,
      @Query('timeout') customTimeout?: string,
    ): Promise<void> {
      try {
        this.logger.debug(`SSE connection requested for request: ${requestId}`);
  
        // Validate request exists
        const requestInfo = await this.trackerService.getRequestInfo(requestId);
        if (!requestInfo) {
          throw new NotFoundException('Request not found or expired');
        }
  
        // Check if request is already complete
        if (requestInfo.status === 'complete' || requestInfo.status === 'error') {
          throw new BadRequestException(`Request already ${requestInfo.status}`);
        }
  
        // Parse custom timeout if provided
        const timeout = customTimeout 
          ? Math.min(parseInt(customTimeout), SSE_CONFIG.MAX_PROCESSING_TIME)
          : SSE_CONFIG.INITIAL_TIMEOUT;
  
        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
        res.status(HttpStatus.OK);
  
        // Track connection
        const connectionId = await this.trackerService.trackConnection(requestId, {
          establishedAt: new Date(),
          lastEventId,
          timeout,
        });
  
        // Set up connection cleanup
        const cleanup = async () => {
          this.logger.debug(`Cleaning up SSE connection for request: ${requestId}`);
          await this.trackerService.removeConnection(requestId, connectionId);
          await this.sseService.cleanup(requestId);
        };
  
        // Handle client disconnect
        res.on('close', cleanup);
        res.on('error', cleanup);
  
        // Start streaming
        await this.sseService.streamEvents(requestId, res, {
          connectionId,
          lastEventId,
          timeout,
          onTimeout: async () => {
            // Handle timeout - send partial results if available
            this.logger.warn(`SSE timeout for request: ${requestId} after ${timeout}ms`);
            await this.sseService.sendTimeoutEvent(requestId, res, timeout);
          },
          onError: async (error: Error) => {
            // Handle errors gracefully
            this.logger.error(`SSE error for request: ${requestId}`, error);
            await this.sseService.sendErrorEvent(requestId, res, error);
          },
        });
  
      } catch (error) {
        this.logger.error('Failed to establish SSE connection', {
          requestId,
          error: error.message,
        });
  
        // Send error response if headers not sent
        if (!res.headersSent) {
          const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
          res.status(status).json({
            error: error.message,
            requestId,
          });
        }
      }
    }
  
    /**
     * Get SSE connection status
     */
    @Get(':requestId/status')
    @ApiOperation({
      summary: 'Get SSE connection status',
      description: 'Check the status of SSE connections for a request'
    })
    @ApiParam({
      name: 'requestId',
      description: 'Request identifier'
    })
    @ApiResponse({
      status: 200,
      description: 'Connection status',
      schema: {
        type: 'object',
        properties: {
          requestId: { type: 'string' },
          activeConnections: { type: 'number' },
          status: { type: 'string' },
          lastEventTime: { type: 'string' },
        },
      },
    })
    async getConnectionStatus(@Param('requestId') requestId: string) {
      const requestInfo = await this.trackerService.getRequestInfo(requestId);
      if (!requestInfo) {
        throw new NotFoundException('Request not found');
      }
  
      const connections = await this.trackerService.getActiveConnections(requestId);
      
      return {
        requestId,
        activeConnections: connections.length,
        status: requestInfo.status,
        lastEventTime: requestInfo.lastEventTime,
        connections: connections.map(conn => ({
          connectionId: conn.connectionId,
          establishedAt: conn.establishedAt,
          lastActivity: conn.lastActivity,
        })),
      };
    }
  }