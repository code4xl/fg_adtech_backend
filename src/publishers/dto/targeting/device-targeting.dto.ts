// src/publishers/dto/targeting/device-targeting.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  DeviceType,
  OperatingSystem,
  BrowserType,
  ConnectionType,
} from '@prisma/client';

export class CreateDeviceTargetingDto {
  @ApiProperty({ description: 'Inventory ID for targeting rules' })
  @IsUUID()
  inventoryId: string;

  @ApiPropertyOptional({
    description: 'Device types to target',
    enum: DeviceType,
    isArray: true,
    example: [DeviceType.MOBILE, DeviceType.DESKTOP],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(DeviceType, { each: true })
  deviceTypes?: DeviceType[];

  @ApiPropertyOptional({
    description: 'Operating systems to target',
    enum: OperatingSystem,
    isArray: true,
    example: [OperatingSystem.ANDROID, OperatingSystem.IOS],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(OperatingSystem, { each: true })
  operatingSystems?: OperatingSystem[];

  @ApiPropertyOptional({
    description: 'Browsers to target',
    enum: BrowserType,
    isArray: true,
    example: [BrowserType.CHROME, BrowserType.SAFARI],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(BrowserType, { each: true })
  browsers?: BrowserType[];

  @ApiPropertyOptional({
    description: 'Connection types to target',
    enum: ConnectionType,
    isArray: true,
    example: [ConnectionType.WIFI, ConnectionType.CELLULAR_4G],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(ConnectionType, { each: true })
  connectionTypes?: ConnectionType[];

  @ApiPropertyOptional({ description: 'Minimum OS version' })
  @IsOptional()
  @IsString()
  minOSVersion?: string;

  @ApiPropertyOptional({ description: 'Maximum OS version' })
  @IsOptional()
  @IsString()
  maxOSVersion?: string;

  @ApiPropertyOptional({
    description: 'Device models to target',
    isArray: true,
    example: ['iPhone 14', 'Samsung Galaxy S23'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deviceModels?: string[];

  @ApiPropertyOptional({
    description: 'Include or exclude these devices',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isInclude?: boolean = true;
}

export class UpdateDeviceTargetingDto extends CreateDeviceTargetingDto {}
