import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HttpLogger");

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const body = request.body || {};
    const params = request.params;
    const query = request.query;
      this.logger.debug(`Request Body: ${JSON.stringify(body)}`);
      this.logger.debug(`Request Params: ${JSON.stringify(params)}`);
      this.logger.debug(`Request Query: ${JSON.stringify(query)}`);
    
    return next.handle().pipe(
      tap(() => {
        // You can also log response or other metrics here if needed
      }),
    );
  }
}