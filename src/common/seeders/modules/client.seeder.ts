import { Injectable, Logger } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import { PrismaService } from 'src/prisma/prisma.service';
import { ISeeder } from '../interfaces/seeder.interface';
import { CompanySize, ClientStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

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

  async seed(count: number = 150): Promise<void> {
    this.logger.debug(
      `Seeding clients (ensuring every advertiser has at least one client)...`,
    );

    try {
      // Get all advertisers to assign clients to
      const advertisers = await this.prisma.advertiser.findMany({
        select: { id: true, email: true, name: true },
      });

      if (advertisers.length === 0) {
        throw new Error('No advertisers found. Please seed advertisers first.');
      }

      const clientData: any = [];

      // STEP 1: Ensure every advertiser gets at least one client
      this.logger.debug(
        `Ensuring each of ${advertisers.length} advertisers gets at least one client...`,
      );

      for (const advertiser of advertisers) {
        const companyName = faker.company.name();
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();
        const fullName = `${firstName} ${lastName}`;

        // Generate unique identifiers (Indian format examples)
        const companyGSTIN = this.generateGSTIN();
        const pan = this.generatePAN();
        const cin = this.generateCIN();

        // Hash password
        const plainPassword = 'password123';
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        clientData.push({
          name: fullName,
          email: faker.internet.email({
            firstName: firstName.toLowerCase(),
            lastName: lastName.toLowerCase(),
            provider: 'example.com',
          }),
          mobile: faker.phone.number(),
          companyName: companyName,
          hqLocation: `${faker.location.city()}, ${faker.location.state()}`,
          companySize: faker.helpers.arrayElement(Object.values(CompanySize)),
          registeredAddress: faker.location.streetAddress({
            useFullAddress: true,
          }),
          companyGSTIN: companyGSTIN,
          PAN: pan,
          CIN: cin,
          website: faker.internet.url(),
          password: hashedPassword,
          advertiserId: advertiser.id, // Assign to this specific advertiser
          emailVerifiedAt: faker.datatype.boolean(0.7)
            ? faker.date.past()
            : null, // 70% verified
          verificationToken: faker.datatype.boolean(0.3)
            ? faker.string.uuid()
            : null, // 30% have pending verification
          status: faker.helpers.arrayElement(Object.values(ClientStatus)),
          createdAt: faker.date.past(),
          updatedAt: faker.date.recent(),
        });
      }

      // STEP 2: Create additional clients if count is higher than number of advertisers
      const remainingClientsToCreate = Math.max(0, count - advertisers.length);

      if (remainingClientsToCreate > 0) {
        this.logger.debug(
          `Creating ${remainingClientsToCreate} additional clients randomly distributed among advertisers...`,
        );

        for (let i = 0; i < remainingClientsToCreate; i++) {
          // Randomly assign to an advertiser
          const advertiser = faker.helpers.arrayElement(advertisers);

          const companyName = faker.company.name();
          const firstName = faker.person.firstName();
          const lastName = faker.person.lastName();
          const fullName = `${firstName} ${lastName}`;

          // Generate unique identifiers
          const companyGSTIN = this.generateGSTIN();
          const pan = this.generatePAN();
          const cin = this.generateCIN();

          // Hash password
          const plainPassword = 'password123';
          const hashedPassword = await bcrypt.hash(plainPassword, 10);

          clientData.push({
            name: fullName,
            email: faker.internet.email({
              firstName: firstName.toLowerCase(),
              lastName: lastName.toLowerCase(),
              provider: 'example.com',
            }),
            mobile: faker.phone.number(),
            companyName: companyName,
            hqLocation: `${faker.location.city()}, ${faker.location.state()}`,
            companySize: faker.helpers.arrayElement(Object.values(CompanySize)),
            registeredAddress: faker.location.streetAddress({
              useFullAddress: true,
            }),
            companyGSTIN: companyGSTIN,
            PAN: pan,
            CIN: cin,
            website: faker.internet.url(),
            password: hashedPassword,
            advertiserId: advertiser.id,
            emailVerifiedAt: faker.datatype.boolean(0.7)
              ? faker.date.past()
              : null,
            verificationToken: faker.datatype.boolean(0.3)
              ? faker.string.uuid()
              : null,
            status: faker.helpers.arrayElement(Object.values(ClientStatus)),
            createdAt: faker.date.past(),
            updatedAt: faker.date.recent(),
          });
        }
      }

      // STEP 3: Add the default test client
      const testAdvertiser = await this.prisma.advertiser.findFirst({
        where: { email: 'advertiser@example.com' },
      });

      if (testAdvertiser) {
        const testHashedPassword = await bcrypt.hash('password123', 10);

        // Check if test client already exists in our data
        const existingTestClient = clientData.find(
          (client) => client.email === 'client@example.com',
        );

        if (!existingTestClient) {
          clientData.push({
            name: 'Test Client',
            email: 'client@example.com',
            mobile: '+919876543210',
            companyName: 'Test Client Company Pvt Ltd',
            hqLocation: 'Mumbai, Maharashtra',
            companySize: CompanySize.FIFTY_ONE_TO_TWO_HUNDRED,
            registeredAddress:
              '123 Test Street, Test Area, Mumbai, Maharashtra, 400001',
            companyGSTIN: '27ABCDE1234F1Z5',
            PAN: 'ABCDE1234F',
            CIN: 'U72900MH2020PTC123456',
            website: 'https://testclient.com',
            password: testHashedPassword,
            advertiserId: testAdvertiser.id,
            emailVerifiedAt: new Date(),
            verificationToken: null,
            status: ClientStatus.ACTIVE,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }

      // STEP 4: Insert all clients using individual creates to handle unique constraints better
      let successfullyCreated = 0;
      for (const client of clientData) {
        try {
          await this.prisma.client.create({
            data: client,
          });
          successfullyCreated++;
        } catch (error) {
          // Skip duplicates and continue
          if (error.code === 'P2002') {
            this.logger.warn(`Skipping duplicate client: ${client.email}`);
            continue;
          }
          throw error;
        }
      }

      const totalClientCount = await this.prisma.client.count();

      // STEP 5: Verify every advertiser has at least one client
      const advertiserClientCounts = await this.prisma.advertiser.findMany({
        select: {
          id: true,
          email: true,
          _count: {
            select: {
              clients: true,
            },
          },
        },
      });

      const advertisersWithoutClients = advertiserClientCounts.filter(
        (advertiser) => advertiser._count.clients === 0,
      );

      if (advertisersWithoutClients.length > 0) {
        this.logger.warn(
          `Warning: ${advertisersWithoutClients.length} advertisers still have no clients:`,
        );
        advertisersWithoutClients.forEach((advertiser) => {
          this.logger.warn(`- ${advertiser.email} (ID: ${advertiser.id})`);
        });
      } else {
        this.logger.debug('✅ All advertisers now have at least one client!');
      }

      this.logger.debug(
        `Successfully seeded ${successfullyCreated} new clients (total: ${totalClientCount})`,
      );

      // Log distribution summary
      const distributionSummary = advertiserClientCounts.map((advertiser) => ({
        email: advertiser.email,
        clientCount: advertiser._count.clients,
      }));

      this.logger.debug('Client distribution per advertiser:');
      distributionSummary.forEach((summary) => {
        this.logger.debug(`  ${summary.email}: ${summary.clientCount} clients`);
      });
    } catch (error) {
      this.logger.error('Error seeding clients');
      this.logger.error(error);
      throw error;
    }
  }

  async clean(): Promise<void> {
    this.logger.debug('Cleaning clients table...');

    try {
      // Clean related tables first (respecting foreign key constraints)
      await this.prisma.clientCampaign.deleteMany({});
      await this.prisma.campaign.deleteMany({});

      // Clean main table
      const deleted = await this.prisma.client.deleteMany({});
      this.logger.debug(`Deleted ${deleted.count} clients`);
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

  // Helper method to generate Indian GSTIN format
  private generateGSTIN(): string {
    const stateCode = faker.number
      .int({ min: 10, max: 37 })
      .toString()
      .padStart(2, '0');
    const panLike =
      faker.string.alpha({ length: 5, casing: 'upper' }) +
      faker.number.int({ min: 1000, max: 9999 }).toString() +
      faker.string.alpha({ length: 1, casing: 'upper' });
    const entityCode = faker.number.int({ min: 1, max: 9 });
    const checksum = faker.string.alpha({ length: 1, casing: 'upper' });

    return `${stateCode}${panLike}${entityCode}Z${checksum}`;
  }

  // Helper method to generate Indian PAN format
  private generatePAN(): string {
    return (
      faker.string.alpha({ length: 5, casing: 'upper' }) +
      faker.number.int({ min: 1000, max: 9999 }).toString() +
      faker.string.alpha({ length: 1, casing: 'upper' })
    );
  }

  // Helper method to generate Indian CIN format
  private generateCIN(): string {
    const classCode = 'U';
    const industryCode = faker.number.int({ min: 10000, max: 99999 });
    const stateCode = faker.helpers.arrayElement([
      'MH',
      'DL',
      'KA',
      'TN',
      'GJ',
    ]);
    const year = faker.number.int({ min: 2000, max: 2024 });
    const type = faker.helpers.arrayElement(['PTC', 'PLC']);
    const registrationNumber = faker.number.int({ min: 100000, max: 999999 });

    return `${classCode}${industryCode}${stateCode}${year}${type}${registrationNumber}`;
  }
}
