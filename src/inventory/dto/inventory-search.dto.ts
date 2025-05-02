// // inventory/dto/inventory-search.dto.ts
// import { ApiProperty } from '@nestjs/swagger';
// import { 
//   IsEnum, 
//   IsInt, 
//   IsOptional, 
//   IsArray,
//   IsUUID, 
//   Min, 
//   Max
// } from 'class-validator';
// import { Type } from 'class-transformer';
// import { InventoryFormat, InventoryPosition } from '@prisma/client';
// import { InventoryQueryDto } from './inventory-query.dto';

// export class InventorySearchDto extends InventoryQueryDto {
//   @ApiProperty({ 
//     description: 'Minimum width in pixels',
//     required: false,
//     example: 300 
//   })
//   @IsOptional()
//   @IsInt()
//   @Min(1)
//   @Type(() => Number)
//   minWidth?: number;

//   @ApiProperty({ 
//     description: 'Minimum height in pixels',
//     required: false,
//     example: 250
//   })
//   @IsOptional()
//   @IsInt()
//   @Min(1)
//   @Type(() => Number)
//   minHeight?: number;

//   @ApiProperty({ 
//     description: 'Filter by categories (array of category IDs)',
//     required: false,
//     type: [String],
//     example: ['123e4567-e89b-12d3-a456-426614174000']
//   })
//   @IsOptional()
//   @IsArray()
//   @IsUUID(4, { each: true })
//   categoryIds?: string[];
// }

// inventory/dto/inventory-search.dto.ts
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
import { InventoryFormat, InventoryPosition } from '@prisma/client';
import { InventoryQueryDto } from './inventory-query.dto';

export class InventorySearchDto extends InventoryQueryDto {
  @ApiProperty({
    description: 'Minimum width in pixels',
    required: false,
    example: 300
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  minWidth?: number;

  @ApiProperty({
    description: 'Minimum height in pixels',
    required: false,
    example: 250
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  minHeight?: number;

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
    description: 'Filter by specific inventory IDs',
    required: false,
    type: [String],
    example: ['123e4567-e89b-12d3-a456-426614174000']
  })
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  inventoryIds?: string[];
}