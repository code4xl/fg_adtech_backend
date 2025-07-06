import { Injectable, Logger } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcryptjs';
import { PublisherStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ISeeder } from '../interfaces/seeder.interface';

@Injectable()
export class PublisherSeeder implements ISeeder {
  private readonly logger = new Logger(PublisherSeeder.name);

  constructor(private readonly prisma: PrismaService) {}

  getModuleName(): string {
    return 'Publisher';
  }

  getDependencies(): string[] {
    // Publisher has no dependencies
    return [];
  }

  async seed(count: number = 200): Promise<void> {
    this.logger.debug(`Seeding ${count} publishers...`);

    try {
      // First, ensure publisher tiers exist
      await this.ensurePublisherTiersExist();

      // Get all available tiers
      const tiers = await this.prisma.publisherTier.findMany({
        select: { id: true, name: true, commissionRate: true },
      });

      if (tiers.length === 0) {
        throw new Error('No publisher tiers found after creation attempt');
      }

      this.logger.debug(`Found ${tiers.length} publisher tiers for assignment`);

      const publisherData: any = [];

      // Generate fake publishers
      for (let i = 0; i < count; i++) {
        const password = 'qwerty';
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationStatus = faker.datatype.boolean(0.8); // 80% chance of verified email

        // Randomly assign a tier to each publisher
        const selectedTier = faker.helpers.arrayElement(tiers);

        publisherData.push({
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
          email: faker.internet.email().toLowerCase(),
          password: hashedPassword,
          emailVerifiedAt: verificationStatus ? faker.date.past() : null,
          status: PublisherStatus.ACTIVE,
          mfaEnabled: faker.datatype.boolean(0.25), // 25% chance of MFA enabled
          tierId: selectedTier.id, // Assign the tier
          paymentThreshold: faker.number.float({
            min: 50.0,
            max: 500.0,
            fractionDigits: 4,
          }), // Random threshold between 50-500
          createdAt: faker.date.past(),
          updatedAt: faker.date.recent(),
        });
      }

      // Add a default publisher for testing with a specific tier
      const defaultTier =
        tiers.find((tier) => tier.name === 'Standard') || tiers[0];

      publisherData.push({
        firstName: 'Test',
        lastName: 'Publisher',
        email: 'publisher@example.com',
        password: await bcrypt.hash('qwerty', 10),
        emailVerifiedAt: new Date(),
        status: PublisherStatus.ACTIVE,
        mfaEnabled: false,
        tierId: defaultTier.id, // Assign default tier
        paymentThreshold: 100.0, // Default threshold
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Insert all publishers
      await this.prisma.publisher.createMany({
        data: publisherData,
        skipDuplicates: true,
      });

      const publisherCount = await this.prisma.publisher.count();

      // Log tier distribution
      const tierDistribution = await this.getTierDistribution();
      this.logger.debug(`Successfully seeded ${publisherCount} publishers`);
      this.logger.debug('Publisher tier distribution:');
      tierDistribution.forEach(({ tierName, count, commissionRate }) => {
        this.logger.debug(
          `  ${tierName} (${commissionRate}% commission): ${count} publishers`,
        );
      });
    } catch (error) {
      this.logger.error('Error seeding publishers');
      this.logger.error(error);
      throw error;
    }
  }

  async clean(): Promise<void> {
    this.logger.debug('Cleaning publishers table...');

    try {
      // Clean related data first to avoid foreign key constraint issues
      await this.prisma.publisherRevenue.deleteMany({});
      await this.prisma.systemRevenue.deleteMany({});
      await this.prisma.impressionEvent.deleteMany({});
      await this.prisma.clickEvent.deleteMany({});
      await this.prisma.adInventory.deleteMany({});
      await this.prisma.website.deleteMany({});
      await this.prisma.bidRequest.deleteMany({});

      // Clean publishers
      const deletedPublishers = await this.prisma.publisher.deleteMany({});

      // Clean publisher tiers (only if no publishers reference them)
      const deletedTiers = await this.prisma.publisherTier.deleteMany({});

      this.logger.debug(
        `Deleted ${deletedPublishers.count} publishers and ${deletedTiers.count} publisher tiers`,
      );
    } catch (error) {
      this.logger.error('Error cleaning publishers table');
      this.logger.error(error);
      throw error;
    }
  }

  async isSeeded(): Promise<boolean> {
    const count = await this.prisma.publisher.count();
    return count > 0;
  }

  /**
   * Ensure that publisher tiers exist in the database
   */
  private async ensurePublisherTiersExist(): Promise<void> {
    this.logger.debug('Ensuring publisher tiers exist...');

    const existingTiers = await this.prisma.publisherTier.findMany();

    if (existingTiers.length > 0) {
      this.logger.debug(
        `Found ${existingTiers.length} existing publisher tiers`,
      );
      return;
    }

    // Create default publisher tiers
    const defaultTiers = [
      {
        name: 'Silver',
        commissionRate: 0.5, // 50% commission rate
      },
      {
        name: 'Gold',
        commissionRate: 0.4, // 40% commission rate
      },
      {
        name: 'Platinum',
        commissionRate: 0.3, // 30% commission rate
      },
    ];

    for (const tier of defaultTiers) {
      try {
        await this.prisma.publisherTier.create({
          data: tier,
        });
      } catch (error) {
        // Skip if tier already exists (unique constraint)
        if (error.code === 'P2002') {
          this.logger.warn(
            `Publisher tier ${tier.name} already exists, skipping...`,
          );
          continue;
        }
        throw error;
      }
    }

    const createdTiers = await this.prisma.publisherTier.count();
    this.logger.debug(`Created ${createdTiers} publisher tiers`);
  }

  /**
   * Get distribution of publishers across tiers for logging
   */
  private async getTierDistribution(): Promise<
    Array<{ tierName: string; count: number; commissionRate: string }>
  > {
    const distribution = await this.prisma.publisherTier.findMany({
      select: {
        name: true,
        commissionRate: true,
        _count: {
          select: {
            publishers: true,
          },
        },
      },
    });

    return distribution.map((tier) => ({
      tierName: tier.name,
      count: tier._count.publishers,
      commissionRate: (Number(tier.commissionRate) * 100).toFixed(1),
    }));
  }
}
