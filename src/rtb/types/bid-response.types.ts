// src/rtb/types/bid-response-creation.types.ts

import {
    BidStatus,
    Currency,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Tracking URLs generated for bid response
 */
export interface TrackingUrls {
    impression: string[];
    click: string[];
}

/**
 * Ad slot context for markup generation
 */
export interface AdSlotMarkupContext {
    width: number;
    height: number;
    format: string;
}

/**
 * Bid Response created by Prisma (exact return type of createBidResponse)
 */
export interface CreatedBidResponse {
    id: string;
    bidRequestId: string;
    campaignId: string;
    creativeId: string;
    advertiserId: string;

    // Bid details
    bidPrice: Decimal;
    currency: Currency;

    // Status tracking
    status: BidStatus;
    responseLatency: number | null;

    // Win details (if applicable)
    finalPrice: number;
    winNotificationSent: boolean;
    landingUrl: string;

    // Ad markup
    adMarkup: string | null;
    impressionUrls: string[];
    clickUrls: string[];

    // Timestamps
    createdAt: Date;
    processedAt: Date | null;
}

/**
 * Input data for creating bid response
 */
export interface CreateBidResponseInput {
    bidRequestId: string;
    campaignId: string;
    creativeId: string;
    advertiserId: string;
    bidPrice: number; // Will be converted to Decimal
    currency: Currency;
    status: BidStatus;
    adMarkup: string;
    impressionUrls: string[];
    clickUrls: string[];
}

export interface WinningBidResponse {
    requestId: string;
    auctionId: string;
    status: 'COMPLETED';
    winningBid: {
        price: number;
        currency: string;
        campaignId: string;
        creativeId: string;
        adMarkup: string;
        impressionUrls: string[];
        clickUrls: string[];
        landingUrl: string;
    };
    auctionData: {
        totalBids: number;
        validBids: number;
        auctionDuration: string;
        timestamp: string;
        floorPrice?: number;
    };
}
