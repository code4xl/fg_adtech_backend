import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class VerifyMfaDto {
  @ApiProperty({ description: '6-digit verification code', example: '123456' })
  @IsString()
  @IsNotEmpty({ message: 'Verification code is required' })
  @MinLength(6, { message: 'Verification code must be 6 digits' })
  @MaxLength(6, { message: 'Verification code must be 6 digits' })
  @Matches(/^[0-9]{6}$/, { message: 'Verification code must contain 6 digits' })
  code: string;

  @ApiProperty({ description: 'Temporary token from login step 1', example: 'xyz...' })
  @IsString()
  @IsNotEmpty({ message: 'Temporary token is required' })
  tempToken: string;
}

export class ToggleMfaDto {
  @ApiProperty({ description: 'Enable or disable MFA', example: true })
  @IsNotEmpty({ message: 'Enable flag is required' })
  enable: boolean;
} 