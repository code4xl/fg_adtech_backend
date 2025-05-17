// scripts/setup-timescale.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setupTimescaleDB() {
  try {
    // Create TimescaleDB extension if it doesn't exist
    await prisma.$executeRawUnsafe(
      'CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;',
    );

    // Convert tables to hypertables
    await prisma.$executeRawUnsafe(
      "SELECT create_hypertable('ImpressionTrack', 'timestamp', if_not_exists => TRUE);",
    );
    await prisma.$executeRawUnsafe(
      "SELECT create_hypertable('ClickTrack', 'timestamp', if_not_exists => TRUE);",
    );
    await prisma.$executeRawUnsafe(
      "SELECT create_hypertable('HourlyStats', 'hour', if_not_exists => TRUE);",
    );

    console.log('TimescaleDB setup completed successfully');
  } catch (error) {
    console.error('Error setting up TimescaleDB:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupTimescaleDB();
