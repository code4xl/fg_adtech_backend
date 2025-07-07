import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../redis/redis.service';
import { v4 as uuidv4 } from 'uuid';
import { 
  SSE_REDIS_KEYS, 
  SSE_CONFIG,
  SSE_STATUS,
  SSEStatusType 
} from '../constants/sse.constants';

interface RequestInfo {
  requestId: string;
  status: SSEStatusType;
  publisherId: string;
  websiteId: string;
  inventoryId: string;
  slots?: any[];
  createdAt: Date;
  lastEventTime?: Date;
  metadata?: Record<string, any>;
}

interface ConnectionInfo {
  connectionId: string;
  requestId: string;
  establishedAt: Date;
  lastActivity: Date;
  lastEventId?: string;
  timeout?: number;
}

interface PartialResults {
  slots: any[];
  processedCount: number;
  totalCount: number;
}

/**
 * SSE Tracker Service
 * 
 * Manages request and connection tracking in Redis.
 * Handles connection lifecycle and provides monitoring capabilities.
 */
@Injectable()
export class SSETrackerService {
  private readonly logger = new Logger(SSETrackerService.name);

  constructor(private readonly redis: RedisService) {
    this.logger.debug('SSE Tracker Service initialized');
  }

  /**
   * Track a new SSE request
   * 
   * Called when RTB controller returns SSE URL to SDK
   */
  async trackRequest(requestInfo: {
    requestId: string;
    publisherId: string;
    websiteId: string;
    inventoryId: string;
    slots?: any[];
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const key = SSE_REDIS_KEYS.REQUEST_INFO(requestInfo.requestId);
      
      const data: RequestInfo = {
        ...requestInfo,
        status: SSE_STATUS.PENDING,
        createdAt: new Date(),
      };

      await this.redis.set(
        key,
        JSON.stringify(data),
        SSE_CONFIG.REQUEST_TTL
      );

      this.logger.debug(`Tracked SSE request: ${requestInfo.requestId}`);
    } catch (error) {
      this.logger.error('Failed to track SSE request', { error, requestInfo });
      throw error;
    }
  }

  /**
   * Get request information
   */
  async getRequestInfo(requestId: string): Promise<RequestInfo | null> {
    try {
      const key = SSE_REDIS_KEYS.REQUEST_INFO(requestId);
      const data = await this.redis.get<string>(key);
      
      if (!data) {
        return null;
      }

      return JSON.parse(data) as RequestInfo;
    } catch (error) {
      this.logger.error(`Failed to get request info for ${requestId}`, error);
      return null;
    }
  }

  /**
   * Update request status
   */
  async updateRequestStatus(
    requestId: string, 
    status: SSEStatusType,
    additionalData?: Partial<RequestInfo>
  ): Promise<void> {
    try {
      const requestInfo = await this.getRequestInfo(requestId);
      if (!requestInfo) {
        throw new Error(`Request not found: ${requestId}`);
      }

      const updated = {
        ...requestInfo,
        ...additionalData,
        status,
        lastEventTime: new Date(),
      };

      const key = SSE_REDIS_KEYS.REQUEST_INFO(requestId);
      await this.redis.set(
        key,
        JSON.stringify(updated),
        SSE_CONFIG.REQUEST_TTL
      );

      this.logger.debug(`Updated request status: ${requestId} -> ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update request status for ${requestId}`, error);
      throw error;
    }
  }

  /**
   * Track a new connection
   */
  async trackConnection(
    requestId: string,
    connectionData: {
      establishedAt: Date;
      lastEventId?: string;
      timeout?: number;
    }
  ): Promise<string> {
    const connectionId = uuidv4();
    
    try {
      // Check connection limit
      const activeCount = await this.getActiveConnectionCount(requestId);
      if (activeCount >= SSE_CONFIG.MAX_CONNECTIONS_PER_REQUEST) {
        throw new Error('Maximum connections exceeded');
      }

      // Store connection info
      const connectionInfo: ConnectionInfo = {
        connectionId,
        requestId,
        establishedAt: connectionData.establishedAt,
        lastActivity: connectionData.establishedAt,
        lastEventId: connectionData.lastEventId,
        timeout: connectionData.timeout,
      };

      const key = SSE_REDIS_KEYS.CONNECTION_INFO(requestId, connectionId);
      await this.redis.set(
        key,
        JSON.stringify(connectionInfo),
        SSE_CONFIG.CONNECTION_TTL / 1000 // Convert to seconds
      );

      // Add to active connections set
      const activeKey = SSE_REDIS_KEYS.ACTIVE_CONNECTIONS(requestId);
      await this.redis.sadd(activeKey, connectionId);
      await this.redis.expire(activeKey, SSE_CONFIG.CONNECTION_TTL / 1000);

      // Increment connection counter
      const counterKey = SSE_REDIS_KEYS.CONNECTION_COUNT(requestId);
      await this.redis.incr(counterKey);
      await this.redis.expire(counterKey, SSE_CONFIG.REQUEST_TTL);

      this.logger.debug(`Tracked new connection: ${connectionId} for request: ${requestId}`);
      return connectionId;
      
    } catch (error) {
      this.logger.error('Failed to track connection', { error, requestId, connectionId });
      throw error;
    }
  }

  /**
   * Update connection activity timestamp
   */
  async updateConnectionActivity(
    requestId: string,
    connectionId: string
  ): Promise<void> {
    try {
      const key = SSE_REDIS_KEYS.CONNECTION_INFO(requestId, connectionId);
      const data = await this.redis.get<string>(key);
      
      if (data) {
        const connectionInfo = JSON.parse(data) as ConnectionInfo;
        connectionInfo.lastActivity = new Date();
        
        await this.redis.set(
          key,
          JSON.stringify(connectionInfo),
          SSE_CONFIG.CONNECTION_TTL / 1000
        );
      }
    } catch (error) {
      this.logger.error('Failed to update connection activity', { 
        error, 
        requestId, 
        connectionId 
      });
    }
  }

  /**
   * Remove connection
   */
  async removeConnection(
    requestId: string,
    connectionId: string
  ): Promise<void> {
    try {
      // Remove connection info
      const key = SSE_REDIS_KEYS.CONNECTION_INFO(requestId, connectionId);
      await this.redis.del(key);

      // Remove from active set
      const activeKey = SSE_REDIS_KEYS.ACTIVE_CONNECTIONS(requestId);
      await this.redis.srem(activeKey, connectionId);

      // Decrement counter
      const counterKey = SSE_REDIS_KEYS.CONNECTION_COUNT(requestId);
      await this.redis.decr(counterKey);

      this.logger.debug(`Removed connection: ${connectionId} for request: ${requestId}`);
    } catch (error) {
      this.logger.error('Failed to remove connection', { 
        error, 
        requestId, 
        connectionId 
      });
    }
  }

  /**
   * Get active connections for a request
   */
  async getActiveConnections(requestId: string): Promise<ConnectionInfo[]> {
    try {
      const activeKey = SSE_REDIS_KEYS.ACTIVE_CONNECTIONS(requestId);
      const connectionIds = await this.redis.smembers(activeKey);
      
      const connections: ConnectionInfo[] = [];
      
      for (const connectionId of connectionIds) {
        const key = SSE_REDIS_KEYS.CONNECTION_INFO(requestId, connectionId);
        const data = await this.redis.get<string>(key);
        
        if (data) {
          connections.push(JSON.parse(data) as ConnectionInfo);
        }
      }
      
      return connections;
    } catch (error) {
      this.logger.error(`Failed to get active connections for ${requestId}`, error);
      return [];
    }
  }

  /**
   * Get active connection count
   */
  async getActiveConnectionCount(requestId: string): Promise<number> {
    try {
      const activeKey = SSE_REDIS_KEYS.ACTIVE_CONNECTIONS(requestId);
      return await this.redis.scard(activeKey) || 0;
    } catch (error) {
      this.logger.error(`Failed to get connection count for ${requestId}`, error);
      return 0;
    }
  }

  /**
   * Store partial results for timeout scenarios
   * 
   * Used when RTB is slow and we need to send partial results
   */
  async storePartialResults(
    requestId: string,
    results: PartialResults
  ): Promise<void> {
    try {
      const key = `${SSE_REDIS_KEYS.REQUEST_INFO(requestId)}:partial`;
      await this.redis.set(
        key,
        JSON.stringify(results),
        60 // 1 minute TTL
      );
    } catch (error) {
      this.logger.error(`Failed to store partial results for ${requestId}`, error);
    }
  }

  /**
   * Get partial results
   */
  async getPartialResults(requestId: string): Promise<PartialResults | null> {
    try {
      const key = `${SSE_REDIS_KEYS.REQUEST_INFO(requestId)}:partial`;
      const data = await this.redis.get<string>(key);
      
      if (!data) {
        return null;
      }
      
      return JSON.parse(data) as PartialResults;
    } catch (error) {
      this.logger.error(`Failed to get partial results for ${requestId}`, error);
      return null;
    }
  }

  /**
   * Record event metrics
   */
  async recordEventMetric(
    requestId: string,
    eventType: string
  ): Promise<void> {
    try {
      const key = SSE_REDIS_KEYS.EVENT_COUNT(requestId, eventType);
      await this.redis.incr(key);
      await this.redis.expire(key, 3600); // 1 hour TTL
    } catch (error) {
      this.logger.error('Failed to record event metric', { 
        error, 
        requestId, 
        eventType 
      });
    }
  }

  /**
   * Get request metrics
   */
  async getRequestMetrics(requestId: string): Promise<{
    connectionCount: number;
    eventCounts: Record<string, number>;
  }> {
    try {
      const counterKey = SSE_REDIS_KEYS.CONNECTION_COUNT(requestId);
      const connectionCount = parseInt(await this.redis.get(counterKey) || '0');
      
      // Get event counts for different types
      const eventTypes = ['bid_update', 'bid_complete', 'error', 'heartbeat'];
      const eventCounts: Record<string, number> = {};
      
      for (const eventType of eventTypes) {
        const key = SSE_REDIS_KEYS.EVENT_COUNT(requestId, eventType);
        eventCounts[eventType] = parseInt(await this.redis.get(key) || '0');
      }
      
      return {
        connectionCount,
        eventCounts,
      };
    } catch (error) {
      this.logger.error(`Failed to get request metrics for ${requestId}`, error);
      return {
        connectionCount: 0,
        eventCounts: {},
      };
    }
  }
}