// src/timescale/consumers/timescale-sync.consumer.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { KafkaService } from '../../kafka/kafka.service';
import { TimescaleService } from '../timescale.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { kafkaTopics } from '../../kafka/constants/kafka.config';
import { REDIS_KEYS } from '../../redis/constants/redis-keys';
import { TimescaleImpressionDto, TimescaleClickDto } from 'src/rtb/dto';

/**
 * TimescaleDB Sync Consumer - Phase 6 Complete Implementation
 *

 * **Why this consumer is essential:**
 * - Provides real-time data synchronization from PostgreSQL to TimescaleDB
 * - Enables immediate analytics on freshly created impression/click data
 * - Supports both real-time and batch synchronization patterns
 * - Maintains data consistency between transactional and analytical stores
 * - Handles error recovery and retry mechanisms
 *
 * **Processing Patterns:**
 * 1. Real-time sync: Individual events as they occur
 * 2. Batch sync: Periodic bulk synchronization for efficiency
 * 3. Recovery sync: Handle missed events during outages
 * 4. Validation sync: Ensure data consistency
 * 5. Health monitoring: Track sync performance and errors
 *
 * **Performance Features:**
 * - Intelligent batching for optimal throughput
 * - Connection pooling for database efficiency
 * - Error handling with exponential backoff
 * - Metrics collection for monitoring
 * - Circuit breaker for fault tolerance
 */
@Injectable()
export class TimescaleSyncConsumer implements OnModuleInit {
  private readonly logger = new Logger(TimescaleSyncConsumer.name);

  // Performance tracking
  private syncMetrics = {
    totalProcessed: 0,
    totalErrors: 0,
    lastSyncTime: new Date(),
    averageProcessingTime: 0,
    batchSizes: [] as number[],
  };

  // Circuit breaker state
  private circuitBreaker = {
    isOpen: false,
    failureCount: 0,
    lastFailureTime: null as Date | null,
    threshold: 5, // failures before opening circuit
    timeout: 30000, // 30 seconds before retry
  };

  // Batch processing configuration
  private readonly batchConfig = {
    maxBatchSize: 1000,
    maxWaitTime: 5000, // 5 seconds
    minBatchSize: 10,
  };

  constructor(
    private readonly kafka: KafkaService,
    private readonly timescale: TimescaleService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    this.logger.log('TimescaleDB Sync Consumer initialized - Phase 6 Complete');
  }

  async onModuleInit() {
    try {
      this.logger.log('Initializing TimescaleDB sync subscriptions...');

      // Primary sync topic
      await this.kafka.subscribe(
        kafkaTopics.TIMESCALE_SYNC,
        'timescale-sync-consumer',
        this.processSyncEvent.bind(this),
        // {
        //   partitionsConsumedConcurrently: 3,
        //   autoCommit: false, // Manual commit for better error handling
        // },
      );

      // Real-time impression sync
      await this.kafka.subscribe(
        kafkaTopics.IMPRESSIONS,
        'timescale-impression-sync',
        this.processImpressionEvent.bind(this),
        // {
        //   eventType: 'impression'
        //   partitionsConsumedConcurrently: 2,
        //   autoCommit: false,
        // },
      );

      // Real-time click sync
      await this.kafka.subscribe(
        kafkaTopics.CLICKS,
        'timescale-click-sync',
        this.processClickEvent.bind(this),
        // {
        //   partitionsConsumedConcurrently: 2,
        //   autoCommit: false,
        // },
      );

      // Batch processing topics
      await this.kafka.subscribe(
        kafkaTopics.TIMESCALE_BATCH_IMPRESSIONS,
        'timescale-batch-impressions',
        this.processBatchImpressions.bind(this),
        // {
        //   partitionsConsumedConcurrently: 1,
        //   autoCommit: false,
        // },
      );

      await this.kafka.subscribe(
        kafkaTopics.TIMESCALE_BATCH_CLICKS,
        'timescale-batch-clicks',
        this.processBatchClicks.bind(this),
        // {
        //   partitionsConsumedConcurrently: 1,
        //   autoCommit: false,
        // },
      );

      // Health check topic
      await this.kafka.subscribe(
        kafkaTopics.TIMESCALE_HEALTH_CHECK,
        'timescale-health-consumer',
        this.processHealthCheck.bind(this),
      );

      // Start periodic health monitoring
      this.startHealthMonitoring();

      this.logger.log(
        '✅ TimescaleDB sync subscriptions initialized successfully',
      );
    } catch (error) {
      this.logger.error(
        '❌ Failed to initialize TimescaleDB sync subscriptions:',
        error,
      );
      throw error;
    }
  }

  private async processSyncEvent(payload: any, context?: any) {
    const startTime = Date.now();

    try {
      // Check circuit breaker
      if (this.isCircuitBreakerOpen()) {
        this.logger.warn('Circuit breaker is open, skipping sync event');
        return;
      }

      this.logger.debug('Processing TimescaleDB sync event', {
        eventType: payload.eventType,
        tableName: payload.tableName,
        batchSize: payload.batchSize,
        messageId: context?.messageId,
      });

      const {
        eventType,
        tableName,
        batchSize = 1000,
        filters = {},
        priority = 'normal',
      } = payload;

      // Process based on event type
      let result;
      switch (eventType) {
        case 'BATCH_SYNC':
          result = await this.processBatchSync(tableName, batchSize, filters);
          break;

        case 'RECOVERY_SYNC':
          result = await this.processRecoverySync(tableName, filters);
          break;

        case 'FULL_SYNC':
          result = await this.processFullSync(tableName);
          break;

        case 'INCREMENTAL_SYNC':
          result = await this.processIncrementalSync(tableName, filters);
          break;

        case 'VALIDATION_SYNC':
          result = await this.processValidationSync(tableName, filters);
          break;

        default:
          this.logger.warn(`Unknown sync event type: ${eventType}`);
          return;
      }

      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, result?.processedCount || 0, false);

      // Manual commit on success
      if (context?.commitOffsets) {
        await context.commitOffsets();
      }

      this.logger.debug(`✅ Sync event processed in ${processingTime}ms`, {
        eventType,
        processedCount: result?.processedCount || 0,
        success: result?.success,
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, 0, true);
      this.handleCircuitBreaker(error);

      this.logger.error('❌ Failed to process sync event:', {
        error: error.message,
        payload,
        processingTime,
      });

      // Send to dead letter queue
      await this.handleSyncError(payload, error, context);
    }
  }

  private async processImpressionEvent(payload: any, context?: any) {
    const startTime = Date.now();

    try {
      if (this.isCircuitBreakerOpen()) {
        this.logger.warn('Circuit breaker is open, skipping impression event');
        return;
      }

      this.logger.debug('Processing impression for TimescaleDB sync', {
        impressionId: payload.impressionId,
        messageId: context?.messageId,
      });

      // Get fresh impression data from PostgreSQL with all relations
      const impression = await this.prisma.impressionEvent.findUnique({
        where: { id: payload.impressionId },
        include: {
          creative: {
            include: {
              campaign: {
                include: {
                  advertiser: true,
                },
              },
            },
          },
          inventory: {
            include: {
              publisher: true,
              website: true,
            },
          },
        },
      });

      if (!impression) {
        this.logger.warn(`Impression not found: ${payload.impressionId}`);
        // Commit offset even for missing records to avoid reprocessing
        if (context?.commitOffsets) {
          await context.commitOffsets();
        }
        return;
      }

      // Check if already synced to avoid duplicates
      if (impression.syncedToTimescale) {
        this.logger.debug(
          `Impression ${impression.id} already synced, skipping`,
        );
        if (context?.commitOffsets) {
          await context.commitOffsets();
        }
        return;
      }

      // Convert to TimescaleDB format with enriched data
      const timescaleData = this.formatImpressionForTimescale(impression);

      // Write to TimescaleDB
      const result = await this.timescale.writeImpressions([timescaleData]);

      if (result.success && result.processedCount > 0) {
        // Mark as synced in PostgreSQL
        await this.prisma.impressionEvent.update({
          where: { id: impression.id },
          data: {
            syncedToTimescale: true,
            syncedAt: new Date(),
          },
        });

        // Update Redis cache for real-time metrics
        await this.updateRealtimeMetrics('impression', impression);

        const processingTime = Date.now() - startTime;
        this.updateMetrics(processingTime, 1, false);

        // Commit offset on success
        if (context?.commitOffsets) {
          await context.commitOffsets();
        }

        this.logger.debug(
          `✅ Impression ${impression.id} synced to TimescaleDB in ${processingTime}ms`,
        );
      } else {
        throw new Error(
          `Failed to sync impression: ${JSON.stringify(result.errors)}`,
        );
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, 0, true);
      this.handleCircuitBreaker(error);

      this.logger.error('❌ Failed to process impression event:', {
        impressionId: payload.impressionId,
        error: error.message,
        processingTime,
      });

      await this.handleSyncError(payload, error, context);
    }
  }

  private async processClickEvent(payload: any, context?: any) {
    const startTime = Date.now();

    try {
      if (this.isCircuitBreakerOpen()) {
        this.logger.warn('Circuit breaker is open, skipping click event');
        return;
      }

      this.logger.debug('Processing click for TimescaleDB sync', {
        clickId: payload.clickId,
        messageId: context?.messageId,
      });

      // Get fresh click data from PostgreSQL with relations
      const click = await this.prisma.clickEvent.findUnique({
        where: { id: payload.clickId },
        include: {
          impression: {
            include: {
              creative: true,
              campaign: true,
              inventory: true,
            },
          },
          creative: {
            include: {
              campaign: {
                include: {
                  advertiser: true,
                },
              },
            },
          },
        },
      });

      if (!click) {
        this.logger.warn(`Click not found: ${payload.clickId}`);
        if (context?.commitOffsets) {
          await context.commitOffsets();
        }
        return;
      }

      // Check if already synced
      if (click.syncedToTimescale) {
        this.logger.debug(`Click ${click.id} already synced, skipping`);
        if (context?.commitOffsets) {
          await context.commitOffsets();
        }
        return;
      }

      // Convert to TimescaleDB format
      const timescaleData = this.formatClickForTimescale(click);

      // Write to TimescaleDB
      const result = await this.timescale.writeClicks([timescaleData]);

      if (result.success && result.processedCount > 0) {
        // Mark as synced in PostgreSQL
        await this.prisma.clickEvent.update({
          where: { id: click.id },
          data: {
            syncedToTimescale: true,
            syncedAt: new Date(),
          },
        });

        // Update Redis cache for real-time metrics
        await this.updateRealtimeMetrics('click', click);

        const processingTime = Date.now() - startTime;
        this.updateMetrics(processingTime, 1, false);

        // Commit offset on success
        if (context?.commitOffsets) {
          await context.commitOffsets();
        }

        this.logger.debug(
          `✅ Click ${click.id} synced to TimescaleDB in ${processingTime}ms`,
        );
      } else {
        throw new Error(
          `Failed to sync click: ${JSON.stringify(result.errors)}`,
        );
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, 0, true);
      this.handleCircuitBreaker(error);

      this.logger.error('❌ Failed to process click event:', {
        clickId: payload.clickId,
        error: error.message,
        processingTime,
      });

      await this.handleSyncError(payload, error, context);
    }
  }

  private async processBatchImpressions(payload: any, context?: any) {
    const startTime = Date.now();

    try {
      const { impressionIds, batchId, priority = 'normal' } = payload;

      this.logger.debug(
        `Processing batch impressions sync: ${impressionIds.length} impressions`,
        {
          batchId,
          priority,
          messageId: context?.messageId,
        },
      );

      // Validate batch size
      if (impressionIds.length > this.batchConfig.maxBatchSize) {
        throw new Error(
          `Batch size ${impressionIds.length} exceeds maximum ${this.batchConfig.maxBatchSize}`,
        );
      }

      // Get impression data from PostgreSQL
      const impressions = await this.prisma.impressionEvent.findMany({
        where: {
          id: { in: impressionIds },
          syncedToTimescale: false,
        },
        include: {
          creative: {
            include: {
              campaign: {
                include: {
                  advertiser: true,
                },
              },
            },
          },
          inventory: {
            include: {
              publisher: true,
              website: true,
            },
          },
        },
        orderBy: { timestamp: 'asc' }, // Process in chronological order
      });

      if (impressions.length === 0) {
        this.logger.debug('No unsynced impressions found in batch');
        if (context?.commitOffsets) {
          await context.commitOffsets();
        }
        return { success: true, processedCount: 0 };
      }

      // Process in smaller chunks for memory efficiency
      const chunkSize = Math.min(this.batchConfig.maxBatchSize / 2, 500);
      let totalProcessed = 0;
      const errors: any[] = [];

      for (let i = 0; i < impressions.length; i += chunkSize) {
        const chunk = impressions.slice(i, i + chunkSize);

        try {
          // Convert to TimescaleDB format
          const timescaleData = chunk.map(this.formatImpressionForTimescale);

          // Write to TimescaleDB
          const result = await this.timescale.writeImpressions(timescaleData);

          if (result.success) {
            // Mark as synced in PostgreSQL
            await this.prisma.impressionEvent.updateMany({
              where: { id: { in: chunk.map((i) => i.id) } },
              data: {
                syncedToTimescale: true,
                syncedAt: new Date(),
              },
            });

            totalProcessed += result.processedCount;

            // Update batch metrics in Redis
            await this.updateBatchMetrics('impressions', chunk.length, batchId);
          } else {
            errors.push(...result.errors);
          }
        } catch (chunkError) {
          this.logger.error(
            `Failed to process chunk ${i}-${i + chunkSize}:`,
            chunkError,
          );
          errors.push({
            chunk: `${i}-${i + chunkSize}`,
            error: chunkError.message,
          });
        }

        // Small delay between chunks to prevent overwhelming the database
        if (i + chunkSize < impressions.length) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, totalProcessed, errors.length > 0);

      // Commit offset on success
      if (context?.commitOffsets && errors.length === 0) {
        await context.commitOffsets();
      }

      this.logger.log(
        `✅ Batch synced ${totalProcessed} impressions to TimescaleDB in ${processingTime}ms`,
        {
          batchId,
          requestedCount: impressionIds.length,
          foundCount: impressions.length,
          processedCount: totalProcessed,
          errorCount: errors.length,
        },
      );

      return {
        success: errors.length === 0,
        processedCount: totalProcessed,
        errors,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, 0, true);
      this.handleCircuitBreaker(error);

      this.logger.error('❌ Failed to process batch impressions:', {
        batchId: payload.batchId,
        error: error.message,
        processingTime,
      });

      await this.handleSyncError(payload, error, context);
      return { success: false, processedCount: 0, errors: [error.message] };
    }
  }

  /**
   * Process batch click sync
   */
  private async processBatchClicks(payload: any, context?: any) {
    const startTime = Date.now();

    try {
      const { clickIds, batchId, priority = 'normal' } = payload;

      this.logger.debug(
        `Processing batch clicks sync: ${clickIds.length} clicks`,
        {
          batchId,
          priority,
          messageId: context?.messageId,
        },
      );

      // Validate batch size
      if (clickIds.length > this.batchConfig.maxBatchSize) {
        throw new Error(
          `Batch size ${clickIds.length} exceeds maximum ${this.batchConfig.maxBatchSize}`,
        );
      }

      // Get click data from PostgreSQL
      const clicks = await this.prisma.clickEvent.findMany({
        where: {
          id: { in: clickIds },
          syncedToTimescale: false,
        },
        include: {
          impression: {
            include: {
              creative: true,
              campaign: true,
            },
          },
          creative: {
            include: {
              campaign: {
                include: {
                  advertiser: true,
                },
              },
            },
          },
        },
        orderBy: { timestamp: 'asc' },
      });

      if (clicks.length === 0) {
        this.logger.debug('No unsynced clicks found in batch');
        if (context?.commitOffsets) {
          await context.commitOffsets();
        }
        return { success: true, processedCount: 0 };
      }

      // Process in chunks
      const chunkSize = Math.min(this.batchConfig.maxBatchSize / 2, 500);
      let totalProcessed = 0;
      const errors: any[] = [];

      for (let i = 0; i < clicks.length; i += chunkSize) {
        const chunk = clicks.slice(i, i + chunkSize);

        try {
          // Convert to TimescaleDB format
          const timescaleData = chunk.map(this.formatClickForTimescale);

          // Write to TimescaleDB
          const result = await this.timescale.writeClicks(timescaleData);

          if (result.success) {
            // Mark as synced in PostgreSQL
            await this.prisma.clickEvent.updateMany({
              where: { id: { in: chunk.map((c) => c.id) } },
              data: {
                syncedToTimescale: true,
                syncedAt: new Date(),
              },
            });

            totalProcessed += result.processedCount;

            // Update batch metrics in Redis
            await this.updateBatchMetrics('clicks', chunk.length, batchId);
          } else {
            errors.push(...result.errors);
          }
        } catch (chunkError) {
          this.logger.error(
            `Failed to process click chunk ${i}-${i + chunkSize}:`,
            chunkError,
          );
          errors.push({
            chunk: `${i}-${i + chunkSize}`,
            error: chunkError.message,
          });
        }

        // Small delay between chunks
        if (i + chunkSize < clicks.length) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, totalProcessed, errors.length > 0);

      // Commit offset on success
      if (context?.commitOffsets && errors.length === 0) {
        await context.commitOffsets();
      }

      this.logger.log(
        `✅ Batch synced ${totalProcessed} clicks to TimescaleDB in ${processingTime}ms`,
        {
          batchId,
          requestedCount: clickIds.length,
          foundCount: clicks.length,
          processedCount: totalProcessed,
          errorCount: errors.length,
        },
      );

      return {
        success: errors.length === 0,
        processedCount: totalProcessed,
        errors,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, 0, true);
      this.handleCircuitBreaker(error);

      this.logger.error('❌ Failed to process batch clicks:', {
        batchId: payload.batchId,
        error: error.message,
        processingTime,
      });

      await this.handleSyncError(payload, error, context);
      return { success: false, processedCount: 0, errors: [error.message] };
    }
  }

  private async processHealthCheck(payload: any) {
    try {
      const healthStatus = {
        service: 'TimescaleDB Sync Consumer',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        metrics: this.syncMetrics,
        circuitBreaker: {
          isOpen: this.circuitBreaker.isOpen,
          failureCount: this.circuitBreaker.failureCount,
          lastFailureTime: this.circuitBreaker.lastFailureTime,
        },
        timescaleHealth: await this.timescale.healthCheck(),
      };

      // Store health status in Redis for monitoring
      await this.redis.setex(
        REDIS_KEYS.TIMESCALE_SYNC_STATUS('consumer'),
        300, // 5 minutes
        JSON.stringify(healthStatus),
      );

      this.logger.debug('Health check completed', {
        status: healthStatus.status,
      });
    } catch (error) {
      this.logger.error('Health check failed:', error);
    }
  }

  private async processBatchSync(
    tableName: string,
    batchSize: number,
    filters: any,
  ) {
    this.logger.debug(`Starting batch sync for ${tableName}`, {
      batchSize,
      filters,
    });

    try {
      // Set sync lock to prevent concurrent batch operations
      const lockKey = REDIS_KEYS.TIMESCALE_SYNC_LOCK(tableName);
      const lockAcquired = await this.redis.setnx(
        lockKey,
        Date.now().toString(),
      );

      if (!lockAcquired) {
        this.logger.warn(`Batch sync already in progress for ${tableName}`);
        return {
          success: false,
          processedCount: 0,
          reason: 'Lock not acquired',
        };
      }

      // Set lock expiration
      await this.redis.expire(lockKey, 3600); // 1 hour

      try {
        const result = await this.timescale.syncUnsyncedRecords(
          tableName as 'impressions' | 'clicks',
          batchSize,
        );

        // Update last sync time
        await this.redis.set(
          REDIS_KEYS.TIMESCALE_LAST_SYNC(tableName),
          new Date().toISOString(),
        );

        return result;
      } finally {
        // Release lock
        await this.redis.del(lockKey);
      }
    } catch (error) {
      this.logger.error(`Batch sync failed for ${tableName}:`, error);
      throw error;
    }
  }

  private async processRecoverySync(tableName: string, filters: any) {
    this.logger.log(`Starting recovery sync for ${tableName}`, { filters });

    try {
      // Get last successful sync time
      const lastSyncTime = await this.redis.get(
        REDIS_KEYS.TIMESCALE_LAST_SYNC(tableName),
      );

      const recoveryFilters = {
        ...filters,
        timestamp: {
          gte: lastSyncTime
            ? new Date(lastSyncTime as string | number | Date)
            : new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours default
        },
      };

      // Use larger batch size for recovery
      const result = await this.timescale.syncUnsyncedRecords(
        tableName as 'impressions' | 'clicks',
        5000,
      );

      this.logger.log(
        `Recovery sync completed: ${result.syncedCount} records recovered`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Recovery sync failed for ${tableName}:`, error);
      throw error;
    }
  }

  private async processFullSync(tableName: string) {
    this.logger.log(`Starting full sync for ${tableName}`);

    try {
      // Reset sync status for all records
      if (tableName === 'impressions') {
        await this.prisma.impressionEvent.updateMany({
          data: { syncedToTimescale: false, syncedAt: null },
        });
      } else if (tableName === 'clicks') {
        await this.prisma.clickEvent.updateMany({
          data: { syncedToTimescale: false, syncedAt: null },
        });
      }

      // Process in very large batches for full sync
      const result = await this.timescale.syncUnsyncedRecords(
        tableName as 'impressions' | 'clicks',
        10000,
      );

      this.logger.log(
        `Full sync completed: ${result.syncedCount} records synced`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Full sync failed for ${tableName}:`, error);
      throw error;
    }
  }

  private async processIncrementalSync(tableName: string, filters: any) {
    this.logger.debug(`Starting incremental sync for ${tableName}`, {
      filters,
    });

    try {
      // Get records modified since last sync
      const lastSyncTime = await this.redis.get(
        REDIS_KEYS.TIMESCALE_LAST_SYNC(tableName),
      );
      const since = lastSyncTime
        ? new Date(lastSyncTime as string | number | Date)
        : new Date(Date.now() - 60 * 60 * 1000); // Last hour default

      const incrementalFilters = {
        ...filters,
        updatedAt: { gte: since },
        syncedToTimescale: false,
      };

      // Use moderate batch size for incremental sync
      const result = await this.timescale.syncUnsyncedRecords(
        tableName as 'impressions' | 'clicks',
        2000,
      );

      this.logger.debug(
        `Incremental sync completed: ${result.syncedCount} records synced`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Incremental sync failed for ${tableName}:`, error);
      throw error;
    }
  }

  private async processValidationSync(tableName: string, filters: any) {
    this.logger.debug(`Starting validation sync for ${tableName}`, { filters });

    try {
      // Compare record counts between PostgreSQL and TimescaleDB
      let pgCount: number;
      let tsCount: number;

      if (tableName === 'impressions') {
        pgCount = await this.prisma.impressionEvent.count({
          where: { syncedToTimescale: true, ...filters },
        });

        const tsResult = await this.timescale.query(
          'SELECT COUNT(*) as count FROM rtb_impressions WHERE timestamp >= $1',
          [
            filters.timestamp?.gte ||
              new Date(Date.now() - 24 * 60 * 60 * 1000),
          ],
        );
        tsCount = parseInt(tsResult.rows[0].count);
      } else if (tableName === 'clicks') {
        pgCount = await this.prisma.clickEvent.count({
          where: { syncedToTimescale: true, ...filters },
        });

        const tsResult = await this.timescale.query(
          'SELECT COUNT(*) as count FROM rtb_clicks WHERE timestamp >= $1',
          [
            filters.timestamp?.gte ||
              new Date(Date.now() - 24 * 60 * 60 * 1000),
          ],
        );
        tsCount = parseInt(tsResult.rows[0].count);
      }

      const discrepancy = Math.abs(pgCount - tsCount);
      const discrepancyPercentage =
        pgCount > 0 ? (discrepancy / pgCount) * 100 : 0;

      this.logger.log(`Validation sync completed for ${tableName}`, {
        postgresCount: pgCount,
        timescaleCount: tsCount,
        discrepancy,
        discrepancyPercentage: discrepancyPercentage.toFixed(2) + '%',
      });

      // If discrepancy is significant, trigger a recovery sync
      if (discrepancyPercentage > 5) {
        // More than 5% discrepancy
        this.logger.warn(
          `Significant discrepancy detected for ${tableName}, triggering recovery sync`,
        );
        await this.processRecoverySync(tableName, filters);
      }

      return {
        success: true,
        processedCount: 0,
        validation: {
          postgresCount: pgCount,
          timescaleCount: tsCount,
          discrepancy,
          discrepancyPercentage,
        },
      };
    } catch (error) {
      this.logger.error(`Validation sync failed for ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Handle sync errors with comprehensive error management
   */
  private async handleSyncError(payload: any, error: Error, context?: any) {
    try {
      this.logger.error('Handling sync error:', {
        payload: JSON.stringify(payload).substring(0, 500), // Truncate for logging
        error: error.message,
        stack: error.stack,
      });

      const errorEvent = {
        originalPayload: payload,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        timestamp: new Date().toISOString(),
        retryCount: payload.retryCount || 0,
        consumerInfo: {
          service: 'TimescaleDB Sync Consumer',
          version: '1.0.0',
          nodeId: process.env.NODE_ID || 'unknown',
        },
      };

      // Determine if error is retryable
      const isRetryable = this.isRetryableError(error);
      const maxRetries = 3;

      if (isRetryable && errorEvent.retryCount < maxRetries) {
        // Schedule retry with exponential backoff
        const delay = Math.pow(2, errorEvent.retryCount) * 1000; // 1s, 2s, 4s

        setTimeout(async () => {
          try {
            const retryPayload = {
              ...payload,
              retryCount: errorEvent.retryCount + 1,
              originalError: error.message,
            };

            // Re-publish to the appropriate topic for retry
            await this.kafka.publish(kafkaTopics.TIMESCALE_SYNC, retryPayload);

            this.logger.debug(
              `Scheduled retry ${errorEvent.retryCount + 1}/${maxRetries} for sync error`,
            );
          } catch (retryError) {
            this.logger.error('Failed to schedule retry:', retryError);
          }
        }, delay);
      } else {
        // Send to dead letter queue
        await this.kafka.publish(kafkaTopics.DLQ_TRACKING, {
          key: `error-${payload.key || Date.now()}`,
          value: errorEvent,
        });
        this.logger.error('Sent sync error to dead letter queue', {
          retryCount: errorEvent.retryCount,
          maxRetries,
          isRetryable,
        });
      }

      // Update error metrics in Redis
      await this.updateErrorMetrics(error);

      // Don't commit offset for errors - let Kafka handle redelivery
      if (context && !isRetryable) {
        // Only commit offset for non-retryable errors to prevent infinite reprocessing
        await context.commitOffsets();
      }
    } catch (handlerError) {
      this.logger.error('Error in error handler:', handlerError);
    }
  }

  private isCircuitBreakerOpen(): boolean {
    if (!this.circuitBreaker.isOpen) {
      return false;
    }

    // Check if timeout has passed to attempt recovery
    if (this.circuitBreaker.lastFailureTime) {
      const timeSinceLastFailure =
        Date.now() - this.circuitBreaker.lastFailureTime.getTime();
      if (timeSinceLastFailure > this.circuitBreaker.timeout) {
        this.logger.debug(
          'Circuit breaker timeout reached, attempting recovery',
        );
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.failureCount = 0;
        return false;
      }
    }

    return true;
  }

  private handleCircuitBreaker(error: Error) {
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = new Date();

    if (this.circuitBreaker.failureCount >= this.circuitBreaker.threshold) {
      this.circuitBreaker.isOpen = true;
      this.logger.error('Circuit breaker opened due to repeated failures', {
        failureCount: this.circuitBreaker.failureCount,
        threshold: this.circuitBreaker.threshold,
        error: error.message,
      });
    }
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'ECONNRESET',
      'ENOTFOUND',
      'ETIMEDOUT',
      'connection terminated',
      'Connection lost',
      'timeout',
      'EPIPE',
    ];

    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some((retryable) =>
      errorMessage.includes(retryable.toLowerCase()),
    );
  }

  private updateMetrics(
    processingTime: number,
    processedCount: number,
    hasError: boolean,
  ) {
    this.syncMetrics.totalProcessed += processedCount;
    this.syncMetrics.lastSyncTime = new Date();

    if (hasError) {
      this.syncMetrics.totalErrors++;
    }

    // Update average processing time (rolling average)
    const currentAvg = this.syncMetrics.averageProcessingTime;
    const totalRecords = this.syncMetrics.totalProcessed;
    this.syncMetrics.averageProcessingTime =
      (currentAvg * (totalRecords - processedCount) + processingTime) /
      totalRecords;

    // Track batch sizes for optimization
    if (processedCount > 0) {
      this.syncMetrics.batchSizes.push(processedCount);
      // Keep only last 100 batch sizes
      if (this.syncMetrics.batchSizes.length > 100) {
        this.syncMetrics.batchSizes = this.syncMetrics.batchSizes.slice(-100);
      }
    }
  }

  private async updateRealtimeMetrics(
    eventType: 'impression' | 'click',
    event: any,
  ) {
    try {
      const now = new Date();
      const hour = now.toISOString().substring(0, 13); // YYYY-MM-DDTHH

      // Update hourly counters
      const pipeline = await this.redis.pipeline();

      if (eventType === 'impression') {
        pipeline.incr(REDIS_KEYS.CREATIVE_IMPRESSIONS(event.creativeId));
        pipeline.incr(REDIS_KEYS.CAMPAIGN_IMPRESSIONS(event.campaignId));
        pipeline.incr(REDIS_KEYS.INVENTORY_IMPRESSIONS(event.inventoryId));
        pipeline.incr(REDIS_KEYS.PUBLISHER_IMPRESSIONS(event.publisherId));

        // Set expiration for hourly counters (48 hours)
        pipeline.expire(
          REDIS_KEYS.CREATIVE_IMPRESSIONS(event.creativeId),
          48 * 3600,
        );
        pipeline.expire(
          REDIS_KEYS.CAMPAIGN_IMPRESSIONS(event.campaignId),
          48 * 3600,
        );
      } else if (eventType === 'click') {
        pipeline.incr(REDIS_KEYS.CREATIVE_CLICKS(event.creativeId));
        pipeline.incr(REDIS_KEYS.CAMPAIGN_CLICKS(event.campaignId));

        // Update CTR calculation
        const impressions: any = await this.redis.get(
          REDIS_KEYS.CREATIVE_IMPRESSIONS(event.creativeId),
        );
        const clicks: any = await this.redis.get(
          REDIS_KEYS.CREATIVE_CLICKS(event.creativeId),
        );

        if (impressions && clicks) {
          const ctr = (parseInt(clicks) / parseInt(impressions)) * 100;
          pipeline.set(
            REDIS_KEYS.CREATIVE_CTR(event.creativeId),
            ctr.toFixed(4),
          );
        }

        pipeline.expire(
          REDIS_KEYS.CREATIVE_CLICKS(event.creativeId),
          48 * 3600,
        );
        pipeline.expire(
          REDIS_KEYS.CAMPAIGN_CLICKS(event.campaignId),
          48 * 3600,
        );
      }

      await pipeline.exec();
    } catch (error) {
      this.logger.warn('Failed to update real-time metrics:', error);
      // Don't throw - metrics failure shouldn't break sync
    }
  }

  private async updateBatchMetrics(
    tableName: string,
    batchSize: number,
    batchId: string,
  ) {
    try {
      const metricsKey = REDIS_KEYS.TIMESCALE_SYNC_STATUS(tableName);
      const batchInfo = {
        batchId,
        batchSize,
        timestamp: new Date().toISOString(),
        tableName,
      };

      await this.redis.lpush(
        `${metricsKey}:batches`,
        JSON.stringify(batchInfo),
      );
      await this.redis.ltrim(`${metricsKey}:batches`, 0, 99); // Keep last 100 batches
      await this.redis.expire(`${metricsKey}:batches`, 24 * 3600); // 24 hours
    } catch (error) {
      this.logger.warn('Failed to update batch metrics:', error);
    }
  }

  private async updateErrorMetrics(error: Error) {
    try {
      const errorKey = REDIS_KEYS.TIMESCALE_SYNC_STATUS('errors');
      const errorInfo = {
        error: error.message,
        timestamp: new Date().toISOString(),
        type: error.name || 'Unknown',
      };

      await this.redis.lpush(errorKey, JSON.stringify(errorInfo));
      await this.redis.ltrim(errorKey, 0, 49); // Keep last 50 errors
      await this.redis.expire(errorKey, 24 * 3600); // 24 hours

      // Update error counters
      await this.redis.incr(`${errorKey}:count`);
      await this.redis.expire(`${errorKey}:count`, 24 * 3600);
    } catch (metricError) {
      this.logger.warn('Failed to update error metrics:', metricError);
    }
  }

  private formatImpressionForTimescale(
    impression: any,
  ): TimescaleImpressionDto {
    return {
      timestamp:
        impression.timestamp?.toISOString() || new Date().toISOString(),
      impression_id: impression.id,
      creative_id: impression.creativeId,
      campaign_id: impression.campaignId,
      advertiser_id: impression.advertiserId,
      inventory_id: impression.inventoryId,
      publisher_id: impression.publisherId,
      website_id: impression.websiteId,

      // Financial data
      price: impression.price
        ? parseFloat(impression.price.toString())
        : undefined,
      publisher_revenue: impression.publisherRevenue
        ? parseFloat(impression.publisherRevenue.toString())
        : undefined,

      // User context
      user_id: impression.userId,
      session_id: impression.sessionId,

      // Technical details
      user_agent: impression.userAgent,
      ip_address: impression.ipAddress,
      device_type: impression.deviceType,
      browser_type: impression.browserType,
      os_type: impression.osType,

      // Geographic context
      country: impression.country,
      region: impression.region,
      city: impression.city,

      // Viewability metrics
      viewable: impression.viewable,
      view_time: impression.viewTime,
      viewable_pixels: impression.viewablePixels,
      ad_size_pixels: impression.adSizePixels,

      // Fraud detection
      is_bot: impression.isBot || false,
      fraud_score: impression.fraudScore,

      // Attribution
      referrer_url: impression.referrerUrl,
      page_url: impression.pageUrl,
      page_category: impression.pageCategory,
    };
  }

  private formatClickForTimescale(click: any): TimescaleClickDto {
    return {
      timestamp: click.timestamp?.toISOString() || new Date().toISOString(),
      click_id: click.id,
      impression_id: click.impressionId,
      creative_id: click.creativeId,
      campaign_id: click.campaignId,
      advertiser_id: click.advertiserId,
      inventory_id: click.inventoryId,
      publisher_id: click.publisherId,

      // Click-specific data
      click_x: click.clickX,
      click_y: click.clickY,
      time_from_impression: click.timeFromImpression,

      // User context (denormalized for analytics)
      user_id: click.userId,
      session_id: click.sessionId,
      user_agent: click.userAgent,
      ip_address: click.ipAddress,
      device_type: click.deviceType,

      // Geographic context
      country: click.country,
      region: click.region,
      city: click.city,

      // Fraud detection
      is_bot: click.isBot || false,
      fraud_score: click.fraudScore,
    };
  }

  private startHealthMonitoring() {
    setInterval(async () => {
      try {
        // Check TimescaleDB connection health
        const healthStatus = await this.timescale.healthCheck();

        // Update circuit breaker if TimescaleDB is healthy
        if (healthStatus.status === 'healthy' && this.circuitBreaker.isOpen) {
          const timeSinceLastFailure = this.circuitBreaker.lastFailureTime
            ? Date.now() - this.circuitBreaker.lastFailureTime.getTime()
            : 0;

          if (timeSinceLastFailure > this.circuitBreaker.timeout) {
            this.circuitBreaker.isOpen = false;
            this.circuitBreaker.failureCount = 0;
            this.logger.debug(
              'Circuit breaker closed - TimescaleDB is healthy again',
            );
          }
        }

        // Log performance metrics periodically
        if (this.syncMetrics.totalProcessed > 0) {
          this.logger.debug('Sync performance metrics', {
            totalProcessed: this.syncMetrics.totalProcessed,
            totalErrors: this.syncMetrics.totalErrors,
            errorRate:
              (
                (this.syncMetrics.totalErrors /
                  this.syncMetrics.totalProcessed) *
                100
              ).toFixed(2) + '%',
            averageProcessingTime:
              this.syncMetrics.averageProcessingTime.toFixed(2) + 'ms',
            averageBatchSize:
              this.syncMetrics.batchSizes.length > 0
                ? (
                    this.syncMetrics.batchSizes.reduce((a, b) => a + b, 0) /
                    this.syncMetrics.batchSizes.length
                  ).toFixed(0)
                : 0,
            circuitBreakerStatus: this.circuitBreaker.isOpen
              ? 'OPEN'
              : 'CLOSED',
          });
        }

        // Store health metrics in Redis
        await this.redis.setex(
          REDIS_KEYS.TIMESCALE_SYNC_STATUS('health'),
          300, // 5 minutes
          JSON.stringify({
            timestamp: new Date().toISOString(),
            metrics: this.syncMetrics,
            circuitBreaker: this.circuitBreaker,
            timescaleHealth: healthStatus,
          }),
        );
      } catch (error) {
        this.logger.error('Health monitoring failed:', error);
      }
    }, 30000); // Every 30 seconds
  }

  async getSyncStatus(): Promise<{
    status: string;
    metrics: any;
    circuitBreaker: any;
    timescaleHealth: any;
  }> {
    try {
      const timescaleHealth = await this.timescale.healthCheck();

      return {
        status: this.circuitBreaker.isOpen ? 'degraded' : 'healthy',
        metrics: this.syncMetrics,
        circuitBreaker: {
          isOpen: this.circuitBreaker.isOpen,
          failureCount: this.circuitBreaker.failureCount,
          lastFailureTime: this.circuitBreaker.lastFailureTime,
          threshold: this.circuitBreaker.threshold,
        },
        timescaleHealth,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        metrics: this.syncMetrics,
        circuitBreaker: this.circuitBreaker,
        timescaleHealth: {
          status: 'unhealthy',
          details: { error: error.message },
        },
      };
    }
  }

  async triggerManualSync(
    tableName: 'impressions' | 'clicks',
    syncType: string = 'BATCH_SYNC',
  ) {
    try {
      this.logger.log(`Manually triggering ${syncType} for ${tableName}`);

      const payload = {
        eventType: syncType,
        tableName,
        batchSize: 1000,
        priority: 'high',
        triggeredBy: 'manual',
        timestamp: new Date().toISOString(),
      };

      // await this.kafka.publish(kafkaTopics.TIMESCALE_SYNC, payload);
      await this.kafka.publish(kafkaTopics.TIMESCALE_SYNC, {
        key: `sync-${tableName}-${Date.now()}`,
        value: payload,
      });
      this.logger.log(`✅ Manual sync triggered for ${tableName}`);
      return {
        success: true,
        message: `${syncType} triggered for ${tableName}`,
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to trigger manual sync for ${tableName}:`,
        error,
      );
      return { success: false, error: error.message };
    }
  }

  async cleanup() {
    try {
      this.logger.log('Cleaning up TimescaleDB Sync Consumer...');

      // Log final metrics
      this.logger.log('Final sync metrics', this.syncMetrics);

      // Store final metrics in Redis
      await this.redis.setex(
        REDIS_KEYS.TIMESCALE_SYNC_STATUS('final_metrics'),
        86400, // 24 hours
        JSON.stringify({
          timestamp: new Date().toISOString(),
          finalMetrics: this.syncMetrics,
          shutdownReason: 'graceful',
        }),
      );

      this.logger.log('✅ TimescaleDB Sync Consumer cleanup completed');
    } catch (error) {
      this.logger.error('❌ Error during cleanup:', error);
    }
  }
}
