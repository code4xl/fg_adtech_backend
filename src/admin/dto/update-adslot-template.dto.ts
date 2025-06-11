import { IsString, IsEnum, IsNumber, IsOptional, Min, Max, Length } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryFormat, InventoryPosition } from '@prisma/client';

export class UpdateAdSlotTemplateDto {
  @ApiPropertyOptional({
    description: 'Name of the ad slot template',
    example: 'Homepage Banner Top Updated',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Width of the ad slot in pixels',
    example: 728,
    minimum: 50,
    maximum: 2000,
  })
  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(2000)
  width?: number;

  @ApiPropertyOptional({
    description: 'Height of the ad slot in pixels',
    example: 90,
    minimum: 50,
    maximum: 2000,
  })
  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(2000)
  height?: number;

  @ApiPropertyOptional({
    description: 'Format of the ad',
    enum: InventoryFormat,
    example: InventoryFormat.BANNER,
  })
  @IsOptional()
  @IsEnum(InventoryFormat)
  format?: InventoryFormat;

  @ApiPropertyOptional({
    description: 'Position of the ad inventory',
    enum: InventoryPosition,
    example: InventoryPosition.ABOVE_FOLD,
  })
  @IsOptional()
  @IsEnum(InventoryPosition)
  position?: InventoryPosition;
}