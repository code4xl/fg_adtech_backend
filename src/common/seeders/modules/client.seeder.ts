import { Injectable, Logger } from '@nestjs/common';
import { faker } from '@faker-js/faker';
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
    // Client depends on Advertiser
    return ['Advertiser'];
  }

  async seed(count: number = 15): Promise<void> {
    this.logger.log(`Seeding ${count} clients...`);

    try {
      // Get all advertisers to assign clients to
      const advertisers = await this.prisma.advertiser.findMany({
        select: { id: true },
      });

      if (advertisers.length === 0) {
        throw new Error('No advertisers found. Please seed advertisers first.');
      }

      const clientData: any = [];

      // Generate fake clients
      for (let i = 0; i < count; i++) {
        // Randomly assign to an advertiser
        const advertiser = faker.helpers.arrayElement(advertisers);

        const companyName = faker.company.name();
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();

        clientData.push({
          advertiserId: advertiser.id, // Required field
          companyName: companyName,
          firstName: firstName,
          lastName: lastName,
          email: faker.internet.email({
            firstName: firstName.toLowerCase(),
            lastName: lastName.toLowerCase(),
            provider: 'example.com',
          }),
          phone: faker.phone.number(),
          address: faker.location.streetAddress(),
          city: faker.location.city(),
          state: faker.location.state(),
          country: faker.location.countryCode(),
          zipCode: faker.location.zipCode(),
          website: faker.internet.url(),
          isActive: faker.datatype.boolean(0.9), // 90% chance of being active
          createdAt: faker.date.past(),
          updatedAt: faker.date.recent(),
        });
      }

      // Add a default test client
      const testAdvertiser = await this.prisma.advertiser.findFirst({
        where: { email: 'advertiser@example.com' },
      });

      if (testAdvertiser) {
        clientData.push({
          advertiserId: testAdvertiser.id, // Required field
          companyName: 'Test Client Company',
          firstName: 'Test',
          lastName: 'Client',
          email: 'client@example.com',
          phone: '+1-555-0123',
          address: '123 Test Street',
          city: 'Test City',
          state: 'CA',
          country: 'US',
          zipCode: '12345',
          website: 'https://testclient.com',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
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
      // Clean related tables first (respecting foreign key constraints)
      await this.prisma.campaign.deleteMany({});

      // Clean main table
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
