import {
    Gender,
    Language,
    Education,
    IncomeRange,
    DeviceType,
    OperatingSystem,
    BrowserType,
    ConnectionType,
    BusinessCategory,
    CampaignInterest,
    PageType,
    BrandSafety,
    PurchaseIntent,
    LifestyleSegment,
    AudienceType,
    UserSegment,
    PurchaseFrequency,
    SessionEngagement,
    TimeSlot,
    DayOfWeek,
    HolidayType,
    FrequencyScope,
    FrequencyWindow
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Demographic Targeting Rules - Match Prisma Schema Exactly
 */
export interface DemographicTargeting {
    id: string;
    campaignId: string | null;  // Changed from optional to nullable
    inventoryId: string | null; // Changed from optional to nullable
    ageMin: number | null;      // Changed to nullable to match schema
    ageMax: number | null;      // Changed to nullable to match schema
    genders: Gender[];
    languages: Language[];
    education: Education[];
    incomeRange: IncomeRange[];
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Geographic Targeting Rules - Match Prisma Schema Exactly
 */
export interface GeographicTargeting {
    id: string;
    campaignId: string | null;
    inventoryId: string | null;
    countries: string[];
    states: string[];
    cities: string[];
    postalCodes: string[];
    radius: number | null;
    latitude: number | null;  // Changed to match Prisma Float? type
    longitude: number | null; // Changed to match Prisma Float? type
    isInclude: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Device Targeting Rules - Match Prisma Schema Exactly
 */
export interface DeviceTargeting {
    id: string;
    campaignId: string | null;
    inventoryId: string | null;
    deviceTypes: DeviceType[];
    operatingSystems: OperatingSystem[];
    browsers: BrowserType[];           // Fixed: Use BrowserType enum
    connectionTypes: ConnectionType[]; // Fixed: Use ConnectionType enum
    minOSVersion: string | null;
    maxOSVersion: string | null;
    deviceModels: string[];
    isInclude: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Contextual Targeting Rules - Match Prisma Schema Exactly
 */
export interface ContextualTargeting {
    id: string;
    campaignId: string | null;
    inventoryId: string | null;
    contentCategories: BusinessCategory[];
    keywords: string[];
    urlPatterns: string[];
    pageTypes: PageType[];      // Fixed: Use PageType enum
    brandSafety: BrandSafety[]; // Fixed: Use BrandSafety enum
    blockedKeywords: string[];
    isInclude: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Behavioral Targeting Rules - Match Prisma Schema Exactly
 */
export interface BehavioralTargeting {
    id: string;
    campaignId: string | null;
    inventoryId: string | null;
    interests: CampaignInterest[];
    purchaseIntent: PurchaseIntent[];           // Fixed: Use proper enum
    lifestyleSegments: LifestyleSegment[];      // Fixed: Use proper enum
    audienceTypes: AudienceType[];              // Fixed: Use proper enum
    userSegments: UserSegment[];                // Fixed: Use proper enum
    purchaseFrequency: PurchaseFrequency[];     // Fixed: Use proper enum
    sessionEngagement: SessionEngagement[];     // Fixed: Use proper enum
    avgOrderValue: Decimal | null;              // Match Prisma Decimal type
    sessionDuration: number | null;             // Match Prisma Int? type
    pageViews: number | null;                   // Match Prisma Int? type
    isInclude: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Time Targeting Rules - Match Prisma Schema Exactly
 */
export interface TimeTargeting {
    id: string;
    campaignId: string | null;
    inventoryId: string | null;
    timezone: string;                    // Default "Asia/Kolkata" in schema
    timeSlots: TimeSlot[];              // Fixed: Use TimeSlot enum
    daysOfWeek: DayOfWeek[];            // Fixed: Use DayOfWeek enum
    holidayTypes: HolidayType[];        // Fixed: Use HolidayType enum
    startHour: number | null;           // Match Prisma Int? type
    endHour: number | null;             // Match Prisma Int? type
    startDate: Date | null;             // Match Prisma DateTime? type
    endDate: Date | null;               // Match Prisma DateTime? type
    includeHolidays: boolean;           // Default true in schema
    workingDaysOnly: boolean;           // Default false in schema
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Frequency Targeting Rules - Match Prisma Schema Exactly
 */
export interface FrequencyTargeting {
    id: string;
    campaignId: string | null;
    inventoryId: string | null;
    maxImpressions: number;                    // Required in schema
    frequencyWindow: FrequencyWindow;          // Fixed: Use FrequencyWindow enum
    frequencyScope: FrequencyScope;            // Fixed: Use FrequencyScope enum
    maxClicksPerUser: number | null;           // Match Prisma Int? type
    minTimeBetween: number | null;             // Match Prisma Int? type (minutes)
    customTimeWindowHours: number | null;      // Match Prisma Int? type
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Helper type for when targeting rules are used in campaign context
 */
export interface CampaignTargetingRules {
    demographicTargeting: DemographicTargeting[];
    geographicTargeting: GeographicTargeting[];
    deviceTargeting: DeviceTargeting[];
    contextualTargeting: ContextualTargeting[];
    behavioralTargeting: BehavioralTargeting[];
    timeTargeting: TimeTargeting[];
    frequencyTargeting: FrequencyTargeting[];
}

/**
 * Helper type for when targeting rules are used in inventory context
 */
export interface InventoryTargetingRules {
    demographicTargeting: DemographicTargeting[];
    geographicTargeting: GeographicTargeting[];
    deviceTargeting: DeviceTargeting[];
    contextualTargeting: ContextualTargeting[];
    behavioralTargeting: BehavioralTargeting[];
    timeTargeting: TimeTargeting[];
    frequencyTargeting: FrequencyTargeting[];
}