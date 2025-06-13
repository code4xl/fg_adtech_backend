// Generic base interface for auction completion data
export interface BaseAuctionCompletionData {
    auctionId: string;
    requestId: string;
    inventoryId: string;
    bidRequest: any;
    campaignIds: string[];
    winner: WinnerData | null;
    totalBids: number;
    validBids: number;
    processingTime: number;
    auctionType: string;
    floorPrice: number;
    finalPrice: number | null;
    auctionStatus: 'COMPLETED' | 'NO_BIDS' | 'ERROR';
    timestamp: string;
    revenue: number;
}

// Winner data interface
export interface WinnerData {
    id: string;
    campaignId: string;
    creativeId: string;
    bidPrice: number;
    finalPrice: number;
    currency: string;
    landingUrl: string;
}

// Specific auction completion data types
export interface SuccessfulAuctionCompletionData extends BaseAuctionCompletionData {
    auctionStatus: 'COMPLETED';
    winner: WinnerData;
    finalPrice: number;
    profit: number;
}

export interface NoBidsAuctionCompletionData extends BaseAuctionCompletionData {
    auctionStatus: 'NO_BIDS';
    winner: null;
    finalPrice: null;
    reason: string;
    inventoryQuality: 'premium' | 'standard' | 'low';
}

export interface ErrorAuctionCompletionData extends BaseAuctionCompletionData {
    auctionStatus: 'ERROR';
    winner: null;
    finalPrice: null;
    errorMessage: string;
    errorCode: string;
    errorType: 'timeout' | 'validation' | 'system' | 'unknown';
}

// Union type for all auction completion data
export type AuctionCompletionData =
    | SuccessfulAuctionCompletionData
    | NoBidsAuctionCompletionData
    | ErrorAuctionCompletionData;