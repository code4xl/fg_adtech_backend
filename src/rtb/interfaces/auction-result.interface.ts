export interface AuctionResult {
  winningBid?: {
    campaignId: string;
    creativeId: string;
    advertiserId: string;
    bidPrice: number;
    finalPrice: number;
  };
  totalBids: number;
  validBids: number;
  auctionDuration: number;
  status: 'COMPLETED' | 'NO_BIDS' | 'TIMEOUT' | 'ERROR';
}
