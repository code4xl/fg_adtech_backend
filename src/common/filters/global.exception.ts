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
import { prefix } from '../exceptions/custom.exception';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = prefix + '_INTERNAL_SERVER_ERROR_' + status;
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
        code = (exceptionResponse as any).code || `HTTP_${status}`;

        // Handle validation errors which typically have details in the message
        if (Array.isArray((exceptionResponse as any).message)) {
          details = (exceptionResponse as any).message;
          message = 'Validation failed';
        }
      } else {
        message = exceptionResponse as string;
        code = `HTTP_${status}`;
      }
    }
    // Handle Prisma Errors
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle specific Prisma errors
      switch (exception.code) {
        case 'P2002': // Unique constraint failed
          status = HttpStatus.CONFLICT;
          message = 'Unique constraint failed';
          code = prefix + '_UNIQUE_CONSTRAINT_FAILED_' + status;
          if (exception.meta?.target) {
            details = {
              fields: exception.meta.target as Record<string, any>,
            };
          }
          break;
        case 'P2025': // Record not found
          status = HttpStatus.NOT_FOUND;
          message = 'Record not found';
          code = prefix + '_RECORD_NOT_FOUND_' + status;
          break;
        case 'P2003': // Foreign key constraint failed
          status = HttpStatus.BAD_REQUEST;
          message = 'Foreign key constraint failed';
          code = prefix + '_FOREIGN_KEY_CONSTRAINT_FAILED_' + status;
          if (exception.meta?.field_name) {
            details = {
              field: exception.meta.field_name as string,
            };
          }
          break;
        case 'P2010': // Raw query failed
          status = HttpStatus.BAD_REQUEST;
          message = 'Database query failed';
          code = prefix + '_QUERY_FAILED_' + status;
          break;
        default:
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          message = `Database error: ${exception.code}`;
          code = prefix + '_DATABASE_ERROR_' + status;
      }
    }
    // Handle Prisma Validation Errors
    else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Validation error in database operation';
      code = prefix + '_DATABASE_VALIDATION_ERROR_' + status;
    }
    // Handle Prisma Connection Errors
    else if (exception instanceof Prisma.PrismaClientInitializationError) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'Database connection error';
      code = prefix + '_DATABASE_CONNECTION_ERROR_' + status;
    }
    // TypeORM error handling is removed since we're not using TypeORM
    // JWT errors
    else if (exception instanceof JsonWebTokenError) {
      status = HttpStatus.UNAUTHORIZED;
      message = 'Invalid token';
      code = prefix + '_INVALID_TOKEN_' + status;
    } else if (exception instanceof TokenExpiredError) {
      status = HttpStatus.UNAUTHORIZED;
      message = 'Token expired';
      code = prefix + '_TOKEN_EXPIRED_' + status;
    }
    // Node.js errors
    else if (exception instanceof SyntaxError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Syntax error';
      code = prefix + '_SYNTAX_ERROR_' + status;
    } else if (exception instanceof TypeError) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Type error';
      code = prefix + '_TYPE_ERROR_' + status;
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
