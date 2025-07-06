// src/common/interceptors/success.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface SuccessResponse<T> {
  success: boolean;
  data: T;
  message: string;
  timestamp: string;
  path: string;
}

@Injectable()
export class SuccessInterceptor<T>
  implements NestInterceptor<T, SuccessResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<SuccessResponse<T>> {
    const request = context.switchToHttp().getRequest();
    const path = request.url;

    // Skip wrapper for RTB endpoints - SDK expects raw response
    if (path.startsWith('/rtb/')) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        // Handle custom response format if it's already structured with success property
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // Handle empty responses
        if (data === undefined || data === null) {
          return {
            success: true,
            data: {},
            message: 'Operation successful',
            timestamp: new Date().toISOString(),
            path,
          };
        }

        // Handle paginated responses
        if (
          data &&
          typeof data === 'object' &&
          'items' in data &&
          'meta' in data
        ) {
          return {
            success: true,
            data: {
              items: data.items,
              meta: data.meta,
            },
            message: 'Operation successful',
            timestamp: new Date().toISOString(),
            path,
          };
        }

        // Standard success response
        return {
          success: true,
          data,
          message: 'Operation successful',
          timestamp: new Date().toISOString(),
          path,
        };
      }),
    );
  }
}
