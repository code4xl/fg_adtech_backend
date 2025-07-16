import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class PublisherSignupTierService {
  private readonly logger = new Logger(PublisherSignupTierService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get the Basic tier for publisher signup
   * Creates it if it doesn't exist
   */
  async getBasicTierForSignup() {
    this.logger.debug('Getting Basic tier for publisher signup...');

    // First, try to find the Basic tier
    let basicTier = await this.prisma.publisherTier.findUnique({
      where: { name: 'Basic' },
    });

    if (!basicTier) {
      this.logger.debug('Basic tier not found, creating it...');
      
      try {
        // Create the Basic tier
        basicTier = await this.prisma.publisherTier.create({
          data: {
            name: 'Basic',
            commissionRate: new Decimal(0.3), // 30% commission rate for Basic tier
          },
        });
        
        this.logger.log('Basic tier created successfully for publisher signup');
      } catch (error) {
        // Handle race condition where another process might have created it
        if (error.code === 'P2002') { // Unique constraint violation
          basicTier = await this.prisma.publisherTier.findUnique({
            where: { name: 'Basic' },
          });
        } else {
          throw error;
        }
      }
    }

    return basicTier;
  }

  /**
   * Ensure all default tiers exist and return Basic tier
   * This creates the complete tier structure as per your requirements:
   * - Premium: 0.5 (50%)
   * - Standard: 0.4 (40%) 
   * - Basic: 0.3 (30%)
   */
  async ensureDefaultTiersAndGetBasic() {
    this.logger.debug('Ensuring all default tiers exist...');

    const defaultTiers = [
      { name: 'Premium', commissionRate: 0.5 },
      { name: 'Standard', commissionRate: 0.4 },
      { name: 'Basic', commissionRate: 0.3 },
    ];

    let basicTier = null;

    // Create all default tiers if they don't exist
    for (const tierData of defaultTiers) {
      try {
        let tier = await this.prisma.publisherTier.findUnique({
          where: { name: tierData.name },
        });

        if (!tier) {
          tier = await this.prisma.publisherTier.create({
            data: {
              name: tierData.name,
              commissionRate: new Decimal(tierData.commissionRate),
            },
          });
          this.logger.debug(`Created tier: ${tierData.name} with ${tierData.commissionRate * 100}% commission`);
        }

        // Store reference to Basic tier
        if (tierData.name === 'Basic') {
          basicTier = tier;
        }
      } catch (error) {
        // Handle race conditions
        if (error.code === 'P2002') {
          const tier = await this.prisma.publisherTier.findUnique({
            where: { name: tierData.name },
          });
          if (tierData.name === 'Basic') {
            basicTier = tier;
          }
        } else {
          this.logger.error(`Failed to create tier ${tierData.name}:`, error);
        }
      }
    }

    if (!basicTier) {
      throw new Error('Failed to create or retrieve Basic tier for publisher signup');
    }

    return basicTier;
  }

  /**
   * Assign a tier to a publisher during signup
   */
  async assignTierToPublisher(publisherId: string, tierId: string) {
    this.logger.debug(`Assigning tier ${tierId} to publisher ${publisherId}`);

    try {
      await this.prisma.publisher.update({
        where: { id: publisherId },
        data: { tierId: tierId },
      });

      this.logger.debug(`Successfully assigned tier to publisher ${publisherId}`);
    } catch (error) {
      this.logger.error(`Failed to assign tier to publisher ${publisherId}:`, error);
      throw error;
    }
  }
}