import { ApiProperty } from '@nestjs/swagger';
import { 
  IsEnum, 
  IsInt, 
  IsNotEmpty, 
  IsOptional, 
  IsString, 
  IsUUID, 
  Min, 
  Max,
  IsNumber
} from 'class-validator';
import { InventoryFormat, InventoryPosition } from '@prisma/client';

export class CreateInventoryDto {
  @ApiProperty({ 
    description: 'Name of the ad inventory',
    example: 'Homepage Banner' 
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ 
    description: 'Width of the ad space in pixels',
    example: 728 
  })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(10000)
  width: number;

  @ApiProperty({ 
    description: 'Height of the ad space in pixels',
    example: 90 
  })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(10000)
  height: number;

  @ApiProperty({ 
    description: 'Format of the ad inventory',
    enum: InventoryFormat,
    example: InventoryFormat.BANNER 
  })
  @IsNotEmpty()
  @IsEnum(InventoryFormat)
  format: InventoryFormat;

  @ApiProperty({ 
    description: 'Position of the ad on the page',
    enum: InventoryPosition,
    example: InventoryPosition.ABOVE_FOLD 
  })
  @IsNotEmpty()
  @IsEnum(InventoryPosition)
  position: InventoryPosition;

  @ApiProperty({ 
    description: 'Initial viewability score (0-1)',
    required: false,
    example: 0.8 
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  viewabilityScore?: number;
}

export class CreateInventoryResponseDto {
  @ApiProperty({ description: 'Unique identifier of the inventory' })
  id: string;

  @ApiProperty({ description: 'Publisher ID' })
  publisherId: string;

  @ApiProperty({ description: 'Name of the ad inventory' })
  name: string;

  @ApiProperty({ description: 'Width of the ad space' })
  width: number;

  @ApiProperty({ description: 'Height of the ad space' })
  height: number;

  @ApiProperty({ 
    description: 'Format of the ad inventory',
    enum: InventoryFormat 
  })
  format: InventoryFormat;

  @ApiProperty({ 
    description: 'Position of the ad on the page',
    enum: InventoryPosition 
  })
  position: InventoryPosition;

  @ApiProperty({ description: 'Whether the inventory is active' })
  isActive: boolean;

  @ApiProperty({ description: 'Viewability score' })
  viewabilityScore: number | null;

  @ApiProperty({ description: 'Approval status' })
  approvalStatus: string;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;
}