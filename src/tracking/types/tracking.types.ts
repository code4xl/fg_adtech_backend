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
  templateId?: string | null; // ← Handle optional fields properly
  timestamp: Date;
  userAgent?: string | null;
  ipAddress?: string | null;
  deviceType?: string | null;
  viewable?: boolean | null;
  viewTime?: number | null;
  isBot?: boolean | null;
  fraudScore?: number | null;
  slotId?: string | null;
  userFingerprint?: string | null;
  bidPrice?: number;
  finalPrice?: number;

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
  templateId?: string | null;
  timestamp: Date;
  userAgent?: string | null;
  ipAddress?: string | null;
  deviceType?: string | null;
  landingUrl?: string | null;
  isBot?: boolean | null;
  fraudScore?: number | null;
  timeFromImpression?: number | null;

  //  FIX: Add missing fields
  slotId?: string | null;
  userFingerprint?: string | null;

  // Additional fields:
  referrer?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
}

interface ImpressionData {
  id: string;
  bidResponseId: string;
  creativeId: string;
  campaignId: string;
  advertiserId: string;
  inventoryId: string;
  publisherId: string;
  websiteId: string;
  templateId: string | null;
  timestamp: string;

  slotId?: string | null;
  userFingerprint?: string | null;

  // User data
  userAgent: string | null;
  ipAddress: string | null;
  deviceType: string | null;

  // Viewability data
  viewable: boolean | null;
  viewTime: number | null; // assuming it's in milliseconds or seconds

  // Fraud data
  isBot: boolean;
  fraudScore: number | null;

  // Financial data
  bidPrice: number;
  finalPrice: number;

  // Additional fields
  referrer: string | null;
  country: string | null;
  region: string | null;
  city: string | null;

  // Metadata
  syncedToTimescale: boolean;
  syncedAt: Date | null;
}

interface ClickData {
  id: string;
  impressionId: string | null;
  bidResponseId: string;
  creativeId: string;
  campaignId: string;
  advertiserId: string;
  inventoryId: string;
  publisherId: string;
  websiteId: string;
  templateId: string | null;
  timestamp: string;

  // User data
  userAgent: string | null;
  ipAddress: string | null;
  deviceType: string | null;

  // Click-specific data
  landingUrl: string | null;

  // Fraud data
  isBot: boolean;
  fraudScore: number | null;
  timeFromImpression: number | null; // in milliseconds or seconds, depending on system

  slotId?: string | null;
  userFingerprint?: string | null;

  // Additional fields
  referrer: string | null;
  country: string | null;
  region: string | null;
  city: string | null;

  // Metadata
  syncedToTimescale: boolean;
  syncedAt: Date | null;
}
