// src/rtb/types/creative-selection.types.ts

import {
    CreativeType,
    CreativeStatus,
    InventoryFormat,
    InventoryPosition
} from '@prisma/client';

/**
 * Ad Slot Template included with creative
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
 * Creative with Ad Slot Template (result of selectCreative query)
 * This matches exactly what your Prisma query returns
 */
export interface CreativeWithTemplate {
    id: string;
    campaignId: string;
    name: string;
    type: CreativeType;
    templateId: string;
    fileUrl: string;
    s3Key: string | null;
    landingUrl: string;
    status: CreativeStatus;
    contentSafetyThreshold: number | null;
    reviewNotes: string | null;
    createdAt: Date;
    updatedAt: Date;

    // Included relation
    adSlotTemplate: AdSlotTemplate;
}

/**
 * Return type for selectCreative method
 * Can be either a creative or null if none found
 */
export type SelectCreativeResult = CreativeWithTemplate | null;