import { AuctionType } from "@prisma/client";
import { BidRequestWithAuction } from "./bid-request.types";

export interface BaseAuctionResult {
    auctionId: string;
    auctionStatus: 'COMPLETED' | 'NO_BIDS' | 'TIMEOUT' | 'ERROR';
    totalBids: number;
    validBids: number;
    processingTime: number;
    auctionType: AuctionType;
    originalBidRequest: BidRequestWithAuction; // The original bid request data
    processedAt: string; // ISO timestamp when published
}

export interface HandleNoBidsResult extends BaseAuctionResult {
    winner: null;
    totalBids: 0;
    validBids: 0;
    auctionStatus: 'NO_BIDS';
}

export interface ErrorAuctionResult extends BaseAuctionResult {
    winner: null;
    errorMessage: string;
    errorCode?: string;
    auctionStatus: 'ERROR';
}

export interface AuctionBidResult extends BaseAuctionResult {
    winner: WinningBidDetails;
    winnerId: string;
    finalPrice: number;
    floorPrice: number;
    auctionStatus: 'COMPLETED';
}

/**
 * Winning bid details for successful auctions
 */
export interface WinningBidDetails {
    id: string;
    campaignId: string;
    creativeId: string;
    advertiserId: string;
    bidPrice: number;
    finalPrice: number;
    status: 'WON';
    responseLatency?: number;
    processedAt?: number;
    currency?: string;
    adMarkup?: string;
    impressionUrls?: string[];
    clickUrls?: string[];
    landingUrl?: string;
}

export interface SuccessfulAuctionResult extends BaseAuctionResult {
    auctionStatus: 'COMPLETED';
    winner: WinningBidDetails;
    winnerId: string;
    finalPrice: number;
    validBids: number;
}

export interface TimeoutAuctionResult extends BaseAuctionResult {
    auctionStatus: 'TIMEOUT';
    winner: null;
    message: string;
    partialBids?: number;
}

export interface AuctionResultInput {
    auctionStatus: 'COMPLETED' | 'NO_BIDS' | 'TIMEOUT' | 'ERROR';
    winner?: WinningBidDetails | null;
    winnerId?: string;
    finalPrice?: number;
    totalBids: number;
    validBids?: number;
    processingTime?: number;
    auctionType?: string;
    message?: string;
    errorMessage?: string;
    errorCode?: string;
    partialBids?: number;
}

export interface AuctionResultKafkaMessage {
    key: string; // auctionId
    value: AuctionResult;
    topic: string;
    partition?: number;
    offset?: string;
}

export interface ProcessedAuctionResult {
    auctionId: string;
    winner: any | null;
    totalBids: number;
    validBids: number;
    processingTime: number;
    auctionType: string;
    floorPrice?: number;
    auctionStatus: string;
}
export type AuctionResult =
    | SuccessfulAuctionResult
    // | NoBidsAuctionResult
    | TimeoutAuctionResult
    | ErrorAuctionResult;




export type CompleteAuctionResult = AuctionBidResult | HandleNoBidsResult | ErrorAuctionResult;