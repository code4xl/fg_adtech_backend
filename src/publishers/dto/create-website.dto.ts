import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';
export class CreateWebsiteDto {
  @ApiProperty({
    description: 'URL of the website',
    example: 'https://example.com',
  })
  @IsNotEmpty()
  @IsString()
  @IsUrl({
    allow_query_components: false,
    host_blacklist: ['localhost', '127.0.0.1'],
    protocols: ['https'],
  })
  url: string;

  @ApiPropertyOptional({
    description: 'Name of the website',
    example: 'Coffee Website',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  websiteName?: string;

  @ApiProperty({ description: 'Publisher ID associated with the website' })
  @IsNotEmpty()
  @IsString()
  @IsUUID('4')
  publisherId: string;

  @ApiProperty({
    description: 'Category Ids associated with the website',
    example: ['category-id-1', 'category-id-2'],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  categoryIds: string[];

  @ApiPropertyOptional({
    description: 'Description of the website',
    example: 'This is a sample coffee website.',
  })
  @IsOptional()
  @MaxLength(1000)
  @IsString()
  @Transform(({ value }) => value?.trim())
  description?: string;
}
