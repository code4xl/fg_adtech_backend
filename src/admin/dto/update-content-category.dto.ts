import { IsString, IsOptional, Length } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateContentCategoryDto {
  @ApiPropertyOptional({
    description: 'Name of the content category',
    example: 'Technology & Innovation',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Description of the content category',
    example: 'Updated description for technology content',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;
}