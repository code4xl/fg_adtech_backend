import { BadRequestException, Injectable, Logger, Inject } from '@nestjs/common';
import { CreateBidRequestDto } from '../dto';
import { BidRequestWithAuction } from '../types/bid-request.types';
import { kafkaTopics } from '../constants/kafka-topics';
import { KafkaService } from 'src/kafka/kafka.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RtbHelper {
  private readonly logger = new Logger(RtbHelper.name);
  constructor(
    @Inject(KafkaService) private readonly kafka: KafkaService,
    private readonly prisma: PrismaService,
  ) { }

  public async validateBidRequest(
    bidRequestDto: CreateBidRequestDto,
  ): Promise<void> {
    // Validate required fields
    if (!bidRequestDto.externalRequestId) {
      throw new BadRequestException('External request ID is required');
    }

    if (!bidRequestDto.inventoryId) {
      throw new BadRequestException('Inventory ID is required');
    }

    if (!bidRequestDto.userContext?.userAgent) {
      throw new BadRequestException('User agent is required');
    }

    if (
      !bidRequestDto.adSlotContext?.width ||
      !bidRequestDto.adSlotContext?.height
    ) {
      throw new BadRequestException('Ad slot dimensions are required');
    }
  }

  public async validateInventoryAdSlotContext(
    inventoryId: string,
    adSlotContext: any,
  ): Promise<void> {
    try {
      this.logger.debug('Validating inventory adSlot context', {
        inventoryId,
        requestedContext: adSlotContext,
      });

      // Get inventory with its adSlotTemplate
      const inventory = await this.prisma.adInventory.findUnique({
        where: { id: inventoryId },
        include: {
          adSlotTemplate: {
            select: {
              id: true,
              name: true,
              width: true,
              height: true,
              format: true,
              position: true,
              isActive: true,
            },
          },
        },
      });

      if (!inventory) {
        throw new BadRequestException(`Inventory not found: ${inventoryId}`);
      }

      if (!inventory.adSlotTemplate) {
        throw new BadRequestException(`Inventory ${inventoryId} has no adSlotTemplate configured`);
      }

      if (!inventory.adSlotTemplate.isActive) {
        throw new BadRequestException(`Inventory ${inventoryId} adSlotTemplate is inactive`);
      }

      const template = inventory.adSlotTemplate;

      // Validate dimensions
      if (adSlotContext.width !== template.width) {
        throw new BadRequestException(
          `Invalid width: expected ${template.width}, got ${adSlotContext.width} for inventory ${inventoryId}`
        );
      }

      if (adSlotContext.height !== template.height) {
        throw new BadRequestException(
          `Invalid height: expected ${template.height}, got ${adSlotContext.height} for inventory ${inventoryId}`
        );
      }

      // Validate format
      if (adSlotContext.format !== template.format) {
        throw new BadRequestException(
          `Invalid format: expected ${template.format}, got ${adSlotContext.format} for inventory ${inventoryId}`
        );
      }

      // Validate position
      if (adSlotContext.position !== template.position) {
        throw new BadRequestException(
          `Invalid position: expected ${template.position}, got ${adSlotContext.position} for inventory ${inventoryId}`
        );
      }

      this.logger.debug('AdSlot context validation passed', {
        inventoryId,
        templateId: template.id,
        templateName: template.name,
        validatedDimensions: `${template.width}x${template.height}`,
        validatedFormat: template.format,
        validatedPosition: template.position,
      });

    } catch (error) {
      this.logger.error('AdSlot context validation failed', {
        error: error.message,
        inventoryId,
        adSlotContext,
      });
      throw error;
    }
  }

  public calculateProcessingPriority(
    bidRequest: BidRequestWithAuction,
  ): 'high' | 'normal' | 'low' {
    // High priority for premium inventory or high floor prices
    if (bidRequest.floorPrice && bidRequest.floorPrice > 5.0) {
      return 'high';
    }

    // High priority for above-the-fold inventory
    if (bidRequest.adSlotContext?.position === 'above_fold') {
      return 'high';
    }

    return 'normal';
  }

  public validateBidRequestKafka(bidRequest: any): void {
    if (!bidRequest.bidRequest) {
      throw new Error('Missing bidRequest in message');
    }

    if (!bidRequest.bidRequest.auctionId) {
      throw new Error('Missing auctionId in message');
    }

    if (!bidRequest.bidRequest.id) {
      throw new Error('Missing bid request ID');
    }
  }

  public assessInventoryQuality(bidRequest: any): 'premium' | 'standard' | 'low' {
    if (bidRequest.floorPrice && bidRequest.floorPrice > 5.0) {
      return 'premium';
    }
    if (bidRequest.adSlotContext?.position === 'above_fold') {
      return 'premium';
    }
    if (bidRequest.floorPrice && bidRequest.floorPrice > 1.0) {
      return 'standard';
    }
    return 'low';
  }

  public categorizeError(errorMessage?: Error): 'timeout' | 'validation' | 'system' | 'unknown' | 'transient' {
    if (!errorMessage) return 'unknown';

    const message = errorMessage.message.toLowerCase();
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('validation') || message.includes('missing') || message.includes('invalid')) return 'validation';
    if (message.includes('system') || message.includes('service')) return 'system';
    if (message.includes('connection') || message.includes('network')) {
      return 'transient';
    }
    return 'unknown';
  }

  public async handleProcessingError(
    payload: any,
    error: Error,
    processingStage: string,
  ): Promise<void> {
    const errorCategory = this.categorizeError(error);

    // Only send recoverable errors to DLQ
    if (errorCategory === 'transient' || errorCategory === 'timeout') {
      try {
        this.kafka.publish(kafkaTopics.DLQ_AUCTIONS, {
          key: payload.key,
          value: {
            originalMessage: payload.value,
            originalTopic: payload.topic,
            errorType: errorCategory,
            errorMessage: error.message,
            processingStage,
            timestamp: new Date().toISOString(),
            retryCount: 0,
            maxRetries: 3,
          },
        });

        this.logger.warn('Message sent to DLQ', {
          key: payload.key,
          errorCategory,
          processingStage,
        });
      } catch (dlqError) {
        this.logger.error('Failed to send message to DLQ', {
          error: dlqError.message,
          originalError: error.message,
        });
      }
    } else {
      // Log permanent failures for monitoring
      this.logger.error('Permanent processing failure', {
        key: payload.key,
        errorCategory,
        errorMessage: error.message,
        processingStage,
      });
    }
  }
}
