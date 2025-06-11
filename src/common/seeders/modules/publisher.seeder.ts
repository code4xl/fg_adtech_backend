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

  async seed(count: number = 50): Promise<void> {
    this.logger.log(`Seeding ${count} publishers...`);

    try {
      const publisherData: any = [];

      // Generate fake publishers
      for (let i = 0; i < count; i++) {
        const password = faker.internet.password();
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationStatus = faker.datatype.boolean(0.8); // 80% chance of verified email

        publisherData.push({
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
          email: faker.internet.email().toLowerCase(),
          password: hashedPassword,
          emailVerifiedAt: verificationStatus ? faker.date.past() : null,
          status: PublisherStatus.ACTIVE,
          mfaEnabled: faker.datatype.boolean(0.25), // 25% chance of MFA enabled
          createdAt: faker.date.past(),
          updatedAt: faker.date.recent(),
        });
      }

      // Add a default publisher for testing
      publisherData.push({
        firstName: 'Test',
        lastName: 'Publisher',
        email: 'publisher@example.com',
        password: await bcrypt.hash('publisherpass123', 10),
        emailVerifiedAt: new Date(),
        status: PublisherStatus.ACTIVE,
        mfaEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Insert all publishers
      await this.prisma.publisher.createMany({
        data: publisherData,
        skipDuplicates: true,
      });

      const publisherCount = await this.prisma.publisher.count();
      this.logger.log(`Successfully seeded ${publisherCount} publishers`);
    } catch (error) {
      this.logger.error('Error seeding publishers');
      this.logger.error(error);
      throw error;
    }
  }

  async clean(): Promise<void> {
    this.logger.log('Cleaning publishers table...');

    try {
      // Clean related data first to avoid foreign key constraint issues
      await this.prisma.adInventory.deleteMany({});
      await this.prisma.website.deleteMany({});

      const deleted = await this.prisma.publisher.deleteMany({});
      this.logger.log(`Deleted ${deleted.count} publishers`);
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
}
