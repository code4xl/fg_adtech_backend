// src/timescale/controllers/analytics.controller.ts
import { Controller, Get, Query, Param, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { TimescaleService } from '../timescale.service';

/**
 * TimescaleDB Analytics Controller - Phase 6 Implementation
 * 
 * **Why this controller is needed:**
 * - Provides HTTP API access to TimescaleDB analytics
 * - Enables dashboard and reporting functionality
 * - Supports real-time monitoring and alerting
 * - Facilitates campaign optimization workflows
 */
@ApiTags('TimescaleDB Analytics')
@Controller('analytics/timescale')
export class TimescaleAnalyticsController {
    private readonly logger = new Logger(TimescaleAnalyticsController.name);

    constructor(private readonly timescale: TimescaleService) { }

    /**
     * Get campaign performance metrics
     */
    @Get('campaigns/:campaignId/metrics')
    @ApiOperation({
        summary: 'Get campaign performance metrics from TimescaleDB',
        description: 'Retrieves time-series performance data for a specific campaign'
    })
    @ApiResponse({ status: 200, description: 'Campaign metrics retrieved successfully' })
    async getCampaignMetrics(
        @Param('campaignId') campaignId: string,
        @Query('startTime') startTime: string,
        @Query('endTime') endTime: string,
    ) {
        try {
            const metrics = await this.timescale.getCampaignMetrics(
                campaignId,
                new Date(startTime),
                new Date(endTime)
            );

            return {
                success: true,
                data: metrics,
                campaignId,
                timeRange: { startTime, endTime }
            };
        } catch (error) {
            this.logger.error(`Failed to get campaign metrics for ${campaignId}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get real-time system metrics
     */
    @Get('realtime')
    @ApiOperation({
        summary: 'Get real-time system metrics',
        description: 'Retrieves current system performance metrics from TimescaleDB'
    })
    @ApiQuery({ name: 'timeRange', required: false, description: 'Time range (e.g., "1 hour", "30 minutes")' })
    async getRealtimeMetrics(@Query('timeRange') timeRange: string = '1 hour') {
        try {
            const metrics = await this.timescale.getRealtimeMetrics(timeRange);

            return {
                success: true,
                data: metrics,
                timeRange,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            this.logger.error('Failed to get realtime metrics:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Health check endpoint
     */
    @Get('health')
    @ApiOperation({
        summary: 'TimescaleDB health check',
        description: 'Check the health status of TimescaleDB service'
    })
    async healthCheck() {
        try {
            return await this.timescale.healthCheck();
        } catch (error) {
            this.logger.error('TimescaleDB health check failed:', error);
            return {
                status: 'unhealthy',
                details: { error: error.message }
            };
        }
    }
}