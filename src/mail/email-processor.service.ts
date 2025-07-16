import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EmailQueueService } from './email-queue.service';
import { MailService } from './mail.service';
import { EmailJobDto, EmailJobType, EmailJobStatus } from './dto/email-job.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class EmailProcessorService implements OnModuleInit {
  private readonly logger = new Logger(EmailProcessorService.name);
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout;

  constructor(
    private readonly emailQueueService: EmailQueueService,
    private readonly mailService: MailService,
  ) {}

  async onModuleInit() {
    this.logger.log('Email Processor Service initialized');
    this.startProcessing();
  }

  /**
   * Start background email processing
   */
  private startProcessing(): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.logger.log('Starting email processing');

    // Process emails every 500ms for better responsiveness
    this.processingInterval = setInterval(async () => {
      try {
        await this.processNextEmail();
      } catch (error) {
        this.logger.error(`Error in email processing interval: ${error.message}`);
      }
    }, 500);
  }

  /**
   * Stop background processing
   */
  private stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    this.isProcessing = false;
    this.logger.log('Stopped email processing');
  }

  /**
   * Process next email in queue
   */
  private async processNextEmail(): Promise<void> {
    try {
      const job = await this.emailQueueService.getNextJob();
      
      if (!job) {
        return; // No jobs in queue
      }

      this.logger.debug(`Processing email job ${job.id} of type ${job.type}`);

      try {
        await this.processEmailJob(job);
        await this.emailQueueService.markJobCompleted(job.id);
        this.logger.debug(`Email job ${job.id} completed successfully`);
      } catch (error) {
        this.logger.error(`Email job ${job.id} failed: ${error.message}`);
        await this.emailQueueService.markJobFailed(job.id, error.message);
      }
    } catch (error) {
      this.logger.error(`Error processing email queue: ${error.message}`);
    }
  }

  /**
   * Process individual email job based on type
   */
  private async processEmailJob(job: EmailJobDto): Promise<void> {
    const startTime = Date.now();

    try {
      switch (job.type) {
        case EmailJobType.VERIFICATION:
          await this.processVerificationEmail(job);
          break;
        case EmailJobType.CLIENT_WELCOME:
          await this.processClientWelcomeEmail(job);
          break;
        case EmailJobType.PASSWORD_RESET:
          await this.processPasswordResetEmail(job);
          break;
        case EmailJobType.MFA_CODE:
          await this.processMfaCodeEmail(job);
          break;
        default:
          throw new Error(`Unknown email job type: ${job.type}`);
      }

      const processingTime = Date.now() - startTime;
      this.logger.debug(`Email job ${job.id} processed in ${processingTime}ms`);
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`Email job ${job.id} failed after ${processingTime}ms: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process verification email
   */
  private async processVerificationEmail(job: EmailJobDto): Promise<void> {
    const { name, role, token } = job.data;
    
    if (!name || !role || !token) {
      throw new Error('Missing required data for verification email');
    }

    await this.mailService.sendVerificationEmail(job.to, name, role, token);
  }

  /**
   * Process client welcome email
   */
  private async processClientWelcomeEmail(job: EmailJobDto): Promise<void> {
    const { clientName, password, advertiserName, advertiserEmail, advertiserCompany } = job.data;
    
    if (!clientName || !password || !advertiserName || !advertiserEmail || !advertiserCompany) {
      throw new Error('Missing required data for client welcome email');
    }

    await this.mailService.sendClientWelcomeEmail(
      job.to,
      clientName,
      password,
      advertiserName,
      advertiserEmail,
      advertiserCompany
    );
  }

  /**
   * Process password reset email
   */
  private async processPasswordResetEmail(job: EmailJobDto): Promise<void> {
    const { role, resetLink } = job.data;
    
    if (!role || !resetLink) {
      throw new Error('Missing required data for password reset email');
    }

    await this.mailService.sendPasswordResetEmail(job.to, role, resetLink);
  }

  /**
   * Process MFA code email
   */
  private async processMfaCodeEmail(job: EmailJobDto): Promise<void> {
    const { verificationCode, expiryMinutes } = job.data;
    
    if (!verificationCode || !expiryMinutes) {
      throw new Error('Missing required data for MFA code email');
    }

    await this.mailService.sendMfaCodeEmail(job.to, verificationCode, expiryMinutes);
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<{
    isProcessing: boolean;
    queueStats: {
      pending: number;
      processing: number;
      completed: number;
      failed: number;
    };
  }> {
    const queueStats = await this.emailQueueService.getQueueStats();
    
    return {
      isProcessing: this.isProcessing,
      queueStats,
    };
  }

  /**
   * Process all pending emails manually (for testing/debugging)
   */
  async processAllPendingEmails(): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    this.logger.log('Processing all pending emails manually');

    while (true) {
      const job = await this.emailQueueService.getNextJob();
      
      if (!job) {
        break; // No more jobs
      }

      try {
        await this.processEmailJob(job);
        await this.emailQueueService.markJobCompleted(job.id);
        processed++;
      } catch (error) {
        await this.emailQueueService.markJobFailed(job.id, error.message);
        failed++;
      }
    }

    this.logger.log(`Manual processing completed: ${processed} processed, ${failed} failed`);
    return { processed, failed };
  }

  /**
   * Retry failed emails
   */
  async retryFailedEmails(): Promise<number> {
    return await this.emailQueueService.retryFailedJobs();
  }

  /**
   * Cron job to clean up old completed/failed jobs every day at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldJobs(): Promise<void> {
    try {
      this.logger.log('Starting daily cleanup of old email jobs');
      await this.emailQueueService.cleanupOldJobs();
      this.logger.log('Daily cleanup completed');
    } catch (error) {
      this.logger.error(`Daily cleanup failed: ${error.message}`);
    }
  }

  /**
   * Cron job to log queue statistics every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async logQueueStats(): Promise<void> {
    try {
      const stats = await this.emailQueueService.getQueueStats();
      
      if (stats.pending > 0 || stats.processing > 0 || stats.failed > 0) {
        this.logger.log(`Queue stats - Pending: ${stats.pending}, Processing: ${stats.processing}, Completed: ${stats.completed}, Failed: ${stats.failed}`);
      }

      // Alert if queue is backing up
      if (stats.pending > 100) {
        this.logger.warn(`Email queue is backing up with ${stats.pending} pending jobs`);
      }

      if (stats.failed > 50) {
        this.logger.warn(`High number of failed email jobs: ${stats.failed}`);
      }
    } catch (error) {
      this.logger.error(`Error logging queue stats: ${error.message}`);
    }
  }

  /**
   * Health check for email processing
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    isProcessing: boolean;
    queueStats: any;
    message?: string;
  }> {
    try {
      const stats = await this.emailQueueService.getQueueStats();
      
      // Check if processing is stuck
      if (stats.processing > 10) {
        return {
          status: 'unhealthy',
          isProcessing: this.isProcessing,
          queueStats: stats,
          message: 'Too many emails stuck in processing state'
        };
      }

      // Check if queue is backing up significantly
      if (stats.pending > 500) {
        return {
          status: 'unhealthy',
          isProcessing: this.isProcessing,
          queueStats: stats,
          message: 'Email queue is severely backed up'
        };
      }

      return {
        status: 'healthy',
        isProcessing: this.isProcessing,
        queueStats: stats,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        isProcessing: this.isProcessing,
        queueStats: { pending: 0, processing: 0, completed: 0, failed: 0 },
        message: `Health check failed: ${error.message}`
      };
    }
  }
}