import {
    IsString,
    IsEmail,
    IsOptional,
    IsUUID,
    IsEnum,
    IsNumber,
    IsArray,
    IsObject,
    Min,
    Max,
    Length,
    Matches,
    ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

enum CompanySize {
    SMALL = 'SMALL',
    MEDIUM = 'MEDIUM',
    LARGE = 'LARGE',
    ENTERPRISE = 'ENTERPRISE',
}

enum CampaignStatus {
    DRAFT = 'DRAFT',
    ACTIVE = 'ACTIVE',
    PAUSED = 'PAUSED',
    COMPLETED = 'COMPLETED',
}

enum CampaignObjective {
    BRAND_AWARENESS = 'BRAND_AWARENESS',
    TRAFFIC = 'TRAFFIC',
    ENGAGEMENT = 'ENGAGEMENT',
    LEAD_GENERATION = 'LEAD_GENERATION',
    CONVERSIONS = 'CONVERSIONS',
    APP_INSTALLS = 'APP_INSTALLS',
}

enum BidStrategy {
    LOWEST_COST = 'LOWEST_COST',
    COST_PER_CLICK = 'COST_PER_CLICK',
    COST_PER_IMPRESSION = 'COST_PER_IMPRESSION',
    TARGET_COST = 'TARGET_COST',
}

// Create Client DTO
export class CreateClientDto {
    @ApiProperty({ description: 'Client name', example: 'John Doe' })
    @IsString()
    @Length(2, 100)
    name: string;

    @ApiProperty({ description: 'Client email', example: 'john.doe@example.com' })
    @IsEmail()
    email: string;

    @ApiPropertyOptional({ description: 'Client password (optional for admin creation)' })
    @IsOptional()
    @IsString()
    @Length(8, 50)
    password?: string;

    @ApiProperty({ description: 'Mobile number', example: '+919876543210' })
    @IsString()
    @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Invalid mobile number format' })
    mobile: string;

    @ApiProperty({ description: 'Company name', example: 'Acme Corp' })
    @IsString()
    @Length(2, 200)
    companyName: string;

    @ApiProperty({ description: 'Headquarters location', example: 'Mumbai, India' })
    @IsString()
    @Length(2, 200)
    hqLocation: string;

    @ApiProperty({
        description: 'Company size',
        enum: CompanySize,
        example: CompanySize.MEDIUM
    })
    @IsEnum(CompanySize)
    companySize: CompanySize;

    @ApiProperty({ description: 'Registered address', example: '123 Business Park, Mumbai' })
    @IsString()
    @Length(10, 500)
    registeredAddress: string;

    @ApiProperty({ description: 'Company GSTIN', example: '22AAAAA0000A1Z5' })
    @IsString()
    @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
        message: 'Invalid GSTIN format'
    })
    companyGSTIN: string;

    @ApiProperty({ description: 'Company PAN', example: 'AAAAA0000A' })
    @IsString()
    @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, { message: 'Invalid PAN format' })
    PAN: string;

    @ApiProperty({ description: 'Company CIN', example: 'U12345MH2020PTC123456' })
    @IsString()
    @Matches(/^[A-Z]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/, {
        message: 'Invalid CIN format'
    })
    CIN: string;

    @ApiProperty({ description: 'Company website', example: 'https://www.acmecorp.com' })
    @IsString()
    @Matches(/^https?:\/\/.+/, { message: 'Invalid website URL' })
    website: string;

    @ApiPropertyOptional({ description: 'Advertiser ID to associate with' })
    @IsOptional()
    @IsUUID()
    advertiserId?: string;
}

// Update Client DTO
export class UpdateClientDto {
    @ApiPropertyOptional({ description: 'Client name' })
    @IsOptional()
    @IsString()
    @Length(2, 100)
    name?: string;

    @ApiPropertyOptional({ description: 'Client email' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({ description: 'New password' })
    @IsOptional()
    @IsString()
    @Length(8, 50)
    password?: string;

    @ApiPropertyOptional({ description: 'Mobile number' })
    @IsOptional()
    @IsString()
    @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Invalid mobile number format' })
    mobile?: string;

    @ApiPropertyOptional({ description: 'Company name' })
    @IsOptional()
    @IsString()
    @Length(2, 200)
    companyName?: string;

    @ApiPropertyOptional({ description: 'Headquarters location' })
    @IsOptional()
    @IsString()
    @Length(2, 200)
    hqLocation?: string;

    @ApiPropertyOptional({ description: 'Company size', enum: CompanySize })
    @IsOptional()
    @IsEnum(CompanySize)
    companySize?: CompanySize;

    @ApiPropertyOptional({ description: 'Registered address' })
    @IsOptional()
    @IsString()
    @Length(10, 500)
    registeredAddress?: string;

    @ApiPropertyOptional({ description: 'Company GSTIN' })
    @IsOptional()
    @IsString()
    @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
        message: 'Invalid GSTIN format'
    })
    companyGSTIN?: string;

    @ApiPropertyOptional({ description: 'Company PAN' })
    @IsOptional()
    @IsString()
    @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, { message: 'Invalid PAN format' })
    PAN?: string;

    @ApiPropertyOptional({ description: 'Company CIN' })
    @IsOptional()
    @IsString()
    @Matches(/^[A-Z]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/, {
        message: 'Invalid CIN format'
    })
    CIN?: string;

    @ApiPropertyOptional({ description: 'Company website' })
    @IsOptional()
    @IsString()
    @Matches(/^https?:\/\/.+/, { message: 'Invalid website URL' })
    website?: string;

    @ApiPropertyOptional({ description: 'Advertiser ID to associate with' })
    @IsOptional()
    @IsUUID()
    advertiserId?: string;
}

// Filter DTO
export class ClientFilterDto {
    @ApiPropertyOptional({ description: 'Page number', default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ description: 'Items per page', default: 10 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(100)
    limit?: number = 10;

    @ApiPropertyOptional({ description: 'Search term' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ description: 'Filter by advertiser ID' })
    @IsOptional()
    @IsUUID()
    advertiserId?: string;

    @ApiPropertyOptional({ description: 'Sort field', default: 'createdAt' })
    @IsOptional()
    @IsString()
    sortBy?: string = 'createdAt';

    @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'], default: 'desc' })
    @IsOptional()
    @IsEnum(['asc', 'desc'])
    sortOrder?: 'asc' | 'desc' = 'desc';
}

// Bulk Action DTO
export class BulkActionDto {
    @ApiProperty({
        description: 'Bulk action type',
        enum: ['DELETE', 'ASSOCIATE_ADVERTISER', 'REMOVE_ADVERTISER', 'UPDATE_STATUS']
    })
    @IsEnum(['DELETE', 'ASSOCIATE_ADVERTISER', 'REMOVE_ADVERTISER', 'UPDATE_STATUS'])
    action: 'DELETE' | 'ASSOCIATE_ADVERTISER' | 'REMOVE_ADVERTISER' | 'UPDATE_STATUS';

    @ApiProperty({ description: 'Array of client IDs', type: [String] })
    @IsArray()
    @IsUUID(4, { each: true })
    clientIds: string[];

    @ApiPropertyOptional({ description: 'Additional data for the action' })
    @IsOptional()
    @IsObject()
    data?: {
        advertiserId?: string;
        status?: 'ACTIVE' | 'INACTIVE';
    };
}

// Response DTOs
export class AdvertiserSummaryDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    name: string;

    @ApiProperty()
    email: string;

    @ApiProperty()
    companyName: string;

    @ApiProperty()
    mobile: string;
}

export class ClientResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    name: string;

    @ApiProperty()
    email: string;

    @ApiProperty()
    mobile: string;

    @ApiProperty()
    companyName: string;

    @ApiProperty()
    hqLocation: string;

    @ApiProperty({ enum: CompanySize })
    companySize: CompanySize;

    @ApiProperty()
    registeredAddress: string;

    @ApiProperty()
    companyGSTIN: string;

    @ApiProperty()
    PAN: string;

    @ApiProperty()
    CIN: string;

    @ApiProperty()
    website: string;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;

    @ApiPropertyOptional({ type: AdvertiserSummaryDto })
    advertiser?: AdvertiserSummaryDto | null;

    @ApiProperty()
    campaignCount: number;
}

export class PaginationDto {
    @ApiProperty()
    page: number;

    @ApiProperty()
    limit: number;

    @ApiProperty()
    total: number;

    @ApiProperty()
    totalPages: number;
}

export class ClientListResponseDto {
    @ApiProperty({ type: [ClientResponseDto] })
    data: ClientResponseDto[];

    @ApiProperty({ type: PaginationDto })
    pagination: PaginationDto;
}

// Campaign related DTOs
export class CampaignSummaryDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    name: string;

    @ApiProperty({ enum: CampaignStatus })
    status: CampaignStatus;

    @ApiProperty()
    startDate: Date;

    @ApiProperty()
    endDate: Date;

    @ApiProperty({ enum: CampaignObjective })
    objective: CampaignObjective;

    @ApiProperty({ enum: BidStrategy })
    bidStrategy: BidStrategy;

    @ApiProperty()
    totalImpressions: number;

    @ApiProperty()
    totalClicks: number;

    @ApiProperty()
    totalConversions: number;

    @ApiProperty()
    totalSpend: number;
}

export class ClientCampaignSummaryDto {
    @ApiProperty()
    clientId: string;

    @ApiProperty({ type: [CampaignSummaryDto] })
    campaigns: CampaignSummaryDto[];

    @ApiProperty({
        type: 'object',
        properties: {
            totalCampaigns: { type: 'number' },
            activeCampaigns: { type: 'number' },
            totalImpressions: { type: 'number' },
            totalClicks: { type: 'number' },
            totalConversions: { type: 'number' },
            totalSpend: { type: 'number' },
        },
    })
    summary: {
        totalCampaigns: number;
        activeCampaigns: number;
        totalImpressions: number;
        totalClicks: number;
        totalConversions: number;
        totalSpend: number;
    };
}

// Statistics DTOs
export class DailyStatDto {
    @ApiProperty()
    date: string;

    @ApiProperty()
    impressions: number;

    @ApiProperty()
    clicks: number;

    @ApiProperty()
    conversions: number;

    @ApiProperty()
    spend: number;
}

export class ClientStatisticsDto {
    @ApiProperty()
    clientId: string;

    @ApiProperty({
        type: 'object',
        properties: {
            startDate: { type: 'string', nullable: true },
            endDate: { type: 'string', nullable: true },
        },
    })
    period: {
        startDate: string | null;
        endDate: string | null;
    };

    @ApiProperty({
        type: 'object',
        properties: {
            totalCampaigns: { type: 'number' },
            activeCampaigns: { type: 'number' },
            totalCreatives: { type: 'number' },
        },
    })
    overview: {
        totalCampaigns: number;
        activeCampaigns: number;
        totalCreatives: number;
    };

    @ApiProperty({
        type: 'object',
        properties: {
            totalImpressions: { type: 'number' },
            totalClicks: { type: 'number' },
            totalConversions: { type: 'number' },
            totalSpend: { type: 'number' },
            ctr: { type: 'number' },
            cpc: { type: 'number' },
            cpm: { type: 'number' },
            conversionRate: { type: 'number' },
        },
    })
    performance: {
        totalImpressions: number;
        totalClicks: number;
        totalConversions: number;
        totalSpend: number;
        ctr: number;
        cpc: number;
        cpm: number;
        conversionRate: number;
    };

    @ApiProperty({ type: [DailyStatDto] })
    dailyStats: DailyStatDto[];
}