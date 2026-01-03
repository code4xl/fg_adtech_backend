import { Injectable, Logger } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from 'src/prisma/prisma.service';
import { ISeeder } from '../interfaces/seeder.interface';

@Injectable()
export class AdminSeeder implements ISeeder {
  private readonly logger = new Logger(AdminSeeder.name);

  constructor(private readonly prisma: PrismaService) {}

  getModuleName(): string {
    return 'Admin';
  }

  getDependencies(): string[] {
    // Admin has no dependencies
    return [];
  }

  async seed(count: number = 5): Promise<void> {
    this.logger.debug(`Seeding ${count} admins...`);

    try {
      const adminData: any = [];

      // Generate fake admins
      for (let i = 0; i < count; i++) {
        const password = 'qwerty';
        const hashedPassword = await bcrypt.hash(password, 10);

        adminData.push({
          name: faker.person.fullName(),
          email: faker.internet.email().toLowerCase(),
          password: hashedPassword,
          mfaEnabled: faker.datatype.boolean(0.3), // 30% chance of MFA enabled
        });
      }

      // Add a default admin
      adminData.push({
        name: 'Super Admin',
        email: 'admin@example.com',
        password: await bcrypt.hash('adminpass123', 10),
        mfaEnabled: true,
      });

      // Insert all admins
      await this.prisma.admin.createMany({
        data: adminData,
        skipDuplicates: true,
      });

      const adminCount = await this.prisma.admin.count();
      this.logger.debug(`Successfully seeded ${adminCount} admins`);
    } catch (error) {
      this.logger.error('Error seeding admins');
      this.logger.error(error);
      throw error;
    }
  }

  async clean(): Promise<void> {
    this.logger.debug('Cleaning admins table...');

    try {
      const deleted = await this.prisma.admin.deleteMany({});
      this.logger.debug(`Deleted ${deleted.count} admins`);
    } catch (error) {
      this.logger.error('Error cleaning admins table');
      this.logger.error(error);
      throw error;
    }
  }

  async isSeeded(): Promise<boolean> {
    const count = await this.prisma.admin.count();
    return count > 0;
  }
}
