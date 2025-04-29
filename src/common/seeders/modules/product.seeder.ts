import { Injectable } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import { BaseSeeder } from '../base.seeder';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ProductSeeder extends BaseSeeder {
    constructor(protected readonly prisma: PrismaService) {
        super(prisma);
    }

    getModuleName(): string {
        return 'Product';
    }

    getDependencies(): string[] {
        // Product depends on User
        return ['User'];
    }

    async seed(count: number = 30): Promise<void> {
        this.logger.log(`Seeding ${count} products...`);

        try {
            // Get all users to assign products to
            const users = await this.prisma.user.findMany({
                select: { id: true },
            });

            if (users.length === 0) {
                throw new Error('No users found. Please seed users first.');
            }

            const productData: any = [];

            // Generate fake products
            for (let i = 0; i < count; i++) {
                // Randomly assign to a user
                const user = faker.helpers.arrayElement(users);

                productData.push({
                    name: faker.commerce.productName(),
                    description: faker.commerce.productDescription(),
                    price: parseFloat(faker.commerce.price()),
                    stock: faker.number.int({ min: 0, max: 100 }),
                    createdAt: faker.date.past(),
                    updatedAt: faker.date.recent(),
                    userId: user.id,
                });
            }

            // Insert all products
            await this.prisma.product.createMany({
                data: productData,
            });

            const productCount = await this.prisma.product.count();
            this.logger.log(`Successfully seeded ${productCount} products`);
        } catch (error) {
            this.logger.error('Error seeding products');
            this.logger.error(error);
            throw error;
        }
    }

    async clean(): Promise<void> {
        this.logger.log('Cleaning products table...');

        try {
            const deleted = await this.prisma.product.deleteMany({});
            this.logger.log(`Deleted ${deleted.count} products`);
        } catch (error) {
            this.logger.error('Error cleaning products table');
            this.logger.error(error);
            throw error;
        }
    }

    async isSeeded(): Promise<boolean> {
        const count = await this.prisma.product.count();
        return count > 0;
    }
}