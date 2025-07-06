export interface BudgetReservation {
  reservationId: string;
  campaignId: string;
  bidResponseId: string;
  amount: number;
  auctionId: string;
  reservedAt: string;
  status: 'RESERVED' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';
  publisherId?: string;
  inventoryId?: string;
  websiteId?: string;
}

export interface ReservationResult {
  success: boolean;
  reservationId?: string;
  errorMessage?: string;
  reservedAmount?: number;
}

export interface BillingResult {
  success: boolean;
  transactionId?: string;
  errorMessage?: string;
  billedAmount?: number;
  reservationFound?: boolean;
}

export interface BudgetTransaction {
  id: string;
  campaignId: string;
  amount: number;
  type: TransactionType;
  description: string;
  publisherId?: string;
  inventoryId?: string;
  bidResponseId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export enum TransactionType {
  IMPRESSION_COST = 'IMPRESSION_COST',
  CLICK_COST = 'CLICK_COST',
  REFUND = 'REFUND',
  ADJUSTMENT = 'ADJUSTMENT',
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
  FREEZE = 'FREEZE',
}

export interface PublisherRevenueData {
  publisherId: string;
  campaignId: string;
  inventoryId: string;
  websiteId: string;
  grossRevenue: number;
  commissionRate: number;
  netRevenue: number;
  eventType: 'IMPRESSION' | 'CLICK';
  createdAt: string;
}

export interface SystemRevenueData {
  campaignId: string;
  publisherId: string;
  advertiserId: string;
  creativeId: string;
  inventoryId: string;
  grossRevenue: number;
  publisherShare: number;
  systemEarning: number;
  commissionRate: number;
  eventType: 'IMPRESSION' | 'CLICK';
  createdAt: string;
}

export interface BudgetHealthMetrics {
  status: 'healthy' | 'warning' | 'critical';
  dailyBudget: number;
  spentToday: number;
  remainingToday: number;
  utilizationPercentage: number;
  reservedAmount: number;
  availableForBidding: number;
  projectedExhaustionTime?: string;
}

export interface SystemBudgetHealth {
  status: 'healthy' | 'warning' | 'critical';
  activeCampaigns: number;
  campaignsWithIssues: number;
  totalReservations: number;
  totalReservedAmount: number;
  averageDiscrepancy: number;
  expiredReservationsCount: number;
}

export interface BillingDiscrepancyReport {
  totalReservations: number;
  totalReservedAmount: number;
  confirmedImpressions: number;
  confirmedAmount: number;
  discrepancyPercentage: number;
  expiredReservations: number;
  expiredAmount: number;
  campaignId?: string;
  date?: string;
  generatedAt: string;
}

export interface DailyBudgetResetResult {
  success: boolean;
  campaignsReset: number;
  errors: string[];
  processedAt: string;
  totalProcessingTime: number;
}

export interface RevenueMetadata {
  publisherId: string;
  inventoryId: string;
  websiteId: string;
  campaignId: string;
  advertiserId?: string;
  creativeId?: string;
  amount: number;
  createdAt: string;
}

export interface BudgetValidationResult {
  isValid: boolean;
  availableAmount: number;
  requestedAmount: number;
  reason?: string;
}

export interface CleanupResult {
  cleanedCount: number;
  reversedAmount: number;
  processedKeys: number;
  errors: string[];
}

export interface BudgetAdjustmentResult {
  success: boolean;
  transactionId?: string;
  newBalance: number;
  previousBalance?: number;
  adjustmentAmount: number;
}

// Configuration interfaces
export interface BudgetManagerConfig {
  reservationTtlSeconds: number;
  defaultCommissionRate: number;
  maxDiscrepancyPercent: number;
  cleanupIntervalMinutes: number;
  healthCheckThresholds: {
    warningUtilization: number;
    criticalUtilization: number;
    maxExpiredReservations: number;
  };
}

// Event interfaces for pub/sub
export interface BudgetReservedEvent {
  type: 'BUDGET_RESERVED';
  reservationId: string;
  campaignId: string;
  amount: number;
  timestamp: string;
}

export interface BudgetConfirmedEvent {
  type: 'BUDGET_CONFIRMED';
  reservationId: string;
  campaignId: string;
  transactionId: string;
  confirmedAmount: number;
  timestamp: string;
}

export interface BudgetExhaustedEvent {
  type: 'BUDGET_EXHAUSTED';
  campaignId: string;
  dailyBudget: number;
  spentAmount: number;
  timestamp: string;
}

export interface ReservationExpiredEvent {
  type: 'RESERVATION_EXPIRED';
  reservationId: string;
  campaignId: string;
  expiredAmount: number;
  timestamp: string;
}

// API Response types
export interface BudgetStatusResponse {
  campaignId: string;
  status: 'ACTIVE' | 'BUDGET_EXHAUSTED' | 'PAUSED';
  dailyBudget: number;
  spentToday: number;
  remainingToday: number;
  reservedAmount: number;
  availableForBidding: number;
  lastUpdated: string;
}

export interface ReservationStatusResponse {
  reservationId: string;
  status: 'RESERVED' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';
  campaignId: string;
  amount: number;
  createdAt: string;
  expiresAt?: string;
  confirmedAt?: string;
}

// Error types
export class BudgetReservationError extends Error {
  constructor(
    message: string,
    public campaignId: string,
    public requestedAmount: number,
    public availableAmount: number,
  ) {
    super(message);
    this.name = 'BudgetReservationError';
  }
}

export class BudgetConfirmationError extends Error {
  constructor(
    message: string,
    public bidResponseId: string,
    public expectedAmount?: number,
  ) {
    super(message);
    this.name = 'BudgetConfirmationError';
  }
}

export class InsufficientBudgetError extends Error {
  constructor(
    message: string,
    public campaignId: string,
    public requestedAmount: number,
    public availableAmount: number,
  ) {
    super(message);
    this.name = 'InsufficientBudgetError';
  }
}

// Constants
export const BUDGET_MANAGER_CONSTANTS = {
  DEFAULT_RESERVATION_TTL: 300, // 5 minutes
  DEFAULT_COMMISSION_RATE: 0.4, // 40%
  MAX_RESERVATION_TTL: 900, // 15 minutes
  MIN_RESERVATION_TTL: 60, // 1 minute
  CLEANUP_BATCH_SIZE: 100,
  MAX_DISCREPANCY_PERCENT: 10,

  // Redis key patterns
  REDIS_PATTERNS: {
    RESERVATION: 'budget:reservation:*',
    METADATA: 'revenue:metadata:*',
    TRACKING: 'budget:reservations:*',
  },

  // Health check thresholds
  HEALTH_THRESHOLDS: {
    WARNING_UTILIZATION: 80,
    CRITICAL_UTILIZATION: 95,
    MAX_EXPIRED_RESERVATIONS: 50,
    MAX_DISCREPANCY_PERCENT: 15,
  },
} as const;
