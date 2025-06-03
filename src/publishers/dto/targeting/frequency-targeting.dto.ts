import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { FrequencyWindow, FrequencyScope } from '@prisma/client';

export class CreateFrequencyTargetingDto {
  @ApiProperty({ description: 'Inventory ID for targeting rules' })
  @IsUUID()
  inventoryId: string;

  @ApiProperty({ description: 'Maximum impressions per user', minimum: 1 })
  @IsNumber()
  @Min(1)
  maxImpressions: number;

  @ApiProperty({
    description: 'Frequency window',
    enum: FrequencyWindow,
    example: FrequencyWindow.DAILY,
  })
  @IsEnum(FrequencyWindow)
  frequencyWindow: FrequencyWindow;

  @ApiProperty({
    description: 'Frequency scope',
    enum: FrequencyScope,
    example: FrequencyScope.CAMPAIGN,
  })
  @IsEnum(FrequencyScope)
  frequencyScope: FrequencyScope;

  @ApiPropertyOptional({ description: 'Maximum clicks per user' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxClicksPerUser?: number;

  @ApiPropertyOptional({
    description: 'Minimum time between impressions in minutes',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minTimeBetween?: number;

  @ApiPropertyOptional({ description: 'Custom time window in hours' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  customTimeWindowHours?: number;
}

export class UpdateFrequencyTargetingDto extends CreateFrequencyTargetingDto {}
