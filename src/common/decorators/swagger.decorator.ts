// src/common/decorators/swagger.decorator.ts
import { applyDecorators, HttpStatus, Type } from '@nestjs/common';
import {
  ApiResponse,
  ApiResponseOptions,
  getSchemaPath,
  ApiExtraModels,
} from '@nestjs/swagger';

// Response models for Swagger documentation
export class BaseResponseDto {
  success: boolean;
  timestamp: string;
  path: string;
}

export class ErrorResponseDto extends BaseResponseDto {
  success = false; // Initialize with a value to fix the overwrite error
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export class SuccessResponseDto<T> extends BaseResponseDto {
  success = true; // Initialize with a value to fix the overwrite error
  data: T;
  message: string;
}

export class PaginatedResponseDto<T> extends SuccessResponseDto<{
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}> {}

/**
 * Custom decorator for Swagger API responses
 */
export const ApiStandardResponse = <DataDto extends Type<any>>(
  options: {
    status?: number;
    type?: DataDto;
    description?: string;
    isPaginated?: boolean;
  } = {},
) => {
  const {
    status = HttpStatus.OK,
    type,
    description = 'Successful operation',
    isPaginated = false,
  } = options;

  const responseOptions: ApiResponseOptions = {
    status,
    description,
  };

  if (type) {
    if (isPaginated) {
      return applyDecorators(
        ApiExtraModels(PaginatedResponseDto, type),
        ApiResponse({
          status,
          description,
          schema: {
            allOf: [
              { $ref: getSchemaPath(PaginatedResponseDto) },
              {
                properties: {
                  data: {
                    properties: {
                      items: {
                        type: 'array',
                        items: { $ref: getSchemaPath(type) },
                      },
                    },
                  },
                },
              },
            ],
          },
        }),
      );
    } else {
      return applyDecorators(
        ApiExtraModels(SuccessResponseDto, type),
        ApiResponse({
          status,
          description,
          schema: {
            allOf: [
              { $ref: getSchemaPath(SuccessResponseDto) },
              {
                properties: {
                  data: { $ref: getSchemaPath(type) },
                },
              },
            ],
          },
        }),
      );
    }
  }

  return applyDecorators(
    ApiExtraModels(SuccessResponseDto, PaginatedResponseDto),
    ApiResponse({
      status,
      description,
    }),
  );
};

/**
 * Custom decorators for standard error responses
 */
export const ApiStandardErrors = () => {
  return applyDecorators(
    ApiExtraModels(ErrorResponseDto),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Bad Request',
      schema: {
        allOf: [{ $ref: getSchemaPath(ErrorResponseDto) }],
      },
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
      schema: {
        allOf: [{ $ref: getSchemaPath(ErrorResponseDto) }],
      },
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Forbidden',
      schema: {
        allOf: [{ $ref: getSchemaPath(ErrorResponseDto) }],
      },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Not Found',
      schema: {
        allOf: [{ $ref: getSchemaPath(ErrorResponseDto) }],
      },
    }),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'Conflict',
      schema: {
        allOf: [{ $ref: getSchemaPath(ErrorResponseDto) }],
      },
    }),
    ApiResponse({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      description: 'Internal Server Error',
      schema: {
        allOf: [{ $ref: getSchemaPath(ErrorResponseDto) }],
      },
    }),
  );
};

/**
 * Combined decorator for standard API responses
 */
export const ApiStandardEndpoint = <DataDto extends Type<any>>(options: {
  summary: string;
  description?: string;
  responseType?: DataDto;
  isPaginated?: boolean;
}) => {
  const { summary, description, responseType, isPaginated = false } = options;

  const decorators = [ApiStandardErrors()];

  if (responseType) {
    decorators.push(
      ApiStandardResponse({
        type: responseType,
        isPaginated,
        description: description || summary,
      }),
    );
  } else {
    decorators.push(
      ApiStandardResponse({
        description: description || summary,
      }),
    );
  }

  return applyDecorators(...decorators);
};
