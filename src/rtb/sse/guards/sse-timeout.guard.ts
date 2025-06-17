import { 
    Injectable, 
    CanActivate, 
    ExecutionContext,
    Logger,
    BadRequestException
  } from '@nestjs/common';
  import { Request } from 'express';
  import { SSE_CONFIG } from '../constants/sse.constants';
  
  /**
   * SSE Timeout Guard
   * 
   * Validates timeout parameters and ensures they're within acceptable ranges.
   * Prevents abuse of long-running connections.
   */
  @Injectable()
  export class SSETimeoutGuard implements CanActivate {
    private readonly logger = new Logger(SSETimeoutGuard.name);
  
    canActivate(context: ExecutionContext): boolean {
      const request = context.switchToHttp().getRequest<Request>();
      const customTimeout = request.query.timeout as string;
      
      if (customTimeout) {
        const timeout = parseInt(customTimeout);
        
        // Validate timeout is a number
        if (isNaN(timeout)) {
          throw new BadRequestException('Invalid timeout value');
        }
        
        // Validate timeout range
        if (timeout < 50) {
          throw new BadRequestException('Timeout must be at least 50ms');
        }
        
        if (timeout > SSE_CONFIG.MAX_PROCESSING_TIME) {
          throw new BadRequestException(
            `Timeout cannot exceed ${SSE_CONFIG.MAX_PROCESSING_TIME}ms`
          );
        }
        
        // Log unusual timeout values
        if (timeout > SSE_CONFIG.CRITICAL_RESPONSE_THRESHOLD) {
          this.logger.warn(`High timeout requested: ${timeout}ms for request: ${request.params.requestId}`);
        }
      }
      
      return true;
    }
  }