import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger
  } from '@nestjs/common';
  import { Observable } from 'rxjs';
  import { tap } from 'rxjs/operators';
  
  @Injectable()
  export class AIUsageInterceptor implements NestInterceptor {
    private readonly logger = new Logger(AIUsageInterceptor.name);
  
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
      const request = context.switchToHttp().getRequest();
      const response = context.switchToHttp().getResponse();
      const startTime = Date.now();
  
      return next.handle().pipe(
        tap(() => {
          const processingTime = Date.now() - startTime;
          const remainingRequests = request.aiRequestsRemaining || 'N/A';
          
          response.setHeader('X-AI-Processing-Time', processingTime.toString());
          response.setHeader('X-AI-Requests-Remaining', remainingRequests.toString());
          
          this.logger.log(
            `AI Request - User: ${request.user?.id} | ` +
            `Endpoint: ${request.url} | ` +
            `Processing Time: ${processingTime}ms | ` +
            `Remaining Requests: ${remainingRequests}`
          );
        })
      );
    }
  }