interface AuctionProcessingMetrics {
    auctionId?: string;
    processingTime: number;
    status: 'success' | 'error';
    timestamp: Date;
    errorType?: string;
    campaignCount?: number;
    bidCount?: number;
}

interface RealtimeMetrics {
    totalAuctions: number;
    successfulAuctions: number;
    failedAuctions: number;
    averageProcessingTime: number;
    errorRate: number;
    throughputPerMinute: number;
    lastUpdated: string;
}

interface HourlyMetrics {
    hour: number;
    date: string;
    totalAuctions: number;
    successfulAuctions: number;
    failedAuctions: number;
    totalProcessingTime: number;
    averageProcessingTime: number;
    errorRate: number;
    topErrors: { [key: string]: number };
}