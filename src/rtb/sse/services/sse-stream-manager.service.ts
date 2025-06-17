import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Response } from 'express';

interface StreamInfo {
  requestId: string;
  connectionId: string;
  response: Response;
  startTime: Date;
  lastActivity: Date;
  eventCount: number;
  status: 'active' | 'closing' | 'closed';
}

/**
 * SSE Stream Manager Service
 * 
 * Manages multiple SSE streams, monitors their health,
 * and handles cleanup on shutdown.
 */
@Injectable()
export class SSEStreamManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(SSEStreamManagerService.name);
  private readonly streams = new Map<string, StreamInfo>();
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.logger.log('SSE Stream Manager initialized');
    this.startMonitoring();
  }

  /**
   * Register a new stream
   */
  registerStream(
    requestId: string,
    connectionId: string,
    response: Response
  ): void {
    const streamKey = `${requestId}:${connectionId}`;
    
    this.streams.set(streamKey, {
      requestId,
      connectionId,
      response,
      startTime: new Date(),
      lastActivity: new Date(),
      eventCount: 0,
      status: 'active',
    });

    this.logger.debug(`Registered stream: ${streamKey}`);
  }

  /**
   * Update stream activity
   */
  updateStreamActivity(requestId: string, connectionId: string): void {
    const streamKey = `${requestId}:${connectionId}`;
    const stream = this.streams.get(streamKey);
    
    if (stream) {
      stream.lastActivity = new Date();
      stream.eventCount++;
    }
  }

  /**
   * Mark stream as closing
   */
  markStreamClosing(requestId: string, connectionId: string): void {
    const streamKey = `${requestId}:${connectionId}`;
    const stream = this.streams.get(streamKey);
    
    if (stream) {
      stream.status = 'closing';
      this.logger.debug(`Stream marked as closing: ${streamKey}`);
    }
  }

  /**
   * Remove stream
   */
  removeStream(requestId: string, connectionId: string): void {
    const streamKey = `${requestId}:${connectionId}`;
    const stream = this.streams.get(streamKey);
    
    if (stream) {
      stream.status = 'closed';
      this.streams.delete(streamKey);
      this.logger.debug(`Stream removed: ${streamKey}`);
    }
  }

  /**
   * Get stream info
   */
  getStreamInfo(requestId: string, connectionId: string): StreamInfo | undefined {
    const streamKey = `${requestId}:${connectionId}`;
    return this.streams.get(streamKey);
  }

  /**
   * Get all streams for a request
   */
  getRequestStreams(requestId: string): StreamInfo[] {
    const streams: StreamInfo[] = [];
    
    this.streams.forEach((stream, key) => {
      if (stream.requestId === requestId) {
        streams.push(stream);
      }
    });
    
    return streams;
  }

  /**
   * Get active stream count
   */
  getActiveStreamCount(): number {
    let count = 0;
    this.streams.forEach(stream => {
      if (stream.status === 'active') {
        count++;
      }
    });
    return count;
  }

  /**
   * Get stream statistics
   */
  getStreamStats(): {
    total: number;
    active: number;
    closing: number;
    averageEventCount: number;
    oldestStreamAge: number;
  } {
    let active = 0;
    let closing = 0;
    let totalEvents = 0;
    let oldestAge = 0;
    const now = new Date();

    this.streams.forEach(stream => {
      if (stream.status === 'active') active++;
      if (stream.status === 'closing') closing++;
      totalEvents += stream.eventCount;
      
      const age = now.getTime() - stream.startTime.getTime();
      if (age > oldestAge) oldestAge = age;
    });

    return {
      total: this.streams.size,
      active,
      closing,
      averageEventCount: this.streams.size > 0 ? totalEvents / this.streams.size : 0,
      oldestStreamAge: oldestAge,
    };
  }

  /**
   * Start monitoring streams for health
   */
  private startMonitoring(): void {
    // Monitor every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.checkStreamHealth();
    }, 30000);
  }

  /**
   * Check health of all streams
   */
  private checkStreamHealth(): void {
    const now = new Date();
    const staleThreshold = 60000; // 1 minute
    const zombieThreshold = 300000; // 5 minutes
    
    this.streams.forEach((stream, key) => {
      const inactiveTime = now.getTime() - stream.lastActivity.getTime();
      const age = now.getTime() - stream.startTime.getTime();
      
      // Check for stale streams
      if (inactiveTime > staleThreshold && stream.status === 'active') {
        this.logger.warn(`Stale stream detected: ${key}, inactive for ${inactiveTime}ms`);
      }
      
      // Check for zombie streams
      if (age > zombieThreshold && stream.status === 'active') {
        this.logger.error(`Zombie stream detected: ${key}, age: ${age}ms`);
        this.closeZombieStream(stream, key);
      }
    });

    // Log statistics
    const stats = this.getStreamStats();
    if (stats.total > 0) {
      this.logger.log('Stream health check', stats);
    }
  }

  /**
   * Close zombie stream
   */
  private closeZombieStream(stream: StreamInfo, key: string): void {
    try {
      if (!stream.response.closed && !stream.response.destroyed) {
        stream.response.end();
      }
      this.streams.delete(key);
      this.logger.warn(`Closed zombie stream: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to close zombie stream: ${key}`, error);
    }
  }

  /**
   * Clean up on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down SSE Stream Manager');
    
    // Stop monitoring
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    // Close all active streams
    const activeStreams = Array.from(this.streams.entries())
      .filter(([_, stream]) => stream.status === 'active');
    
    this.logger.log(`Closing ${activeStreams.length} active streams`);
    
    for (const [key, stream] of activeStreams) {
      try {
        if (!stream.response.closed && !stream.response.destroyed) {
          stream.response.write('event: close\ndata: {"message": "Server shutting down"}\n\n');
          stream.response.end();
        }
        this.streams.delete(key);
      } catch (error) {
        this.logger.error(`Failed to close stream ${key} during shutdown`, error);
      }
    }
    
    this.logger.log('SSE Stream Manager shutdown complete');
  }
}