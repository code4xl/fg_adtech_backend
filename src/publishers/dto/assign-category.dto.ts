
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignCategoryDto {
  @ApiProperty({
    description: 'Category ID to assign',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsUUID(4)
  categoryId: string;
}
