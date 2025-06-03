import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateFloorPriceDto } from './floor-price.dto';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class UpdateFloorPriceDto extends PartialType(CreateFloorPriceDto) {
  @ApiProperty({
    description: 'ID of the floor price rule to update',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsNotEmpty()
  @IsString()
  @IsUUID('4')
  id: string;
}
