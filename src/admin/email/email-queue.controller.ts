import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  Put,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiExcludeController,
} from '@nestjs/swagger';
import { AdminGuard } from 'src/common/guards/authorization.guard';
import { QueueStatsDto, CreateEmailJobDto } from 'src/mail/dto/email-job.dto';
import { EmailProcessorService } from 'src/mail/email-processor.service';
import { EmailQueueService } from 'src/mail/email-queue.service';


@ApiExcludeController()
@ApiTags('Admin - Email Management')
@Controller('admin/email-queue')
@UseGuards(AdminGuard)
@ApiBearerAuth()
export class EmailQueueController {
  constructor(
    private readonly emailQueueService: EmailQueueService,
    private readonly emailProcessorService: EmailProcessorService,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get email queue statistics' })
  @ApiResponse({
    status: 200,
    description: 'Queue statistics retrieved successfully',
    type: QueueStatsDto,
  })
  async getQueueStats() {
    return await this.emailQueueService.getQueueStats();
  }

  @Get('processing-stats')
  @ApiOperation({ summary: 'Get email processing statistics' })
  @ApiResponse({
    status: 200,
    description: 'Processing statistics retrieved successfully',
  })
  async getProcessingStats() {
    return await this.emailProcessorService.getProcessingStats();
  }

  @Get('health')
  @ApiOperation({ summary: 'Check email queue health' })
  @ApiResponse({
    status: 200,
    description: 'Health check completed',
  })
  async healthCheck() {
    return await this.emailProcessorService.healthCheck();
  }

  @Get('job/:id/status')
  @ApiOperation({ summary: 'Get email job status' })
  @ApiParam({ name: 'id', description: 'Email job ID' })
  @ApiResponse({
    status: 200,
    description: 'Job status retrieved successfully',
  })
  async getJobStatus(@Param('id') jobId: string) {
    const status = await this.emailQueueService.getJobStatus(jobId);
    return {
      jobId,
      status,
    };
  }

  @Post('job')
  @ApiOperation({ summary: 'Add email job to queue manually' })
  @ApiResponse({
    status: 201,
    description: 'Email job added to queue successfully',
  })
  async addEmailJob(@Body() createEmailJobDto: CreateEmailJobDto) {
    const jobId = await this.emailQueueService.addEmailJob({
      ...createEmailJobDto,
      priority: createEmailJobDto.priority ?? 1,
    });
    return {
      message: 'Email job added to queue successfully',
      jobId,
    };
  }

  @Post('process-all')
  @ApiOperation({ summary: 'Process all pending emails manually' })
  @ApiResponse({
    status: 200,
    description: 'All pending emails processed',
  })
  async processAllPendingEmails() {
    const result = await this.emailProcessorService.processAllPendingEmails();
    return {
      message: 'All pending emails processed',
      ...result,
    };
  }

  @Post('retry-failed')
  @ApiOperation({ summary: 'Retry all failed email jobs' })
  @ApiResponse({
    status: 200,
    description: 'Failed jobs retried successfully',
  })
  async retryFailedJobs() {
    const retriedCount = await this.emailQueueService.retryFailedJobs();
    return {
      message: 'Failed jobs retried successfully',
      retriedCount,
    };
  }

  @Post('cleanup')
  @ApiOperation({ summary: 'Clean up old completed/failed jobs' })
  @ApiResponse({
    status: 200,
    description: 'Cleanup completed successfully',
  })
  async cleanupOldJobs() {
    await this.emailQueueService.cleanupOldJobs();
    return {
      message: 'Cleanup completed successfully',
    };
  }

  @Post('test-email')
  @ApiOperation({ summary: 'Send test email to verify email configuration' })
  @ApiResponse({
    status: 200,
    description: 'Test email sent successfully',
  })
  async sendTestEmail(@Body() { email }: { email: string }) {
    const jobId = await this.emailQueueService.addEmailJob({
      type: 'verification' as any, // Using verification template for test
      to: email,
      priority: 1,
      data: {
        name: 'Test User',
        role: 'admin',
        token: 'test-token-123',
      },
    });

    return {
      message: 'Test email queued successfully',
      jobId,
    };
  }

  @Get('failed-jobs')
  @ApiOperation({ summary: 'Get list of failed jobs' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of jobs to return' })
  @ApiResponse({
    status: 200,
    description: 'Failed jobs retrieved successfully',
  })
  async getFailedJobs(@Query('limit') limit: string = '50') {
    // This would require implementing a method to get failed job details
    // For now, just return basic stats
    const stats = await this.emailQueueService.getQueueStats();
    return {
      message: 'Failed jobs information',
      totalFailed: stats.failed,
      // TODO: Add actual failed job details when implemented
    };
  }

  @Put('job/:id/retry')
  @ApiOperation({ summary: 'Retry specific failed job' })
  @ApiParam({ name: 'id', description: 'Email job ID to retry' })
  @ApiResponse({
    status: 200,
    description: 'Job retried successfully',
  })
  async retrySpecificJob(@Param('id') jobId: string) {
    // This would require implementing job-specific retry logic
    return {
      message: 'Job retry functionality not yet implemented',
      jobId,
    };
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get detailed email queue metrics' })
  @ApiResponse({
    status: 200,
    description: 'Detailed metrics retrieved successfully',
  })
  async getDetailedMetrics() {
    const [queueStats, processingStats, health] = await Promise.all([
      this.emailQueueService.getQueueStats(),
      this.emailProcessorService.getProcessingStats(),
      this.emailProcessorService.healthCheck(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      queueStats,
      processingStats,
      health,
    };
  }
}