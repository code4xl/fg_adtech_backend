import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsArray, IsObject } from 'class-validator';

export class CreateTargetingRuleDto {
  @ApiProperty({ description: 'Name of the targeting rule' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'Type of targeting (geo, device, browser, etc)' })
  @IsNotEmpty()
  @IsString()
  type: string;

  @ApiProperty({ description: 'Whether this rule is for inclusion or exclusion' })
  @IsOptional()
  @IsBoolean()
  include?: boolean;

  @ApiProperty({ description: 'Array of values for targeting (country codes, device types, etc)' })
  @IsOptional()
  @IsArray()
  values?: string[];

  @ApiProperty({ description: 'Additional parameters for complex targeting' })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, any>;

  @ApiProperty({ description: 'Whether this targeting rule is active' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
} 