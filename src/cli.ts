// src/cli.ts - Fixed version
import { NestFactory } from '@nestjs/core';
import { CommandModule, CommandService } from 'nestjs-command';
import { Logger } from '@nestjs/common';
import { AppCommandModule } from './common/seeders/commands/command.module';

async function bootstrap() {
  const logger = new Logger('CLI');

  try {
    logger.log('Starting CLI application...');

    const app = await NestFactory.createApplicationContext(AppCommandModule, {
      logger: ['error', 'warn', 'log', 'debug'],
    });

    logger.log('Application context created successfully');
    logger.log('Command arguments:', process.argv);

    try {
      const commandService = app.select(CommandModule).get(CommandService);
      logger.log('CommandService obtained, executing command...');

      await commandService.exec();
      logger.log('Command executed successfully');

      await app.close();
      logger.log('Application closed');
      process.exit(0);
    } catch (error) {
      logger.error('CLI command execution failed:', error.stack);
      await app.close();
      process.exit(1);
    }
  } catch (error) {
    logger.error('Failed to start CLI application:', error.stack);
    process.exit(1);
  }
}

// Add error handling for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

bootstrap();
