// src/common/dto/api-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ErrorDetails {
  @ApiPropertyOptional({
    type: [String],
    description: 'Validation error messages',
  })
  messages?: string[];

  @ApiPropertyOptional({
    type: Object,
    description: 'Additional error details',
  })
  additionalInfo?: Record<string, any>;
}

export class ErrorDto {
  @ApiProperty({ example: 'RESOURCE_NOT_FOUND' })
  code: string;

  @ApiProperty({ example: 'User with id 1 not found' })
  message: string;

  @ApiProperty({ example: '2025-04-24T10:30:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '/api/users/1' })
  path: string;

  @ApiPropertyOptional({ type: ErrorDetails })
  details?: ErrorDetails;
}

export class ErrorResponseDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ type: ErrorDto })
  error: ErrorDto;
}

export class PaginationMetaDto {
  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 10 })
  totalPages: number;
}

export class SuccessResponseDto<T> {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty()
  data: T;

  @ApiProperty({ example: 'Operation successful' })
  message: string;

  @ApiProperty({ example: '2025-04-24T10:30:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '/api/users' })
  path: string;
}

export class PaginatedDto<T> {
  @ApiProperty({ isArray: true })
  items: T[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class PaginatedResponseDto<T> extends SuccessResponseDto<
  PaginatedDto<T>
> {}

// Example of a specific DTO
export class UserDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'john.doe@example.com' })
  email: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;
}

// Example of how to use with specific entity
export class UserResponseDto extends SuccessResponseDto<UserDto> {}
export class UsersResponseDto extends PaginatedResponseDto<UserDto> {}
