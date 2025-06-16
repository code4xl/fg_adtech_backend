import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsNumber,
  IsEnum,
  IsObject,
  IsOptional,
} from 'class-validator';

export class BidEvaluationDto {
  @ApiProperty({
    description: 'Campaign ID',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  @IsUUID()
  campaignId: string;

  @ApiProperty({
    description: 'Base bid amount from campaign',
    example: 2.5,
  })
  @IsNumber()
  baseBid: number;

  @ApiProperty({
    description: 'Bid strategy applied',
    example: 'COST_CAP',
    enum: ['LOWEST_COST', 'COST_CAP', 'BID_CAP', 'TARGET_COST'],
  })
  @IsEnum(['LOWEST_COST', 'COST_CAP', 'BID_CAP', 'TARGET_COST'])
  bidStrategy: string;

  @ApiProperty({
    description: 'Final calculated bid price',
    example: 2.85,
  })
  @IsNumber()
  finalBid: number;

  @ApiProperty({
    description: 'Applied adjustments',
    type: 'object',
    example: {
      deviceMultiplier: 1.2,
      geoMultiplier: 0.95,
      timeMultiplier: 1.1,
      qualityMultiplier: 1.0,
      performanceMultiplier: 1.15,
    },
    additionalProperties: { type: 'number' },
  })
  @IsObject()
  adjustments: {
    deviceMultiplier: number;
    geoMultiplier: number;
    timeMultiplier: number;
    qualityMultiplier: number;
    performanceMultiplier: number;
  };

  @ApiPropertyOptional({
    description: 'Performance metrics used in calculation',
    type: 'object',
    example: {
      ctr: 2.5,
      conversionRate: 1.2,
      avgCost: 1.85,
    },
    additionalProperties: { type: 'number' },
  })
  @IsOptional()
  @IsObject()
  performanceMetrics?: {
    ctr: number;
    conversionRate: number;
    avgCost: number;
  };
}
