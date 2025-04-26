import { Injectable } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcryptjs';
import { CompanySize } from '@prisma/client';
import { BaseSeeder } from '../base.seeder';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AdvertiserSeeder extends BaseSeeder {
    constructor(protected readonly prisma: PrismaService) {
        super(prisma);
    }

    getModuleName(): string {
        return 'Advertiser';
    }

    getDependencies(): string[] {
        // Advertiser has no dependencies
        return [];
    }

    async seed(count: number = 15): Promise<void> {
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
                    createdAt: faker.date.past(),
                    updatedAt: faker.date.recent(),
                });
            }

            // Add a default advertiser
            advertiserData.push({
                name: 'Advertiser User',
                email: 'advertiser@example.com',
                password: await bcrypt.hash('advertiserpass123', 10),
                mobile: '+12025550179',
                companyName: 'Example Advertising Inc.',
                hqLocation: 'Chicago, IL',
                companySize: CompanySize.FIFTY_ONE_TO_TWO_HUNDRED,
                emailVerifiedAt: new Date(),
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