import { ApiProperty } from '@nestjs/swagger';
import { 
  IsOptional, 
  IsEnum, 
  IsBoolean, 
  IsString, 
  IsInt, 
  Min 
} from 'class-validator';
import { Type } from 'class-transformer';
import { 
  InventoryFormat, 
  InventoryPosition, 
  ApprovalStatus 
} from '@prisma/client';

export class InventoryQueryDto {
  @ApiProperty({ 
    description: 'Filter by format',
    enum: InventoryFormat,
    required: false 
  })
  @IsOptional()
  @IsEnum(InventoryFormat)
  format?: InventoryFormat;

  @ApiProperty({ 
    description: 'Filter by position',
    enum: InventoryPosition,
    required: false 
  })
  @IsOptional()
  @IsEnum(InventoryPosition)
  position?: InventoryPosition;

  @ApiProperty({ 
    description: 'Filter by active status',
    required: false 
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiProperty({ 
    description: 'Filter by approval status',
    enum: ApprovalStatus,
    required: false 
  })
  @IsOptional()
  @IsEnum(ApprovalStatus)
  approvalStatus?: ApprovalStatus;

  @ApiProperty({ 
    description: 'Search by name',
    required: false 
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ 
    description: 'Page number for pagination',
    minimum: 1,
    default: 1,
    required: false 
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({ 
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 10,
    required: false 
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;

  @ApiProperty({ 
    description: 'Sort by field',
    required: false,
    example: 'createdAt' 
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiProperty({ 
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
    required: false 
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}