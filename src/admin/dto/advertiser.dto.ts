import {
    IsString,
    IsEmail,
    IsNotEmpty,
    IsOptional,
    IsEnum,
    IsBoolean,
    IsNumber,
    IsDateString,
    Min,
    Max,
    Length,
    Matches,
    IsPhoneNumber,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { AdvertiserStatus, CompanySize } from '@prisma/client';

// ============================================
// ENUMS AND INTERFACES
// ============================================

export { AdvertiserStatus, CompanySize };

// ============================================
// CREATE ADVERTISER DTO
// ============================================

export class CreateAdvertiserDto {
    @ApiProperty({
        description: 'Advertiser full name',
        example: 'John Doe',
        minLength: 2,
        maxLength: 100,
    })
    @IsString()
    @IsNotEmpty()
    @Length(2, 100)
    name: string;

    @ApiProperty({
        description: 'Email address',
        example: 'john.doe@example.com',
    })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({
        description: 'Password (minimum 8 characters)',
        example: 'SecurePassword123!',
        minLength: 8,
    })
    @IsString()
    @IsNotEmpty()
    @Length(8, 100)
    @Matches(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        {
            message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        },
    )
    password: string;

    @ApiProperty({
        description: 'Mobile phone number',
        example: '+919876543210',
    })
    @IsPhoneNumber()
    @IsNotEmpty()
    mobile: string;

    @ApiProperty({
        description: 'Company name',
        example: 'TechCorp Ltd.',
        minLength: 2,
        maxLength: 150,
    })
    @IsString()
    @IsNotEmpty()
    @Length(2, 150)
    companyName: string;

    @ApiProperty({
        description: 'Company headquarters location',
        example: 'Mumbai, Maharashtra, India',
        minLength: 5,
        maxLength: 200,
    })
    @IsString()
    @IsNotEmpty()
    @Length(5, 200)
    hqLocation: string;

    @ApiProperty({
        description: 'Company size',
        enum: CompanySize,
        example: CompanySize.ELEVEN_TO_FIFTY,
    })
    @IsEnum(CompanySize)
    companySize: CompanySize;

    @ApiPropertyOptional({
        description: 'Initial advertiser status (defaults to ACTIVE)',
        enum: AdvertiserStatus,
        example: AdvertiserStatus.ACTIVE,
    })
    @IsOptional()
    @IsEnum(AdvertiserStatus)
    status?: AdvertiserStatus;
}

// ============================================
// UPDATE ADVERTISER DTO
// ============================================

export class UpdateAdvertiserDto extends PartialType(CreateAdvertiserDto) {
    @ApiPropertyOptional({
        description: 'Advertiser full name',
        example: 'John Doe Updated',
        minLength: 2,
        maxLength: 100,
    })
    @IsOptional()
    @IsString()
    @Length(2, 100)
    name?: string;

    @ApiPropertyOptional({
        description: 'Email address',
        example: 'john.updated@example.com',
    })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({
        description: 'New password (minimum 8 characters)',
        example: 'NewSecurePassword123!',
        minLength: 8,
    })
    @IsOptional()
    @IsString()
    @Length(8, 100)
    @Matches(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        {
            message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        },
    )
    password?: string;

    @ApiPropertyOptional({
        description: 'Mobile phone number',
        example: '+919876543211',
    })
    @IsOptional()
    @IsPhoneNumber()
    mobile?: string;

    @ApiPropertyOptional({
        description: 'Company name',
        example: 'TechCorp Ltd. Updated',
        minLength: 2,
        maxLength: 150,
    })
    @IsOptional()
    @IsString()
    @Length(2, 150)
    companyName?: string;

    @ApiPropertyOptional({
        description: 'Company headquarters location',
        example: 'Delhi, India',
        minLength: 5,
        maxLength: 200,
    })
    @IsOptional()
    @IsString()
    @Length(5, 200)
    hqLocation?: string;

    @ApiPropertyOptional({
        description: 'Company size',
        enum: CompanySize,
        example: CompanySize.FIFTY_ONE_TO_TWO_HUNDRED,
    })
    @IsOptional()
    @IsEnum(CompanySize)
    companySize?: CompanySize;
}

// ============================================
// UPDATE STATUS DTO
// ============================================

export class UpdateAdvertiserStatusDto {
    @ApiProperty({
        description: 'New advertiser status',
        enum: AdvertiserStatus,
        example: AdvertiserStatus.SUSPENDED,
    })
    @IsEnum(AdvertiserStatus)
    status: AdvertiserStatus;
}

export class VerifyEmailDto {
    @ApiPropertyOptional({ description: 'Advertiser ID', example: 'uuid-string' })
    id?: string;

    @ApiPropertyOptional({ description: 'Advertiser email', example: 'user@example.com' })
    email?: string;
}

// ============================================
// QUERY DTO
// ============================================

export class AdvertiserQueryDto {
    @ApiPropertyOptional({
        description: 'Page number for pagination',
        example: 1,
        minimum: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({
        description: 'Number of items per page',
        example: 10,
        minimum: 1,
        maximum: 100,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(100)
    limit?: number = 10;

    @ApiPropertyOptional({
        description: 'Search term (searches in name, email, company name)',
        example: 'john',
        maxLength: 100,
    })
    @IsOptional()
    @IsString()
    @Length(0, 100)
    search?: string;

    @ApiPropertyOptional({
        description: 'Filter by advertiser status',
        enum: AdvertiserStatus,
        example: AdvertiserStatus.ACTIVE,
    })
    @IsOptional()
    @IsEnum(AdvertiserStatus)
    status?: AdvertiserStatus;

    @ApiPropertyOptional({
        description: 'Filter by company size',
        enum: CompanySize,
        example: CompanySize.ELEVEN_TO_FIFTY,
    })
    @IsOptional()
    @IsEnum(CompanySize)
    companySize?: CompanySize;

    @ApiPropertyOptional({
        description: 'Filter by email verification status',
        example: true,
    })
    @IsOptional()
    @Transform(({ value }) => value === 'true')
    @IsBoolean()
    isEmailVerified?: boolean;

    @ApiPropertyOptional({
        description: 'Filter by MFA enabled status',
        example: false,
    })
    @IsOptional()
    @Transform(({ value }) => value === 'true')
    @IsBoolean()
    isMfaEnabled?: boolean;

    @ApiPropertyOptional({
        description: 'Sort field',
        example: 'createdAt',
        enum: ['name', 'email', 'companyName', 'createdAt', 'updatedAt'],
    })
    @IsOptional()
    @IsString()
    sortBy?: string = 'createdAt';

    @ApiPropertyOptional({
        description: 'Sort order',
        example: 'desc',
        enum: ['asc', 'desc'],
    })
    @IsOptional()
    @IsEnum(['asc', 'desc'])
    sortOrder?: 'asc' | 'desc' = 'desc';

    @ApiPropertyOptional({
        description: 'Filter by creation date from',
        example: '2024-01-01',
    })
    @IsOptional()
    @IsDateString()
    createdFrom?: string;

    @ApiPropertyOptional({
        description: 'Filter by creation date to',
        example: '2024-12-31',
    })
    @IsOptional()
    @IsDateString()
    createdTo?: string;
}

// ============================================
// RESPONSE DTOs
// ============================================

export class AdvertiserCountsDto {
    @ApiProperty({
        description: 'Number of campaigns',
        example: 5,
    })
    Campaign: number;

    @ApiProperty({
        description: 'Number of clients',
        example: 3,
    })
    clients: number;

    @ApiPropertyOptional({
        description: 'Number of bid responses',
        example: 1250,
    })
    bidResponses?: number;
}

export class AdvertiserResponseDto {
    @ApiProperty({
        description: 'Advertiser unique identifier',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    id: string;

    @ApiProperty({
        description: 'Advertiser full name',
        example: 'John Doe',
    })
    name: string;

    @ApiProperty({
        description: 'Email address',
        example: 'john.doe@example.com',
    })
    email: string;

    @ApiPropertyOptional({
        description: 'Email verification date',
        example: '2024-01-15T10:30:00Z',
    })
    emailVerifiedAt?: string;

    @ApiProperty({
        description: 'Mobile phone number',
        example: '+919876543210',
    })
    mobile: string;

    @ApiProperty({
        description: 'Company name',
        example: 'TechCorp Ltd.',
    })
    companyName: string;

    @ApiProperty({
        description: 'Company headquarters location',
        example: 'Mumbai, Maharashtra, India',
    })
    hqLocation: string;

    @ApiProperty({
        description: 'Company size',
        enum: CompanySize,
        example: CompanySize.ELEVEN_TO_FIFTY,
    })
    companySize: CompanySize;

    @ApiProperty({
        description: 'Account status',
        enum: AdvertiserStatus,
        example: AdvertiserStatus.ACTIVE,
    })
    status: AdvertiserStatus;

    @ApiProperty({
        description: 'MFA enabled status',
        example: false,
    })
    mfaEnabled: boolean;

    @ApiProperty({
        description: 'Account creation date',
        example: '2024-01-01T00:00:00Z',
    })
    createdAt: string;

    @ApiProperty({
        description: 'Last update date',
        example: '2024-01-15T10:30:00Z',
    })
    updatedAt: string;

    @ApiPropertyOptional({
        description: 'Related entity counts',
        type: AdvertiserCountsDto,
    })
    _count?: AdvertiserCountsDto;
}

// ============================================
// DETAILED PROFILE RESPONSE DTO
// ============================================

export class CampaignSummaryDto {
    @ApiProperty({ description: 'Campaign ID' })
    id: string;

    @ApiProperty({ description: 'Campaign name' })
    name: string;

    @ApiProperty({ description: 'Campaign status' })
    status: string;

    @ApiPropertyOptional({ description: 'Campaign start date' })
    startDate?: string;

    @ApiPropertyOptional({ description: 'Campaign end date' })
    endDate?: string;

    @ApiProperty({ description: 'Campaign creation date' })
    createdAt: string;
}

export class ClientSummaryDto {
    @ApiProperty({ description: 'Client ID' })
    id: string;

    @ApiProperty({ description: 'Client name' })
    name: string;

    @ApiProperty({ description: 'Client email' })
    email: string;

    @ApiProperty({ description: 'Client creation date' })
    createdAt: string;
}

export class DetailedAdvertiserResponseDto extends AdvertiserResponseDto {
    @ApiPropertyOptional({
        description: 'Recent campaigns (up to 5)',
        type: [CampaignSummaryDto],
    })
    Campaign?: CampaignSummaryDto[];

    @ApiPropertyOptional({
        description: 'Recent clients (up to 5)',
        type: [ClientSummaryDto],
    })
    clients?: ClientSummaryDto[];
}

// ============================================
// ANALYTICS RESPONSE DTOs
// ============================================

export class AnalyticsDashboardDto {
    @ApiProperty({ description: 'Total number of advertisers' })
    totalAdvertisers: number;

    @ApiProperty({ description: 'Number of active advertisers' })
    activeAdvertisers: number;

    @ApiProperty({ description: 'Number of advertisers pending email verification' })
    pendingVerification: number;

    @ApiProperty({ description: 'New registrations in last 30 days' })
    recentRegistrations: number;

    @ApiProperty({ description: 'Email verification rate (percentage)' })
    verificationRate: string;
}

export class RegistrationTrendDto {
    @ApiProperty({ description: 'Date of registration' })
    createdAt: string;

    @ApiProperty({ description: 'Number of registrations on this date' })
    _count: { id: number };
}

export class StatusDistributionDto {
    @ApiProperty({ description: 'Advertiser status', enum: AdvertiserStatus })
    status: AdvertiserStatus;

    @ApiProperty({ description: 'Count of advertisers with this status' })
    _count: { id: number };
}