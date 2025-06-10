import { Injectable, Logger } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcryptjs';
import { CompanySize } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ISeeder } from '../interfaces/seeder.interface';

@Injectable()
export class AdvertiserSeeder implements ISeeder {
  private readonly logger = new Logger(AdvertiserSeeder.name);

  constructor(private readonly prisma: PrismaService) {}

  getModuleName(): string {
    return 'Advertiser';
  }

  getDependencies(): string[] {
    // Advertiser has no dependencies
    return [];
  }

  async seed(count: number = 30): Promise<void> {
    this.logger.log(`Seeding ${count} advertisers...`);

    try {
      const advertiserData: any = [];

      // Generate fake advertisers
      for (let i = 0; i < count; i++) {
        const password = faker.internet.password();
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationStatus = faker.datatype.boolean(0.8); // 80% chance of verified email

        // Get random company size
        const companySizes = Object.values(CompanySize);
        const companySize = faker.helpers.arrayElement(companySizes);

        advertiserData.push({
          name: faker.person.fullName(),
          email: faker.internet.email().toLowerCase(),
          password: hashedPassword,
          mobile: faker.phone.number(),
          companyName: faker.company.name(),
          hqLocation: `${faker.location.city()}, ${faker.location.state()}`,
          companySize: companySize,
          emailVerifiedAt: verificationStatus ? faker.date.past() : null,
          mfaEnabled: faker.datatype.boolean(0.2), // 20% chance of MFA enabled
          createdAt: faker.date.past(),
          updatedAt: faker.date.recent(),
        });
      }

      // Add a default advertiser
      advertiserData.push({
        name: 'Test Advertiser',
        email: 'advertiser@example.com',
        password: await bcrypt.hash('advertiserpass123', 10),
        mobile: '+12025550179',
        companyName: 'Example Advertising Inc.',
        hqLocation: 'Mumbai, Maharashtra',
        companySize: CompanySize.FIFTY_ONE_TO_TWO_HUNDRED,
        emailVerifiedAt: new Date(),
        mfaEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Insert all advertisers
      await this.prisma.advertiser.createMany({
        data: advertiserData,
        skipDuplicates: true,
      });

      const advertiserCount = await this.prisma.advertiser.count();
      this.logger.log(`Successfully seeded ${advertiserCount} advertisers`);
    } catch (error) {
      this.logger.error('Error seeding advertisers');
      this.logger.error(error);
      throw error;
    }
  }

  async clean(): Promise<void> {
    this.logger.log('Cleaning advertisers table...');

    try {
      // Clean related data first to avoid foreign key constraint issues
      await this.prisma.client.deleteMany({});
      await this.prisma.campaign.deleteMany({});

      const deleted = await this.prisma.advertiser.deleteMany({});
      this.logger.log(`Deleted ${deleted.count} advertisers`);
    } catch (error) {
      this.logger.error('Error cleaning advertisers table');
      this.logger.error(error);
      throw error;
    }
  }

  async isSeeded(): Promise<boolean> {
    const count = await this.prisma.advertiser.count();
    return count > 0;
  }
}
