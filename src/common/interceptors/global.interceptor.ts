// src/common/filters/http-exception.filter.ts
import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        let code = 'INTERNAL_SERVER_ERROR';

        // Handle HttpExceptions
        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
                message = (exceptionResponse as any).message || message;
                code = (exceptionResponse as any).code || `HTTP_${status}`;
            } else {
                message = exceptionResponse as string;
                code = `HTTP_${status}`;
            }
        }
        // Handle Prisma Errors
        else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
            // Handle specific Prisma errors
            if (exception.code === 'P2002') {
                status = HttpStatus.CONFLICT;
                message = 'Unique constraint failed';
                code = 'UNIQUE_CONSTRAINT_FAILED';
            } else if (exception.code === 'P2025') {
                status = HttpStatus.NOT_FOUND;
                message = 'Record not found';
                code = 'RECORD_NOT_FOUND';
            }
        }
        // Handle other Prisma errors
        else if (exception instanceof Prisma.PrismaClientValidationError) {
            status = HttpStatus.BAD_REQUEST;
            message = 'Validation error';
            code = 'VALIDATION_ERROR';
        }

        response.status(status).json({
            success: false,
            error: {
                code,
                status,
                message,
                timestamp: new Date().toISOString(),
                path: request.url,
            },
        });
    }
}