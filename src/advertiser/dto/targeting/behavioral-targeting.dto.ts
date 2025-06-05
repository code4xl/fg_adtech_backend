import { ApiExtraModels, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsBoolean,
    IsDecimal,
    IsEnum,
    IsNumber,
    IsOptional,
    IsUUID,
} from 'class-validator';
import {
    CampaignInterest,
    PurchaseIntent,
    LifestyleSegment,
    AudienceType,
    UserSegment,
    PurchaseFrequency,
    SessionEngagement,
} from '@prisma/client';
import { Type } from 'class-transformer';

@ApiExtraModels()
export class CreateCampaignBehavioralTargetingDto {
    @ApiProperty({ description: 'Campaign ID for targeting rules' })
    @IsUUID()
    campaignId: string;

    @ApiPropertyOptional({
        description: 'User interests to target',
        enum: CampaignInterest,
        isArray: true,
        example: [CampaignInterest.TECHNOLOGY, CampaignInterest.SPORTS],
    })
    @IsOptional()
    @IsArray()
    @IsEnum(CampaignInterest, { each: true })
    interests?: CampaignInterest[];

    @ApiPropertyOptional({
        description: 'Purchase intent levels',
        enum: PurchaseIntent,
        isArray: true,
        example: [PurchaseIntent.HIGH, PurchaseIntent.MEDIUM],
    })
    @IsOptional()
    @IsArray()
    @IsEnum(PurchaseIntent, { each: true })
    purchaseIntent?: PurchaseIntent[];

    @ApiPropertyOptional({
        description: 'Lifestyle segments to target',
        enum: LifestyleSegment,
        isArray: true,
        example: [LifestyleSegment.TECH_SAVVY, LifestyleSegment.FITNESS_ENTHUSIAST],
    })
    @IsOptional()
    @IsArray()
    @IsEnum(LifestyleSegment, { each: true })
    lifestyleSegments?: LifestyleSegment[];

    @ApiPropertyOptional({
        description: 'Audience types',
        enum: AudienceType,
        isArray: true,
        example: [AudienceType.INTEREST_BASED, AudienceType.BEHAVIORAL],
    })
    @IsOptional()
    @IsArray()
    @IsEnum(AudienceType, { each: true })
    audienceTypes?: AudienceType[];

    @ApiPropertyOptional({
        description: 'User segments',
        enum: UserSegment,
        isArray: true,
        example: [UserSegment.NEW_VISITORS, UserSegment.HIGH_VALUE_CUSTOMERS],
    })
    @IsOptional()
    @IsArray()
    @IsEnum(UserSegment, { each: true })
    userSegments?: UserSegment[];

    @ApiPropertyOptional({
        description: 'Purchase frequency patterns',
        enum: PurchaseFrequency,
        isArray: true,
        example: [PurchaseFrequency.MONTHLY, PurchaseFrequency.WEEKLY],
    })
    @IsOptional()
    @IsArray()
    @IsEnum(PurchaseFrequency, { each: true })
    purchaseFrequency?: PurchaseFrequency[];

    @ApiPropertyOptional({
        description: 'Session engagement levels',
        enum: SessionEngagement,
        isArray: true,
        example: [
            SessionEngagement.HIGH_ENGAGEMENT,
            SessionEngagement.MEDIUM_ENGAGEMENT,
        ],
    })
    @IsOptional()
    @IsArray()
    @IsEnum(SessionEngagement, { each: true })
    sessionEngagement?: SessionEngagement[];

    @ApiPropertyOptional({ description: 'Average order value threshold' })
    @IsOptional()
    @IsDecimal()
    @Type(() => Number)
    avgOrderValue?: number;

    @ApiPropertyOptional({ description: 'Session duration in minutes' })
    @IsOptional()
    @IsNumber()
    sessionDuration?: number;

    @ApiPropertyOptional({ description: 'Average page views per session' })
    @IsOptional()
    @IsNumber()
    pageViews?: number;

    @ApiPropertyOptional({
        description: 'Include or exclude these behaviors',
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    isInclude?: boolean = true;
}

export class UpdateCampaignBehavioralTargetingDto extends CreateCampaignBehavioralTargetingDto { }