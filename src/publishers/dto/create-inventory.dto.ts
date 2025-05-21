import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsNumber, IsUrl } from 'class-validator';

export class CreateInventoryDto {
  @ApiProperty({ description: 'The name of the inventory' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'The type of inventory (banner, video, native, etc.)' })
  @IsNotEmpty()
  @IsString()
  type: string;

  @ApiProperty({ description: 'The description of the inventory' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'The size of the inventory (e.g., 300x250, 728x90)' })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiProperty({ description: 'The URL where the ad will be displayed' })
  @IsOptional()
  @IsUrl()
  url?: string;

  @ApiProperty({ description: 'Whether the inventory is active' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiProperty({ description: 'The minimum floor price for this inventory' })
  @IsOptional()
  @IsNumber()
  floorPrice?: number;
} 