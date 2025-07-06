// src/rtb/controllers/financial-monitoring.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { PublisherRevenueJob } from '../jobs/daily/publisher-revenue.job';
import { AdvertiserSpendingJob } from '../jobs/daily/advertiser-spending.job';
import { SystemRevenueJob } from '../jobs/daily/system-revenue.job';
import { TrackingService } from 'src/tracking/tracking.service';
import { BudgetManagerService } from '../services/budget-manager.service';

@ApiTags('Financial Monitoring')
@Controller('financial')
export class FinancialMonitoringController {
  private readonly logger = new Logger(FinancialMonitoringController.name);

  constructor(
    private readonly publisherRevenueJob: PublisherRevenueJob,
    private readonly advertiserSpendingJob: AdvertiserSpendingJob,
    private readonly systemRevenueJob: SystemRevenueJob,
    private readonly trackingService: TrackingService,
    private readonly budgetManager: BudgetManagerService,
  ) {}

  // ===== DASHBOARD OVERVIEW =====

  @Get('dashboard')
  @ApiOperation({
    summary: 'Get financial dashboard overview',
    description:
      'Returns comprehensive financial metrics and system health status',
  })
  @ApiResponse({
    status: 200,
    description: 'Financial dashboard data retrieved successfully',
  })
  async getFinancialDashboard(): Promise<any> {
    try {
      this.logger.debug('Fetching financial dashboard data');

      // Get all job statuses in parallel
      const [
        publisherStatus,
        advertiserStatus,
        systemStatus,
        pendingCounts,
        revenueInsights,
      ] = await Promise.all([
        this.publisherRevenueJob.getProcessingStatus(),
        this.advertiserSpendingJob.getProcessingStatus(),
        this.systemRevenueJob.getProcessingStatus(),
        this.trackingService.getPendingEventsCount(),
        this.systemRevenueJob.getRevenueInsights(30), // Last 30 days
      ]);

      // Calculate overall system health
      const totalPendingEvents =
        pendingCounts.impressions +
        pendingCounts.clicks +
        pendingCounts.budgetTransactions +
        pendingCounts.publisherRevenue +
        pendingCounts.advertiserSpending +
        pendingCounts.systemRevenue;

      let overallHealth = 'healthy';
      if (totalPendingEvents > 10000) overallHealth = 'warning';
      if (totalPendingEvents > 50000) overallHealth = 'critical';

      const dashboard = {
        timestamp: new Date().toISOString(),
        overallHealth,

        // System health overview
        systemHealth: {
          score: systemStatus.systemHealth.score,
          status: overallHealth,
          totalPendingEvents,
          breakdown: systemStatus.systemHealth.breakdown,
        },

        // Pending events summary
        pendingEvents: {
          total: totalPendingEvents,
          breakdown: pendingCounts,
        },

        // Job processing status
        jobs: {
          publisherRevenue: {
            lastRun: publisherStatus.lastRun,
            todayProcessed: publisherStatus.todayProcessed,
            successCount: publisherStatus.successCount,
            failureCount: publisherStatus.failureCount,
            pendingRecords: publisherStatus.pendingRecords,
          },
          advertiserSpending: {
            lastRun: advertiserStatus.lastRun,
            todayProcessed: advertiserStatus.todaySpendingProcessed,
            successCount: advertiserStatus.successCount,
            failureCount: advertiserStatus.failureCount,
            pendingRecords:
              advertiserStatus.pendingSpending +
              advertiserStatus.pendingTransactions,
          },
          systemRevenue: {
            lastRun: systemStatus.lastRun,
            todayProcessed: systemStatus.todayProcessed,
            successCount: systemStatus.successCount,
            failureCount: systemStatus.failureCount,
            pendingRecords: systemStatus.pendingRecords,
          },
        },

        // Revenue insights
        revenue: {
          last30Days: {
            totalSystemEarnings: revenueInsights.totalSystemEarnings,
            totalPublisherPayouts: revenueInsights.totalPublisherPayouts,
            averageDailyRevenue: revenueInsights.averageDailyRevenue,
          },
          trends: revenueInsights.commissionTrends,
          topPerformingDays: revenueInsights.topPerformingDays,
        },

        // Recent errors (if any)
        // recentErrors: {
        //   publisher: publisherStatus.recentErrors.slice(0, 3),
        //   advertiser: advertiserStatus.recentErrors.slice(0, 3),
        //   system: systemStatus.recentErrors.slice(0, 3),
        // },
      };

      return dashboard;
    } catch (error) {
      this.logger.error('Failed to get financial dashboard', {
        error: error.message,
      });
      throw new BadRequestException('Failed to retrieve financial dashboard');
    }
  }

  // ===== INDIVIDUAL JOB STATUS ENDPOINTS =====

  @Get('jobs/publisher-revenue/status')
  @ApiOperation({
    summary: 'Get publisher revenue job status',
    description: 'Returns detailed status of publisher revenue processing job',
  })
  async getPublisherRevenueStatus(): Promise<any> {
    try {
      return await this.publisherRevenueJob.getProcessingStatus();
    } catch (error) {
      this.logger.error('Failed to get publisher revenue status', {
        error: error.message,
      });
      throw new BadRequestException(
        'Failed to retrieve publisher revenue status',
      );
    }
  }

  @Get('jobs/advertiser-spending/status')
  @ApiOperation({
    summary: 'Get advertiser spending job status',
    description:
      'Returns detailed status of advertiser spending processing job',
  })
  async getAdvertiserSpendingStatus(): Promise<any> {
    try {
      return await this.advertiserSpendingJob.getProcessingStatus();
    } catch (error) {
      this.logger.error('Failed to get advertiser spending status', {
        error: error.message,
      });
      throw new BadRequestException(
        'Failed to retrieve advertiser spending status',
      );
    }
  }

  @Get('jobs/system-revenue/status')
  @ApiOperation({
    summary: 'Get system revenue job status',
    description: 'Returns detailed status of system revenue processing job',
  })
  async getSystemRevenueStatus(): Promise<any> {
    try {
      return await this.systemRevenueJob.getProcessingStatus();
    } catch (error) {
      this.logger.error('Failed to get system revenue status', {
        error: error.message,
      });
      throw new BadRequestException('Failed to retrieve system revenue status');
    }
  }

  // ===== MANUAL JOB TRIGGERS =====

  @Post('jobs/publisher-revenue/trigger')
  @ApiOperation({
    summary: 'Manually trigger publisher revenue processing',
    description:
      'Triggers immediate processing of pending publisher revenue data',
  })
  @ApiResponse({
    status: 200,
    description: 'Publisher revenue processing triggered successfully',
  })
  async triggerPublisherRevenueProcessing(): Promise<any> {
    try {
      this.logger.debug('Manual trigger: Publisher revenue processing');

      const result = await this.publisherRevenueJob.triggerManualProcessing();

      return {
        success: result.success,
        message: result.success
          ? 'Publisher revenue processing completed successfully'
          : 'Publisher revenue processing failed',
        data: result,
        triggeredAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to trigger publisher revenue processing', {
        error: error.message,
      });
      throw new BadRequestException(
        'Failed to trigger publisher revenue processing',
      );
    }
  }

  @Post('jobs/advertiser-spending/trigger')
  @ApiOperation({
    summary: 'Manually trigger advertiser spending processing',
    description:
      'Triggers immediate processing of pending advertiser spending data',
  })
  @ApiResponse({
    status: 200,
    description: 'Advertiser spending processing triggered successfully',
  })
  async triggerAdvertiserSpendingProcessing(): Promise<any> {
    try {
      this.logger.debug('Manual trigger: Advertiser spending processing');

      const result = await this.advertiserSpendingJob.triggerManualProcessing();

      return {
        success: result.success,
        message: result.success
          ? 'Advertiser spending processing completed successfully'
          : 'Advertiser spending processing failed',
        data: result,
        triggeredAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to trigger advertiser spending processing', {
        error: error.message,
      });
      throw new BadRequestException(
        'Failed to trigger advertiser spending processing',
      );
    }
  }

  @Post('jobs/system-revenue/trigger')
  @ApiOperation({
    summary: 'Manually trigger system revenue processing',
    description: 'Triggers immediate processing of pending system revenue data',
  })
  @ApiResponse({
    status: 200,
    description: 'System revenue processing triggered successfully',
  })
  async triggerSystemRevenueProcessing(): Promise<any> {
    try {
      this.logger.debug('Manual trigger: System revenue processing');

      const result = await this.systemRevenueJob.triggerManualProcessing();

      return {
        success: result.success,
        message: result.success
          ? 'System revenue processing completed successfully'
          : 'System revenue processing failed',
        data: result,
        triggeredAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to trigger system revenue processing', {
        error: error.message,
      });
      throw new BadRequestException(
        'Failed to trigger system revenue processing',
      );
    }
  }

  @Post('jobs/all/trigger')
  @ApiOperation({
    summary: 'Manually trigger all financial processing jobs',
    description:
      'Triggers immediate processing of all pending financial data (sequential execution)',
  })
  @ApiResponse({
    status: 200,
    description: 'All financial processing jobs triggered successfully',
  })
  async triggerAllFinancialProcessing(): Promise<any> {
    try {
      this.logger.debug('Manual trigger: All financial processing jobs');

      const startTime = Date.now();

      // Run jobs sequentially to avoid database conflicts
      const publisherResult =
        await this.publisherRevenueJob.triggerManualProcessing();
      const advertiserResult =
        await this.advertiserSpendingJob.triggerManualProcessing();
      const systemResult =
        await this.systemRevenueJob.triggerManualProcessing();

      const totalTime = Date.now() - startTime;
      const allSuccessful =
        publisherResult.success &&
        advertiserResult.success &&
        systemResult.success;

      return {
        success: allSuccessful,
        message: allSuccessful
          ? 'All financial processing jobs completed successfully'
          : 'Some financial processing jobs failed',
        totalProcessingTime: totalTime,
        results: {
          publisherRevenue: publisherResult,
          advertiserSpending: advertiserResult,
          systemRevenue: systemResult,
        },
        triggeredAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to trigger all financial processing', {
        error: error.message,
      });
      throw new BadRequestException(
        'Failed to trigger all financial processing',
      );
    }
  }

  // ===== PENDING EVENTS MONITORING =====

  // @Get('pending-events')
  // @ApiOperation({
  //   summary: 'Get pending events count',
  //   description: 'Returns count of pending events in all Redis queues',
  // })
  // async getPendingEvents(): Promise<any> {
  //   try {
  //     const pendingCounts = await this.trackingService.getPendingEventsCount();
  //     const budgetCounts = 0;
  //     // await this.budgetManager.getPendingTransactionCounts();

  //     return {
  //       timestamp: new Date().toISOString(),
  //       totalPending: Object.values(pendingCounts).reduce(
  //         (sum, count) => sum + count,
  //         0,
  //       ),
  //       breakdown: {
  //         ...pendingCounts,
  //         budgetTransactions: budgetCounts.budgetTransactions,
  //       },
  //       queues: {
  //         events: {
  //           impressions: pendingCounts.impressions,
  //           clicks: pendingCounts.clicks,
  //         },
  //         financial: {
  //           publisherRevenue: pendingCounts.publisherRevenue,
  //           advertiserSpending: pendingCounts.advertiserSpending,
  //           systemRevenue: pendingCounts.systemRevenue,
  //           budgetTransactions: budgetCounts.budgetTransactions,
  //         },
  //       },
  //     };
  //   } catch (error) {
  //     this.logger.error('Failed to get pending events', {
  //       error: error.message,
  //     });
  //     throw new BadRequestException('Failed to retrieve pending events');
  //   }
  // }

  // ===== REVENUE INSIGHTS =====

  @Get('insights/revenue')
  @ApiOperation({
    summary: 'Get revenue insights',
    description:
      'Returns revenue trends, top performing days, and financial analytics',
  })
  @ApiResponse({
    status: 200,
    description: 'Revenue insights retrieved successfully',
  })
  async getRevenueInsights(): Promise<any> {
    try {
      const insights = await this.systemRevenueJob.getRevenueInsights(30);

      return {
        timestamp: new Date().toISOString(),
        period: 'Last 30 days',
        ...insights,
      };
    } catch (error) {
      this.logger.error('Failed to get revenue insights', {
        error: error.message,
      });
      throw new BadRequestException('Failed to retrieve revenue insights');
    }
  }

  @Get('insights/revenue/:days')
  @ApiOperation({
    summary: 'Get revenue insights for specific period',
    description:
      'Returns revenue trends and analytics for specified number of days',
  })
  @ApiParam({
    name: 'days',
    description: 'Number of days to analyze (1-365)',
    example: 30,
  })
  async getRevenueInsightsForPeriod(@Param('days') days: string): Promise<any> {
    try {
      const daysNum = parseInt(days);

      if (isNaN(daysNum) || daysNum < 1 || daysNum > 365) {
        throw new BadRequestException(
          'Days must be a number between 1 and 365',
        );
      }

      const insights = await this.systemRevenueJob.getRevenueInsights(daysNum);

      return {
        timestamp: new Date().toISOString(),
        period: `Last ${daysNum} days`,
        ...insights,
      };
    } catch (error) {
      this.logger.error('Failed to get revenue insights for period', {
        error: error.message,
        days,
      });

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Failed to retrieve revenue insights');
    }
  }

  // ===== CAMPAIGN METRICS =====

  @Get('campaign/:campaignId/metrics')
  @ApiOperation({
    summary: 'Get campaign financial metrics',
    description:
      'Returns spending, impressions, and performance metrics for a specific campaign',
  })
  @ApiParam({
    name: 'campaignId',
    description: 'Campaign ID',
    example: 'uuid-string',
  })
  async getCampaignMetrics(
    @Param('campaignId') campaignId: string,
  ): Promise<any> {
    try {
      const metrics = await this.trackingService.getCampaignMetrics(campaignId);

      if (!metrics) {
        throw new BadRequestException('Campaign metrics not found');
      }

      return {
        timestamp: new Date().toISOString(),
        campaignId,
        ...metrics,
      };
    } catch (error) {
      this.logger.error('Failed to get campaign metrics', {
        error: error.message,
        campaignId,
      });

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Failed to retrieve campaign metrics');
    }
  }

  @Get('creative/:creativeId/metrics')
  @ApiOperation({
    summary: 'Get creative performance metrics',
    description: 'Returns performance metrics for a specific creative',
  })
  @ApiParam({
    name: 'creativeId',
    description: 'Creative ID',
    example: 'uuid-string',
  })
  async getCreativeMetrics(
    @Param('creativeId') creativeId: string,
  ): Promise<any> {
    try {
      const metrics = await this.trackingService.getCreativeMetrics(creativeId);

      if (!metrics) {
        throw new BadRequestException('Creative metrics not found');
      }

      return {
        timestamp: new Date().toISOString(),
        creativeId,
        ...metrics,
      };
    } catch (error) {
      this.logger.error('Failed to get creative metrics', {
        error: error.message,
        creativeId,
      });

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Failed to retrieve creative metrics');
    }
  }

  @Get('publisher/:publisherId/revenue')
  @ApiOperation({
    summary: 'Get publisher revenue metrics',
    description: 'Returns revenue metrics for a specific publisher',
  })
  @ApiParam({
    name: 'publisherId',
    description: 'Publisher ID',
    example: 'uuid-string',
  })
  async getPublisherRevenue(
    @Param('publisherId') publisherId: string,
  ): Promise<any> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const revenue =
        await this.trackingService.getPublisherRevenue(publisherId);

      return {
        timestamp: new Date().toISOString(),
        publisherId,
        date: today,
        totalRevenue: revenue,
      };
    } catch (error) {
      this.logger.error('Failed to get publisher revenue', {
        error: error.message,
        publisherId,
      });
      throw new BadRequestException('Failed to retrieve publisher revenue');
    }
  }
}
