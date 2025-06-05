import { Command, Option } from 'nestjs-command';
import { Injectable, Logger } from '@nestjs/common';
import { MainSeederService } from '../main.seeder';

@Injectable()
export class SeedCommand {
  private readonly logger = new Logger(SeedCommand.name);

  constructor(private readonly seederService: MainSeederService) {}

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
    try {
      if (clean) {
        this.logger.log('Cleaning all data before seeding...');
        await this.seederService.cleanAll();
      }

      this.logger.log('Seeding all modules...');
      await this.seederService.seedAll();
      this.logger.log('All modules seeded successfully!');
    } catch (error) {
      this.logger.error('Error seeding database');
      this.logger.error(error);
      process.exit(1);
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
    try {
      this.logger.log(`Seeding module: ${moduleName}`);
      await this.seederService.seedModule(moduleName, clean);
      this.logger.log(`Module ${moduleName} seeded successfully!`);
    } catch (error) {
      this.logger.error(`Error seeding module: ${moduleName}`);
      this.logger.error(error);
      process.exit(1);
    }
  }

  @Command({
    command: 'db:clean',
    describe: 'Clean all data from the database',
  })
  async cleanAll() {
    try {
      this.logger.log('Cleaning all data from database...');
      await this.seederService.cleanAll();
      this.logger.log('Database cleaned successfully!');
    } catch (error) {
      this.logger.error('Error cleaning database');
      this.logger.error(error);
      process.exit(1);
    }
  }

  @Command({
    command: 'db:seed:info',
    describe: 'Display information about available seeders and their order',
  })
  async showInfo() {
    try {
      const availableModules = this.seederService.getAvailableModules();
      const seedingOrder = this.seederService.getSeedingOrder();
      const cleaningOrder = this.seederService.getCleaningOrder();

      this.logger.log('Available Modules:');
      availableModules.forEach((module) => this.logger.log(`- ${module}`));

      this.logger.log('\nSeeding Order:');
      seedingOrder.forEach((module, index) =>
        this.logger.log(`${index + 1}. ${module}`),
      );

      this.logger.log('\nCleaning Order:');
      cleaningOrder.forEach((module, index) =>
        this.logger.log(`${index + 1}. ${module}`),
      );
    } catch (error) {
      this.logger.error('Error displaying seeder information');
      this.logger.error(error);
      process.exit(1);
    }
  }
}
