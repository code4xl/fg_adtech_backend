import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Gender, Language, Education, IncomeRange } from '@prisma/client';

export class CreateDemographicTargetingDto {
  @ApiProperty({ description: 'Inventory ID for targeting rules' })
  @IsUUID()
  inventoryId: string;

  @ApiPropertyOptional({
    description: 'Minimum age for targeting',
    minimum: 13,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(13)
  @Max(100)
  ageMin?: number;

  @ApiPropertyOptional({
    description: 'Maximum age for targeting',
    minimum: 13,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(13)
  @Max(100)
  ageMax?: number;

  @ApiPropertyOptional({
    description: 'Target genders',
    enum: Gender,
    isArray: true,
    example: [Gender.MALE, Gender.FEMALE],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(Gender, { each: true })
  genders?: Gender[];

  @ApiPropertyOptional({
    description: 'Target languages',
    enum: Language,
    isArray: true,
    example: [Language.ENGLISH, Language.HINDI],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(Language, { each: true })
  languages?: Language[];

  @ApiPropertyOptional({
    description: 'Education levels to target',
    enum: Education,
    isArray: true,
    example: [Education.BACHELOR, Education.MASTER],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(Education, { each: true })
  education?: Education[];

  @ApiPropertyOptional({
    description: 'Income ranges to target',
    enum: IncomeRange,
    isArray: true,
    example: [IncomeRange.RANGE_50K_100K, IncomeRange.RANGE_100K_200K],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(IncomeRange, { each: true })
  incomeRange?: IncomeRange[];
}

export class UpdateDemographicTargetingDto extends CreateDemographicTargetingDto {}
