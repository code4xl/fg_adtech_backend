// src/tracking/services/postgres-timescale-sync.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { TimescaleService } from '../../timescale/timescale.service';
import { RedisService } from '../../redis/redis.service';
import { v4 as uuidv4 } from 'uuid';

export interface PostgresTimescaleSyncResult {
  success: boolean;
  processedCount: number;
  errors?: any[];
  processingTimeMs: number;
  batchId: string;
}

export interface SyncStatus {
  impressionsLastSync: Date;
  clicksLastSync: Date;
  totalImpressionsSynced: number;
  totalClicksSynced: number;
  isRunning: boolean;
  circuitBreakerOpen: boolean;
}

@Injectable()
export class PostgresTimescaleSyncService {
  private readonly logger = new Logger(PostgresTimescaleSyncService.name);

  // Circuit breaker for fault tolerance
  private circuitBreaker = {
    isOpen: false,
    failureCount: 0,
    lastFailureTime: null as Date | null,
    threshold: 5, // failures before opening circuit
    timeout: 30000, // 30 seconds before retry
  };

  // Sync status tracking
  private syncStatus: SyncStatus = {
    impressionsLastSync: new Date(),
    clicksLastSync: new Date(),
    totalImpressionsSynced: 0,
    totalClicksSynced: 0,
    isRunning: false,
    circuitBreakerOpen: false,
  };

  // Processing configuration
  private readonly config = {
    batchSize: 5000,
    maxRetries: 3,
    retryDelayMs: 1000,
    minAgeMinutes: 5, // Only sync data older than 5 minutes
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly timescale: TimescaleService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Main cron job - Sync data from PostgreSQL to TimescaleDB every 12 hours
   */
  // @Cron(CronExpression.EVERY_12_HOURS) // Every 12 hours
  @Cron('*/15 * * * *') // Every 15 minutes
  async syncPostgresToTimescale(): Promise<void> {
    if (this.syncStatus.isRunning) {
      this.logger.warn('⚠️ Sync already running, skipping this execution');
      return;
    }

    if (this.circuitBreaker.isOpen) {
      if (this.shouldRetryAfterCircuitBreaker()) {
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.failureCount = 0;
        this.syncStatus.circuitBreakerOpen = false;
        this.logger.debug(
          '🔄 Circuit breaker reset, retrying TimescaleDB sync',
        );
      } else {
        this.logger.warn('⚠️ Circuit breaker open, skipping TimescaleDB sync');
        return;
      }
    }

    this.syncStatus.isRunning = true;
    const syncId = uuidv4();

    this.logger.debug('🔄 Starting PostgreSQL → TimescaleDB sync', {
      syncId,
      timestamp: new Date().toISOString(),
    });

    try {
      // Sync impressions first, then clicks
      const impressionResult = await this.syncImpressions(syncId);
      const clickResult = await this.syncClicks(syncId);

      // Update Redis with sync status
      await this.updateSyncStatusInRedis({
        impressions: impressionResult,
        clicks: clickResult,
        timestamp: new Date(),
      });

      this.logger.debug(' PostgreSQL → TimescaleDB sync completed', {
        syncId,
        impressionsProcessed: impressionResult.processedCount,
        clicksProcessed: clickResult.processedCount,
        totalTime:
          impressionResult.processingTimeMs + clickResult.processingTimeMs,
      });
    } catch (error) {
      this.handleSyncError(error, syncId);
    } finally {
      this.syncStatus.isRunning = false;
    }
  }

  /**
   * Sync impressions from PostgreSQL to TimescaleDB
   */
  private async syncImpressions(
    syncId: string,
  ): Promise<PostgresTimescaleSyncResult> {
    const startTime = Date.now();
    const batchId = `${syncId}-impressions`;

    this.logger.debug('🔄 Starting impressions sync to TimescaleDB', {
      batchId,
    });

    try {
      // Get unsynced impressions from PostgreSQL
      const unsyncedImpressions = await this.getUnsyncedImpressions();

      if (unsyncedImpressions.length === 0) {
        this.logger.debug(' No unsynced impressions found');
        return {
          success: true,
          processedCount: 0,
          processingTimeMs: Date.now() - startTime,
          batchId,
        };
      }

      this.logger.debug(
        `📊 Found ${unsyncedImpressions.length} unsynced impressions`,
        { batchId },
      );

      // Transform data for TimescaleDB format
      const timescaleData =
        this.transformImpressionsForTimescale(unsyncedImpressions);

      // Insert to TimescaleDB using direct SQL query
      const insertedCount = await this.bulkInsertImpressions(timescaleData);

      // Mark as synced in PostgreSQL
      await this.markImpressionsSynced(unsyncedImpressions.map((i) => i.id));

      // Update sync status
      this.syncStatus.impressionsLastSync = new Date();
      this.syncStatus.totalImpressionsSynced += insertedCount;

      // Reset circuit breaker on success
      this.circuitBreaker.failureCount = 0;

      return {
        success: true,
        processedCount: insertedCount,
        processingTimeMs: Date.now() - startTime,
        batchId,
      };
    } catch (error) {
      this.logger.error('❌ Impressions sync failed:', {
        error: error.message,
        batchId,
      });
      throw error;
    }
  }

  /**
   * Sync clicks from PostgreSQL to TimescaleDB
   */
  private async syncClicks(
    syncId: string,
  ): Promise<PostgresTimescaleSyncResult> {
    const startTime = Date.now();
    const batchId = `${syncId}-clicks`;

    this.logger.debug('🔄 Starting clicks sync to TimescaleDB', { batchId });

    try {
      // Get unsynced clicks from PostgreSQL
      const unsyncedClicks = await this.getUnsyncedClicks();

      if (unsyncedClicks.length === 0) {
        this.logger.debug(' No unsynced clicks found');
        return {
          success: true,
          processedCount: 0,
          processingTimeMs: Date.now() - startTime,
          batchId,
        };
      }

      this.logger.debug(`📊 Found ${unsyncedClicks.length} unsynced clicks`, {
        batchId,
      });

      // Transform data for TimescaleDB format
      const timescaleData = this.transformClicksForTimescale(unsyncedClicks);

      // Insert to TimescaleDB using direct SQL query
      const insertedCount = await this.bulkInsertClicks(timescaleData);

      // Mark as synced in PostgreSQL
      await this.markClicksSynced(unsyncedClicks.map((c) => c.id));

      // Update sync status
      this.syncStatus.clicksLastSync = new Date();
      this.syncStatus.totalClicksSynced += insertedCount;

      // Reset circuit breaker on success
      this.circuitBreaker.failureCount = 0;

      return {
        success: true,
        processedCount: insertedCount,
        processingTimeMs: Date.now() - startTime,
        batchId,
      };
    } catch (error) {
      this.logger.error('❌ Clicks sync failed:', {
        error: error.message,
        batchId,
      });
      throw error;
    }
  }

  /**
   * Get unsynced impressions from PostgreSQL
   */
  private async getUnsyncedImpressions(): Promise<any[]> {
    const cutoffTime = new Date(
      Date.now() - this.config.minAgeMinutes * 60 * 1000,
    );

    let data = await this.prisma.impressionEvent.findMany({
      where: {
        syncedToTimescale: false,
      },
      take: this.config.batchSize,
      orderBy: { createdAt: 'asc' },
    });

    this.logger.debug('Impresssionssss from postgresql', {
      data,
    });

    return data;
  }

  /**
   * Get unsynced clicks from PostgreSQL
   */
  private async getUnsyncedClicks(): Promise<any[]> {
    const cutoffTime = new Date(
      Date.now() - this.config.minAgeMinutes * 60 * 1000,
    );

    let data = await this.prisma.clickEvent.findMany({
      where: {
        syncedToTimescale: false,
      },
      take: this.config.batchSize,
      orderBy: { createdAt: 'asc' },
    });

    this.logger.debug('Clickss from postgresql', {
      data,
    });

    return data;
  }

  /**
   * Transform impression data for TimescaleDB format (matching your schema)
   */
  private transformImpressionsForTimescale(impressions: any[]): any[] {
    this.logger.debug('Impression Data from Postgresql', {
      impressions,
    });

    return impressions.map((impression) => ({
      id: impression.id,
      creative_id: impression.creativeId,
      bid_response_id: impression.bidResponseId,
      campaign_id: impression.campaignId,
      advertiser_id: impression.advertiserId,
      inventory_id: impression.inventoryId,
      publisher_id: impression.publisherId,
      website_id: impression.websiteId,
      template_id: impression.templateId,
      bid_price: impression.bidPrice,
      final_price: impression.finalPrice,
      timestamp: impression.timestamp || impression.createdAt,
      user_agent: impression.userAgent,
      ip_address: impression.ipAddress,
      device_type: impression.deviceType,
      country: impression.country,
      region: impression.region,
      city: impression.city,
      viewable: impression.viewable,
      view_time: impression.viewTime,
      is_bot: impression.isBot,
      fraud_score: impression.fraudScore,
      slot_id: impression.slotId,
      user_fingerprint: impression.userFingerprint,
      synced_to_timescale: true,
      synced_at: new Date(),
      created_at: impression.createdAt,
    }));
  }

  /**
   * Transform click data for TimescaleDB format (matching your schema)
   */
  private transformClicksForTimescale(clicks: any[]): any[] {
    this.logger.debug('Click Data from postgresql', {
      clicks,
    });

    return clicks.map((click) => ({
      id: click.id,
      impression_id: click.impressionId,
      creative_id: click.creativeId,
      bid_response_id: click.bidResponseId,
      campaign_id: click.campaignId,
      advertiser_id: click.advertiserId,
      inventory_id: click.inventoryId,
      publisher_id: click.publisherId,
      website_id: click.websiteId,
      template_id: click.templateId,
      timestamp: click.timestamp || click.createdAt,
      user_agent: click.userAgent,
      ip_address: click.ipAddress,
      device_type: click.deviceType,
      landing_url: click.landingUrl,
      is_bot: click.isBot,
      fraud_score: click.fraudScore,
      time_from_impression: click.timeFromImpression,
      country: click.country,
      region: click.region,
      city: click.city,
      slot_id: click.slotId,
      user_fingerprint: click.userFingerprint,
      synced_to_timescale: true,
      synced_at: new Date(),
      created_at: click.createdAt,
    }));
  }

  /**
   * Bulk insert impressions to TimescaleDB using direct SQL
   */
  private async bulkInsertImpressions(impressions: any[]): Promise<number> {
    if (impressions.length === 0) return 0;

    const values = impressions
      .map(
        (imp) => `(
            '${imp.id}',
            '${imp.creative_id}',
            '${imp.bid_response_id}',
            '${imp.campaign_id}',
            '${imp.advertiser_id}',
            '${imp.inventory_id}',
            '${imp.publisher_id}',
            '${imp.website_id}',
            ${imp.template_id ? `'${imp.template_id}'` : 'NULL'},
            ${imp.bid_price || 'NULL'},
            ${imp.final_price || 'NULL'},
            '${imp.timestamp.toISOString()}',
            ${imp.user_agent ? `'${imp.user_agent.replace(/'/g, "''")}'` : 'NULL'},
            ${imp.ip_address ? `'${imp.ip_address}'` : 'NULL'},
            ${imp.device_type ? `'${imp.device_type}'` : 'NULL'},
            ${imp.country ? `'${imp.country}'` : 'NULL'},
            ${imp.region ? `'${imp.region}'` : 'NULL'},
            ${imp.city ? `'${imp.city}'` : 'NULL'},
            ${imp.viewable},
            ${imp.view_time},
            ${imp.is_bot},
            ${imp.fraud_score},
            ${imp.slot_id ? `'${imp.slot_id}'` : 'NULL'},
            ${imp.user_fingerprint ? `'${imp.user_fingerprint}'` : 'NULL'},
            true,
            '${imp.synced_at.toISOString()}',
            '${imp.created_at.toISOString()}'
        )`,
      )
      .join(',');

    const insertQuery = `
            INSERT INTO impression_events (
                id, creative_id, bid_response_id, campaign_id, advertiser_id,
                inventory_id, publisher_id, website_id, template_id, bid_price,
                final_price, timestamp, user_agent, ip_address, device_type,
                country, region, city, viewable, view_time, is_bot, fraud_score,
                slot_id, user_fingerprint, synced_to_timescale, synced_at, created_at
            ) VALUES ${values}
            ON CONFLICT (timestamp, id) DO NOTHING
        `;

    const result = await this.timescale.query(insertQuery);
    return result.rowCount || 0;
  }

  /**
   * Bulk insert clicks to TimescaleDB using direct SQL
   */
  private async bulkInsertClicks(clicks: any[]): Promise<number> {
    if (clicks.length === 0) return 0;

    const values = clicks
      .map(
        (click) => `(
            '${click.id}',
            ${click.impression_id ? `'${click.impression_id}'` : 'NULL'},
            '${click.creative_id}',
            '${click.bid_response_id}',
            '${click.campaign_id}',
            '${click.advertiser_id}',
            '${click.inventory_id}',
            '${click.publisher_id}',
            '${click.website_id}',
            ${click.template_id ? `'${click.template_id}'` : 'NULL'},
            '${click.timestamp.toISOString()}',
            ${click.user_agent ? `'${click.user_agent.replace(/'/g, "''")}'` : 'NULL'},
            ${click.ip_address ? `'${click.ip_address}'` : 'NULL'},
            ${click.device_type ? `'${click.device_type}'` : 'NULL'},
            ${click.landing_url ? `'${click.landing_url}'` : 'NULL'},
            ${click.is_bot},
            ${click.fraud_score},
            ${click.time_from_impression || 'NULL'},
            ${click.country ? `'${click.country}'` : 'NULL'},
            ${click.region ? `'${click.region}'` : 'NULL'},
            ${click.city ? `'${click.city}'` : 'NULL'},
            ${click.slot_id ? `'${click.slot_id}'` : 'NULL'},
            ${click.user_fingerprint ? `'${click.user_fingerprint}'` : 'NULL'},
            true,
            '${click.synced_at.toISOString()}',
            '${click.created_at.toISOString()}'
        )`,
      )
      .join(',');

    const insertQuery = `
            INSERT INTO click_events (
                id, impression_id, creative_id, bid_response_id, campaign_id,
                advertiser_id, inventory_id, publisher_id, website_id, template_id,
                timestamp, user_agent, ip_address, device_type, landing_url,
                is_bot, fraud_score, time_from_impression, country, region, city,
                slot_id, user_fingerprint, synced_to_timescale, synced_at, created_at
            ) VALUES ${values}
            ON CONFLICT (timestamp, id) DO NOTHING
        `;

    const result = await this.timescale.query(insertQuery);
    return result.rowCount || 0;
  }

  /**
   * Mark impressions as synced to TimescaleDB
   */
  private async markImpressionsSynced(impressionIds: string[]): Promise<void> {
    if (impressionIds.length === 0) return;

    await this.prisma.impressionEvent.updateMany({
      where: {
        id: { in: impressionIds },
      },
      data: {
        syncedToTimescale: true,
        syncedAt: new Date(),
      },
    });

    this.logger.debug(
      ` Marked ${impressionIds.length} impressions as synced to TimescaleDB`,
    );
  }

  /**
   * Mark clicks as synced to TimescaleDB
   */
  private async markClicksSynced(clickIds: string[]): Promise<void> {
    if (clickIds.length === 0) return;

    await this.prisma.clickEvent.updateMany({
      where: {
        id: { in: clickIds },
      },
      data: {
        syncedToTimescale: true,
        syncedAt: new Date(),
      },
    });

    this.logger.debug(
      ` Marked ${clickIds.length} clicks as synced to TimescaleDB`,
    );
  }

  /**
   * Update sync status in Redis for monitoring
   */
  private async updateSyncStatusInRedis(syncResult: any): Promise<void> {
    try {
      const statusKey = 'postgres:timescale:sync:status';
      const status = {
        lastSync: syncResult.timestamp,
        impressionsProcessed: syncResult.impressions.processedCount,
        clicksProcessed: syncResult.clicks.processedCount,
        totalImpressionsSynced: this.syncStatus.totalImpressionsSynced,
        totalClicksSynced: this.syncStatus.totalClicksSynced,
        circuitBreakerOpen: this.circuitBreaker.isOpen,
      };

      await this.redis.setex(statusKey, 3600, JSON.stringify(status)); // Expire in 1 hour
    } catch (error) {
      this.logger.warn('Failed to update sync status in Redis:', error.message);
    }
  }

  /**
   * Manual trigger for sync (useful for testing and emergency situations)
   */
  async triggerManualSync(): Promise<{
    impressions: PostgresTimescaleSyncResult;
    clicks: PostgresTimescaleSyncResult;
  }> {
    if (this.syncStatus.isRunning) {
      throw new Error('Sync is already running');
    }

    this.logger.debug('🔄 Manual PostgreSQL → TimescaleDB sync triggered');

    const syncId = `manual-${uuidv4()}`;
    this.syncStatus.isRunning = true;

    try {
      const impressions = await this.syncImpressions(syncId);
      const clicks = await this.syncClicks(syncId);

      return { impressions, clicks };
    } finally {
      this.syncStatus.isRunning = false;
    }
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): SyncStatus {
    return {
      ...this.syncStatus,
      circuitBreakerOpen: this.circuitBreaker.isOpen,
    };
  }

  /**
   * Health check for the sync service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: any;
  }> {
    try {
      // Check TimescaleDB connection
      const timescaleHealth = await this.timescale.healthCheck();

      // Check PostgreSQL connection
      await this.prisma.$queryRaw`SELECT 1`;

      // Check for stuck syncs (running for more than 1 hour)
      const isStuck =
        this.syncStatus.isRunning &&
        Date.now() - this.syncStatus.impressionsLastSync.getTime() >
          60 * 60 * 1000;

      return {
        status:
          timescaleHealth.status === 'healthy' && !isStuck
            ? 'healthy'
            : 'unhealthy',
        details: {
          timescaleHealth,
          postgresHealth: 'healthy',
          syncStatus: this.syncStatus,
          circuitBreaker: this.circuitBreaker,
          isStuck,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
          syncStatus: this.syncStatus,
          circuitBreaker: this.circuitBreaker,
        },
      };
    }
  }

  /**
   * Handle sync errors and implement circuit breaker pattern
   */
  private handleSyncError(error: any, syncId: string): void {
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = new Date();

    if (this.circuitBreaker.failureCount >= this.circuitBreaker.threshold) {
      this.circuitBreaker.isOpen = true;
      this.syncStatus.circuitBreakerOpen = true;
      this.logger.error('🚨 Circuit breaker opened due to repeated failures', {
        syncId,
        failureCount: this.circuitBreaker.failureCount,
        error: error.message,
      });
    } else {
      this.logger.error('❌ Sync failed:', {
        syncId,
        failureCount: this.circuitBreaker.failureCount,
        error: error.message,
      });
    }
  }

  /**
   * Check if circuit breaker should be reset
   */
  private shouldRetryAfterCircuitBreaker(): boolean {
    if (!this.circuitBreaker.lastFailureTime) return false;

    const timeSinceLastFailure =
      Date.now() - this.circuitBreaker.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.circuitBreaker.timeout;
  }
}
