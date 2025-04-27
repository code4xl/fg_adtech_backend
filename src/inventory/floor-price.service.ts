import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFloorPriceDto } from './dto/floor-price.dto';
import { 
  ResourceNotFoundException, 
  BadRequestException,
  DuplicateResourceException 
} from '../common/exceptions/custom.exception';
import { InventoryService } from './inventory.service';

@Injectable()
export class FloorPriceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService
  ) {}

  async create(
    inventoryId: string, 
    publisherId: string, 
    createFloorPriceDto: CreateFloorPriceDto
  ) {
    // Verify inventory exists and belongs to publisher
    await this.inventoryService.findOne(inventoryId, publisherId);

    // Check for overlapping floor price rules
    const overlappingPrices = await this.checkOverlappingPrices(
      inventoryId,
      new Date(createFloorPriceDto.startDate),
      createFloorPriceDto.endDate ? new Date(createFloorPriceDto.endDate) : null
    );

    if (overlappingPrices > 0) {
      throw new DuplicateResourceException(
        'Floor price rule overlaps with existing rules',
        'FloorPrice',
        'date range'
      );
    }

    return this.prisma.floorPrice.create({
      data: {
        inventoryId,
        basePrice: createFloorPriceDto.basePrice,
        currency: createFloorPriceDto.currency || 'USD',
        startDate: new Date(createFloorPriceDto.startDate),
        endDate: createFloorPriceDto.endDate ? new Date(createFloorPriceDto.endDate) : null,
        timeTargeting: createFloorPriceDto.timeTargeting,
        buyerTargeting: createFloorPriceDto.buyerTargeting
      }
    });
  }

  async findAll(inventoryId: string, publisherId: string) {
    // Verify inventory exists and belongs to publisher
    await this.inventoryService.findOne(inventoryId, publisherId);

    return this.prisma.floorPrice.findMany({
      where: {
        inventoryId
      },
      orderBy: {
        startDate: 'desc'
      }
    });
  }

  async findOne(priceId: string, inventoryId: string, publisherId: string) {
    // Verify inventory exists and belongs to publisher
    await this.inventoryService.findOne(inventoryId, publisherId);

    const floorPrice = await this.prisma.floorPrice.findFirst({
      where: {
        id: priceId,
        inventoryId
      }
    });

    if (!floorPrice) {
      throw new ResourceNotFoundException('Floor Price', priceId);
    }

    return floorPrice;
  }

  async update(
    priceId: string,
    inventoryId: string,
    publisherId: string,
    updateFloorPriceDto: Partial<CreateFloorPriceDto>
  ) {
    const floorPrice = await this.findOne(priceId, inventoryId, publisherId);

    // If dates are being updated, check for overlaps
    if (updateFloorPriceDto.startDate || updateFloorPriceDto.endDate) {
      const startDate = updateFloorPriceDto.startDate 
        ? new Date(updateFloorPriceDto.startDate) 
        : floorPrice.startDate;
      
      const endDate = updateFloorPriceDto.endDate 
        ? new Date(updateFloorPriceDto.endDate) 
        : floorPrice.endDate;

      const overlappingPrices = await this.checkOverlappingPrices(
        inventoryId,
        startDate,
        endDate,
        priceId
      );

      if (overlappingPrices > 0) {
        throw new DuplicateResourceException(
          'Floor price rule overlaps with existing rules',
          'FloorPrice',
          'date range'
        );
      }
    }

    return this.prisma.floorPrice.update({
      where: { id: priceId },
      data: {
        basePrice: updateFloorPriceDto.basePrice,
        currency: updateFloorPriceDto.currency,
        startDate: updateFloorPriceDto.startDate ? new Date(updateFloorPriceDto.startDate) : undefined,
        endDate: updateFloorPriceDto.endDate ? new Date(updateFloorPriceDto.endDate) : undefined,
        timeTargeting: updateFloorPriceDto.timeTargeting,
        buyerTargeting: updateFloorPriceDto.buyerTargeting
      }
    });
  }

  async remove(priceId: string, inventoryId: string, publisherId: string) {
    await this.findOne(priceId, inventoryId, publisherId);

    return this.prisma.floorPrice.delete({
      where: { id: priceId }
    });
  }

  private async checkOverlappingPrices(
    inventoryId: string,
    startDate: Date,
    endDate: Date | null,
    excludePriceId?: string
  ): Promise<number> {
    const whereConditions: any = {
      inventoryId,
      NOT: excludePriceId ? { id: excludePriceId } : undefined,
      OR: []
    };

    if (endDate) {
      whereConditions.OR.push(
        // New rule starts during existing rule
        {
          startDate: { lte: startDate },
          OR: [
            { endDate: { gte: startDate } },
            { endDate: null }
          ]
        },
        // New rule ends during existing rule
        {
          startDate: { lte: endDate },
          OR: [
            { endDate: { gte: endDate } },
            { endDate: null }
          ]
        },
        // New rule completely contains existing rule
        {
          startDate: { gte: startDate },
          OR: [
            { endDate: { lte: endDate } },
            { endDate: null }
          ]
        }
      );
    } else {
      // If new rule has no end date, it overlaps with any rule after its start date
      whereConditions.OR.push({
        startDate: { gte: startDate }
      });
    }

    return this.prisma.floorPrice.count({ where: whereConditions });
  }

  async getCurrentFloorPrice(inventoryId: string): Promise<number> {
    const now = new Date();
    
    const currentPrices = await this.prisma.floorPrice.findMany({
      where: {
        inventoryId,
        startDate: { lte: now },
        OR: [
          { endDate: { gte: now } },
          { endDate: null }
        ]
      },
      orderBy: {
        startDate: 'desc'
      },
      take: 1
    });

    if (currentPrices.length === 0) {
      return 0.01; // Default minimum floor price
    }

    return Number(currentPrices[0].basePrice);
  }
}