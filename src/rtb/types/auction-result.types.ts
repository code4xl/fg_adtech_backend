// src/rtb/types/auction-result.types.ts

/**
 * Base auction result structure that gets published to Kafka
 */
export interface BaseAuctionResult {
    auctionId: string;
    auctionStatus: 'COMPLETED' | 'NO_BIDS' | 'TIMEOUT' | 'ERROR';
    totalBids: number;
    validBids: number;
    processingTime: number;
    auctionType: string;
    originalBidRequest: any; // The original bid request data
    processedAt: string; // ISO timestamp when published
}

export interface HandleNoBidsResult extends BaseAuctionResult {
    winner: null;
    totalBids: 0;
    validBids: 0;
    auctionStatus: 'NO_BIDS';
}

export interface ErrorAuctionResult extends BaseAuctionResult {
    auctionStatus: 'ERROR';
    winner: null;
    errorMessage: string;
    errorCode?: string;
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

/**
 * Successful auction result (when there's a winner)
 */
export interface SuccessfulAuctionResult extends BaseAuctionResult {
    auctionStatus: 'COMPLETED';
    winner: WinningBidDetails;
    winnerId: string;
    finalPrice: number;
    validBids: number;
}

/**
 * No bids auction result (when no eligible campaigns)
 */
// export interface NoBidsAuctionResult extends BaseAuctionResult {
//     auctionStatus: 'NO_BIDS';
//     winner: null;
//     message: string;
//     totalBids: 0;
//     validBids?: 0;
// }

/**
 * Timeout auction result (when auction times out)
 */
export interface TimeoutAuctionResult extends BaseAuctionResult {
    auctionStatus: 'TIMEOUT';
    winner: null;
    message: string;
    partialBids?: number;
}

/**
 * Error auction result (when auction fails)
 */
// export interface ErrorAuctionResult extends BaseAuctionResult {
//     auctionStatus: 'ERROR';
//     winner: null;
//     errorMessage: string;
//     errorCode?: string;
// }



/**
 * Union type for all possible auction results
 * This is what gets published to Kafka AUCTION_RESULTS topic
 */
export type AuctionResult =
    | SuccessfulAuctionResult
    // | NoBidsAuctionResult
    | TimeoutAuctionResult
    | ErrorAuctionResult;

/**
 * The data passed to publishAuctionResult() method (before adding metadata)
 */
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

/**
 * Complete Kafka message structure for auction results
 */
export interface AuctionResultKafkaMessage {
    key: string; // auctionId
    value: AuctionResult;
    topic: string;
    partition?: number;
    offset?: string;
}





/**
 * Type for the handleNoBidsAuction return value
 */
// export interface HandleNoBidsResult extends BaseAuctionResult {
//     auctionId: string;
//     winner: null;
//     totalBids: 0;
//     validBids: 0;
//     processingTime: number;
//     auctionType: string;
//     auctionStatus: string;
// }




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

export type CompleteAuctionResult = AuctionBidResult | HandleNoBidsResult | ErrorAuctionResult;