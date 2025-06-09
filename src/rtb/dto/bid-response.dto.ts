import {
    IsString,
    IsUUID,
    IsOptional,
    IsObject,
    IsNumber,
    IsEnum,
    IsArray,
    ValidateNested,
    Min,
    Max
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';


/**
 * Winning Bid DTO
 * 
 * Contains information about the winning bid in an auction.
 */
export class WinningBidDto {
    @ApiProperty({
        description: 'Winning bid price',
        example: 2.50
    })
    @IsNumber()
    price: number;

    @ApiProperty({
        description: 'Currency of the bid',
        example: 'USD',
        enum: ['USD', 'INR']
    })
    @IsEnum(['USD', 'INR'])
    currency: string;

    @ApiProperty({
        description: 'Campaign ID that won the auction',
        example: '550e8400-e29b-41d4-a716-446655440003'
    })
    @IsUUID()
    campaignId: string;

    @ApiProperty({
        description: 'Creative ID to be displayed',
        example: '550e8400-e29b-41d4-a716-446655440004'
    })
    @IsUUID()
    creativeId: string;

    @ApiProperty({
        description: 'Ad markup HTML/code to display',
        example: '<div class="ad-container"><img src="https://example.com/ad.jpg" /></div>'
    })
    @IsString()
    adMarkup: string;

    @ApiProperty({
        description: 'URLs for tracking impressions',
        example: ['https://track.oceanadtech.com/impression/12345']
    })
    @IsArray()
    @IsString({ each: true })
    impressionUrls: string[];

    @ApiProperty({
        description: 'URLs for tracking clicks',
        example: ['https://track.oceanadtech.com/click/12345?url=https://landing.com']
    })
    @IsArray()
    @IsString({ each: true })
    clickUrls: string[];

    @ApiPropertyOptional({
        description: 'Landing page URL',
        example: 'https://example.com/landing'
    })
    @IsOptional()
    @IsString()
    landingUrl?: string;
}

/**
 * Auction Data DTO
 * 
 * Contains metadata about the auction process.
 */
export class AuctionDataDto {
    @ApiProperty({
        description: 'Total number of bids received',
        example: 8
    })
    @IsNumber()
    totalBids: number;

    @ApiProperty({
        description: 'Number of valid bids after filtering',
        example: 6
    })
    @IsNumber()
    validBids: number;

    @ApiProperty({
        description: 'Auction processing duration',
        example: '95ms'
    })
    @IsString()
    auctionDuration: string;

    @ApiProperty({
        description: 'Auction completion timestamp',
        example: '2025-06-09T12:30:00.000Z'
    })
    @IsString()
    timestamp: string;

    @ApiPropertyOptional({
        description: 'Floor price used in auction',
        example: 0.50
    })
    @IsOptional()
    @IsNumber()
    floorPrice?: number;
}

/**
 * Bid Response DTO
 * 
 * Response sent back to SDK after auction completion.
 */
export class BidResponseDto {
    @ApiProperty({
        description: 'Original request ID',
        example: 'req_12345_abcdef'
    })
    @IsString()
    requestId: string;

    @ApiProperty({
        description: 'Auction status',
        example: 'completed',
        enum: ['processing', 'completed', 'no_bids', 'timeout', 'error']
    })
    @IsEnum(['processing', 'completed', 'no_bids', 'timeout', 'error'])
    status: string;

    @ApiPropertyOptional({
        description: 'Winning bid information',
        type: WinningBidDto
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => WinningBidDto)
    winningBid?: WinningBidDto;

    @ApiPropertyOptional({
        description: 'Auction metadata',
        type: AuctionDataDto
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => AuctionDataDto)
    auctionData?: AuctionDataDto;

    @ApiPropertyOptional({
        description: 'Error message if auction failed',
        example: 'No eligible campaigns found'
    })
    @IsOptional()
    @IsString()
    errorMessage?: string;

    @ApiPropertyOptional({
        description: 'Message if auction failed'
    })
    @IsOptional()
    @IsString()
    message?: string;
}