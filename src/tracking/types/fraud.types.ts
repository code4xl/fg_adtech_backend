interface FraudCheckResult {
    isBot: boolean;
    fraudScore: number;
    reasons: string[];
    timeFromImpression?: number;
}

interface ImpressionFraudCheck {
    userAgent?: string;
    ipAddress?: string;
    bidResponseId: string;
    campaignId: string;
}

interface ClickFraudCheck {
    userAgent?: string;
    ipAddress?: string;
    bidResponseId: string;
    campaignId: string;
    clickX?: number;
    clickY?: number;
    impressionId?: string;
}
