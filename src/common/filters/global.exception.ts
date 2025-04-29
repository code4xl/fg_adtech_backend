// src/common/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { ErrorConfigService } from '../exceptions/error-config.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  constructor(private errorConfigService: ErrorConfigService) { }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = this.errorConfigService.formatErrorCode(
      'INTERNAL_SERVER_ERROR',
      status,
    );
    let details: Record<string, any> | null = null;

    // Log the exception for debugging
    this.logger.error(
      `Exception: ${exception instanceof Error ? exception.message : String(exception)}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    // Handle HttpExceptions (NestJS built-in + custom exceptions)
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        message = (exceptionResponse as any).message || message;
        // Use the code if it exists, otherwise create a consistent code
        code =
          (exceptionResponse as any).code ||
          this.errorConfigService.formatErrorCode(`HTTP_ERROR`, status);

        // Handle validation errors which typically have details in the message
        if (Array.isArray((exceptionResponse as any).message)) {
          details = (exceptionResponse as any).message;
          message = 'Validation failed';
        }
      } else {
        message = exceptionResponse as string;
        code = this.errorConfigService.formatErrorCode(`HTTP_ERROR`, status);
      }
    }
    // Handle Prisma Errors
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle specific Prisma errors
      switch (exception.code) {
        case 'P2002': // Unique constraint failed
          status = HttpStatus.CONFLICT;
          message = 'Unique constraint failed';
          code = this.errorConfigService.formatErrorCode(
            'UNIQUE_CONSTRAINT_FAILED',
            status,
          );
          if (exception.meta?.target) {
            details = {
              fields: exception.meta.target as Record<string, any>,
            };
          }
          break;
        case 'P2025': // Record not found
          status = HttpStatus.NOT_FOUND;
          message = 'Record not found';
          code = this.errorConfigService.formatErrorCode(
            'RECORD_NOT_FOUND',
            status,
          );
          break;
        case 'P2003': // Foreign key constraint failed
          status = HttpStatus.BAD_REQUEST;
          message = 'Foreign key constraint failed';
          code = this.errorConfigService.formatErrorCode(
            'FOREIGN_KEY_CONSTRAINT_FAILED',
            status,
          );
          if (exception.meta?.field_name) {
            details = {
              field: exception.meta.field_name as string,
            };
          }
          break;
        case 'P2010': // Raw query failed
          status = HttpStatus.BAD_REQUEST;
          message = 'Database query failed';
          code = this.errorConfigService.formatErrorCode(
            'QUERY_FAILED',
            status,
          );
          break;
        default:
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          message = `Database error: ${exception.code}`;
          code = this.errorConfigService.formatErrorCode(
            'DATABASE_ERROR',
            status,
          );
      }
    }
    // Handle Prisma Validation Errors
    else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Validation error in database operation';
      code = this.errorConfigService.formatErrorCode(
        'DATABASE_VALIDATION_ERROR',
        status,
      );
    }
    // Handle Prisma Connection Errors
    else if (exception instanceof Prisma.PrismaClientInitializationError) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'Database connection error';
      code = this.errorConfigService.formatErrorCode(
        'DATABASE_CONNECTION_ERROR',
        status,
      );
    }
    // JWT errors
    else if (exception instanceof JsonWebTokenError) {
      status = HttpStatus.UNAUTHORIZED;
      message = 'Invalid token';
      code = this.errorConfigService.formatErrorCode('INVALID_TOKEN', status);
    } else if (exception instanceof TokenExpiredError) {
      status = HttpStatus.UNAUTHORIZED;
      message = 'Token expired';
      code = this.errorConfigService.formatErrorCode('TOKEN_EXPIRED', status);
    }
    // Node.js errors
    else if (exception instanceof SyntaxError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Syntax error';
      code = this.errorConfigService.formatErrorCode('SYNTAX_ERROR', status);
    } else if (exception instanceof TypeError) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Type error';
      code = this.errorConfigService.formatErrorCode('TYPE_ERROR', status);
    }
    // Default case for unknown errors
    else if (exception instanceof Error) {
      message = exception.message || 'Unexpected error';
    }

    // Standard error response format
    const errorResponse = {
      success: false,
      error: {
        code,
        message,
        timestamp: new Date().toISOString(),
        path: request.url,
        details: details,
      },
    };

    // Remove null details to keep the response clean
    if (errorResponse.error.details === null) {
      const responseObj = errorResponse as any;
      responseObj.error = { ...responseObj.error };
      delete responseObj.error.details;
    }

    response.status(status).json(errorResponse);
  }
}
