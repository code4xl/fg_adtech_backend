import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { v4 as uuidv4 } from 'uuid';
import { TimescaleService } from 'src/timescale/timescale.service';

export interface TimescaleSyncResult {
    success: boolean;
    processedCount: number;
    errors?: any[];
    processingTimeMs: number;
}

@Injectable()
export class TimescaleSyncService {
    private readonly logger = new Logger(TimescaleSyncService.name);

    // Circuit breaker state
    private circuitBreaker = {
        isOpen: false,
        failureCount: 0,
        lastFailureTime: null as Date | null,
        threshold: 5, // failures before opening circuit
        timeout: 30000, // 30 seconds before retry
    };

    // Sync status tracking
    private syncStatus = {
        impressionsLastSync: new Date(),
        clicksLastSync: new Date(),
        totalImpressionsSynced: 0,
        totalClicksSynced: 0,
    };

    constructor(
        private readonly prisma: PrismaService,
        private readonly timescale: TimescaleService,
        private readonly redis: RedisService,
    ) { }

    /**
     * Sync impressions from PostgreSQL to TimescaleDB every 30 minutes
     */
    @Cron('*/5 * * * *') // Every 30 minutes
    async syncImpressionsToTimescale(): Promise<void> {
        if (this.circuitBreaker.isOpen) {
            if (this.shouldRetryAfterCircuitBreaker()) {
                this.circuitBreaker.isOpen = false;
                this.circuitBreaker.failureCount = 0;
                this.logger.log('🔄 Circuit breaker reset, retrying TimescaleDB sync');
            } else {
                this.logger.warn('⚠️ Circuit breaker open, skipping TimescaleDB sync');
                return;
            }
        }

        const startTime = Date.now();
        const batchId = uuidv4();

        this.logger.debug('🔄 Starting impressions sync to TimescaleDB', {
            batchId,
            timestamp: new Date().toISOString(),
        });

        try {
            // Get unsynced impressions from PostgreSQL
            const unsyncedImpressions = await this.getUnsyncedImpressions();

            if (unsyncedImpressions.length === 0) {
                this.logger.debug('✅ No unsynced impressions found');
                return;
            }

            const result = await this.bulkInsertImpressions(unsyncedImpressions, batchId);

            if (result.success) {
                // Mark as synced in PostgreSQL
                await this.markImpressionsSynced(
                    unsyncedImpressions.map((i) => i.id)
                );

                this.syncStatus.impressionsLastSync = new Date();
                this.syncStatus.totalImpressionsSynced += result.processedCount;

                // Reset circuit breaker on success
                this.circuitBreaker.failureCount = 0;

                this.logger.log('✅ Impressions sync to TimescaleDB completed', {
                    batchId,
                    processedCount: result.processedCount,
                    processingTimeMs: result.processingTimeMs,
                });
            } else {
                throw new Error(`Bulk insert failed: ${result.errors?.join(', ')}`);
            }

        } catch (error) {
            this.handleSyncError(error, 'impressions', batchId);
        }
    }

    /**
     * Sync clicks from PostgreSQL to TimescaleDB every 30 minutes
     */
    @Cron('*/5 * * * *') // Every 30 minutes
    async syncClicksToTimescale(): Promise<void> {
        if (this.circuitBreaker.isOpen) {
            if (this.shouldRetryAfterCircuitBreaker()) {
                this.circuitBreaker.isOpen = false;
                this.circuitBreaker.failureCount = 0;
                this.logger.log('🔄 Circuit breaker reset, retrying TimescaleDB sync');
            } else {
                this.logger.warn('⚠️ Circuit breaker open, skipping TimescaleDB sync');
                return;
            }
        }

        const startTime = Date.now();
        const batchId = uuidv4();

        this.logger.debug('🔄 Starting clicks sync to TimescaleDB', {
            batchId,
            timestamp: new Date().toISOString(),
        });

        try {
            // Get unsynced clicks from PostgreSQL
            const unsyncedClicks = await this.getUnsyncedClicks();

            if (unsyncedClicks.length === 0) {
                this.logger.debug('✅ No unsynced clicks found');
                return;
            }

            const result = await this.bulkInsertClicks(unsyncedClicks, batchId);

            if (result.success) {
                // Mark as synced in PostgreSQL
                await this.markClicksSynced(
                    unsyncedClicks.map((c) => c.id)
                );

                this.syncStatus.clicksLastSync = new Date();
                this.syncStatus.totalClicksSynced += result.processedCount;

                // Reset circuit breaker on success
                this.circuitBreaker.failureCount = 0;

                this.logger.log('✅ Clicks sync to TimescaleDB completed', {
                    batchId,
                    processedCount: result.processedCount,
                    processingTimeMs: result.processingTimeMs,
                });
            } else {
                throw new Error(`Bulk insert failed: ${result.errors?.join(', ')}`);
            }

        } catch (error) {
            this.handleSyncError(error, 'clicks', batchId);
        }
    }

    /**
     * Get unsynced impressions from PostgreSQL (at least 5 minutes old)
     */
    private async getUnsyncedImpressions(): Promise<any[]> {
        try {
            return await this.prisma.impressionEvent.findMany({
                where: {
                    syncedToTimescale: false,
                    createdAt: {
                        lte: new Date(Date.now() - 5 * 60 * 1000), // At least 5 minutes old
                    },
                },
                take: 5000, // Process in batches of 5000
                orderBy: { createdAt: 'asc' },
            });
        } catch (error) {
            this.logger.error('Failed to fetch unsynced impressions:', error);
            throw error;
        }
    }

    /**
     * Get unsynced clicks from PostgreSQL (at least 5 minutes old)
     */
    private async getUnsyncedClicks(): Promise<any[]> {
        try {
            return await this.prisma.clickEvent.findMany({
                where: {
                    syncedToTimescale: false,
                    createdAt: {
                        lte: new Date(Date.now() - 5 * 60 * 1000), // At least 5 minutes old
                    },
                },
                take: 5000, // Process in batches of 5000
                orderBy: { createdAt: 'asc' },
            });
        } catch (error) {
            this.logger.error('Failed to fetch unsynced clicks:', error);
            throw error;
        }
    }

    /**
     * Bulk insert impressions to TimescaleDB
     */
    private async bulkInsertImpressions(
        impressions: any[],
        batchId: string,
    ): Promise<TimescaleSyncResult> {
        const startTime = Date.now();

        try {
            // Transform data for TimescaleDB format
            const timescaleData = impressions.map((impression) => ({
                timestamp: impression.timestamp,
                impression_id: impression.id,
                creative_id: impression.creativeId,
                campaign_id: impression.campaignId,
                advertiser_id: impression.advertiserId,
                inventory_id: impression.inventoryId,
                publisher_id: impression.publisherId,
                website_id: impression.websiteId || null,
                price: impression.bidPrice,
                publisher_revenue: impression.publisherRevenue,
                user_id: impression.userId || null,
                session_id: impression.sessionId || null,
                user_agent: impression.userAgent,
                ip_address: impression.ipAddress,
                device_type: impression.deviceType,
                browser_type: impression.browserType || null,
                os_type: impression.osType || null,
                country: impression.country,
                region: impression.region,
                city: impression.city,
                viewable: impression.viewable,
                view_time: impression.viewTime,
                viewable_pixels: impression.viewablePixels || null,
                ad_size_pixels: impression.adSizePixels || null,
                is_bot: impression.isBot,
                fraud_score: impression.fraudScore,
                referrer_url: impression.referrerUrl || null,
                page_url: impression.pageUrl || null,
                page_category: impression.pageCategory || null,
            }));

            // Use TimescaleService to write data
            const result = await this.timescale.writeImpressions(timescaleData);

            const processingTime = Date.now() - startTime;

            if (result.success) {
                this.logger.debug('✅ Bulk insert impressions successful', {
                    batchId,
                    requestedCount: impressions.length,
                    processedCount: result.processedCount,
                    processingTimeMs: processingTime,
                });

                // Update Redis metrics
                await this.updateTimescaleMetrics('impressions', result.processedCount, processingTime);

                return {
                    success: true,
                    processedCount: result.processedCount,
                    processingTimeMs: processingTime,
                };
            } else {
                return {
                    success: false,
                    processedCount: 0,
                    errors: result.errors,
                    processingTimeMs: processingTime,
                };
            }

        } catch (error) {
            const processingTime = Date.now() - startTime;
            this.logger.error('❌ Bulk insert impressions failed:', {
                error: error.message,
                batchId,
                requestedCount: impressions.length,
                processingTimeMs: processingTime,
            });

            return {
                success: false,
                processedCount: 0,
                errors: [error.message],
                processingTimeMs: processingTime,
            };
        }
    }

    /**
     * Bulk insert clicks to TimescaleDB
     */
    private async bulkInsertClicks(
        clicks: any[],
        batchId: string,
    ): Promise<TimescaleSyncResult> {
        const startTime = Date.now();

        try {
            // Transform data for TimescaleDB format
            const timescaleData = clicks.map((click) => ({
                timestamp: click.timestamp,
                click_id: click.id,
                impression_id: click.impressionId,
                creative_id: click.creativeId,
                campaign_id: click.campaignId,
                advertiser_id: click.advertiserId,
                inventory_id: click.inventoryId,
                publisher_id: click.publisherId,
                click_x: click.clickX,
                click_y: click.clickY,
                time_from_impression: click.timeFromImpression,
                user_id: click.userId || null,
                session_id: click.sessionId || null,
                user_agent: click.userAgent,
                ip_address: click.ipAddress,
                device_type: click.deviceType,
                country: click.country,
                region: click.region,
                city: click.city,
                is_bot: click.isBot,
                fraud_score: click.fraudScore,
            }));

            // Use TimescaleService to write data
            const result = await this.timescale.writeClicks(timescaleData);

            const processingTime = Date.now() - startTime;

            if (result.success) {
                this.logger.debug('✅ Bulk insert clicks successful', {
                    batchId,
                    requestedCount: clicks.length,
                    processedCount: result.processedCount,
                    processingTimeMs: processingTime,
                });

                // Update Redis metrics
                await this.updateTimescaleMetrics('clicks', result.processedCount, processingTime);

                return {
                    success: true,
                    processedCount: result.processedCount,
                    processingTimeMs: processingTime,
                };
            } else {
                return {
                    success: false,
                    processedCount: 0,
                    errors: result.errors,
                    processingTimeMs: processingTime,
                };
            }

        } catch (error) {
            const processingTime = Date.now() - startTime;
            this.logger.error('❌ Bulk insert clicks failed:', {
                error: error.message,
                batchId,
                requestedCount: clicks.length,
                processingTimeMs: processingTime,
            });

            return {
                success: false,
                processedCount: 0,
                errors: [error.message],
                processingTimeMs: processingTime,
            };
        }
    }

    /**
     * Mark impressions as synced in PostgreSQL
     */
    private async markImpressionsSynced(impressionIds: string[]): Promise<void> {
        try {
            await this.prisma.impressionEvent.updateMany({
                where: { id: { in: impressionIds } },
                data: {
                    syncedToTimescale: true,
                    syncedAt: new Date(),
                },
            });

            this.logger.debug('✅ Marked impressions as synced', {
                count: impressionIds.length,
            });

        } catch (error) {
            this.logger.error('❌ Failed to mark impressions as synced:', error);
            throw error;
        }
    }

    /**
     * Mark clicks as synced in PostgreSQL
     */
    private async markClicksSynced(clickIds: string[]): Promise<void> {
        try {
            await this.prisma.clickEvent.updateMany({
                where: { id: { in: clickIds } },
                data: {
                    syncedToTimescale: true,
                    syncedAt: new Date(),
                },
            });

            this.logger.debug('✅ Marked clicks as synced', {
                count: clickIds.length,
            });

        } catch (error) {
            this.logger.error('❌ Failed to mark clicks as synced:', error);
            throw error;
        }
    }

    /**
     * Handle sync errors with circuit breaker pattern
     */
    private handleSyncError(error: any, eventType: string, batchId: string): void {
        this.circuitBreaker.failureCount++;
        this.circuitBreaker.lastFailureTime = new Date();

        if (this.circuitBreaker.failureCount >= this.circuitBreaker.threshold) {
            this.circuitBreaker.isOpen = true;
            this.logger.error(`🚨 Circuit breaker opened after ${this.circuitBreaker.failureCount} failures`, {
                eventType,
                batchId,
                error: error.message,
            });
        } else {
            this.logger.error(`❌ ${eventType} sync to TimescaleDB failed:`, {
                error: error.message,
                batchId,
                failureCount: this.circuitBreaker.failureCount,
                threshold: this.circuitBreaker.threshold,
            });
        }
    }

    /**
     * Check if circuit breaker should be reset
     */
    private shouldRetryAfterCircuitBreaker(): boolean {
        if (!this.circuitBreaker.lastFailureTime) {
            return true;
        }

        const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailureTime.getTime();
        return timeSinceLastFailure > this.circuitBreaker.timeout;
    }

    /**
     * Update TimescaleDB sync metrics in Redis
     */
    private async updateTimescaleMetrics(
        eventType: 'impressions' | 'clicks',
        processedCount: number,
        processingTime: number,
    ): Promise<void> {
        try {
            const now = new Date();
            const hour = now.toISOString().substring(0, 13); // YYYY-MM-DDTHH

            const pipeline = this.redis.pipeline();

            // Update TimescaleDB sync metrics
            pipeline.incr(`timescale:sync:${eventType}:processed:${hour}`);
            pipeline.incrby(`timescale:sync:${eventType}:count:${hour}`, processedCount);
            pipeline.set(`timescale:sync:${eventType}:last_processing_time`, processingTime);
            pipeline.set(`timescale:sync:${eventType}:last_sync_time`, now.toISOString());

            // Circuit breaker status
            pipeline.set(`timescale:circuit_breaker:${eventType}:is_open`, this.circuitBreaker.isOpen.toString());
            pipeline.set(`timescale:circuit_breaker:${eventType}:failure_count`, this.circuitBreaker.failureCount);

            // Set expiration (keep for 24 hours)
            pipeline.expire(`timescale:sync:${eventType}:processed:${hour}`, 86400);
            pipeline.expire(`timescale:sync:${eventType}:count:${hour}`, 86400);
            pipeline.expire(`timescale:sync:${eventType}:last_processing_time`, 86400);
            pipeline.expire(`timescale:sync:${eventType}:last_sync_time`, 86400);

            await pipeline.exec();

        } catch (error) {
            this.logger.error('Failed to update TimescaleDB metrics:', error);
        }
    }

    /**
     * Get sync status for monitoring
     */
    async getSyncStatus(): Promise<any> {
        return {
            ...this.syncStatus,
            circuitBreaker: { ...this.circuitBreaker },
        };
    }

    /**
     * Manual sync trigger for recovery
     */
    async triggerManualSync(): Promise<{ impressions: TimescaleSyncResult; clicks: TimescaleSyncResult }> {
        this.logger.log('🔄 Manual TimescaleDB sync triggered');

        // Reset circuit breaker for manual sync
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.failureCount = 0;

        const impressions = await this.syncImpressionsToTimescale();
        const clicks = await this.syncClicksToTimescale();

        return {
            impressions: {
                success: true,
                processedCount: 0,
                processingTimeMs: 0,
            },
            clicks: {
                success: true,
                processedCount: 0,
                processingTimeMs: 0,
            },
        };
    }

    /**
     * Health check for TimescaleDB connection
     */
    async healthCheck(): Promise<{ status: string; details: any }> {
        try {
            const timescaleHealth = await this.timescale.healthCheck();

            return {
                status: timescaleHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
                details: {
                    ...timescaleHealth.details,
                    syncStatus: this.syncStatus,
                    circuitBreaker: this.circuitBreaker,
                },
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                details: { error: error.message },
            };
        }
    }

    /**
  * Reset circuit breaker manually (emergency operation)
  */
    async resetCircuitBreaker(): Promise<{ success: boolean; message: string }> {
        try {
            this.logger.warn('🚨 Circuit breaker manually reset', {
                previousState: { ...this.circuitBreaker },
                resetBy: 'API_REQUEST',
            });

            // Reset circuit breaker state
            this.circuitBreaker.isOpen = false;
            this.circuitBreaker.failureCount = 0;
            this.circuitBreaker.lastFailureTime = null;

            this.logger.log('✅ Circuit breaker reset successfully', {
                newState: { ...this.circuitBreaker },
            });

            return {
                success: true,
                message: 'Circuit breaker has been reset successfully',
            };

        } catch (error) {
            this.logger.error('❌ Failed to reset circuit breaker:', error);
            return {
                success: false,
                message: `Failed to reset circuit breaker: ${error.message}`,
            };
        }
    }
}