import { Gender, Language, Education, IncomeRange, DeviceType, OperatingSystem, BusinessCategory, CampaignInterest } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Demographic Targeting Rules
 */
export interface DemographicTargeting {
    id: string;
    campaignId?: string;
    inventoryId?: string;
    ageMin?: number;
    ageMax?: number;
    genders: Gender[];
    languages: Language[];
    education: Education[];
    incomeRange: IncomeRange[];
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Geographic Targeting Rules
 */
export interface GeographicTargeting {
    id: string;
    campaignId?: string;
    inventoryId?: string;
    countries: string[];
    states: string[];
    cities: string[];
    postalCodes: string[];
    radius?: number;
    latitude?: number;
    longitude?: number;
    isInclude: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Device Targeting Rules
 */
export interface DeviceTargeting {
    id: string;
    campaignId?: string;
    inventoryId?: string;
    deviceTypes: DeviceType[];
    operatingSystems: OperatingSystem[];
    browsers: string[]; // BrowserType enum if you have it
    connectionTypes: string[]; // ConnectionType enum if you have it
    minOSVersion?: string;
    maxOSVersion?: string;
    deviceModels: string[];
    isInclude: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Contextual Targeting Rules
 */
export interface ContextualTargeting {
    id: string;
    campaignId?: string;
    inventoryId?: string;
    contentCategories: BusinessCategory[];
    keywords: string[];
    urlPatterns: string[];
    pageTypes: string[]; // PageType enum if you have it
    brandSafety: string[]; // BrandSafety enum if you have it
    blockedKeywords: string[];
    isInclude: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Behavioral Targeting Rules
 */
export interface BehavioralTargeting {
    id: string;
    campaignId?: string;
    inventoryId?: string;
    interests: CampaignInterest[];
    purchaseIntent: string[]; // PurchaseIntent enum if you have it
    lifestyleSegments: string[]; // LifestyleSegment enum if you have it
    audienceTypes: string[]; // AudienceType enum if you have it
    userSegments: string[]; // UserSegment enum if you have it
    purchaseFrequency: string[]; // PurchaseFrequency enum if you have it
    sessionEngagement: string[]; // SessionEngagement enum if you have it
    avgOrderValue?: Decimal | null;
    sessionDuration?: number;
    pageViews?: number;
    isInclude: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Time Targeting Rules
 */
export interface TimeTargeting {
    id: string;
    campaignId?: string;
    inventoryId?: string;
    timezone: string;
    timeSlots: string[]; // TimeSlot enum if you have it
    daysOfWeek: string[]; // DayOfWeek enum if you have it
    holidayTypes: string[]; // HolidayType enum if you have it
    startHour?: number;
    endHour?: number;
    startDate?: Date;
    endDate?: Date;
    includeHolidays: boolean;
    workingDaysOnly: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Frequency Targeting Rules
 */
export interface FrequencyTargeting {
    id: string;
    campaignId?: string;
    inventoryId?: string;
    maxImpressions?: number;
    timeWindow?: number; // hours
    createdAt: Date;
    updatedAt: Date;
}