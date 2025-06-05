import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';
import { BusinessCategory, PageType, BrandSafety } from '@prisma/client';

export class CreateCampaignContextualTargetingDto {
    @ApiProperty({ description: 'Campaign ID for targeting rules' })
    @IsUUID()
    campaignId: string;

    @ApiPropertyOptional({
        description: 'Content categories to target',
        enum: BusinessCategory,
        isArray: true,
        example: [BusinessCategory.TECHNOLOGY, BusinessCategory.FINANCE],
    })
    @IsOptional()
    @IsArray()
    @IsEnum(BusinessCategory, { each: true })
    contentCategories?: BusinessCategory[];

    @ApiPropertyOptional({
        description: 'Keywords to match in page content',
        isArray: true,
        example: ['smartphone', 'technology', 'innovation'],
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    keywords?: string[];

    @ApiPropertyOptional({
        description: 'URL patterns to match',
        isArray: true,
        example: ['/products/*', '/category/tech'],
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    urlPatterns?: string[];

    @ApiPropertyOptional({
        description: 'Page types to target',
        enum: PageType,
        isArray: true,
        example: [PageType.ARTICLE, PageType.PRODUCT],
    })
    @IsOptional()
    @IsArray()
    @IsEnum(PageType, { each: true })
    pageTypes?: PageType[];

    @ApiPropertyOptional({
        description: 'Brand safety levels',
        enum: BrandSafety,
        isArray: true,
        example: [BrandSafety.SAFE, BrandSafety.MODERATE],
    })
    @IsOptional()
    @IsArray()
    @IsEnum(BrandSafety, { each: true })
    brandSafety?: BrandSafety[];

    @ApiPropertyOptional({
        description: 'Keywords to avoid',
        isArray: true,
        example: ['violence', 'controversy'],
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    blockedKeywords?: string[];

    @ApiPropertyOptional({
        description: 'Include or exclude these contexts',
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    isInclude?: boolean = true;
}

export class UpdateCampaignContextualTargetingDto extends CreateCampaignContextualTargetingDto { }