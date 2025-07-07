// src/common/seeders/commands/seed.command.ts - Debug version
import { Command, Option } from 'nestjs-command';
import { Injectable, Logger } from '@nestjs/common';
import { MainSeederService } from '../main.seeder';

@Injectable()
export class SeedCommand {
  private readonly logger = new Logger(SeedCommand.name);

  constructor(private readonly seederService: MainSeederService) {
    this.logger.log('SeedCommand constructor called');
  }

  @Command({
    command: 'db:seed',
    describe: 'Seed the database with initial data',
  })
  async seedAll(
    @Option({
      name: 'clean',
      describe: 'Clean the database before seeding',
      type: 'boolean',
      default: false,
    })
    clean: boolean,
  ) {
    this.logger.log('🚀 db:seed command started');
    this.logger.log(`Clean option: ${clean}`);

    try {
      if (clean) {
        this.logger.log('Cleaning all data before seeding...');
        await this.seederService.cleanAll();
      }

      this.logger.log('Starting to seed all modules...');
      await this.seederService.seedAll();
      this.logger.log(' All modules seeded successfully!');
    } catch (error) {
      this.logger.error('❌ Error seeding database:', error.stack);
      throw error;
    }
  }

  @Command({
    command: 'db:seed:module',
    describe: 'Seed a specific module and its dependencies',
  })
  async seedModule(
    @Option({
      name: 'module',
      describe: 'Module name to seed',
      type: 'string',
      demandOption: true,
    })
    moduleName: string,

    @Option({
      name: 'clean',
      describe: 'Clean the module and related modules before seeding',
      type: 'boolean',
      default: true,
    })
    clean: boolean,
  ) {
    this.logger.log(`🚀 db:seed:module command started for: ${moduleName}`);

    try {
      this.logger.log(`Seeding module: ${moduleName}`);
      await this.seederService.seedModule(moduleName, clean);
      this.logger.log(` Module ${moduleName} seeded successfully!`);
    } catch (error) {
      this.logger.error(`❌ Error seeding module: ${moduleName}`, error.stack);
      throw error;
    }
  }

  @Command({
    command: 'db:clean',
    describe: 'Clean all data from the database',
  })
  async cleanAll() {
    this.logger.log('🚀 db:clean command started');

    try {
      this.logger.log('Cleaning all data from database...');
      await this.seederService.cleanAll();
      this.logger.log(' Database cleaned successfully!');
    } catch (error) {
      this.logger.error('❌ Error cleaning database:', error.stack);
      throw error;
    }
  }

  @Command({
    command: 'db:seed:info',
    describe: 'Display information about available seeders and their order',
  })
  async showInfo() {
    this.logger.log('🚀 db:seed:info command started');

    try {
      const availableModules = this.seederService.getAvailableModules();
      const seedingOrder = this.seederService.getSeedingOrder();
      const cleaningOrder = this.seederService.getCleaningOrder();

      this.logger.log('📋 Available Modules:');
      availableModules.forEach((module) => this.logger.log(`- ${module}`));

      this.logger.log('\n📈 Seeding Order:');
      seedingOrder.forEach((module, index) =>
        this.logger.log(`${index + 1}. ${module}`),
      );

      this.logger.log('\n📉 Cleaning Order:');
      cleaningOrder.forEach((module, index) =>
        this.logger.log(`${index + 1}. ${module}`),
      );
    } catch (error) {
      this.logger.error('❌ Error displaying seeder information:', error.stack);
      throw error;
    }
  }
}
