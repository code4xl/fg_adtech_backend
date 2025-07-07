// src/rtb/controllers/budget-sync.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { BudgetSyncService } from '../services/budget-sync.service';
import { BudgetSyncToPostgresJob } from '../jobs/every-15-minutes/budget-sync-to-postgres.job';

@ApiTags('Budget Sync')
@Controller('budget-sync')
export class BudgetSyncController {
  constructor(
    private readonly budgetSyncService: BudgetSyncService,
    private readonly budgetSyncJob: BudgetSyncToPostgresJob,
  ) {}

  @Get('status')
  @ApiOperation({
    summary: 'Get budget sync status',
    description:
      'Returns the current status of budget synchronization between Redis and PostgreSQL',
  })
  @ApiResponse({
    status: 200,
    description: 'Budget sync status retrieved successfully',
  })
  async getBudgetSyncStatus() {
    try {
      const [syncStatus, jobHealth] = await Promise.all([
        this.budgetSyncService.getBudgetSyncStatus(),
        this.budgetSyncJob.getSyncJobHealth(),
      ]);

      return {
        status: 'success',
        data: {
          syncStatus,
          jobHealth,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      throw new BadRequestException({
        status: 'error',
        message: 'Failed to get budget sync status',
        error: error.message,
      });
    }
  }

  @Post('trigger/daily')
  @ApiOperation({
    summary: 'Trigger daily budget sync',
    description:
      'Manually trigger synchronization of daily budget spends from Redis to PostgreSQL',
  })
  @ApiResponse({
    status: 200,
    description: 'Daily budget sync triggered successfully',
  })
  async triggerDailySync() {
    try {
      const result = await this.budgetSyncService.syncDailyBudgetSpends();

      return {
        status: result.success ? 'success' : 'warning',
        message: 'Daily budget sync completed',
        data: {
          campaignsSynced: result.campaignsSynced,
          totalSpendSynced: result.totalSpendSynced,
          errors: result.errors,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new BadRequestException({
        status: 'error',
        message: 'Failed to trigger daily budget sync',
        error: error.message,
      });
    }
  }

  @Post('trigger/total')
  @ApiOperation({
    summary: 'Trigger total budget sync',
    description: 'Manually trigger synchronization of total campaign budgets',
  })
  @ApiResponse({
    status: 200,
    description: 'Total budget sync triggered successfully',
  })
  async triggerTotalSync() {
    try {
      const result = await this.budgetSyncService.syncTotalCampaignBudgets();

      return {
        status: result.success ? 'success' : 'warning',
        message: 'Total budget sync completed',
        data: {
          campaignsSynced: result.campaignsSynced,
          errors: result.errors,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new BadRequestException({
        status: 'error',
        message: 'Failed to trigger total budget sync',
        error: error.message,
      });
    }
  }

  @Post('trigger/emergency')
  @ApiOperation({
    summary: 'Trigger emergency sync',
    description:
      'Manually trigger both daily and total budget synchronization (emergency use)',
  })
  @ApiResponse({
    status: 200,
    description: 'Emergency sync triggered successfully',
  })
  async triggerEmergencySync() {
    try {
      const result = await this.budgetSyncJob.triggerEmergencySync();

      return {
        status: result.success ? 'success' : 'error',
        message: 'Emergency budget sync completed',
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new BadRequestException({
        status: 'error',
        message: 'Failed to trigger emergency sync',
        error: error.message,
      });
    }
  }

  @Post('sync/campaign/:campaignId')
  @ApiOperation({
    summary: 'Sync specific campaign',
    description: 'Manually trigger synchronization for a specific campaign',
  })
  @ApiParam({
    name: 'campaignId',
    description: 'ID of the campaign to sync',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Campaign sync triggered successfully',
  })
  async syncSpecificCampaign(@Param('campaignId') campaignId: string) {
    try {
      // Validate campaign ID format (basic UUID check)
      if (!campaignId || campaignId.length < 36) {
        throw new BadRequestException('Invalid campaign ID format');
      }

      const result = await this.budgetSyncService.emergencySync(campaignId);

      return {
        status: result.success ? 'success' : 'error',
        message: result.success
          ? 'Campaign budget synced successfully'
          : 'Failed to sync campaign budget',
        data: result.data || null,
        error: result.error || null,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new BadRequestException({
        status: 'error',
        message: 'Failed to sync specific campaign',
        error: error.message,
      });
    }
  }

  @Get('metrics')
  @ApiOperation({
    summary: 'Get budget sync metrics',
    description:
      'Returns detailed metrics about budget synchronization performance',
  })
  @ApiResponse({
    status: 200,
    description: 'Budget sync metrics retrieved successfully',
  })
  async getBudgetSyncMetrics() {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get comprehensive metrics from Redis
      const metrics = await this.budgetSyncService.getBudgetSyncStatus();
      const jobHealth = await this.budgetSyncJob.getSyncJobHealth();

      return {
        status: 'success',
        data: {
          overview: {
            redisCampaigns: metrics.redisCampaigns,
            postgresCampaigns: metrics.postgresCampaigns,
            lastSyncTime: metrics.lastSyncTime,
            syncLagCount: metrics.syncLag.length,
          },
          health: jobHealth,
          syncLag: metrics.syncLag,
          date: today,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new BadRequestException({
        status: 'error',
        message: 'Failed to get budget sync metrics',
        error: error.message,
      });
    }
  }

  @Get('health')
  @ApiOperation({
    summary: 'Get budget sync health',
    description: 'Returns health status of the budget sync system',
  })
  @ApiResponse({
    status: 200,
    description: 'Budget sync health retrieved successfully',
  })
  async getBudgetSyncHealth() {
    try {
      const health = await this.budgetSyncJob.getSyncJobHealth();

      const httpStatus =
        health.status === 'healthy'
          ? HttpStatus.OK
          : health.status === 'warning'
            ? HttpStatus.OK
            : HttpStatus.SERVICE_UNAVAILABLE;

      return {
        status: health.status,
        message: `Budget sync system is ${health.status}`,
        details: health.details,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new BadRequestException({
        status: 'error',
        message: 'Failed to get budget sync health',
        error: error.message,
      });
    }
  }

  @Get('comparison/:campaignId')
  @ApiOperation({
    summary: 'Compare Redis vs PostgreSQL data',
    description:
      'Compare budget data between Redis and PostgreSQL for a specific campaign',
  })
  @ApiParam({
    name: 'campaignId',
    description: 'ID of the campaign to compare',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Budget comparison retrieved successfully',
  })
  async compareBudgetData(@Param('campaignId') campaignId: string) {
    try {
      // This would be implemented in the budget sync service
      const comparison =
        await this.budgetSyncService.compareCampaignBudgetData(campaignId);

      return {
        status: 'success',
        data: comparison,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new BadRequestException({
        status: 'error',
        message: 'Failed to compare budget data',
        error: error.message,
      });
    }
  }
}
