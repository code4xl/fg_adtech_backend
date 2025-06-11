import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PublisherGuard } from 'src/common/guards/authorization.guard';
import { PublisherService } from './publisher.service';
import {
  ActivateInventoryDto,
  CreateAdInventoryDto,
} from './dto/inventory.dto';
import { Injectable } from '@nestjs/common';
import { CdnOrchestratorService } from '../cdn/services/cdn-orchestrator.service';
import { KafkaService } from '../kafka/kafka.service';

@Controller('publishers/adslots')
@ApiTags('publishers/adslots')
@UseGuards(PublisherGuard)
@ApiBearerAuth()
export class PublisherInventoryController {
  private readonly logger = new Logger(PublisherInventoryController.name);

  constructor(
    private readonly publisherService: PublisherService,
    private readonly cdnOrchestrator: CdnOrchestratorService,
    private readonly kafkaService: KafkaService,
  ) {}

  @Get('/get-available-ad-slot-templates')
  @ApiResponse({
    status: 200,
    description: 'Returns available ad slot templates for the publisher',
  })
  async getAvailableAdSlotTemplates() {
    const adSlotTypes =
      await this.publisherService.getAvailableAdSlotTemplates();
    return adSlotTypes;
  }

  @Post()
  @ApiResponse({
    status: 201,
    description: 'Creates a new ad slot for the publisher',
  })
  async createAdSlot(@Body() createAdSlotDto: CreateAdInventoryDto) {
    const adSlot = await this.publisherService.createAdSlot(createAdSlotDto);
    
    // ✅ ADD CDN REGENERATION HERE
    await this.triggerCdnRegeneration(
      createAdSlotDto.publisherId,
      createAdSlotDto.websiteId,
      'inventory_created',
      adSlot.id,
    );

    return {
      message: 'Ad slot created successfully',
      data: adSlot,
    };
  }

  @Get('/adslots/:publisherId')
  @ApiResponse({
    status: 200,
    description: 'Returns all ad slots for the publisher',
  })
  async getAdSlotsForPublisher(@Param('publisherId') publisherId: string) {
    const adSlots =
      await this.publisherService.getAdSlotsForPublisher(publisherId);
    return {
      message: 'Ad slots retrieved successfully',
      data: adSlots,
    };
  }
  
  @Get('/adslots/:publisherId/:websiteId')
  @ApiResponse({
    status: 200,
    description: 'Returns all ad slots of a specific website for the publisher',
  })
  async getAdSlotsForWebsite(
    @Param('publisherId') publisherId: string,
    @Param('websiteId') websiteId: string,
  ) {
    const adSlots = await this.publisherService.getAdSlotsForWebsite(
      publisherId,
      websiteId,
    );
    return {
      message: 'Ad slots retrieved successfully',
      data: adSlots,
    };
  }
  
  @Get('/adslots/:publisherId/:websiteId/:adSlotId')
  @ApiResponse({
    status: 200,
    description:
      'Returns specific ad slot of a specific website for the publisher',
  })
  async getSpecificAdSlot(
    @Param('publisherId') publisherId: string,
    @Param('websiteId') websiteId: string,
    @Param('adSlotId') adSlotId: string,
  ) {
    const adSlot = await this.publisherService.getSpecificAdSlot(
      publisherId,
      adSlotId,
      websiteId,
    );
    return {
      message: 'Ad slot retrieved successfully',
      data: adSlot,
    };
  }

  @Post('/adslots/toggle-activation-status')
  @ApiResponse({
    status: 200,
    description:
      'Toggles activation status an ad slot of a website for publisher',
  })
  async toggleActivationStatus(@Body() activateSlotDto: ActivateInventoryDto) {
    const updatedAdSlot =
      await this.publisherService.toggleActivationStatus(activateSlotDto);
    
    // ✅ ADD CDN REGENERATION HERE
    await this.triggerCdnRegeneration(
      activateSlotDto.publisherId,
      activateSlotDto.websiteId,
      updatedAdSlot.isActive ? 'inventory_activated' : 'inventory_deactivated',
      activateSlotDto.inventoryId,
    );

    return {
      message: 'Ad slot activation status updated successfully',
      data: updatedAdSlot,
    };
  }
  
  @Delete('/adslots/:publisherId/:websiteId/:adSlotId')
  @ApiResponse({
    status: 200,
    description:
      'Deletes a specific ad slot of a specific website for the publisher',
  })
  async deleteAdSlot(
    @Param('publisherId') publisherId: string,
    @Param('websiteId') websiteId: string,
    @Param('adSlotId') adSlotId: string,
  ) {
    const data = await this.publisherService.deleteAdSlot(
      publisherId,
      adSlotId,
      websiteId,
    );
    
    // ✅ ADD CDN REGENERATION HERE
    await this.triggerCdnRegeneration(
      publisherId,
      websiteId,
      'inventory_deleted',
      adSlotId,
    );

    return {
      message: 'Ad slot deleted successfully',
      data,
    };
  }

  // ✅ ADD THIS HELPER METHOD
  /**
   * Trigger CDN regeneration after inventory changes
   * This method handles both synchronous and asynchronous approaches
   */
  private async triggerCdnRegeneration(
    publisherId: string,
    websiteId: string,
    reason: string,
    inventoryId?: string,
  ): Promise<void> {
    try {
      // Option 1: Asynchronous via Kafka (RECOMMENDED for production)
      // This won't block the API response
      await this.kafkaService.publish('cdn.regeneration.requested', {
        key: `${publisherId}-${websiteId}-${Date.now()}`,
        value: {
          publisherId,
          websiteId,
          reason,
          inventoryId,
          timestamp: new Date().toISOString(),
        },
      });

      this.logger.log(
        `CDN regeneration triggered for publisher ${publisherId}, website ${websiteId} - Reason: ${reason}`,
      );

      // Option 2: Synchronous regeneration (NOT RECOMMENDED for production)
      // This will block the API response until CDN is regenerated
      // Uncomment only if you want immediate regeneration
      /*
      await this.cdnOrchestrator.invalidateAndRegenerate(
        publisherId,
        websiteId,
        true, // regenerate = true
      );
      */

      // Option 3: Fire and forget (USE WITH CAUTION)
      // This starts regeneration but doesn't wait for completion
      /*
      this.cdnOrchestrator.invalidateAndRegenerate(publisherId, websiteId, true)
        .catch(error => 
          this.logger.error(`Background CDN regeneration failed: ${error.message}`)
        );
      */

    } catch (error) {
      // Log error but don't fail the main operation
      // Inventory changes should succeed even if CDN regeneration fails
      this.logger.error(
        `Failed to trigger CDN regeneration for ${publisherId}/${websiteId}: ${error.message}`,
      );
      
      // Optional: You could send to a dead letter queue or alert system here
    }
  }
}