import { Injectable, Logger } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcryptjs';
import { CompanySize } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ISeeder } from '../interfaces/seeder.interface';

@Injectable()
export class ClientSeeder implements ISeeder {
  private readonly logger = new Logger(ClientSeeder.name);

  constructor(private readonly prisma: PrismaService) {}

  getModuleName(): string {
    return 'Client';
  }

  getDependencies(): string[] {
    // Depends on Advertiser
    return ['Advertiser'];
  }

  async seed(count: number = 10): Promise<void> {
    this.logger.log(`Seeding ${count} clients...`);

    try {
      // Get advertisers to link clients to
      const advertisers = await this.prisma.advertiser.findMany({
        select: { id: true },
      });

      if (advertisers.length === 0) {
        throw new Error('No advertisers found. Please seed advertisers first.');
      }

      const clientData: any = [];

      // Generate fake clients
      for (let i = 0; i < count; i++) {
        // Only some clients should be linked to advertisers
        const advertiser = faker.datatype.boolean(0.7)
          ? faker.helpers.arrayElement(advertisers)
          : null;

        const password = faker.internet.password();
        const hashedPassword = await bcrypt.hash(password, 10);

        // Get random company size
        const companySizes = Object.values(CompanySize);
        const companySize = faker.helpers.arrayElement(companySizes);

        clientData.push({
          name: faker.person.fullName(),
          email: faker.internet.email().toLowerCase(),
          password: hashedPassword,
          mobile: faker.phone.number(),
          companyName: faker.company.name(),
          hqLocation: `${faker.location.city()}, ${faker.location.state()}`,
          companySize: companySize,
          registeredAddress: faker.location.streetAddress(true),
          companyGSTIN: `${faker.string.alphanumeric(10).toUpperCase()}${faker.string.numeric(5)}`,
          PAN: `${faker.string.alpha(5).toUpperCase()}${faker.string.numeric(4)}${faker.string.alpha(1).toUpperCase()}`,
          CIN: `U${faker.string.numeric(5)}${faker.string.alpha(2).toUpperCase()}${faker.string.numeric(4)}${faker.string.alpha(3).toUpperCase()}${faker.string.numeric(6)}`,
          website: faker.internet.url(),
          advertiserId: advertiser?.id,
        });
      }

      // Add a default client for testing
      const defaultAdvertiser = await this.prisma.advertiser.findFirst({
        where: { email: 'advertiser@example.com' },
      });

      if (defaultAdvertiser) {
        clientData.push({
          name: 'Test Client',
          email: 'client@example.com',
          password: await bcrypt.hash('clientpass123', 10),
          mobile: '+919876543210',
          companyName: 'Test Client Company',
          hqLocation: 'New Delhi, Delhi',
          companySize: CompanySize.FIFTY_ONE_TO_TWO_HUNDRED,
          registeredAddress: '123 Test Street, New Delhi, Delhi 110001',
          companyGSTIN: 'TESTGST123456',
          PAN: 'TESTPAN123T',
          CIN: 'U12345TC2022ABC123456',
          website: 'https://testclient.example.com',
          advertiserId: defaultAdvertiser.id,
        });
      }

      // Insert all clients
      await this.prisma.client.createMany({
        data: clientData,
        skipDuplicates: true,
      });

      const clientCount = await this.prisma.client.count();
      this.logger.log(`Successfully seeded ${clientCount} clients`);
    } catch (error) {
      this.logger.error('Error seeding clients');
      this.logger.error(error);
      throw error;
    }
  }

  async clean(): Promise<void> {
    this.logger.log('Cleaning clients table...');

    try {
      // Clean related data first
      await this.prisma.campaign.deleteMany({});

      const deleted = await this.prisma.client.deleteMany({});
      this.logger.log(`Deleted ${deleted.count} clients`);
    } catch (error) {
      this.logger.error('Error cleaning clients table');
      this.logger.error(error);
      throw error;
    }
  }

  async isSeeded(): Promise<boolean> {
    const count = await this.prisma.client.count();
    return count > 0;
  }
}
