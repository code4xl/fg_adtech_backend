/**
 * SSE Constants
 * 
 * Defines event types, configuration, and Redis key patterns
 * for the Server-Sent Events implementation.
 */

export const SSE_EVENTS = {
    BID_UPDATE: 'bid_update',
    BID_COMPLETE: 'bid_complete',
    ERROR: 'error',
    HEARTBEAT: 'heartbeat',
    CONNECTION_CLOSE: 'connection_close',
  } as const;
  
  export const SSE_STATUS = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    AUCTION: 'auction',
    COMPLETE: 'complete',
    ERROR: 'error',
    TIMEOUT: 'timeout',
    PARTIAL: 'partial',
  } as const;
  
  export const SSE_CONFIG = {
    // Timeouts and intervals (milliseconds)
    INITIAL_TIMEOUT: 15000, // Initial response timeout (15 seconds for slow RTB)
    MAX_PROCESSING_TIME: 30000, // Max time for RTB processing (30s for very slow responses)
    HEARTBEAT_INTERVAL: 30000, // Keep-alive heartbeat
    CONNECTION_TTL: 300000, // 5 minutes max connection time
    REQUEST_TTL: 300, // 5 minutes in Redis (seconds)
    
    // Connection limits
    MAX_CONNECTIONS_PER_REQUEST: 3,
    MAX_RETRY_ATTEMPTS: 3,
    
    // Redis pub/sub channels
    REDIS_CHANNEL_PREFIX: 'rtb:sse:channel:',
    
    // Performance thresholds
    SLOW_RESPONSE_THRESHOLD: 5000, // Log warning if response > 5s
    CRITICAL_RESPONSE_THRESHOLD: 10000, // Log error if response > 10s
  } as const;
  
  // Redis key patterns for SSE
  export const SSE_REDIS_KEYS = {
    // Request tracking
    REQUEST_INFO: (requestId: string) => `rtb:sse:request:${requestId}`,
    REQUEST_LOCK: (requestId: string) => `rtb:sse:lock:${requestId}`,
    
    // Event queue
    EVENT_QUEUE: (requestId: string) => `rtb:sse:events:${requestId}`,
    
    // Connection tracking
    CONNECTION_INFO: (requestId: string, connectionId: string) => 
      `rtb:sse:connection:${requestId}:${connectionId}`,
    ACTIVE_CONNECTIONS: (requestId: string) => `rtb:sse:connections:${requestId}`,
    
    // Channel for pub/sub
    EVENT_CHANNEL: (requestId: string) => `${SSE_CONFIG.REDIS_CHANNEL_PREFIX}${requestId}`,
    
    // Metrics and monitoring
    CONNECTION_COUNT: (requestId: string) => `rtb:sse:metrics:connections:${requestId}`,
    EVENT_COUNT: (requestId: string, eventType: string) => 
      `rtb:sse:metrics:events:${requestId}:${eventType}`,
    RESPONSE_TIME: (requestId: string) => `rtb:sse:metrics:response:${requestId}`,
  } as const;
  
  export type SSEEventType = typeof SSE_EVENTS[keyof typeof SSE_EVENTS];
  export type SSEStatusType = typeof SSE_STATUS[keyof typeof SSE_STATUS];