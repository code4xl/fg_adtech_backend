import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { RedisService } from '../../../redis/redis.service';
import { SSEEventFormatterService } from './sse-event-formatter.service';
import { SSETrackerService } from './sse-tracker.service';
import { 
  SSE_CONFIG, 
  SSE_EVENTS, 
  SSE_REDIS_KEYS,
  SSEEventType,
  SSE_STATUS
} from '../constants/sse.constants';
import { SSEEventDto } from '../dto/sse-event.dto';

interface StreamOptions {
  connectionId: string;
  lastEventId?: string;
  timeout: number;
  onTimeout: () => Promise<void>;
  onError: (error: Error) => Promise<void>;
}

/**
 * SSE Service
 * 
 * Core service for managing Server-Sent Events streaming.
 * Handles Redis pub/sub, event formatting, and connection management.
 */
@Injectable()
export class SSEService {
  private readonly logger = new Logger(SSEService.name);
  private activeStreams = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly redis: RedisService,
    private readonly formatter: SSEEventFormatterService,
    private readonly tracker: SSETrackerService,
  ) {
    this.logger.debug('SSE Service initialized');
  }

  /**
   * Stream events for a bid request
   * 
   * Handles both fast (250ms) and slow (5-6s) RTB responses gracefully
   */
  async streamEvents(
    requestId: string,
    res: Response,
    options: StreamOptions,
  ): Promise<void> {
    const { connectionId, timeout, onTimeout, onError } = options;
    let subscriber: any = null;
    let heartbeatInterval: NodeJS.Timeout | null = null;
    let timeoutTimer: NodeJS.Timeout | null = null;
    let eventSequence = 0;
    let hasReceivedInitialResponse = false;
    let streamClosed = false;

    try {
      // Set up timeout handling
      // For slow RTB (5-6s), we use a longer timeout after initial response
      timeoutTimer = setTimeout(async () => {
        if (!hasReceivedInitialResponse && !streamClosed) {
          this.logger.warn(`Initial timeout reached for ${requestId} after ${timeout}ms`);
          await onTimeout();
          this.closeStream(res);
        }
      }, timeout);

      // Send initial connection event
      await this.sendEvent(res, {
        type: SSE_EVENTS.HEARTBEAT,
        requestId,
        timestamp: new Date().toISOString(),
        data: { 
          message: 'Connection established',
          expectedProcessingTime: SSE_CONFIG.MAX_PROCESSING_TIME,
        },
        sequence: eventSequence++,
      });

      // Set up heartbeat to keep connection alive
      heartbeatInterval = setInterval(async () => {
        if (!streamClosed) {
          await this.sendHeartbeat(requestId, res, eventSequence++);
        }
      }, SSE_CONFIG.HEARTBEAT_INTERVAL);

      // Check for missed events (if resuming with lastEventId)
      if (options.lastEventId) {
        await this.sendMissedEvents(requestId, res, options.lastEventId, eventSequence);
      }

      // Subscribe to Redis channel for real-time updates
      const channelKey = SSE_REDIS_KEYS.EVENT_CHANNEL(requestId);
      this.logger.debug('Subscribing to Redis channel', {
        requestId,
        channelKey,
      });
      subscriber = await this.redis.subscribe(channelKey, async (message: string) => {
        try {
          this.logger.debug('📨 Received message on SSE channel', {
            requestId,
            channelKey,
            messageLength: message.length,
            messagePreview: message.substring(0, 100),
          });
          
          const event = JSON.parse(message) as SSEEventDto;
          
          this.logger.debug('Parsed SSE event', {
            requestId,
            eventType: event.type,
            hasData: !!event.data,
            dataKeys: event.data ? Object.keys(event.data) : [],
          });

          this.logger.debug('Event data', {
            event,
          });
          
          // Mark that we've received initial response
          if (!hasReceivedInitialResponse) {
            hasReceivedInitialResponse = true;
            // Clear initial timeout and set extended timeout for slow RTB
            if (timeoutTimer) {
              clearTimeout(timeoutTimer);
              timeoutTimer = setTimeout(async () => {
                if (!streamClosed) {
                  this.logger.debug(`Extended timeout reached for ${requestId} after ${SSE_CONFIG.MAX_PROCESSING_TIME}ms`);
                  await this.sendTimeoutEvent(requestId, res, SSE_CONFIG.MAX_PROCESSING_TIME);
                  this.closeStream(res);
                }
              }, SSE_CONFIG.MAX_PROCESSING_TIME);
            }
          }

          // Add sequence number
          event.sequence = eventSequence++;

          // Send event to client
          await this.sendEvent(res, event);

          // Update connection activity
          await this.tracker.updateConnectionActivity(requestId, connectionId);

          // Close stream if complete or error
          if (event.type === SSE_EVENTS.BID_COMPLETE || event.type === SSE_EVENTS.ERROR) {
            this.logger.debug(`Closing stream for ${requestId} - Event: ${event.type}`);
            this.closeStream(res);
          }

          // Log slow responses
          const processingTime = event.data?.processingTime;
          if (processingTime) {
            if (processingTime > SSE_CONFIG.CRITICAL_RESPONSE_THRESHOLD) {
              this.logger.error(`Critical slow response: ${processingTime}ms for ${requestId}`);
            } else if (processingTime > SSE_CONFIG.SLOW_RESPONSE_THRESHOLD) {
              this.logger.warn(`Slow response: ${processingTime}ms for ${requestId}`);
            }
          }

        } catch (error) {
          this.logger.error(`Error processing SSE event for ${requestId}`, error);
          await onError(error);
        }
      });

      // Store stream reference for cleanup
      this.activeStreams.set(requestId, timeoutTimer);

    } catch (error) {
      this.logger.error(`Stream setup failed for ${requestId}`, error);
      await onError(error);
      this.closeStream(res);
    } finally {
      // Cleanup function
      res.on('close', async () => {
        streamClosed = true;
        this.logger.debug(`Client disconnected from SSE stream: ${requestId}`);
        
        // Clear timers
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        
        // Unsubscribe from Redis
        if (subscriber) {
          await this.redis.unsubscribe(SSE_REDIS_KEYS.EVENT_CHANNEL(requestId));
        }
        
        // Remove from active streams
        this.activeStreams.delete(requestId);
        
        // Update tracker
        await this.tracker.removeConnection(requestId, connectionId);
      });
    }
  }

  /**
   * Send an event to the SSE stream
   */
  private async sendEvent(res: Response, event: SSEEventDto): Promise<void> {
    if (res.closed || res.destroyed) {
      return;
    }

    try {
      const formattedEvent = this.formatter.formatEvent(event);
      res.write(formattedEvent);
      
      // Store event for replay
      await this.storeEvent(event.requestId, event);
      
    } catch (error) {
      this.logger.error('Failed to send SSE event', { error, event });
    }
  }

  /**
   * Send heartbeat event
   */
  private async sendHeartbeat(
    requestId: string, 
    res: Response, 
    sequence: number
  ): Promise<void> {
    await this.sendEvent(res, {
      type: SSE_EVENTS.HEARTBEAT,
      requestId,
      timestamp: new Date().toISOString(),
      data: { message: 'keepalive' },
      sequence,
    });
  }

  /**
   * Send timeout event with partial results
   */
  async sendTimeoutEvent(requestId: string, res: Response, actualTimeout?: number): Promise<void> {
    const partialResults = await this.tracker.getPartialResults(requestId);
    
    // Format as AdResponse to match SDK expectations
    const adResponse = {
      meta: {
        requestId: requestId,
        processingTime: actualTimeout || SSE_CONFIG.INITIAL_TIMEOUT,
        timestamp: Date.now(),
      },
      slots: partialResults?.slots || [],
      error: {
        code: 'TIMEOUT',
        message: 'Request processing exceeded timeout',
      },
    };
    
    await this.sendEvent(res, {
      type: SSE_EVENTS.BID_COMPLETE,
      requestId,
      timestamp: new Date().toISOString(),
      data: adResponse,
    });
  }

  /**
   * Send error event
   */
  async sendErrorEvent(
    requestId: string, 
    res: Response, 
    error: Error
  ): Promise<void> {
    await this.sendEvent(res, {
      type: SSE_EVENTS.ERROR,
      requestId,
      timestamp: new Date().toISOString(),
      data: {
        code: 'STREAM_ERROR',
        message: error.message,
        details: error.stack,
      },
    });
  }

  /**
   * Send missed events when resuming connection
   */
  private async sendMissedEvents(
    requestId: string,
    res: Response,
    lastEventId: string,
    currentSequence: number,
  ): Promise<void> {
    try {
      const events = await this.getStoredEvents(requestId, lastEventId);
      
      for (const event of events) {
        event.sequence = currentSequence++;
        await this.sendEvent(res, event);
      }
    } catch (error) {
      this.logger.error(`Failed to send missed events for ${requestId}`, error);
    }
  }

  /**
   * Store event for replay capability
   */
  private async storeEvent(requestId: string, event: SSEEventDto): Promise<void> {
    try {
      const key = SSE_REDIS_KEYS.EVENT_QUEUE(requestId);
      await this.redis.rpush(key, JSON.stringify(event));
      await this.redis.expire(key, SSE_CONFIG.REQUEST_TTL);
    } catch (error) {
      this.logger.error(`Failed to store event for ${requestId}`, error);
    }
  }

  /**
   * Get stored events for replay
   */
  private async getStoredEvents(
    requestId: string, 
    afterEventId: string
  ): Promise<SSEEventDto[]> {
    const key = SSE_REDIS_KEYS.EVENT_QUEUE(requestId);
    const events = await this.redis.lrange(key, 0, -1);
    
    return events
      .map(e => JSON.parse(e) as SSEEventDto)
      .filter(e => e.sequence && e.sequence > parseInt(afterEventId));
  }

  /**
   * Close SSE stream gracefully
   */
  private closeStream(res: Response): void {
    if (!res.closed && !res.destroyed) {
      res.write('event: close\ndata: {"message": "Stream closed"}\n\n');
      res.end();
    }
  }

  /**
   * Clean up resources for a request
   */
  async cleanup(requestId: string): Promise<void> {
    try {
      // Remove from active streams
      const timer = this.activeStreams.get(requestId);
      if (timer) {
        clearTimeout(timer);
        this.activeStreams.delete(requestId);
      }

      // Clean up Redis keys (optional, they have TTL)
      const keys = [
        SSE_REDIS_KEYS.EVENT_QUEUE(requestId),
        SSE_REDIS_KEYS.CONNECTION_COUNT(requestId),
      ];

      await Promise.all(keys.map(key => this.redis.del(key)));
      
    } catch (error) {
      this.logger.error(`Cleanup failed for ${requestId}`, error);
    }
  }
}