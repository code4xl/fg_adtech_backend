// src/common/exceptions/custom-exceptions.ts
import { HttpException, HttpStatus } from '@nestjs/common';

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
                code,
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
        super(
            'Validation failed',
            HttpStatus.BAD_REQUEST,
            'VALIDATION_FAILED',
        );
    }
}