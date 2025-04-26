import { Injectable } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcryptjs';
import { BaseSeeder } from '../base.seeder';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UserSeeder extends BaseSeeder {
    constructor(protected readonly prisma: PrismaService) {
        super(prisma);
    }

    getModuleName(): string {
        return 'User';
    }

    getDependencies(): string[] {
        // User has no dependencies
        return [];
    }

    async seed(count: number = 10): Promise<void> {
        this.logger.log(`Seeding ${count} users...`);

        try {
            const userData: any = [];

            // Generate fake users
            for (let i = 0; i < count; i++) {
                const password = faker.internet.password();
                const hashedPassword = await bcrypt.hash(password, 10);

                userData.push({
                    name: faker.person.fullName(),
                    email: faker.internet.email().toLowerCase(),
                    password: hashedPassword,
                    createdAt: faker.date.past(),
                    updatedAt: faker.date.recent(),
                });
            }

            // Add a default test user
            userData.push({
                name: 'Test User',
                email: 'test@example.com',
                password: await bcrypt.hash('password123', 10),
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // Insert all users
            await this.prisma.user.createMany({
                data: userData,
                skipDuplicates: true,
            });

            const userCount = await this.prisma.user.count();
            this.logger.log(`Successfully seeded ${userCount} users`);
        } catch (error) {
            this.logger.error('Error seeding users');
            this.logger.error(error);
            throw error;
        }
    }

    async clean(): Promise<void> {
        this.logger.log('Cleaning users table...');

        try {
            const deleted = await this.prisma.user.deleteMany({});
            this.logger.log(`Deleted ${deleted.count} users`);
        } catch (error) {
            this.logger.error('Error cleaning users table');
            this.logger.error(error);
            throw error;
        }
    }

    async isSeeded(): Promise<boolean> {
        const count = await this.prisma.user.count();
        return count > 0;
    }
}