import { IsUUID, IsBoolean, IsOptional, IsEnum, IsString } from 'class-validator';

/**
 * Build environment types
 */
export enum BuildEnvironment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
}

/**
 * CDN build request DTO
 */
export class GenerateCdnDto {
  @IsUUID()
  publisherId: string;

  @IsUUID()
  websiteId: string;

  @IsOptional()
  @IsEnum(BuildEnvironment)
  environment?: BuildEnvironment;

  @IsOptional()
  @IsBoolean()
  forceRebuild?: boolean;

  @IsOptional()
  @IsBoolean()
  includeDebug?: boolean;
}

/**
 * CDN build response DTO
 */
export class CdnBuildResponseDto {
  @IsString()
  cdnUrl: string;

  @IsString()
  integrity: string;

  @IsString()
  version: string;

  @IsString()
  publisherId: string;

  @IsString()
  websiteId: string;

  @IsString()
  buildId: string;

  @IsString()
  environment: BuildEnvironment;

  @IsString()
  createdAt: string;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}

/**
 * CDN invalidation request DTO
 */
export class InvalidateCdnDto {
  @IsUUID()
  publisherId: string;

  @IsOptional()
  @IsUUID()
  websiteId?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * CDN status response DTO
 */
export class CdnStatusDto {
  @IsBoolean()
  isBuilt: boolean;

  @IsOptional()
  @IsString()
  lastBuildDate?: string;

  @IsOptional()
  @IsString()
  cdnUrl?: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsString()
  environment?: BuildEnvironment;

  @IsBoolean()
  isCached: boolean;

  @IsOptional()
  @IsString()
  cacheExpiresAt?: string;
}