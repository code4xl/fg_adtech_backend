import {
    CampaignStatus,
    CampaignObjective,
    BidStrategy,
    CampaignPacing,
    BusinessCategory,
    CampaignInterest,
    CreativeStatus,
    CreativeType,

    InventoryFormat,
    InventoryPosition,
    BehavioralTargeting,
    ContextualTargeting,
    DeviceTargeting,
    FrequencyTargeting,
    GeographicTargeting,
    TimeTargeting
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { DemographicTargeting } from './targeting.types';

/**
 * Ad Slot Template from your creatives
 */
export interface AdSlotTemplate {
    id: string;
    name: string;
    width: number;
    height: number;
    format: InventoryFormat;
    position: InventoryPosition;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Creative with Ad Slot Template
 */
export interface CampaignCreative {
    id: string;
    campaignId: string;
    name: string;
    type: CreativeType;
    templateId: string;
    fileUrl: string;
    s3Key?: string;
    landingUrl: string;
    status: CreativeStatus;
    contentSafetyThreshold?: number;
    reviewNotes?: string;
    createdAt: Date;
    updatedAt: Date;
    adSlotTemplate: AdSlotTemplate;
}

/**
 * Advertiser basic info
 */
export interface CampaignAdvertiser {
    id: string;
    name: string;
}

/**
 * Complete Campaign with all targeting rules and creatives
 * This is the return type of getBasicCampaignPool()
 */
export interface CampaignWithTargeting {
    id: string;
    name: string;
    advertiserId: string;
    clientId: string;
    startDate: Date;
    endDate: Date;
    status: CampaignStatus;
    objective: CampaignObjective;
    bidStrategy: BidStrategy;
    bidAmount?: Decimal | null;
    pacing: CampaignPacing;
    businessCategory: BusinessCategory;
    websiteUrl: string;
    interests: CampaignInterest[];
    createdAt: Date;
    updatedAt: Date;

    // Relations
    creatives: CampaignCreative[];
    advertiser: CampaignAdvertiser;

    // Targeting Rules
    demographicTargeting: DemographicTargeting[];
    geographicTargeting: GeographicTargeting[];
    deviceTargeting: DeviceTargeting[];
    contextualTargeting: ContextualTargeting[];
    behavioralTargeting: BehavioralTargeting[];
    timeTargeting: TimeTargeting[];
    frequencyTargeting: FrequencyTargeting[];
}

export interface CampaignBudgetInfo {
    dailyBudget: Decimal;
    totalBudget: Decimal;
}

export interface CampaignBudgetTracker {
    id: string;
    campaignId: string;
    date: Date;
    totalBudget: Decimal;
    dailyBudget: Decimal;
    spentToday: Decimal;
    remainingBudget: Decimal;
    isExhausted: boolean;
    lastUpdated: Date;
}

/**
 * Type alias for the function return
 */
export type BasicCampaignPool = CampaignWithTargeting[];