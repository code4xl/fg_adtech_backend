// export interface ImpressionEvent {
//     id: string;
//     creativeId: string;
//     campaignId: string;
//     inventoryId: string;
//     publisherId: string;
//     advertiserId: string;
//     bidResponseId: string;
//     bidPrice: number;
//     timestamp: Date;
//     userAgent?: string;
//     ipAddress?: string;
//     deviceType?: string;
//     country?: string;
//     region?: string;
//     city?: string;
//     viewable?: boolean;
//     viewTime?: number;
//     isBot?: boolean;
//     fraudScore?: number;
// }

// export interface ClickEvent {
//     id: string;
//     impressionId: string;
//     creativeId: string;
//     campaignId: string;
//     inventoryId: string;
//     publisherId: string;
//     advertiserId: string;
//     clickPrice?: number; // For CPC campaigns
//     timestamp: Date;
//     userAgent?: string;
//     ipAddress?: string;
//     deviceType?: string;
//     country?: string;
//     region?: string;
//     city?: string;
//     isBot?: boolean;
//     fraudScore?: number;
//     landingUrl?: string;
// }

interface ImpressionEvent {
    id: string;
    bidResponseId: string;
    creativeId: string;
    campaignId: string;
    advertiserId: string;
    inventoryId: string;
    publisherId: string;
    websiteId: string;
    adSlotId?: string | null;  // ← Handle optional fields properly
    timestamp: Date;
    userAgent?: string | null;
    ipAddress?: string | null;
    deviceType?: string | null;
    viewable?: boolean | null;
    viewTime?: number | null;
    isBot?: boolean | null;
    fraudScore?: number | null;
    bidPrice: number;

    // Additional fields to match Prisma model:
    referrer?: string | null;
    country?: string | null;
    region?: string | null;
    city?: string | null;
}

interface ClickEvent {
    id: string;
    impressionId?: string | null;
    bidResponseId: string;
    creativeId: string;
    campaignId: string;
    advertiserId: string;
    inventoryId: string;
    publisherId: string;
    websiteId: string;
    adSlotId?: string | null;
    timestamp: Date;
    userAgent?: string | null;
    ipAddress?: string | null;
    deviceType?: string | null;
    clickX?: number | null;
    clickY?: number | null;
    clickArea?: string | null;
    landingUrl?: string | null;
    isBot?: boolean | null;
    fraudScore?: number | null;
    timeFromImpression?: number | null;

    // Additional fields:
    referrer?: string | null;
    country?: string | null;
    region?: string | null;
    city?: string | null;
}