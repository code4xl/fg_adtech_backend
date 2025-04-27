import { ApiProperty } from '@nestjs/swagger';
import { 
  IsEnum, 
  IsInt, 
  IsOptional, 
  IsArray,
  IsUUID, 
  Min, 
  Max
} from 'class-validator';
import { Type } from 'class-transformer';
import { InventoryFormat } from '@prisma/client';

export class PerformanceQueryDto {
  @ApiProperty({ 
    description: 'Filter by format',
    enum: InventoryFormat,
    required: false,
    example: 'BANNER'
  })
  @IsOptional()
  @IsEnum(InventoryFormat)
  format?: InventoryFormat;

  @ApiProperty({ 
    description: 'Filter by categories (array of category IDs)',
    required: false,
    type: [String],
    example: ['123e4567-e89b-12d3-a456-426614174000']
  })
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  categoryIds?: string[];

  @ApiProperty({ 
    description: 'Time period for stats (days)',
    default: 30,
    required: false,
    example: 30
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  @Type(() => Number)
  days?: number = 30;
}