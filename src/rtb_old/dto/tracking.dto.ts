import {
  IsString,
  IsUUID,
  IsOptional,
  IsObject,
  IsBoolean,
  IsNumber,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ImpressionEventDto {
  @ApiProperty({
    description: 'Bid response ID for tracking',
    example: '550e8400-e29b-41d4-a716-446655440005',
  })
  @IsUUID()
  bidResponseId: string;

  @ApiPropertyOptional({
    description: 'User ID if available',
    example: 'user_12345',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Session ID',
    example: 'session_789xyz',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiProperty({
    description: 'User agent string',
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  })
  @IsString()
  userAgent: string;

  @ApiProperty({
    description: 'IP address',
    example: '192.168.1.100',
  })
  @IsString()
  ipAddress: string;

  @ApiPropertyOptional({
    description: 'Device type',
    example: 'mobile',
  })
  @IsOptional()
  @IsString()
  deviceType?: string;

  @ApiPropertyOptional({
    description: 'Country',
    example: 'IN',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'Whether impression was viewable',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  viewable?: boolean;

  @ApiPropertyOptional({
    description: 'Time ad was in view (milliseconds)',
    example: 2500,
  })
  @IsOptional()
  @IsNumber()
  viewTime?: number;

  @ApiPropertyOptional({
    description: 'Page URL where impression occurred',
    example: 'https://example.com/article',
  })
  @IsOptional()
  @IsString()
  pageUrl?: string;

  @ApiPropertyOptional({
    description: 'Referrer URL',
    example: 'https://google.com/search',
  })
  @IsOptional()
  @IsString()
  referrerUrl?: string;
}

export class ClickEventDto {
  @ApiProperty({
    description: 'Bid response ID for tracking',
    example: '550e8400-e29b-41d4-a716-446655440005',
  })
  @IsUUID()
  bidResponseId: string;

  @ApiProperty({
    description: 'Landing URL to redirect to',
    example: 'https://example.com/landing',
  })
  @IsString()
  landingUrl: string;

  @ApiPropertyOptional({
    description: 'User ID if available',
    example: 'user_12345',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Session ID',
    example: 'session_789xyz',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiProperty({
    description: 'User agent string',
    example: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)',
  })
  @IsString()
  userAgent: string;

  @ApiProperty({
    description: 'IP address',
    example: '192.168.1.100',
  })
  @IsString()
  ipAddress: string;

  @ApiPropertyOptional({
    description: 'X coordinate of click',
    example: 150,
  })
  @IsOptional()
  @IsNumber()
  clickX?: number;

  @ApiPropertyOptional({
    description: 'Y coordinate of click',
    example: 75,
  })
  @IsOptional()
  @IsNumber()
  clickY?: number;

  @ApiPropertyOptional({
    description: 'Area of ad that was clicked',
    example: 'center',
  })
  @IsOptional()
  @IsString()
  clickArea?: string;

  @ApiPropertyOptional({
    description: 'Page URL where click occurred',
    example: 'https://example.com/article',
  })
  @IsOptional()
  @IsString()
  pageUrl?: string;

  @ApiPropertyOptional({
    description: 'Referrer URL',
    example: 'https://google.com/search',
  })
  @IsOptional()
  @IsString()
  referrerUrl?: string;
}
