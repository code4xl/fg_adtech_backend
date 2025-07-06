import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { REDIS_KEYS, RTB_CACHE_TTL } from '../constants/cache-keys';
import { v4 as uuidv4 } from 'uuid';

export interface BudgetReservation {
  reservationId: string;
  campaignId: string;
  bidResponseId: string;
  amount: number;
  auctionId: string;
  reservedAt: string;
  status: 'RESERVED' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';
}

export interface BillingResult {
  success: boolean;
  transactionId?: string;
  errorMessage?: string;
}

export interface ReservationResult {
  success: boolean;
  reservationId?: string;
  errorMessage?: string;
}

@Injectable()
export class BudgetManagerService {
  private readonly logger = new Logger(BudgetManagerService.name);

  // Reservation TTL: 5 minutes (enough time for impression tracking)
  private readonly RESERVATION_TTL = 300; // 5 minutes in seconds

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Reserve budget on auction win
   * This ensures budget availability without immediate deduction
   */
  async reserveBudgetOnWin(
    winningBid: any,
    publisherId: string,
    inventoryId: string,
    websiteId: string,
    costPerImpression: number,
    auctionId?: string,
  ): Promise<ReservationResult> {
    const reservationId = `${winningBid.id}_${Date.now()}`;
    const today = new Date().toISOString().split('T')[0];

    this.logger.debug('🔒 Reserving budget for auction winner', {
      campaignId: winningBid.campaignId,
      bidResponseId: winningBid.id,
      costPerImpression,
      reservationId,
    });

    try {
      // // 1. Double-check budget availability (race condition protection) // -- check again
      // const hasAvailableBudget = await this.validateBudgetAvailability(
      //   winningBid.campaignId,
      //   costPerImpression,
      // );

      // if (!hasAvailableBudget) {
      //   this.logger.warn(
      //     '❌ Budget exhausted between auction and reservation',
      //     {
      //       campaignId: winningBid.campaignId,
      //       costPerImpression,
      //       auctionId,
      //     },
      //   );
      //   return {
      //     success: false,
      //     errorMessage: 'Insufficient budget available',
      //   };
      // }

      // 2. Create atomic reservation in Redis
      const reservationData: BudgetReservation = {
        reservationId,
        campaignId: winningBid.campaignId,
        bidResponseId: winningBid.id,
        amount: costPerImpression,
        auctionId: auctionId || 'unknown',
        reservedAt: new Date().toISOString(),
        status: 'RESERVED',
      };

      // Store reservation with TTL
      const reservationKey = REDIS_KEYS.BUDGET_RESERVATION(reservationId);
      await this.redis.set(
        reservationKey,
        JSON.stringify(reservationData),
        RTB_CACHE_TTL.BUDGET_RESERVATION, // 5 minutes
      );

      // 3. Temporarily increment spent amount in Redis (will be confirmed or reversed)
      const pipeline = this.redis.pipeline();

      pipeline.incrbyfloat(
        REDIS_KEYS.DAILY_BUDGET_SPEND(winningBid.campaignId, today),
        costPerImpression,
      );

      // Add to reservations tracking set for cleanup
      pipeline.sadd(
        REDIS_KEYS.RESERVATION_TRACKING(today, winningBid.campaignId),
        reservationId,
      );
      pipeline.expire(
        REDIS_KEYS.RESERVATION_TRACKING(today, winningBid.campaignId),
        RTB_CACHE_TTL.RESERVATION_TRACKING, // 24 hours
      );

      await pipeline.exec();

      // 4. Store metadata for revenue sharing calculation -- check again
      // await this.storeRevenueMetadata(
      //   reservationId,
      //   publisherId,
      //   inventoryId,
      //   websiteId,
      //   winningBid.campaignId,
      //   costPerImpression,
      // );

      this.logger.log('✅ Budget reserved successfully', {
        reservationId,
        campaignId: winningBid.campaignId,
        amount: costPerImpression,
        ttl: RTB_CACHE_TTL.BUDGET_RESERVATION,
      });

      return { success: true, reservationId };
    } catch (error) {
      this.logger.error('❌ Budget reservation failed', {
        error: error.message,
        stack: error.stack,
        campaignId: winningBid.campaignId,
        costPerImpression,
        auctionId,
      });

      return {
        success: false,
        errorMessage: `Reservation failed: ${error.message}`,
      };
    }
  }

  /**
   * Confirm budget deduction when impression is actually served
   * This is the industry standard billing point
   */
  async confirmBudgetDeduction(
    bidResponseId: string,
    actualPrice?: number,
  ): Promise<BillingResult> {
    this.logger.debug('💰 Confirming budget deduction for impression', {
      bidResponseId,
      actualPrice,
    });

    try {
      // 1. Find and retrieve the reservation
      const reservation = await this.findAndRetrieveReservation(bidResponseId);

      if (!reservation) {
        this.logger.warn(
          'No reservation found, attempting immediate deduction',
          {
            bidResponseId,
          },
        );
        return await this.handleImmediateDeduction(bidResponseId, actualPrice);
      }

      // 2. Use reservation amount if actual price not provided
      const finalAmount = actualPrice || reservation.amount;

      // 3. Create permanent budget transaction in PostgreSQL
      const transactionId = await this.createBudgetTransaction({
        campaignId: reservation.campaignId,
        amount: finalAmount,
        type: 'IMPRESSION_COST',
        description: `Impression served for bid ${bidResponseId}`,
        bidResponseId: reservation.bidResponseId,
        metadata: {
          reservationId: reservation.reservationId,
          auctionId: reservation.auctionId,
          originalReservedAmount: reservation.amount,
        },
      });

      // 4. Update daily budget spend in PostgreSQL
      await this.updateDailyBudgetSpend(reservation.campaignId, finalAmount);

      // 5. Process revenue sharing
      await this.processRevenueSharing(reservation.reservationId, finalAmount);

      // 6. Clean up reservation
      await this.cleanupReservation(
        reservation.reservationId,
        reservation.campaignId,
      );

      // 7. Update Redis metrics
      await this.updateSuccessfulBillingMetrics(
        reservation.campaignId,
        finalAmount,
      );

      this.logger.log('✅ Budget deduction confirmed successfully', {
        campaignId: reservation.campaignId,
        bidResponseId,
        reservedAmount: reservation.amount,
        finalAmount,
        transactionId,
      });

      return { success: true, transactionId };
    } catch (error) {
      this.logger.error('❌ Budget deduction confirmation failed', {
        error: error.message,
        stack: error.stack,
        bidResponseId,
        actualPrice,
      });

      return {
        success: false,
        errorMessage: `Confirmation failed: ${error.message}`,
      };
    }
  }

  /**
   * ===============================================
   * HELPER METHODS
   * ===============================================
   */

  /**
   * Find and retrieve reservation for a bid response
   */
  private async findAndRetrieveReservation(
    bidResponseId: string,
  ): Promise<BudgetReservation | null> {
    try {
      // Search for reservation keys matching the bid response
      const reservationKeys = await this.redis.keys(
        `budget:reservation:${bidResponseId}_*`,
      );

      if (reservationKeys.length === 0) {
        return null;
      }

      // Get the first (and should be only) reservation
      const reservationKey = reservationKeys[0];
      const reservationData = await this.redis.get(reservationKey);

      if (!reservationData) {
        this.logger.warn('Reservation key exists but data is empty', {
          reservationKey,
          bidResponseId,
        });
        return null;
      }

      const reservation: BudgetReservation = JSON.parse(
        reservationData as string,
      );

      // Validate reservation is still valid
      if (reservation.status !== 'RESERVED') {
        this.logger.warn('Reservation found but not in RESERVED status', {
          reservationId: reservation.reservationId,
          status: reservation.status,
          bidResponseId,
        });
        return null;
      }

      return reservation;
    } catch (error) {
      this.logger.error('Error finding reservation', {
        error: error.message,
        bidResponseId,
      });
      return null;
    }
  }

  /**
   * Handle impression without proper reservation (fallback)
   */
  private async handleImmediateDeduction(
    bidResponseId: string,
    actualPrice?: number,
  ): Promise<BillingResult> {
    this.logger.debug('Handling immediate deduction (no reservation found)', {
      bidResponseId,
      actualPrice,
    });

    try {
      // 1. Get campaign info from bid response
      const bidResponse = await this.prisma.bidResponse.findUnique({
        where: { id: bidResponseId },
        select: {
          campaignId: true,
          bidPrice: true,
          finalPrice: true,
        },
      });

      if (!bidResponse) {
        this.logger.error('Bid response not found for immediate deduction', {
          bidResponseId,
        });
        return {
          success: false,
          errorMessage: 'Bid response not found',
        };
      }

      // 2. Determine final amount
      const finalAmount =
        actualPrice ||
        Number(bidResponse.finalPrice) ||
        Number(bidResponse.bidPrice);

      // 3. Check current budget availability
      const hasAvailableBudget = await this.validateBudgetAvailability(
        bidResponse.campaignId,
        finalAmount,
      );

      if (!hasAvailableBudget) {
        this.logger.warn('Budget not available for immediate deduction', {
          campaignId: bidResponse.campaignId,
          amount: finalAmount,
          bidResponseId,
        });
        return {
          success: false,
          errorMessage: 'Insufficient budget for immediate deduction',
        };
      }

      // 4. Create transaction immediately
      const transactionId = await this.createBudgetTransaction({
        campaignId: bidResponse.campaignId,
        amount: finalAmount,
        type: 'IMPRESSION_COST',
        description: `Immediate deduction for impression ${bidResponseId}`,
        bidResponseId,
        metadata: {
          type: 'immediate_deduction',
          reason: 'no_reservation_found',
        },
      });

      // 5. Update budgets
      await Promise.all([
        this.updateDailyBudgetSpend(bidResponse.campaignId, finalAmount),
        this.updateRedisBudgetSpend(bidResponse.campaignId, finalAmount),
      ]);

      this.logger.log('✅ Immediate budget deduction completed', {
        campaignId: bidResponse.campaignId,
        bidResponseId,
        amount: finalAmount,
        transactionId,
      });

      return { success: true, transactionId };
    } catch (error) {
      this.logger.error('❌ Immediate deduction failed', {
        error: error.message,
        bidResponseId,
        actualPrice,
      });

      return {
        success: false,
        errorMessage: `Immediate deduction failed: ${error.message}`,
      };
    }
  }

  /**
   * Validate budget availability
   */
  private async validateBudgetAvailability(
    campaignId: string,
    amount: number,
  ): Promise<boolean> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check PostgreSQL for authoritative budget data
      const [campaignBudget, dailyBudget] = await Promise.all([
        this.prisma.campaignBudget.findUnique({
          where: { campaignId },
          select: { dailyBudget: true, isExhausted: true },
        }),
        this.prisma.campaignDailyBudget.findUnique({
          where: { campaignId_date: { campaignId, date: today } },
          select: { remainingToday: true, isExhausted: true },
        }),
      ]);

      if (!campaignBudget || campaignBudget.isExhausted) {
        return false;
      }

      if (!dailyBudget || dailyBudget.isExhausted) {
        return false;
      }

      const remainingBudget = Number(dailyBudget.remainingToday);
      const hasEnoughBudget = remainingBudget >= amount;

      this.logger.debug('Budget validation result', {
        campaignId,
        requestedAmount: amount,
        remainingBudget,
        hasEnoughBudget,
      });

      return hasEnoughBudget;
    } catch (error) {
      this.logger.error('Budget validation failed', {
        error: error.message,
        campaignId,
        amount,
      });
      return false; // Fail safe
    }
  }

  /**
   * Create budget transaction record
   */
  private async createBudgetTransaction(data: {
    campaignId: string;
    amount: number;
    type: string;
    description: string;
    bidResponseId?: string;
    publisherId?: string;
    inventoryId?: string;
    metadata?: any;
  }): Promise<string> {
    try {
      const transaction = await this.prisma.budgetTransaction.create({
        data: {
          id: uuidv4(),
          campaignId: data.campaignId,
          type: data.type as any,
          amount: data.amount,
          description: data.description,
          publisherId: data.publisherId,
          inventoryId: data.inventoryId,
          createdAt: new Date(),
        },
      });

      // Store metadata separately if provided
      if (data.metadata) {
        await this.redis.set(
          `transaction:metadata:${transaction.id}`,
          JSON.stringify(data.metadata),
          86400, // 24 hours
        );
      }

      return transaction.id;
    } catch (error) {
      this.logger.error('Failed to create budget transaction', {
        error: error.message,
        data,
      });
      throw error;
    }
  }

  /**
   * Update daily budget spend in PostgreSQL
   */
  private async updateDailyBudgetSpend(
    campaignId: string,
    amount: number,
  ): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const updatedBudget = await this.prisma.campaignDailyBudget.update({
        where: { campaignId_date: { campaignId, date: today } },
        data: {
          spentToday: { increment: amount },
          remainingToday: { decrement: amount },
          lastUpdated: new Date(),
        },
      });

      // Check if budget is now exhausted
      if (Number(updatedBudget.remainingToday) <= 0) {
        await this.markBudgetExhausted(campaignId, today);
      }

      this.logger.debug('Daily budget updated', {
        campaignId,
        amount,
        newSpent: Number(updatedBudget.spentToday),
        newRemaining: Number(updatedBudget.remainingToday),
      });
    } catch (error) {
      this.logger.error('Failed to update daily budget spend', {
        error: error.message,
        campaignId,
        amount,
      });
      throw error;
    }
  }

  /**
   * Update Redis budget spend
   */
  private async updateRedisBudgetSpend(
    campaignId: string,
    amount: number,
  ): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];

      await this.redis.incrbyfloat(
        REDIS_KEYS.DAILY_BUDGET_SPEND(campaignId, today),
        amount,
      );

      this.logger.debug('Redis budget spend updated', {
        campaignId,
        amount,
        date: today,
      });
    } catch (error) {
      this.logger.error('Failed to update Redis budget spend', {
        error: error.message,
        campaignId,
        amount,
      });
      // Don't throw - Redis update is not critical
    }
  }

  /**
   * Mark budget as exhausted
   */
  private async markBudgetExhausted(
    campaignId: string,
    date: Date,
  ): Promise<void> {
    try {
      await Promise.all([
        // Update PostgreSQL
        this.prisma.campaignDailyBudget.update({
          where: { campaignId_date: { campaignId, date } },
          data: { isExhausted: true },
        }),
        // Update Redis
        this.redis.set(
          REDIS_KEYS.CAMPAIGN_STATUS(campaignId),
          'BUDGET_EXHAUSTED',
          86400, // 24 hours
        ),
      ]);

      this.logger.log('🚫 Campaign budget marked as exhausted', {
        campaignId,
        date: date.toISOString().split('T')[0],
      });
    } catch (error) {
      this.logger.error('Failed to mark budget as exhausted', {
        error: error.message,
        campaignId,
        date,
      });
    }
  }

  /**
   * ===============================================
   * REVENUE SHARING METHODS
   * ===============================================
   */

  /**
   * Store revenue metadata for later processing
   */
  private async storeRevenueMetadata(
    reservationId: string,
    publisherId: string,
    inventoryId: string,
    websiteId: string,
    campaignId: string,
    amount: number,
  ): Promise<void> {
    try {
      const metadata = {
        publisherId,
        inventoryId,
        websiteId,
        campaignId,
        amount,
        createdAt: new Date().toISOString(),
      };

      await this.redis.set(
        REDIS_KEYS.REVENUE_METADATA(reservationId),
        JSON.stringify(metadata),
        RTB_CACHE_TTL.REVENUE_METADATA, // 5 minutes longer than reservation
      );
    } catch (error) {
      this.logger.error('Failed to store revenue metadata', {
        error: error.message,
        reservationId,
      });
    }
  }

  /**
   * Process revenue sharing when impression is confirmed
   */
  private async processRevenueSharing(
    reservationId: string,
    finalAmount: number,
  ): Promise<void> {
    try {
      // Get revenue metadata
      const metadataRaw = await this.redis.get(
        `revenue:metadata:${reservationId}`,
      );
      if (!metadataRaw) {
        this.logger.warn('Revenue metadata not found', { reservationId });
        return;
      }

      const metadata = JSON.parse(metadataRaw as string);

      // Get publisher commission rate
      const commissionRate = await this.getPublisherCommissionRate(
        metadata.publisherId,
      );

      // Calculate revenue split
      const grossRevenue = finalAmount;
      const publisherShare = grossRevenue * commissionRate;
      const systemEarning = grossRevenue - publisherShare;

      // Store publisher revenue
      await this.recordPublisherRevenue({
        publisherId: metadata.publisherId,
        campaignId: metadata.campaignId,
        inventoryId: metadata.inventoryId,
        websiteId: metadata.websiteId,
        grossRevenue,
        commissionRate,
        netRevenue: publisherShare,
        eventType: 'IMPRESSION',
      });

      // Store system revenue
      await this.recordSystemRevenue({
        campaignId: metadata.campaignId,
        publisherId: metadata.publisherId,
        advertiserId: metadata.advertiserId,
        creativeId: metadata.creativeId,
        inventoryId: metadata.inventoryId,
        grossRevenue,
        publisherShare,
        systemEarning,
        commissionRate,
        eventType: 'IMPRESSION',
      });

      // Clean up metadata
      await this.redis.del(`revenue:metadata:${reservationId}`);

      this.logger.debug('✅ Revenue sharing processed', {
        reservationId,
        grossRevenue: finalAmount,
        publisherShare,
        systemEarning,
        commissionRate,
      });
    } catch (error) {
      this.logger.error('❌ Revenue sharing failed', {
        error: error.message,
        reservationId,
        finalAmount,
      });
    }
  }

  /**
   * Get publisher commission rate
   */
  private async getPublisherCommissionRate(
    publisherId: string,
  ): Promise<number> {
    try {
      // Try Redis cache first
      const cached = await this.redis.get(
        REDIS_KEYS.PUBLISHER_REVENUE_TIERS(publisherId),
      );

      if (cached) {
        return parseFloat(cached as string);
      }

      // Get from database
      const publisher = await this.prisma.publisher.findUnique({
        where: { id: publisherId },
        include: { tier: true },
      });

      const rate = publisher?.tier?.commissionRate
        ? Number(publisher.tier.commissionRate)
        : 0.4; // Default 40%

      // Cache for 1 hour
      await this.redis.set(
        REDIS_KEYS.PUBLISHER_REVENUE_TIERS(publisherId),
        rate.toString(),
        3600,
      );

      return rate;
    } catch (error) {
      this.logger.error('Failed to get publisher commission rate', {
        error: error.message,
        publisherId,
      });
      return 0.4; // Default fallback
    }
  }

  /**
   * Record publisher revenue
   */
  private async recordPublisherRevenue(data: {
    publisherId: string;
    campaignId: string;
    inventoryId: string;
    websiteId: string;
    grossRevenue: number;
    commissionRate: number;
    netRevenue: number;
    eventType: string;
  }): Promise<void> {
    try {
      // Store in Redis queue for batch processing
      await this.redis.rpush(
        REDIS_KEYS.PUBLISHER_REVENUE_PENDING,
        JSON.stringify({
          ...data,
          createdAt: new Date().toISOString(),
        }),
      );

      this.logger.debug('Publisher revenue queued', {
        publisherId: data.publisherId,
        amount: data.netRevenue,
      });
    } catch (error) {
      this.logger.error('Failed to record publisher revenue', {
        error: error.message,
        data,
      });
    }
  }

  /**
   * Record system revenue
   */
  private async recordSystemRevenue(data: {
    campaignId: string;
    publisherId: string;
    advertiserId: string;
    creativeId: string;
    inventoryId: string;
    grossRevenue: number;
    publisherShare: number;
    systemEarning: number;
    commissionRate: number;
    eventType: string;
  }): Promise<void> {
    try {
      // Store in Redis queue for batch processing
      await this.redis.rpush(
        REDIS_KEYS.SYSTEM_REVENUE_PENDING,
        JSON.stringify({
          ...data,
          createdAt: new Date().toISOString(),
        }),
      );

      this.logger.debug('System revenue queued', {
        campaignId: data.campaignId,
        systemEarning: data.systemEarning,
      });
    } catch (error) {
      this.logger.error('Failed to record system revenue', {
        error: error.message,
        data,
      });
    }
  }

  /**
   * ===============================================
   * CLEANUP AND MAINTENANCE
   * ===============================================
   */

  /**
   * Clean up confirmed reservation
   */
  private async cleanupReservation(
    reservationId: string,
    campaignId: string,
  ): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();

      // Remove reservation
      pipeline.del(`budget:reservation:${reservationId}`);

      // Remove from tracking set
      const today = new Date().toISOString().split('T')[0];
      pipeline.srem(
        `budget:reservations:${today}:${campaignId}`,
        reservationId,
      );

      await pipeline.exec();

      this.logger.debug('Reservation cleaned up', { reservationId });
    } catch (error) {
      this.logger.error('Failed to cleanup reservation', {
        error: error.message,
        reservationId,
      });
    }
  }

  /**
   * Cleanup expired reservations (should run periodically)
   */
  async cleanupExpiredReservations(): Promise<{
    cleanedCount: number;
    reversedAmount: number;
  }> {
    this.logger.debug('🧹 Starting expired reservations cleanup');

    try {
      const reservationKeys = await this.redis.keys('budget:reservation:*');
      let cleanedCount = 0;
      let reversedAmount = 0;

      for (const key of reservationKeys) {
        try {
          const ttl = await this.redis.ttl(key);

          if (ttl <= 0) {
            // Reservation expired - reverse the temporary deduction
            const reservationData = await this.redis.get(key);

            if (reservationData) {
              const reservation: BudgetReservation = JSON.parse(
                reservationData as string,
              );

              // Reverse the temporary Redis deduction
              const today = new Date().toISOString().split('T')[0];
              await this.redis.incrbyfloat(
                REDIS_KEYS.DAILY_BUDGET_SPEND(reservation.campaignId, today),
                -reservation.amount,
              );

              reversedAmount += reservation.amount;

              this.logger.debug('Reversed expired reservation', {
                reservationId: reservation.reservationId,
                campaignId: reservation.campaignId,
                amount: reservation.amount,
              });
            }

            // Remove expired reservation
            await this.redis.del(key);
            cleanedCount++;
          }
        } catch (keyError) {
          this.logger.warn('Error processing reservation key', {
            error: keyError.message,
            key,
          });
        }
      }

      if (cleanedCount > 0) {
        this.logger.log(`🧹 Cleaned up ${cleanedCount} expired reservations`, {
          reversedAmount,
        });
      }

      return { cleanedCount, reversedAmount };
    } catch (error) {
      this.logger.error('Failed to cleanup expired reservations', {
        error: error.message,
      });
      return { cleanedCount: 0, reversedAmount: 0 };
    }
  }

  /**
   * Update successful billing metrics
   */
  private async updateSuccessfulBillingMetrics(
    campaignId: string,
    amount: number,
  ): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const hour = new Date().getHours();

      const pipeline = this.redis.pipeline();

      // Daily metrics
      pipeline.incr(`billing:success:${campaignId}:${today}`);
      pipeline.incrbyfloat(`billing:amount:${campaignId}:${today}`, amount);

      // Hourly metrics
      pipeline.incr(`billing:success:hourly:${today}:${hour}`);
      pipeline.incrbyfloat(`billing:amount:hourly:${today}:${hour}`, amount);

      // Set expiration
      pipeline.expire(`billing:success:${campaignId}:${today}`, 86400 * 7);
      pipeline.expire(`billing:amount:${campaignId}:${today}`, 86400 * 7);
      pipeline.expire(`billing:success:hourly:${today}:${hour}`, 86400 * 7);
      pipeline.expire(`billing:amount:hourly:${today}:${hour}`, 86400 * 7);

      await pipeline.exec();
    } catch (error) {
      this.logger.error('Failed to update billing metrics', {
        error: error.message,
        campaignId,
        amount,
      });
    }
  }

  /**
   * ===============================================
   * PUBLISHER TIER MANAGEMENT
   * ===============================================
   */

  /**
   * Sync publisher revenue tiers to Redis
   */
  async syncPublisherRevenueTiers(): Promise<void> {
    try {
      this.logger.log('🔄 Syncing publisher revenue tiers to Redis');

      const publishers = await this.prisma.publisher.findMany({
        where: { status: 'ACTIVE' },
        include: { tier: true },
      });

      const pipeline = this.redis.pipeline();

      for (const publisher of publishers) {
        const commissionRate = publisher.tier?.commissionRate
          ? Number(publisher.tier.commissionRate)
          : 0.4; // Default 40%

        pipeline.setex(
          REDIS_KEYS.PUBLISHER_REVENUE_TIERS(publisher.id),
          86400 * 30, // 30 days
          commissionRate.toString(),
        );
      }

      await pipeline.exec();

      this.logger.log(
        `✅ Synced ${publishers.length} publisher tiers to Redis`,
      );
    } catch (error) {
      this.logger.error('Failed to sync publisher revenue tiers', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * ===============================================
   * REPORTING AND ANALYTICS
   * ===============================================
   */

  /**
   * Get billing discrepancy report for monitoring
   */
  async getBillingDiscrepancyReport(
    campaignId?: string,
    date?: string,
  ): Promise<{
    totalReservations: number;
    totalReservedAmount: number;
    confirmedImpressions: number;
    confirmedAmount: number;
    discrepancyPercentage: number;
    expiredReservations: number;
    expiredAmount: number;
  }> {
    try {
      const reportDate = date || new Date().toISOString().split('T')[0];

      let totalReservations = 0;
      let totalReservedAmount = 0;
      let expiredReservations = 0;
      let expiredAmount = 0;

      // Count current reservations
      const reservationKeys = await this.redis.keys('budget:reservation:*');

      for (const key of reservationKeys) {
        try {
          const reservationData = await this.redis.get(key);
          if (reservationData) {
            const reservation: BudgetReservation = JSON.parse(
              reservationData as string,
            );

            // Filter by campaign if specified
            if (campaignId && reservation.campaignId !== campaignId) {
              continue;
            }

            // Filter by date if specified
            if (date) {
              const reservationDate = new Date(reservation.reservedAt)
                .toISOString()
                .split('T')[0];
              if (reservationDate !== reportDate) {
                continue;
              }
            }

            totalReservations++;
            totalReservedAmount += reservation.amount;

            // Check if expired
            const ttl = await this.redis.ttl(key);
            if (ttl <= 0) {
              expiredReservations++;
              expiredAmount += reservation.amount;
            }
          }
        } catch (keyError) {
          this.logger.warn('Error processing reservation for report', {
            error: keyError.message,
            key,
          });
        }
      }

      // Count confirmed impressions from database
      const whereClause: any = {
        type: 'IMPRESSION_COST',
        createdAt: {
          gte: new Date(`${reportDate}T00:00:00.000Z`),
          lt: new Date(`${reportDate}T23:59:59.999Z`),
        },
      };

      if (campaignId) {
        whereClause.campaignId = campaignId;
      }

      const confirmedTransactions =
        await this.prisma.budgetTransaction.aggregate({
          where: whereClause,
          _sum: { amount: true },
          _count: { id: true },
        });

      const confirmedAmount = Number(confirmedTransactions._sum.amount || 0);
      const confirmedImpressions = confirmedTransactions._count.id;

      // Calculate discrepancy
      const totalExpected = totalReservedAmount + confirmedAmount;
      const discrepancyPercentage =
        totalExpected > 0
          ? Math.round((totalReservedAmount / totalExpected) * 10000) / 100
          : 0;

      const report = {
        totalReservations,
        totalReservedAmount: Math.round(totalReservedAmount * 100) / 100,
        confirmedImpressions,
        confirmedAmount: Math.round(confirmedAmount * 100) / 100,
        discrepancyPercentage,
        expiredReservations,
        expiredAmount: Math.round(expiredAmount * 100) / 100,
      };

      this.logger.debug('Billing discrepancy report generated', {
        campaignId,
        date: reportDate,
        report,
      });

      return report;
    } catch (error) {
      this.logger.error('Failed to generate billing discrepancy report', {
        error: error.message,
        campaignId,
        date,
      });

      return {
        totalReservations: 0,
        totalReservedAmount: 0,
        confirmedImpressions: 0,
        confirmedAmount: 0,
        discrepancyPercentage: 0,
        expiredReservations: 0,
        expiredAmount: 0,
      };
    }
  }

  /**
   * Get campaign budget health metrics
   */
  async getCampaignBudgetHealth(campaignId: string): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    dailyBudget: number;
    spentToday: number;
    remainingToday: number;
    utilizationPercentage: number;
    reservedAmount: number;
    availableForBidding: number;
    projectedExhaustionTime?: string;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get budget data from PostgreSQL
      const [campaignBudget, dailyBudget] = await Promise.all([
        this.prisma.campaignBudget.findUnique({
          where: { campaignId },
          select: { dailyBudget: true, isExhausted: true },
        }),
        this.prisma.campaignDailyBudget.findUnique({
          where: { campaignId_date: { campaignId, date: today } },
          select: {
            spentToday: true,
            remainingToday: true,
            isExhausted: true,
          },
        }),
      ]);

      if (!campaignBudget || !dailyBudget) {
        return {
          status: 'critical',
          dailyBudget: 0,
          spentToday: 0,
          remainingToday: 0,
          utilizationPercentage: 0,
          reservedAmount: 0,
          availableForBidding: 0,
        };
      }

      const dailyBudgetAmount = Number(campaignBudget.dailyBudget);
      const spentToday = Number(dailyBudget.spentToday);
      const remainingToday = Number(dailyBudget.remainingToday);

      // Get reserved amount
      const reservedAmount =
        await this.getReservedAmountForCampaign(campaignId);

      // Calculate metrics
      const utilizationPercentage =
        dailyBudgetAmount > 0 ? (spentToday / dailyBudgetAmount) * 100 : 0;

      const availableForBidding = Math.max(0, remainingToday - reservedAmount);

      // Determine status
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (dailyBudget.isExhausted || availableForBidding <= 0) {
        status = 'critical';
      } else if (
        utilizationPercentage > 80 ||
        availableForBidding < dailyBudgetAmount * 0.1
      ) {
        status = 'warning';
      }

      // Project exhaustion time (if spending rate continues)
      let projectedExhaustionTime: string | undefined;
      if (status !== 'critical' && spentToday > 0) {
        const currentHour = new Date().getHours();
        const hoursElapsed = currentHour > 0 ? currentHour : 1;
        const hourlySpendRate = spentToday / hoursElapsed;

        if (hourlySpendRate > 0) {
          const hoursToExhaustion = availableForBidding / hourlySpendRate;
          const exhaustionTime = new Date();
          exhaustionTime.setHours(
            exhaustionTime.getHours() + hoursToExhaustion,
          );
          projectedExhaustionTime = exhaustionTime.toISOString();
        }
      }

      return {
        status,
        dailyBudget: dailyBudgetAmount,
        spentToday,
        remainingToday,
        utilizationPercentage: Math.round(utilizationPercentage * 100) / 100,
        reservedAmount,
        availableForBidding,
        projectedExhaustionTime,
      };
    } catch (error) {
      this.logger.error('Failed to get campaign budget health', {
        error: error.message,
        campaignId,
      });

      return {
        status: 'critical',
        dailyBudget: 0,
        spentToday: 0,
        remainingToday: 0,
        utilizationPercentage: 0,
        reservedAmount: 0,
        availableForBidding: 0,
      };
    }
  }

  /**
   * Get reserved amount for a specific campaign
   */
  private async getReservedAmountForCampaign(
    campaignId: string,
  ): Promise<number> {
    try {
      const reservationKeys = await this.redis.keys('budget:reservation:*');
      let totalReserved = 0;

      for (const key of reservationKeys) {
        try {
          const reservationData = await this.redis.get(key);
          if (reservationData) {
            const reservation: BudgetReservation = JSON.parse(
              reservationData as string,
            );
            if (
              reservation.campaignId === campaignId &&
              reservation.status === 'RESERVED'
            ) {
              totalReserved += reservation.amount;
            }
          }
        } catch (keyError) {
          // Skip invalid keys
          continue;
        }
      }

      return totalReserved;
    } catch (error) {
      this.logger.error('Failed to get reserved amount for campaign', {
        error: error.message,
        campaignId,
      });
      return 0;
    }
  }

  /**
   * ===============================================
   * SYSTEM HEALTH AND MONITORING
   * ===============================================
   */

  /**
   * Get overall budget system health
   */
  async getSystemBudgetHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    activeCampaigns: number;
    campaignsWithIssues: number;
    totalReservations: number;
    totalReservedAmount: number;
    averageDiscrepancy: number;
    expiredReservationsCount: number;
  }> {
    try {
      // Get active campaigns
      const activeCampaigns = await this.prisma.campaign.count({
        where: { status: 'ACTIVE' },
      });

      // Get campaigns with budget issues
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const campaignsWithIssues = await this.prisma.campaignDailyBudget.count({
        where: {
          date: today,
          OR: [{ isExhausted: true }, { remainingToday: { lte: 0 } }],
        },
      });

      // Get reservation metrics
      const reservationKeys = await this.redis.keys('budget:reservation:*');
      let totalReservations = 0;
      let totalReservedAmount = 0;
      let expiredReservationsCount = 0;

      for (const key of reservationKeys) {
        try {
          const reservationData = await this.redis.get(key);
          const ttl = await this.redis.ttl(key);

          if (reservationData) {
            const reservation: BudgetReservation = JSON.parse(
              reservationData as string,
            );
            totalReservations++;
            totalReservedAmount += reservation.amount;

            if (ttl <= 0) {
              expiredReservationsCount++;
            }
          }
        } catch (keyError) {
          continue;
        }
      }

      // Calculate average discrepancy (simplified)
      const averageDiscrepancy =
        totalReservations > 0
          ? (expiredReservationsCount / totalReservations) * 100
          : 0;

      // Determine overall status
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';

      if (activeCampaigns === 0) {
        status = 'critical';
      } else {
        const issuePercentage = (campaignsWithIssues / activeCampaigns) * 100;
        const expiredPercentage =
          totalReservations > 0
            ? (expiredReservationsCount / totalReservations) * 100
            : 0;

        if (issuePercentage > 20 || expiredPercentage > 10) {
          status = 'critical';
        } else if (issuePercentage > 10 || expiredPercentage > 5) {
          status = 'warning';
        }
      }

      return {
        status,
        activeCampaigns,
        campaignsWithIssues,
        totalReservations,
        totalReservedAmount: Math.round(totalReservedAmount * 100) / 100,
        averageDiscrepancy: Math.round(averageDiscrepancy * 100) / 100,
        expiredReservationsCount,
      };
    } catch (error) {
      this.logger.error('Failed to get system budget health', {
        error: error.message,
      });

      return {
        status: 'critical',
        activeCampaigns: 0,
        campaignsWithIssues: 0,
        totalReservations: 0,
        totalReservedAmount: 0,
        averageDiscrepancy: 0,
        expiredReservationsCount: 0,
      };
    }
  }

  /**
   * ===============================================
   * LEGACY METHOD COMPATIBILITY
   * ===============================================
   */

  /**
   * Legacy method for backward compatibility
   * @deprecated Use reserveBudgetOnWin instead
   */
  async deductBudgetOnWin(
    winningBid: any,
    publisherId: string,
    inventoryId: string,
    websiteId: string,
    finalPrice: number,
  ): Promise<void> {
    this.logger.warn(
      '⚠️ Using deprecated deductBudgetOnWin method. Use reserveBudgetOnWin instead.',
    );

    const result = await this.reserveBudgetOnWin(
      winningBid,
      publisherId,
      inventoryId,
      websiteId,
      finalPrice,
    );

    if (!result.success) {
      throw new Error(result.errorMessage || 'Budget deduction failed');
    }
  }

  /**
   * ===============================================
   * SCHEDULED CLEANUP JOBS
   * ===============================================
   */

  /**
   * Daily budget reset (should be called by scheduled job)
   */
  async performDailyBudgetReset(): Promise<{
    success: boolean;
    campaignsReset: number;
    errors: string[];
  }> {
    this.logger.log('🔄 Starting daily budget reset');

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get all active campaigns
      const activeCampaigns = await this.prisma.campaign.findMany({
        where: {
          status: 'ACTIVE',
          startDate: { lte: today },
          endDate: { gte: today },
        },
        include: { campaignBudget: true },
      });

      const errors: string[] = [];
      let campaignsReset = 0;

      // Process each campaign
      for (const campaign of activeCampaigns) {
        try {
          if (!campaign.campaignBudget) {
            errors.push(`Campaign ${campaign.id} has no budget configuration`);
            continue;
          }

          const dailyBudgetAmount = Number(campaign.campaignBudget.dailyBudget);

          // Create or reset daily budget
          await this.prisma.campaignDailyBudget.upsert({
            where: {
              campaignId_date: {
                campaignId: campaign.id,
                date: today,
              },
            },
            create: {
              campaignId: campaign.id,
              date: today,
              spentToday: 0,
              remainingToday: dailyBudgetAmount,
              isExhausted: false,
            },
            update: {
              spentToday: 0,
              remainingToday: dailyBudgetAmount,
              isExhausted: false,
              lastUpdated: new Date(),
            },
          });

          // Reset Redis budget data
          const todayStr = today.toISOString().split('T')[0];
          await Promise.all([
            this.redis.set(
              REDIS_KEYS.DAILY_BUDGET_SPEND(campaign.id, todayStr),
              '0',
              86400,
            ),
            this.redis.set(
              REDIS_KEYS.CAMPAIGN_STATUS(campaign.id),
              'ACTIVE',
              86400,
            ),
          ]);

          campaignsReset++;
        } catch (campaignError) {
          const errorMsg = `Failed to reset budget for campaign ${campaign.id}: ${campaignError.message}`;
          errors.push(errorMsg);
          this.logger.error(errorMsg);
        }
      }

      // Cleanup expired reservations
      await this.cleanupExpiredReservations();

      const success = errors.length === 0;

      this.logger.log('✅ Daily budget reset completed', {
        success,
        campaignsReset,
        errorsCount: errors.length,
      });

      return { success, campaignsReset, errors };
    } catch (error) {
      this.logger.error('❌ Daily budget reset failed', {
        error: error.message,
      });

      return {
        success: false,
        campaignsReset: 0,
        errors: [`Daily reset failed: ${error.message}`],
      };
    }
  }

  /**
   * ===============================================
   * UTILITY METHODS
   * ===============================================
   */

  /**
   * Manual budget adjustment (admin function)
   */
  async adjustCampaignBudget(
    campaignId: string,
    adjustment: number,
    reason: string,
    adminId?: string,
  ): Promise<{ success: boolean; newBalance: number }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create adjustment transaction
      const transactionId = await this.createBudgetTransaction({
        campaignId,
        amount: adjustment,
        type: adjustment > 0 ? 'CREDIT' : 'DEBIT',
        description: `Manual adjustment: ${reason}`,
        metadata: {
          adjustedBy: adminId,
          reason,
          type: 'manual_adjustment',
        },
      });

      // Update daily budget
      const updatedBudget = await this.prisma.campaignDailyBudget.update({
        where: { campaignId_date: { campaignId, date: today } },
        data: {
          remainingToday: { increment: adjustment },
          lastUpdated: new Date(),
        },
      });

      // Update Redis
      const todayStr = today.toISOString().split('T')[0];
      await this.redis.incrbyfloat(
        REDIS_KEYS.DAILY_BUDGET_SPEND(campaignId, todayStr),
        -adjustment, // Opposite of adjustment for spend tracking
      );

      this.logger.log('✅ Manual budget adjustment completed', {
        campaignId,
        adjustment,
        reason,
        transactionId,
        newBalance: Number(updatedBudget.remainingToday),
      });

      return {
        success: true,
        newBalance: Number(updatedBudget.remainingToday),
      };
    } catch (error) {
      this.logger.error('❌ Manual budget adjustment failed', {
        error: error.message,
        campaignId,
        adjustment,
        reason,
      });

      return { success: false, newBalance: 0 };
    }
  }

  /**
   * Emergency budget freeze (stops all bidding for a campaign)
   */
  async emergencyBudgetFreeze(
    campaignId: string,
    reason: string,
    adminId?: string,
  ): Promise<boolean> {
    try {
      // Mark as budget exhausted in both PostgreSQL and Redis
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await Promise.all([
        this.prisma.campaignDailyBudget.update({
          where: { campaignId_date: { campaignId, date: today } },
          data: { isExhausted: true },
        }),
        this.redis.set(
          REDIS_KEYS.CAMPAIGN_STATUS(campaignId),
          'BUDGET_EXHAUSTED',
          86400,
        ),
      ]);

      // Log the freeze
      await this.createBudgetTransaction({
        campaignId,
        amount: 0,
        type: 'FREEZE',
        description: `Emergency budget freeze: ${reason}`,
        metadata: {
          frozenBy: adminId,
          reason,
          type: 'emergency_freeze',
        },
      });

      this.logger.log('🚨 Emergency budget freeze activated', {
        campaignId,
        reason,
        adminId,
      });

      return true;
    } catch (error) {
      this.logger.error('❌ Emergency budget freeze failed', {
        error: error.message,
        campaignId,
        reason,
      });
      return false;
    }
  }
}
