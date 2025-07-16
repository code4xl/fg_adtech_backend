import { IsEmail, IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum EmailJobType {
  VERIFICATION = 'verification',
  CLIENT_WELCOME = 'client_welcome',
  PASSWORD_RESET = 'password_reset',
  MFA_CODE = 'mfa_code',
}

export enum EmailJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export class EmailJobDto {
  @ApiProperty({ description: 'Unique job ID' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'Email job type', enum: EmailJobType })
  @IsEnum(EmailJobType)
  type: EmailJobType;

  @ApiProperty({ description: 'Recipient email address' })
  @IsEmail()
  to: string;

  @ApiProperty({ description: 'Job priority (higher number = higher priority)', default: 1 })
  @IsNumber()
  @Min(1)
  priority: number;

  @ApiProperty({ description: 'Email data specific to job type' })
  @IsObject()
  data: Record<string, any>;

  @ApiProperty({ description: 'Job status', enum: EmailJobStatus })
  @IsEnum(EmailJobStatus)
  status: EmailJobStatus;

  @ApiProperty({ description: 'Number of attempts made' })
  @IsNumber()
  @Min(0)
  attempts: number;

  @ApiProperty({ description: 'Job creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last attempt timestamp', required: false })
  @IsOptional()
  lastAttemptAt?: Date;

  @ApiProperty({ description: 'Last error message', required: false })
  @IsOptional()
  @IsString()
  lastError?: string;

  @ApiProperty({ description: 'Job completion timestamp', required: false })
  @IsOptional()
  completedAt?: Date;
}

export class CreateEmailJobDto {
  @ApiProperty({ description: 'Email job type', enum: EmailJobType })
  @IsEnum(EmailJobType)
  type: EmailJobType;

  @ApiProperty({ description: 'Recipient email address' })
  @IsEmail()
  to: string;

  @ApiProperty({ description: 'Job priority (higher number = higher priority)', default: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  priority?: number = 1;

  @ApiProperty({ description: 'Email data specific to job type' })
  @IsObject()
  data: Record<string, any>;
}

export class QueueStatsDto {
  @ApiProperty({ description: 'Number of pending jobs' })
  pending: number;

  @ApiProperty({ description: 'Number of processing jobs' })
  processing: number;

  @ApiProperty({ description: 'Number of completed jobs' })
  completed: number;

  @ApiProperty({ description: 'Number of failed jobs' })
  failed: number;
}

// Specific DTOs for different email types
export class VerificationEmailDataDto {
  @ApiProperty({ description: 'Recipient name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'User role' })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiProperty({ description: 'Verification token' })
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class ClientWelcomeEmailDataDto {
  @ApiProperty({ description: 'Client name' })
  @IsString()
  @IsNotEmpty()
  clientName: string;

  @ApiProperty({ description: 'Client password' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ description: 'Advertiser name' })
  @IsString()
  @IsNotEmpty()
  advertiserName: string;

  @ApiProperty({ description: 'Advertiser email' })
  @IsEmail()
  advertiserEmail: string;

  @ApiProperty({ description: 'Advertiser company' })
  @IsString()
  @IsNotEmpty()
  advertiserCompany: string;
}

export class PasswordResetEmailDataDto {
  @ApiProperty({ description: 'User role' })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiProperty({ description: 'Password reset link' })
  @IsString()
  @IsNotEmpty()
  resetLink: string;
}

export class MfaCodeEmailDataDto {
  @ApiProperty({ description: 'MFA verification code' })
  @IsString()
  @IsNotEmpty()
  verificationCode: string;

  @ApiProperty({ description: 'Code expiry time in minutes' })
  @IsNumber()
  @Min(1)
  expiryMinutes: number;
}