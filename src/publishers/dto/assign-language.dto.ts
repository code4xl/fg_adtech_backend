
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { Language } from '@prisma/client';

export class AssignLanguageDto {
  @ApiProperty({
    description: 'Language to assign',
    enum: Language,
    example: Language.ENGLISH
  })
  @IsEnum(Language)
  language: string;
}