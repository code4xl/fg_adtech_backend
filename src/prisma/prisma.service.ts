import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private configService: ConfigService) {
    // Try different ways to get the database URL
    const dbUrl = configService.get('database.url') ||
      configService.get('DATABASE_URL') ||
      process.env.DATABASE_URL;

    console.log('Database URL:', dbUrl); // For debugging

    if (!dbUrl) {
      throw new Error('Database URL is not defined. Please check your environment configuration.');
    }

    super({
      datasources: {
        db: {
          url: dbUrl,
        },
      },
      log: ['warn', 'error'],
      errorFormat: 'pretty',
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    // Use Prisma's transactions for safe cleanup
    // Order matters due to foreign key constraints
    const modelNames = Reflect.ownKeys(this).filter((key) => {
      return (
        typeof key === 'string' &&
        !key.startsWith('_') &&
        key !== '$connect' &&
        key !== '$disconnect' &&
        key !== '$on' &&
        key !== '$transaction' &&
        key !== '$use'
      );
    });

    return this.$transaction(
      modelNames.map((modelName) => {
        return this[modelName as string].deleteMany();
      }),
    );
  }
}