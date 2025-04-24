// src/common/exceptions/custom-exceptions.ts
import { HttpException, HttpStatus } from '@nestjs/common';
export const prefix = 'OceanAdTech';
export class CustomException extends HttpException {
  constructor(
    message: string,
    status: HttpStatus,
    public readonly code: string,
  ) {
    super(
      {
        message,
        status,
        code: `${prefix}_${code}_${status}`,
      },
      status,
    );
  }
}

export class ResourceNotFoundException extends CustomException {
  constructor(resource: string, id?: string | number) {
    const message = id
      ? `${resource} with id ${id} not found`
      : `${resource} not found`;
    super(message, HttpStatus.NOT_FOUND, 'RESOURCE_NOT_FOUND');
  }
}

export class DuplicateResourceException extends CustomException {
  constructor(resource: string, field: string, value: string | number) {
    super(
      `${resource} with ${field} '${value}' already exists`,
      HttpStatus.CONFLICT,
      'DUPLICATE_RESOURCE',
    );
  }
}

export class ValidationFailedException extends CustomException {
  constructor(errors: Record<string, any>) {
    super('Validation failed', HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED');
  }
}

export class UnauthorizedException extends CustomException {
  constructor(message = 'Unauthorized access') {
    super(message, HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED');
  }
}

export class ForbiddenException extends CustomException {
  constructor(message = 'Access forbidden') {
    super(message, HttpStatus.FORBIDDEN, 'FORBIDDEN');
  }
}

export class BadRequestException extends CustomException {
  constructor(message = 'Bad request') {
    super(message, HttpStatus.BAD_REQUEST, 'BAD_REQUEST');
  }
}

export class InternalServerErrorException extends CustomException {
  constructor(message = 'Internal server error') {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL_SERVER_ERROR');
  }
}

export class ServiceUnavailableException extends CustomException {
  constructor(message = 'Service unavailable') {
    super(message, HttpStatus.SERVICE_UNAVAILABLE, 'SERVICE_UNAVAILABLE');
  }
}

export class DatabaseException extends CustomException {
  constructor(message = 'Database operation failed') {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, 'DATABASE_ERROR');
  }
}

export class RateLimitedException extends CustomException {
  constructor(message = 'Too many requests') {
    super(message, HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED');
  }
}

export class PaymentRequiredException extends CustomException {
  constructor(message = 'Payment required') {
    super(message, HttpStatus.PAYMENT_REQUIRED, 'PAYMENT_REQUIRED');
  }
}
