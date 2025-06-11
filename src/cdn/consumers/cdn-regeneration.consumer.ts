import { Injectable, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { CdnOrchestratorService } from '../services/cdn-orchestrator.service';

interface CdnRegenerationEvent {
  publisherId: string;
  websiteId: string;
  reason: string;
  inventoryId?: string;
  timestamp: string;
}

/**
 * Kafka consumer that handles CDN regeneration events
 * This runs asynchronously in the background
 */
@Injectable()
export class CdnRegenerationConsumer {
  private readonly logger = new Logger(CdnRegenerationConsumer.name);
  private readonly maxRetries = 3;
  private readonly retryDelay = 5000; // 5 seconds

  constructor(
    private readonly cdnOrchestrator: CdnOrchestratorService,
  ) {}

  @EventPattern('cdn.regeneration.requested')
  async handleCdnRegeneration(
    @Payload() data: CdnRegenerationEvent,
  ): Promise<void> {
    this.logger.log(
      `Processing CDN regeneration request: ${JSON.stringify(data)}`,
    );

    let retryCount = 0;
    let lastError: Error;

    // Implement retry logic
    while (retryCount < this.maxRetries) {
      try {
        await this.cdnOrchestrator.invalidateAndRegenerate(
          data.publisherId,
          data.websiteId,
          true, // regenerate = true
        );

        this.logger.log(
          `CDN regeneration completed successfully for ${data.publisherId}/${data.websiteId}`,
        );
        
        // Success - exit the retry loop
        return;
      } catch (error) {
        lastError = error;
        retryCount++;
        
        this.logger.error(
          `CDN regeneration failed (attempt ${retryCount}/${this.maxRetries}): ${error.message}`,
        );

        if (retryCount < this.maxRetries) {
          // Wait before retrying
          await this.delay(this.retryDelay * retryCount);
        }
      }
    }

    // All retries failed
    this.logger.error(
      `CDN regeneration failed after ${this.maxRetries} attempts for ${data.publisherId}/${data.websiteId}`,
      lastError.stack,
    );

    // Send to dead letter queue or alert system
    await this.handleFailedRegeneration(data, lastError);
  }

  /**
   * Handle failed regeneration after all retries
   */
  private async handleFailedRegeneration(
    data: CdnRegenerationEvent,
    error: Error,
  ): Promise<void> {
    // Option 1: Send to dead letter queue
    // await this.kafkaService.publish('cdn.regeneration.failed', {
    //   ...data,
    //   error: error.message,
    //   failedAt: new Date().toISOString(),
    // });

    // Option 2: Send alert (email, Slack, etc.)
    // await this.alertService.sendAlert({
    //   type: 'CDN_REGENERATION_FAILED',
    //   data,
    //   error: error.message,
    // });

    // Option 3: Store in database for manual processing
    // await this.prisma.failedCdnRegeneration.create({
    //   data: {
    //     publisherId: data.publisherId,
    //     websiteId: data.websiteId,
    //     reason: data.reason,
    //     error: error.message,
    //     attempts: this.maxRetries,
    //   },
    // });

    this.logger.error(
      `Failed regeneration logged for manual intervention: ${data.publisherId}/${data.websiteId}`,
    );
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}