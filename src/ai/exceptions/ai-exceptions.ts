import { HttpException, HttpStatus } from '@nestjs/common';

export class AIServiceException extends HttpException {
  constructor(message: string, status: HttpStatus = HttpStatus.SERVICE_UNAVAILABLE) {
    super(
      {
        message,
        error: 'AI_SERVICE_ERROR',
        statusCode: status,
      },
      status
    );
  }
}

export class AIQuotaExceededException extends HttpException {
  constructor(resetTime?: Date) {
    const message = resetTime
      ? `AI service quota exceeded. Resets at ${resetTime.toISOString()}`
      : 'AI service quota exceeded';
    
    super(
      {
        message,
        error: 'AI_QUOTA_EXCEEDED',
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        resetTime
      },
      HttpStatus.TOO_MANY_REQUESTS
    );
  }
}

export class AIInvalidResponseException extends HttpException {
  constructor(details?: string) {
    super(
      {
        message: 'Invalid response from AI service',
        error: 'AI_INVALID_RESPONSE',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        details
      },
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}