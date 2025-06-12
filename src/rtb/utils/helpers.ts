import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateBidRequestDto } from '../dto';
import { BidRequestWithAuction } from '../types/bid-request.types';
@Injectable()
export class RtbHelper {
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
}
