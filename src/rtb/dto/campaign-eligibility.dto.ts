import {
  IsString,
  IsUUID,
  IsOptional,
  IsObject,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CampaignEligibilityDto {
  @ApiProperty({
    description: 'Campaign ID',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  @IsUUID()
  campaignId: string;

  @ApiProperty({
    description: 'Campaign name',
    example: 'Summer Sale Campaign',
  })
  @IsString()
  campaignName: string;

  @ApiProperty({
    description: 'Whether campaign is eligible',
    example: true,
  })
  @IsBoolean()
  isEligible: boolean;

  @ApiPropertyOptional({
    description: 'Reason for ineligibility',
    example: 'Budget exhausted',
  })
  @IsOptional()
  @IsString()
  ineligibilityReason?: string;

  @ApiProperty({
    description: 'Targeting rules evaluation results',
    type: 'object',
    additionalProperties: { type: 'boolean' },
    example: {
      geographic: true,
      demographic: true,
      device: false,
      contextual: true,
      behavioral: true,
      frequency: true,
    },
  })
  @IsObject()
  targetingResults: Record<string, boolean>;

  @ApiProperty({
    description: 'Budget availability status',
    type: 'object',
    properties: {
      hasDaily: { type: 'boolean' },
      remainingDaily: { type: 'number' },
      spentToday: { type: 'number' },
    },
    additionalProperties: false,
    example: {
      hasDaily: true,
      remainingDaily: 1500.0,
      spentToday: 500.0,
    },
  })
  @IsObject()
  budgetStatus: {
    hasDaily: boolean;
    remainingDaily: number;
    spentToday: number;
  };
}
