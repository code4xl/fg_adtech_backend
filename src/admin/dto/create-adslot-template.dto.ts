import { IsString, IsEnum, IsNumber, Min, Max, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { InventoryFormat, InventoryPosition } from '@prisma/client';

export class CreateAdSlotTemplateDto {
  @ApiProperty({
    description: 'Name of the ad slot template',
    example: 'Homepage Banner Top',
    maxLength: 100,
  })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({
    description: 'Width of the ad slot in pixels',
    example: 728,
    minimum: 50,
    maximum: 2000,
  })
  @IsNumber()
  @Min(50)
  @Max(2000)
  width: number;

  @ApiProperty({
    description: 'Height of the ad slot in pixels',
    example: 90,
    minimum: 50,
    maximum: 2000,
  })
  @IsNumber()
  @Min(50)
  @Max(2000)
  height: number;

  @ApiProperty({
    description: 'Format of the ad',
    enum: InventoryFormat,
    example: InventoryFormat.BANNER,
  })
  @IsEnum(InventoryFormat)
  format: InventoryFormat;

  @ApiProperty({
    description: 'Position of the ad inventory',
    enum: InventoryPosition,
    example: InventoryPosition.ABOVE_FOLD,
  })
  @IsEnum(InventoryPosition)
  position: InventoryPosition;
}