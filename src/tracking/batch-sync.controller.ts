// // src/tracking/controllers/batch-sync.controller.ts
// import {
//     Controller,
//     Get,
//     Post,
//     Param,
//     Query,
//     HttpStatus,
//     HttpCode,
//     UseGuards,
//     Logger,
// } from '@nestjs/common';
// import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
// import { TimescaleService } from 'src/timescale/timescale.service';
// import { RedisPostgresSyncService } from './services/redis-postgres-sync.service';
// import { PostgresTimescaleSyncService } from './services/postgre-timescale-sync.service';

// @ApiTags('Batch Sync')
// @Controller('batch-sync')
// export class BatchSyncController {
//     private readonly logger = new Logger(BatchSyncController.name);

//     constructor(
//         private readonly redisPostgresSync: RedisPostgresSyncService,
//         private readonly timescaleSync: PostgresTimescaleSyncService,
//         private readonly timescale: TimescaleService,
//     ) { }

//     /**
//      * Get sync metrics and status
//      */
//     @Get('status')
//     @ApiOperation({ summary: 'Get batch sync status and metrics' })
//     @ApiResponse({ status: 200, description: 'Sync status retrieved successfully' })
//     async getSyncStatus() {
//         try {
//             const [
//                 redisPostgresMetrics,
//                 timescaleSyncStatus,
//                 timescaleHealth,
//                 pendingCounts,
//             ] = await Promise.all([
//                 this.redisPostgresSync.getSyncMetrics(),
//                 this.timescaleSync.getSyncStatus(),
//                 this.timescale.healthCheck(),
//                 this.redisPostgresSync.getPendingCounts(),
//             ]);

//             return {
//                 status: 'success',
//                 data: {
//                     redisToPostgres: {
//                         metrics: redisPostgresMetrics,
//                         pendingCounts,
//                         description: 'Redis to PostgreSQL sync (every 2 minutes)',
//                         nextSyncEstimate: this.getNextSyncTime(2), // Next sync in 2 minutes
//                     },
//                     postgresToTimescale: {
//                         status: timescaleSyncStatus,
//                         description: 'PostgreSQL to TimescaleDB sync (every 30 minutes)',
//                         nextSyncEstimate: this.getNextSyncTime(5), // Next sync in 30 minutes
//                     },
//                     timescaleHealth: {
//                         health: timescaleHealth,
//                         description: 'TimescaleDB connection and performance',
//                     },
//                     dataFlow: {
//                         pipeline: 'Redis → PostgreSQL → TimescaleDB',
//                         stages: [
//                             {
//                                 stage: 1,
//                                 name: 'Real-time tracking',
//                                 description: 'Events stored in Redis immediately',
//                                 frequency: 'Per request (1-5ms)',
//                                 status: 'active',
//                             },
//                             {
//                                 stage: 2,
//                                 name: 'Redis to PostgreSQL sync',
//                                 description: 'Batch transfer for persistence',
//                                 frequency: 'Every 2 minutes',
//                                 status: 'active',
//                                 pendingItems: pendingCounts.impressions + pendingCounts.clicks,
//                             },
//                             {
//                                 stage: 3,
//                                 name: 'PostgreSQL to TimescaleDB sync',
//                                 description: 'Analytics-optimized storage',
//                                 frequency: 'Every 30 minutes',
//                                 status: timescaleSyncStatus.circuitBreaker?.isOpen ? 'circuit_open' : 'active',
//                             },
//                         ],
//                     },
//                     timestamp: new Date().toISOString(),
//                 },
//             };

//         } catch (error) {
//             this.logger.error('Failed to get sync status:', error);
//             return {
//                 status: 'error',
//                 message: 'Failed to retrieve sync status',
//                 error: error.message,
//                 timestamp: new Date().toISOString(),
//             };
//         }
//     }

//     /**
//      * Trigger manual Redis to PostgreSQL sync
//      */
//     @Post('redis-postgres/trigger')
//     @HttpCode(HttpStatus.OK)
//     @ApiOperation({ summary: 'Manually trigger Redis to PostgreSQL sync' })
//     @ApiResponse({ status: 200, description: 'Manual sync triggered successfully' })
//     async triggerRedisPostgresSync() {
//         try {
//             this.logger.log('🔄 Manual Redis to PostgreSQL sync triggered via API');

//             const startTime = Date.now();
//             const result = await this.redisPostgresSync.triggerManualSync();
//             const totalTime = Date.now() - startTime;

//             return {
//                 status: 'success',
//                 message: 'Manual Redis to PostgreSQL sync completed',
//                 data: {
//                     impressionsProcessingTime: result.impressions,
//                     clicksProcessingTime: result.clicks,
//                     totalProcessingTime: totalTime,
//                     timestamp: new Date().toISOString(),
//                 },
//             };

//         } catch (error) {
//             this.logger.error('Failed to trigger Redis to PostgreSQL sync:', error);
//             return {
//                 status: 'error',
//                 message: 'Failed to trigger manual sync',
//                 error: error.message,
//                 timestamp: new Date().toISOString(),
//             };
//         }
//     }

//     /**
//      * Trigger manual PostgreSQL to TimescaleDB sync
//      */
//     @Post('postgres-timescale/trigger')
//     @HttpCode(HttpStatus.OK)
//     @ApiOperation({ summary: 'Manually trigger PostgreSQL to TimescaleDB sync' })
//     @ApiResponse({ status: 200, description: 'Manual TimescaleDB sync triggered successfully' })
//     async triggerTimescaleSync() {
//         try {
//             this.logger.log('🔄 Manual PostgreSQL to TimescaleDB sync triggered via API');

//             const startTime = Date.now();
//             const result = await this.timescaleSync.triggerManualSync();
//             const totalTime = Date.now() - startTime;

//             return {
//                 status: 'success',
//                 message: 'Manual PostgreSQL to TimescaleDB sync completed',
//                 data: {
//                     impressionsResult: result.impressions,
//                     clicksResult: result.clicks,
//                     totalProcessingTime: totalTime,
//                     timestamp: new Date().toISOString(),
//                 },
//             };

//         } catch (error) {
//             this.logger.error('Failed to trigger TimescaleDB sync:', error);
//             return {
//                 status: 'error',
//                 message: 'Failed to trigger TimescaleDB sync',
//                 error: error.message,
//                 timestamp: new Date().toISOString(),
//             };
//         }
//     }

//     /**
//      * Get real-time pipeline metrics
//      */
//     @Get('metrics/realtime')
//     @ApiOperation({ summary: 'Get real-time pipeline metrics' })
//     @ApiQuery({ name: 'interval', required: false, description: 'Time interval (e.g., "6 hours", "24 hours")', example: '6 hours' })
//     @ApiResponse({ status: 200, description: 'Real-time metrics retrieved successfully' })
//     async getRealtimeMetrics(@Query('interval') interval: string = '6 hours') {
//         try {
//             const metrics = await this.timescale.getRealtimeMetrics(interval);

//             return {
//                 status: 'success',
//                 data: {
//                     metrics,
//                     interval,
//                     description: `Hourly metrics for the last ${interval}`,
//                     timestamp: new Date().toISOString(),
//                 },
//             };

//         } catch (error) {
//             this.logger.error('Failed to get realtime metrics:', error);
//             return {
//                 status: 'error',
//                 message: 'Failed to retrieve realtime metrics',
//                 error: error.message,
//                 timestamp: new Date().toISOString(),
//             };
//         }
//     }

//     /**
//      * Get campaign performance from TimescaleDB
//      */
//     @Get('metrics/campaign/:campaignId')
//     @ApiOperation({ summary: 'Get campaign metrics from TimescaleDB' })
//     @ApiParam({ name: 'campaignId', description: 'Campaign ID', example: 'campaign-123' })
//     @ApiQuery({ name: 'hours', required: false, description: 'Number of hours to look back', example: 24 })
//     @ApiResponse({ status: 200, description: 'Campaign metrics retrieved successfully' })
//     async getCampaignMetrics(
//         @Param('campaignId') campaignId: string,
//         @Query('hours') hours: string = '24'
//     ) {
//         try {
//             const hoursNum = parseInt(hours) || 24;
//             const endDate = new Date();
//             const startDate = new Date();
//             startDate.setHours(startDate.getHours() - hoursNum);

//             const [metrics, ctr] = await Promise.all([
//                 this.timescale.getCampaignMetrics(campaignId, startDate, endDate),
//                 this.timescale.getCampaignCTR(campaignId, hoursNum),
//             ]);

//             return {
//                 status: 'success',
//                 data: {
//                     campaignId,
//                     timeRange: {
//                         start: startDate.toISOString(),
//                         end: endDate.toISOString(),
//                         hours: hoursNum,
//                     },
//                     metrics: metrics || {
//                         impression_count: 0,
//                         total_spend: 0,
//                         avg_view_time: 0,
//                         viewable_impressions: 0,
//                         unique_users: 0,
//                     },
//                     ctr: ctr || {
//                         impressions: 0,
//                         clicks: 0,
//                         ctr_percentage: 0,
//                     },
//                     timestamp: new Date().toISOString(),
//                 },
//             };

//         } catch (error) {
//             this.logger.error('Failed to get campaign metrics:', error);
//             return {
//                 status: 'error',
//                 message: 'Failed to retrieve campaign metrics',
//                 error: error.message,
//                 timestamp: new Date().toISOString(),
//             };
//         }
//     }

//     /**
//      * Get data retention and storage status
//      */
//     @Get('storage/status')
//     @ApiOperation({ summary: 'Get data storage and retention status' })
//     @ApiResponse({ status: 200, description: 'Storage status retrieved successfully' })
//     async getStorageStatus() {
//         try {
//             const retentionStatus = await this.timescale.getRetentionStatus();

//             return {
//                 status: 'success',
//                 data: {
//                     tables: retentionStatus,
//                     retentionPolicy: '90 days',
//                     description: 'TimescaleDB storage usage and retention information',
//                     timestamp: new Date().toISOString(),
//                 },
//             };

//         } catch (error) {
//             this.logger.error('Failed to get storage status:', error);
//             return {
//                 status: 'error',
//                 message: 'Failed to retrieve storage status',
//                 error: error.message,
//                 timestamp: new Date().toISOString(),
//             };
//         }
//     }

//     /**
//      * Health check for entire pipeline
//      */
//     @Get('health')
//     @ApiOperation({ summary: 'Complete pipeline health check' })
//     @ApiResponse({ status: 200, description: 'Pipeline health status' })
//     async getHealthStatus() {
//         try {
//             const [timescaleHealth, syncStatus, pendingCounts] = await Promise.all([
//                 this.timescale.healthCheck(),
//                 this.timescaleSync.getSyncStatus(),
//                 this.redisPostgresSync.getPendingCounts(),
//             ]);

//             const isHealthy = timescaleHealth.status === 'healthy' &&
//                 !syncStatus.circuitBreaker?.isOpen;

//             const healthStatus = isHealthy ? 'healthy' : 'unhealthy';

//             return {
//                 status: healthStatus,
//                 data: {
//                     overall: {
//                         status: healthStatus,
//                         message: isHealthy
//                             ? 'All pipeline components are healthy'
//                             : 'Some pipeline components have issues',
//                     },
//                     components: {
//                         timescaleDB: {
//                             status: timescaleHealth.status,
//                             details: timescaleHealth.details,
//                         },
//                         syncService: {
//                             status: syncStatus.circuitBreaker?.isOpen ? 'circuit_open' : 'healthy',
//                             details: syncStatus,
//                         },
//                         redis: {
//                             status: 'active',
//                             pendingCounts,
//                             description: 'Redis queue status',
//                         },
//                     },
//                     pipeline: {
//                         redisToPostgres: {
//                             status: 'active',
//                             frequency: 'Every 2 minutes',
//                             description: 'Real-time event persistence',
//                             nextSync: this.getNextSyncTime(2),
//                         },
//                         postgresToTimescale: {
//                             status: syncStatus.circuitBreaker?.isOpen ? 'circuit_open' : 'active',
//                             frequency: 'Every 30 minutes',
//                             description: 'Analytics data synchronization',
//                             nextSync: this.getNextSyncTime(30),
//                         },
//                     },
//                     timestamp: new Date().toISOString(),
//                 },
//             };

//         } catch (error) {
//             this.logger.error('Failed to get health status:', error);
//             return {
//                 status: 'unhealthy',
//                 message: 'Failed to retrieve health status',
//                 error: error.message,
//                 timestamp: new Date().toISOString(),
//             };
//         }
//     }

//     /**
//      * Get performance statistics
//      */
//     @Get('performance')
//     @ApiOperation({ summary: 'Get pipeline performance statistics' })
//     @ApiResponse({ status: 200, description: 'Performance statistics retrieved successfully' })
//     async getPerformanceStats() {
//         try {
//             const [redisMetrics, timescaleStatus, pendingCounts] = await Promise.all([
//                 this.redisPostgresSync.getSyncMetrics(),
//                 this.timescaleSync.getSyncStatus(),
//                 this.redisPostgresSync.getPendingCounts(),
//             ]);

//             return {
//                 status: 'success',
//                 data: {
//                     redisToPostgres: {
//                         totalProcessed: redisMetrics.totalProcessed,
//                         totalErrors: redisMetrics.totalErrors,
//                         averageProcessingTime: `${redisMetrics.averageProcessingTime}ms`,
//                         lastSyncTime: redisMetrics.lastSyncTime,
//                         recentBatchSizes: redisMetrics.batchSizes.slice(-10), // Last 10 batches
//                         currentPendingItems: pendingCounts,
//                     },
//                     postgresToTimescale: {
//                         totalImpressionsSynced: timescaleStatus.totalImpressionsSynced,
//                         totalClicksSynced: timescaleStatus.totalClicksSynced,
//                         lastImpressionsSync: timescaleStatus.impressionsLastSync,
//                         lastClicksSync: timescaleStatus.clicksLastSync,
//                         circuitBreaker: timescaleStatus.circuitBreaker,
//                     },
//                     pipeline: {
//                         description: 'End-to-end tracking pipeline performance',
//                         stages: [
//                             {
//                                 name: 'Event Capture',
//                                 latency: '1-5ms',
//                                 storage: 'Redis (in-memory)',
//                                 purpose: 'Real-time tracking with immediate budget control',
//                                 currentLoad: pendingCounts.impressions + pendingCounts.clicks,
//                             },
//                             {
//                                 name: 'Persistence Layer',
//                                 latency: '2 minutes',
//                                 storage: 'PostgreSQL (transactional)',
//                                 purpose: 'Reliable data persistence and ACID compliance',
//                                 processedToday: redisMetrics.totalProcessed,
//                             },
//                             {
//                                 name: 'Analytics Layer',
//                                 latency: '30 minutes',
//                                 storage: 'TimescaleDB (time-series)',
//                                 purpose: 'High-performance analytics and reporting',
//                                 totalSynced: timescaleStatus.totalImpressionsSynced + timescaleStatus.totalClicksSynced,
//                             },
//                         ],
//                     },
//                     timestamp: new Date().toISOString(),
//                 },
//             };

//         } catch (error) {
//             this.logger.error('Failed to get performance stats:', error);
//             return {
//                 status: 'error',
//                 message: 'Failed to retrieve performance statistics',
//                 error: error.message,
//                 timestamp: new Date().toISOString(),
//             };
//         }
//     }

//     /**
//      * Get pending items count in Redis
//      */
//     @Get('pending')
//     @ApiOperation({ summary: 'Get pending items count in Redis queues' })
//     @ApiResponse({ status: 200, description: 'Pending counts retrieved successfully' })
//     async getPendingCounts() {
//         try {
//             const pendingCounts = await this.redisPostgresSync.getPendingCounts();

//             return {
//                 status: 'success',
//                 data: {
//                     pending: pendingCounts,
//                     total: pendingCounts.impressions + pendingCounts.clicks,
//                     description: 'Items waiting to be synced from Redis to PostgreSQL',
//                     estimatedSyncTime: this.estimateSyncTime(pendingCounts.impressions + pendingCounts.clicks),
//                     timestamp: new Date().toISOString(),
//                 },
//             };

//         } catch (error) {
//             this.logger.error('Failed to get pending counts:', error);
//             return {
//                 status: 'error',
//                 message: 'Failed to retrieve pending counts',
//                 error: error.message,
//                 timestamp: new Date().toISOString(),
//             };
//         }
//     }

//     /**
//      * Get system overview dashboard data
//      */
//     @Get('dashboard')
//     @ApiOperation({ summary: 'Get complete dashboard overview' })
//     @ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
//     async getDashboardData() {
//         try {
//             const [
//                 realtimeMetrics,
//                 pendingCounts,
//                 performanceStats,
//                 healthStatus,
//             ] = await Promise.all([
//                 this.timescale.getRealtimeMetrics('24 hours'),
//                 this.redisPostgresSync.getPendingCounts(),
//                 this.redisPostgresSync.getSyncMetrics(),
//                 this.timescale.healthCheck(),
//             ]);

//             // Calculate totals from realtime metrics
//             const totals = realtimeMetrics.reduce((acc, metric) => ({
//                 impressions: acc.impressions + (metric.impression_count || 0),
//                 spend: acc.spend + (parseFloat(metric.total_spend) || 0),
//                 campaigns: Math.max(acc.campaigns, metric.active_campaigns || 0),
//             }), { impressions: 0, spend: 0, campaigns: 0 });

//             return {
//                 status: 'success',
//                 data: {
//                     summary: {
//                         last24Hours: {
//                             totalImpressions: totals.impressions,
//                             totalSpend: `${totals.spend.toFixed(2)}`,
//                             activeCampaigns: totals.campaigns,
//                             averageCPM: totals.impressions > 0 ? `${((totals.spend / totals.impressions) * 1000).toFixed(2)}` : '$0.00',
//                         },
//                         currentStatus: {
//                             pendingItems: pendingCounts.impressions + pendingCounts.clicks,
//                             pipelineHealth: healthStatus.status,
//                             totalProcessed: performanceStats.totalProcessed,
//                             errorRate: performanceStats.totalErrors > 0
//                                 ? `${((performanceStats.totalErrors / performanceStats.totalProcessed) * 100).toFixed(2)}%`
//                                 : '0%',
//                         },
//                     },
//                     charts: {
//                         hourlyMetrics: realtimeMetrics,
//                         description: 'Hourly impression and spend data for the last 24 hours',
//                     },
//                     alerts: this.generateAlerts(pendingCounts, healthStatus, performanceStats),
//                     timestamp: new Date().toISOString(),
//                 },
//             };

//         } catch (error) {
//             this.logger.error('Failed to get dashboard data:', error);
//             return {
//                 status: 'error',
//                 message: 'Failed to retrieve dashboard data',
//                 error: error.message,
//                 timestamp: new Date().toISOString(),
//             };
//         }
//     }

//     /**
//      * Reset circuit breaker (emergency operation)
//      */
//     @Post('circuit-breaker/reset')
//     @HttpCode(HttpStatus.OK)
//     @ApiOperation({ summary: 'Reset TimescaleDB circuit breaker (emergency operation)' })
//     @ApiResponse({ status: 200, description: 'Circuit breaker reset successfully' })
//     async resetCircuitBreaker() {
//         try {
//             this.logger.warn('🚨 Circuit breaker reset triggered via API');

//             // This would reset the circuit breaker in TimescaleSyncService
//             // You might want to add this method to TimescaleSyncService
//             await this.timescaleSync.resetCircuitBreaker?.();

//             return {
//                 status: 'success',
//                 message: 'Circuit breaker has been reset',
//                 warning: 'This is an emergency operation. Monitor system carefully.',
//                 timestamp: new Date().toISOString(),
//             };

//         } catch (error) {
//             this.logger.error('Failed to reset circuit breaker:', error);
//             return {
//                 status: 'error',
//                 message: 'Failed to reset circuit breaker',
//                 error: error.message,
//                 timestamp: new Date().toISOString(),
//             };
//         }
//     }

//     /**
//      * Helper method to calculate next sync time
//      */
//     private getNextSyncTime(intervalMinutes: number): string {
//         const now = new Date();
//         const nextSync = new Date(now.getTime() + intervalMinutes * 60000);
//         return nextSync.toISOString();
//     }

//     /**
//      * Helper method to estimate sync time based on pending items
//      */
//     private estimateSyncTime(pendingItems: number): string {
//         if (pendingItems === 0) return 'No pending items';

//         const itemsPerBatch = 500;
//         const batchProcessingTimeMs = 200; // Estimated 200ms per batch
//         const batches = Math.ceil(pendingItems / itemsPerBatch);
//         const estimatedMs = batches * batchProcessingTimeMs;

//         if (estimatedMs < 1000) return `${estimatedMs}ms`;
//         if (estimatedMs < 60000) return `${Math.round(estimatedMs / 1000)}s`;
//         return `${Math.round(estimatedMs / 60000)}m`;
//     }

//     /**
//      * Helper method to generate system alerts
//      */
//     private generateAlerts(pendingCounts: any, healthStatus: any, performanceStats: any): any[] {
//         const alerts = [];

//         // High pending items alert
//         const totalPending = pendingCounts.impressions + pendingCounts.clicks;
//         if (totalPending > 10000) {
//             alerts.push({
//                 type: 'warning',
//                 message: `High number of pending items: ${totalPending}`,
//                 action: 'Consider triggering manual sync',
//             });
//         }

//         // Health status alert
//         if (healthStatus.status !== 'healthy') {
//             alerts.push({
//                 type: 'error',
//                 message: 'TimescaleDB health check failed',
//                 action: 'Check TimescaleDB connection and logs',
//             });
//         }

//         // Error rate alert
//         if (performanceStats.totalErrors > 0) {
//             const errorRate = (performanceStats.totalErrors / performanceStats.totalProcessed) * 100;
//             if (errorRate > 5) {
//                 alerts.push({
//                     type: 'warning',
//                     message: `High error rate: ${errorRate.toFixed(2)}%`,
//                     action: 'Review sync service logs for errors',
//                 });
//             }
//         }

//         // No alerts
//         if (alerts.length === 0) {
//             alerts.push({
//                 type: 'success',
//                 message: 'All systems operating normally',
//                 action: 'No action required',
//             });
//         }

//         return alerts;
//     }
// }