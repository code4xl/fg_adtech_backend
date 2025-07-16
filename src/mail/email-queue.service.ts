// src/mail/email-queue.service.ts
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { EmailJobDto, EmailJobStatus, EmailJobType } from './dto/email-job.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class EmailQueueService {
  private readonly logger = new Logger(EmailQueueService.name);
  private readonly QUEUE_KEY = 'email:queue';
  private readonly PROCESSING_KEY = 'email:processing';
  private readonly FAILED_KEY = 'email:failed';
  private readonly COMPLETED_KEY = 'email:completed';
  

  constructor(private readonly redisService: RedisService) {}

  async addEmailJob(emailJob: Omit<EmailJobDto, 'id' | 'createdAt' | 'status' | 'attempts'>): Promise<string> {
    try {
      const jobId = uuidv4();
      const job: EmailJobDto = {
        id: jobId,
        ...emailJob,
        status: EmailJobStatus.PENDING,
        attempts: 0,
        createdAt: new Date(),
      };

      // Add to queue using Redis List (FIFO)
      await this.redisService.lpush(this.QUEUE_KEY, JSON.stringify(job));
      
      // Store job details in hash for tracking
      await this.redisService.hset(`email:job:${jobId}`, 'data', JSON.stringify(job));
      await this.redisService.expire(`email:job:${jobId}`, 60 * 60 * 24 * 7); // 7 days TTL

      this.logger.debug(`Email job ${jobId} added to queue: ${emailJob.type}`);
      return jobId;
    } catch (error) {
      this.logger.error(`Failed to add email job to queue: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add verification email to queue
   */
  async queueVerificationEmail(
    email: string,
    name: string,
    role: string,
    token: string,
    priority: number = 1
  ): Promise<string> {
    return this.addEmailJob({
      type: EmailJobType.VERIFICATION,
      to: email,
      priority,
      data: { name, role, token },
    });
  }

  /**
   * Add client welcome email to queue
   */
  async queueClientWelcomeEmail(
    clientEmail: string,
    clientName: string,
    password: string,
    advertiserName: string,
    advertiserEmail: string,
    advertiserCompany: string,
    priority: number = 1
  ): Promise<string> {
    return this.addEmailJob({
      type: EmailJobType.CLIENT_WELCOME,
      to: clientEmail,
      priority,
      data: {
        clientName,
        password,
        advertiserName,
        advertiserEmail,
        advertiserCompany,
      },
    });
  }

  /**
   * Add password reset email to queue
   */
  async queuePasswordResetEmail(
    email: string,
    role: string,
    resetLink: string,
    priority: number = 2
  ): Promise<string> {
    return this.addEmailJob({
      type: EmailJobType.PASSWORD_RESET,
      to: email,
      priority,
      data: { role, resetLink },
    });
  }

  /**
   * Add MFA code email to queue
   */
  async queueMfaCodeEmail(
    email: string,
    verificationCode: string,
    expiryMinutes: number,
    priority: number = 3 // High priority for MFA
  ): Promise<string> {
    return this.addEmailJob({
      type: EmailJobType.MFA_CODE,
      to: email,
      priority,
      data: { verificationCode, expiryMinutes },
    });
  }

  /**
   * Get next job from queue
   */
  async getNextJob(): Promise<EmailJobDto | null> {
    try {
      // Get job from queue (blocking pop with timeout)
      const jobData = await this.redisService.lpop(this.QUEUE_KEY, 1);
      
      if (!jobData || jobData.length === 0) {
        return null;
      }

      const job = JSON.parse(jobData[0]) as EmailJobDto;
      
      // Move to processing set
      await this.redisService.hset(`email:job:${job.id}`, 'status', EmailJobStatus.PROCESSING);
      await this.redisService.sadd(this.PROCESSING_KEY, job.id);
      
      this.logger.debug(`Retrieved job ${job.id} from queue`);
      return job;
    } catch (error) {
      this.logger.error(`Error getting next job: ${error.message}`);
      return null;
    }
  }

  /**
   * Mark job as completed
   */
  async markJobCompleted(jobId: string): Promise<void> {
    try {
      // Update job status
      await this.redisService.hset(`email:job:${jobId}`, 'status', EmailJobStatus.COMPLETED);
      await this.redisService.hset(`email:job:${jobId}`, 'completedAt', new Date().toISOString());
      
      // Move from processing to completed
      await this.redisService.srem(this.PROCESSING_KEY, jobId);
      await this.redisService.sadd(this.COMPLETED_KEY, jobId);
      
      // Clean up completed jobs after some time
      await this.redisService.expire(`email:job:${jobId}`, 60 * 60 * 24); // 1 day TTL for completed jobs
      
      this.logger.debug(`Job ${jobId} marked as completed`);
    } catch (error) {
      this.logger.error(`Error marking job as completed: ${error.message}`);
    }
  }

  /**
   * Mark job as failed
   */
  async markJobFailed(jobId: string, error: string, shouldRetry: boolean = true): Promise<void> {
    try {
      const jobData = await this.redisService.hgetall(`email:job:${jobId}`);
      
      if (!jobData.data) {
        this.logger.error(`Job ${jobId} not found when marking as failed`);
        return;
      }

      const job = JSON.parse(jobData.data) as EmailJobDto;
      job.attempts += 1;
      job.lastError = error;
      job.lastAttemptAt = new Date();

      // Check if we should retry (max 3 attempts)
      if (shouldRetry && job.attempts < 3) {
        job.status = EmailJobStatus.PENDING;
        
        // Add delay based on attempt number (exponential backoff)
        const delay = Math.pow(2, job.attempts) * 1000; // 2s, 4s, 8s
        
        setTimeout(async () => {
          try {
            await this.redisService.lpush(this.QUEUE_KEY, JSON.stringify(job));
            this.logger.debug(`Job ${jobId} requeued for retry attempt ${job.attempts}`);
          } catch (retryError) {
            this.logger.error(`Failed to requeue job ${jobId}: ${retryError.message}`);
          }
        }, delay);
      } else {
        job.status = EmailJobStatus.FAILED;
        await this.redisService.sadd(this.FAILED_KEY, jobId);
      }

      // Update job data
      await this.redisService.hset(`email:job:${jobId}`, 'data', JSON.stringify(job));
      await this.redisService.hset(`email:job:${jobId}`, 'status', job.status);
      
      // Remove from processing
      await this.redisService.srem(this.PROCESSING_KEY, jobId);
      
      this.logger.debug(`Job ${jobId} marked as ${job.status}, attempts: ${job.attempts}`);
    } catch (error) {
      this.logger.error(`Error marking job as failed: ${error.message}`);
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<EmailJobStatus | null> {
    try {
      const status = await this.redisService.hgetall(`email:job:${jobId}`);
      return status.status as EmailJobStatus || null;
    } catch (error) {
      this.logger.error(`Error getting job status: ${error.message}`);
      return null;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    try {
      const [pending, processing, completed, failed] = await Promise.all([
        this.redisService.llen(this.QUEUE_KEY),
        this.redisService.scard(this.PROCESSING_KEY),
        this.redisService.scard(this.COMPLETED_KEY),
        this.redisService.scard(this.FAILED_KEY),
      ]);

      return { pending, processing, completed, failed };
    } catch (error) {
      this.logger.error(`Error getting queue stats: ${error.message}`);
      return { pending: 0, processing: 0, completed: 0, failed: 0 };
    }
  }

  /**
   * Clean up old completed/failed jobs
   */
  async cleanupOldJobs(): Promise<void> {
    try {
      const cutoffTime = new Date();
      cutoffTime.setDate(cutoffTime.getDate() - 7); // 7 days ago

      // Get all completed jobs
      const completedJobs = await this.redisService.smembers(this.COMPLETED_KEY);
      
      for (const jobId of completedJobs) {
        const jobData = await this.redisService.hgetall(`email:job:${jobId}`);
        if (jobData.completedAt) {
          const completedAt = new Date(jobData.completedAt);
          if (completedAt < cutoffTime) {
            // Remove job data
            await this.redisService.del(`email:job:${jobId}`);
            await this.redisService.srem(this.COMPLETED_KEY, jobId);
            this.logger.debug(`Cleaned up old completed job ${jobId}`);
          }
        }
      }

      // Clean up old failed jobs (older than 30 days)
      const failedCutoff = new Date();
      failedCutoff.setDate(failedCutoff.getDate() - 30);
      
      const failedJobs = await this.redisService.smembers(this.FAILED_KEY);
      
      for (const jobId of failedJobs) {
        const jobData = await this.redisService.hgetall(`email:job:${jobId}`);
        if (jobData.data) {
          const job = JSON.parse(jobData.data) as EmailJobDto;
          if (job.createdAt < failedCutoff) {
            await this.redisService.del(`email:job:${jobId}`);
            await this.redisService.srem(this.FAILED_KEY, jobId);
            this.logger.debug(`Cleaned up old failed job ${jobId}`);
          }
        }
      }

      this.logger.debug('Completed job cleanup');
    } catch (error) {
      this.logger.error(`Error during job cleanup: ${error.message}`);
    }
  }

  /**
   * Retry all failed jobs
   */
  async retryFailedJobs(): Promise<number> {
    try {
      const failedJobs = await this.redisService.smembers(this.FAILED_KEY);
      let retriedCount = 0;

      for (const jobId of failedJobs) {
        const jobData = await this.redisService.hgetall(`email:job:${jobId}`);
        if (jobData.data) {
          const job = JSON.parse(jobData.data) as EmailJobDto;
          
          // Reset job for retry
          job.status = EmailJobStatus.PENDING;
          job.attempts = 0;
          job.lastError = undefined;
          job.lastAttemptAt = undefined;

          // Add back to queue
          await this.redisService.lpush(this.QUEUE_KEY, JSON.stringify(job));
          await this.redisService.hset(`email:job:${jobId}`, 'data', JSON.stringify(job));
          await this.redisService.hset(`email:job:${jobId}`, 'status', EmailJobStatus.PENDING);
          
          // Remove from failed set
          await this.redisService.srem(this.FAILED_KEY, jobId);
          
          retriedCount++;
        }
      }

      this.logger.log(`Retried ${retriedCount} failed jobs`);
      return retriedCount;
    } catch (error) {
      this.logger.error(`Error retrying failed jobs: ${error.message}`);
      return 0;
    }
  }
}