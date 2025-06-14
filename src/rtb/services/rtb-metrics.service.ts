import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { METRICS_KEYS, RTB_CACHE_TTL } from '../constants/cache-keys';

@Injectable()
export class RTBMetricsService {
    private readonly logger = new Logger(RTBMetricsService.name);

    constructor(private readonly redis: RedisService) { }

    /**
     * Record auction processing metrics
     */
    async recordAuctionProcessing(data: AuctionProcessingMetrics): Promise<void> {
        try {
            const now = new Date();
            const hour = now.getHours();
            const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
            const minute = now.getMinutes();
            const dateHourMinute = `${date}_${hour}_${minute}`;

            this.logger.debug('Recording auction processing metrics', {
                auctionId: data.auctionId,
                status: data.status,
                processingTime: data.processingTime,
            });

            // Record metrics in parallel for performance
            await Promise.all([
                // Hourly counters
                this.recordHourlyMetrics(data, hour, date),

                // Minute-level throughput tracking
                this.recordThroughputMetrics(dateHourMinute, data.status),

                // Processing time histograms
                this.recordProcessingTimeMetrics(data.processingTime, hour),

                // Error tracking
                this.recordErrorMetrics(data, hour, date),

                // Real-time counters for dashboards
                this.updateRealtimeCounters(data),
            ]);

            this.logger.debug('✅ Auction processing metrics recorded successfully', {
                auctionId: data.auctionId,
                status: data.status,
            });

        } catch (error) {
            this.logger.error('❌ Failed to record auction processing metrics', {
                error: error.message,
                auctionId: data.auctionId,
            });
            // Don't throw - metrics failure shouldn't break main flow
        }
    }

    /**
     * Record hourly aggregated metrics
     */
    private async recordHourlyMetrics(
        data: AuctionProcessingMetrics,
        hour: number,
        date: string,
    ): Promise<void> {
        const pipeline = this.redis.pipeline();

        // Total auction count
        const totalKey = METRICS_KEYS.RTB_HOURLY_TOTAL_AUCTIONS(hour, date);
        pipeline.incr(totalKey);
        pipeline.expire(totalKey, RTB_CACHE_TTL.HOURLY_METRICS);

        // Success/failure counts
        const statusKey = METRICS_KEYS.RTB_HOURLY_AUCTION_STATUS(data.status, hour, date);
        pipeline.incr(statusKey);
        pipeline.expire(statusKey, RTB_CACHE_TTL.HOURLY_METRICS);

        // Processing time accumulation
        const timeKey = METRICS_KEYS.RTB_HOURLY_PROCESSING_TIME(hour, date);
        pipeline.incrby(timeKey, Math.round(data.processingTime));
        pipeline.expire(timeKey, RTB_CACHE_TTL.HOURLY_METRICS);

        // Bid count if available
        if (data.bidCount) {
            const bidKey = METRICS_KEYS.RTB_HOURLY_BID_COUNT(hour, date);
            pipeline.incrby(bidKey, data.bidCount);
            pipeline.expire(bidKey, RTB_CACHE_TTL.HOURLY_METRICS);
        }

        await pipeline.exec();
    }

    /**
     * Record minute-level throughput for real-time monitoring
     */
    private async recordThroughputMetrics(
        dateHourMinute: string,
        status: string,
    ): Promise<void> {
        const throughputKey = METRICS_KEYS.RTB_THROUGHPUT_PER_MINUTE(dateHourMinute);
        const statusThroughputKey = METRICS_KEYS.RTB_THROUGHPUT_BY_STATUS(dateHourMinute, status);

        await Promise.all([
            this.redis.incr(throughputKey),
            this.redis.incr(statusThroughputKey),
            this.redis.expire(throughputKey, RTB_CACHE_TTL.THROUGHPUT_METRICS),
            this.redis.expire(statusThroughputKey, RTB_CACHE_TTL.THROUGHPUT_METRICS),
        ]);
    }

    /**
     * Record processing time distribution for performance analysis
     */
    private async recordProcessingTimeMetrics(
        processingTime: number,
        hour: number,
    ): Promise<void> {
        // Categorize processing times into buckets
        let bucket: string;
        if (processingTime < 50) bucket = 'under_50ms';
        else if (processingTime < 100) bucket = 'under_100ms';
        else if (processingTime < 200) bucket = 'under_200ms';
        else if (processingTime < 500) bucket = 'under_500ms';
        else bucket = 'over_500ms';

        const bucketKey = METRICS_KEYS.RTB_PROCESSING_TIME_BUCKET(bucket, hour);

        await this.redis.incr(bucketKey);
        await this.redis.expire(bucketKey, RTB_CACHE_TTL.PROCESSING_TIME_BUCKETS);
    }

    /**
     * Record error metrics for troubleshooting
     */
    private async recordErrorMetrics(
        data: AuctionProcessingMetrics,
        hour: number,
        date: string,
    ): Promise<void> {
        if (data.status !== 'error') return;

        const errorType = data.errorType || 'unknown';
        const errorKey = METRICS_KEYS.RTB_ERROR_BY_TYPE(errorType, hour, date);

        await this.redis.incr(errorKey);
        await this.redis.expire(errorKey, RTB_CACHE_TTL.ERROR_METRICS);

        // Store recent error details for debugging
        const errorDetailKey = METRICS_KEYS.RTB_RECENT_ERRORS();
        const errorDetail = {
            auctionId: data.auctionId,
            errorType,
            timestamp: data.timestamp.toISOString(),
            processingTime: data.processingTime,
        };

        await this.redis.lpush(errorDetailKey, JSON.stringify(errorDetail));
        await this.redis.ltrim(errorDetailKey, 0, 99); // Keep last 100 errors
        await this.redis.expire(errorDetailKey, RTB_CACHE_TTL.ERROR_DETAILS);
    }

    /**
     * Update real-time counters for live dashboards
     */
    private async updateRealtimeCounters(data: AuctionProcessingMetrics): Promise<void> {
        const pipeline = this.redis.pipeline();

        // Rolling counters (last 5 minutes)
        const now = Math.floor(Date.now() / 60000); // Current minute
        const realtimeKey = METRICS_KEYS.RTB_REALTIME_COUNTER(now);

        pipeline.hincrby(realtimeKey, 'total_auctions', 1);
        pipeline.hincrby(realtimeKey, `${data.status}_auctions`, 1);
        pipeline.hincrby(realtimeKey, 'total_processing_time', Math.round(data.processingTime));

        if (data.bidCount) {
            pipeline.hincrby(realtimeKey, 'total_bids', data.bidCount);
        }

        pipeline.expire(realtimeKey, 300); // 5 minutes

        await pipeline.exec();
    }

    /**
     * Get current real-time metrics
     */
    async getRealtimeMetrics(): Promise<RealtimeMetrics> {
        try {
            const now = Math.floor(Date.now() / 60000);
            const promises = [];

            // Get last 5 minutes of data
            for (let i = 0; i < 5; i++) {
                const minute = now - i;
                const key = METRICS_KEYS.RTB_REALTIME_COUNTER(minute);
                promises.push(this.redis.smembers(key));
            }

            const results = await Promise.all(promises);

            // Aggregate the results
            let totalAuctions = 0;
            let successfulAuctions = 0;
            let failedAuctions = 0;
            let totalProcessingTime = 0;
            let totalBids = 0;

            for (const result of results) {
                if (result && typeof result === 'object') {
                    totalAuctions += parseInt(result['total_auctions'] || '0');
                    successfulAuctions += parseInt(result['success_auctions'] || '0');
                    failedAuctions += parseInt(result['error_auctions'] || '0');
                    totalProcessingTime += parseInt(result['total_processing_time'] || '0');
                    totalBids += parseInt(result['total_bids'] || '0');
                }
            }

            const averageProcessingTime = totalAuctions > 0
                ? Math.round(totalProcessingTime / totalAuctions)
                : 0;

            const errorRate = totalAuctions > 0
                ? Math.round((failedAuctions / totalAuctions) * 100 * 100) / 100
                : 0;

            return {
                totalAuctions,
                successfulAuctions,
                failedAuctions,
                averageProcessingTime,
                errorRate,
                throughputPerMinute: Math.round(totalAuctions / 5), // 5-minute average
                lastUpdated: new Date().toISOString(),
            };

        } catch (error) {
            this.logger.error('Failed to get realtime metrics', { error: error.message });
            return {
                totalAuctions: 0,
                successfulAuctions: 0,
                failedAuctions: 0,
                averageProcessingTime: 0,
                errorRate: 0,
                throughputPerMinute: 0,
                lastUpdated: new Date().toISOString(),
            };
        }
    }

    /**
     * Get hourly metrics for a specific time range
     */
    async getHourlyMetrics(startHour: number, endHour?: number): Promise<HourlyMetrics[]> {
        try {
            const end = endHour || new Date().getHours();
            const results: HourlyMetrics[] = [];
            const date = new Date().toISOString().split('T')[0];

            for (let hour = startHour; hour <= end; hour++) {
                const metrics = await this.getHourlyMetricsForHour(hour, date);
                results.push(metrics);
            }

            return results;
        } catch (error) {
            this.logger.error('Failed to get hourly metrics', { error: error.message });
            return [];
        }
    }

    private async getHourlyMetricsForHour(hour: number, date: string): Promise<HourlyMetrics> {
        const [
            totalAuctions,
            successfulAuctions,
            failedAuctions,
            totalProcessingTime,
        ] = await Promise.all([
            this.redis.get<string>(METRICS_KEYS.RTB_HOURLY_TOTAL_AUCTIONS(hour, date)),
            this.redis.get<string>(METRICS_KEYS.RTB_HOURLY_AUCTION_STATUS('success', hour, date)),
            this.redis.get<string>(METRICS_KEYS.RTB_HOURLY_AUCTION_STATUS('error', hour, date)),
            this.redis.get<string>(METRICS_KEYS.RTB_HOURLY_PROCESSING_TIME(hour, date)),
        ]);

        const total = parseInt(totalAuctions || '0');
        const successful = parseInt(successfulAuctions || '0');
        const failed = parseInt(failedAuctions || '0');
        const processingTime = parseInt(totalProcessingTime || '0');

        return {
            hour,
            date,
            totalAuctions: total,
            successfulAuctions: successful,
            failedAuctions: failed,
            totalProcessingTime: processingTime,
            averageProcessingTime: total > 0 ? Math.round(processingTime / total) : 0,
            errorRate: total > 0 ? Math.round((failed / total) * 100 * 100) / 100 : 0,
            topErrors: {}, // TODO: Implement top errors aggregation
        };
    }

    /**
     * Get performance summary for monitoring dashboards
     */
    async getPerformanceSummary(timeRange: 'hour' | 'day' | 'week' = 'hour'): Promise<any> {
        try {
            const realtimeMetrics = await this.getRealtimeMetrics();

            let historicalMetrics;
            switch (timeRange) {
                case 'hour':
                    const currentHour = new Date().getHours();
                    historicalMetrics = await this.getHourlyMetrics(currentHour - 1, currentHour);
                    break;
                case 'day':
                    historicalMetrics = await this.getHourlyMetrics(0, 23);
                    break;
                default:
                    historicalMetrics = [];
            }

            return {
                realtime: realtimeMetrics,
                historical: historicalMetrics,
                summary: {
                    status: realtimeMetrics.errorRate < 5 ? 'healthy' :
                        realtimeMetrics.errorRate < 15 ? 'warning' : 'critical',
                    avgResponseTime: realtimeMetrics.averageProcessingTime,
                    throughput: realtimeMetrics.throughputPerMinute,
                    uptime: '99.9%', // TODO: Calculate actual uptime
                },
                timestamp: new Date().toISOString(),
            };

        } catch (error) {
            this.logger.error('Failed to get performance summary', { error: error.message });
            return {
                error: 'Failed to retrieve metrics',
                timestamp: new Date().toISOString(),
            };
        }
    }

    /**
     * Record campaign-specific metrics
     */
    async recordCampaignMetrics(campaignId: string, data: {
        impressions?: number;
        clicks?: number;
        spend?: number;
        conversions?: number;
    }): Promise<void> {
        try {
            const hour = new Date().getHours();
            const date = new Date().toISOString().split('T')[0];
            const pipeline = this.redis.pipeline();

            if (data.impressions) {
                const key = METRICS_KEYS.CAMPAIGN_HOURLY_IMPRESSIONS(campaignId, hour, date);
                pipeline.incrby(key, data.impressions);
                pipeline.expire(key, RTB_CACHE_TTL.CAMPAIGN_METRICS);
            }

            if (data.clicks) {
                const key = METRICS_KEYS.CAMPAIGN_HOURLY_CLICKS(campaignId, hour, date);
                pipeline.incrby(key, data.clicks);
                pipeline.expire(key, RTB_CACHE_TTL.CAMPAIGN_METRICS);
            }

            if (data.spend) {
                const key = METRICS_KEYS.CAMPAIGN_HOURLY_SPEND(campaignId, hour, date);
                pipeline.incrbyfloat(key, data.spend);
                pipeline.expire(key, RTB_CACHE_TTL.CAMPAIGN_METRICS);
            }

            await pipeline.exec();

            this.logger.debug('Campaign metrics recorded', { campaignId, data });

        } catch (error) {
            this.logger.error('Failed to record campaign metrics', {
                error: error.message,
                campaignId,
            });
        }
    }

    /**
     * Get campaign performance metrics
     */
    async getCampaignMetrics(campaignId: string, hours: number = 24): Promise<any> {
        try {
            const results = [];
            const now = new Date();

            for (let i = 0; i < hours; i++) {
                const targetTime = new Date(now.getTime() - (i * 60 * 60 * 1000));
                const hour = targetTime.getHours();
                const date = targetTime.toISOString().split('T')[0];

                const [impressions, clicks, spend] = await Promise.all([
                    this.redis.get<string>(METRICS_KEYS.CAMPAIGN_HOURLY_IMPRESSIONS(campaignId, hour, date)),
                    this.redis.get<string>(METRICS_KEYS.CAMPAIGN_HOURLY_CLICKS(campaignId, hour, date)),
                    this.redis.get<string>(METRICS_KEYS.CAMPAIGN_HOURLY_SPEND(campaignId, hour, date)),
                ]);

                const impressionCount = parseInt(impressions || '0');
                const clickCount = parseInt(clicks || '0');
                const spendAmount = parseFloat(spend || '0');

                results.push({
                    hour,
                    date,
                    impressions: impressionCount,
                    clicks: clickCount,
                    spend: spendAmount,
                    ctr: impressionCount > 0 ? (clickCount / impressionCount) * 100 : 0,
                    cpc: clickCount > 0 ? spendAmount / clickCount : 0,
                });
            }

            return {
                campaignId,
                timeRange: `Last ${hours} hours`,
                data: results.reverse(), // Most recent first
                summary: this.calculateCampaignSummary(results),
            };

        } catch (error) {
            this.logger.error('Failed to get campaign metrics', {
                error: error.message,
                campaignId,
            });
            return { error: 'Failed to retrieve campaign metrics' };
        }
    }

    private calculateCampaignSummary(data: any[]): any {
        const totals = data.reduce((acc, item) => ({
            impressions: acc.impressions + item.impressions,
            clicks: acc.clicks + item.clicks,
            spend: acc.spend + item.spend,
        }), { impressions: 0, clicks: 0, spend: 0 });

        return {
            totalImpressions: totals.impressions,
            totalClicks: totals.clicks,
            totalSpend: Math.round(totals.spend * 100) / 100,
            overallCTR: totals.impressions > 0
                ? Math.round((totals.clicks / totals.impressions) * 100 * 100) / 100
                : 0,
            overallCPC: totals.clicks > 0
                ? Math.round((totals.spend / totals.clicks) * 100) / 100
                : 0,
        };
    }
}