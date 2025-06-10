import { Injectable, Logger } from '@nestjs/common';
import { DependencyResolver } from './tools/dependency.resolver';
import { SeederRegistry } from './tools/seeders.registry';

@Injectable()
export class MainSeederService {
  private readonly logger = new Logger(MainSeederService.name);

  constructor(
    private readonly seederRegistry: SeederRegistry,
    private readonly dependencyResolver: DependencyResolver,
  ) {}

  async seedAll(): Promise<void> {
    const seeders = this.seederRegistry.getAllSeeders();
    const orderedSeeders = this.dependencyResolver.resolveSeederOrder(seeders);

    this.logger.log(
      `Starting seeding process for ${orderedSeeders.length} modules...`,
    );

    for (const seeder of orderedSeeders) {
      try {
        const isSeeded = await seeder.isSeeded();
        if (!isSeeded) {
          this.logger.log(`Seeding ${seeder.getModuleName()}...`);
          await seeder.seed();
          this.logger.log(`✅ ${seeder.getModuleName()} seeded successfully`);
        } else {
          this.logger.log(
            `⏭️  ${seeder.getModuleName()} already seeded, skipping...`,
          );
        }
      } catch (error) {
        this.logger.error(
          `❌ Failed to seed ${seeder.getModuleName()}: ${error.message}`,
        );
        throw error;
      }
    }

    this.logger.log('✅ All modules seeded successfully!');
  }

  async cleanAll(): Promise<void> {
    const seeders = this.seederRegistry.getAllSeeders();
    const orderedSeeders = this.dependencyResolver.resolveCleanerOrder(seeders);

    this.logger.log(
      `Starting cleanup process for ${orderedSeeders.length} modules...`,
    );

    for (const seeder of orderedSeeders) {
      try {
        this.logger.log(`Cleaning ${seeder.getModuleName()}...`);
        await seeder.clean();
        this.logger.log(`✅ ${seeder.getModuleName()} cleaned successfully`);
      } catch (error) {
        this.logger.warn(
          `⚠️  Failed to clean ${seeder.getModuleName()}: ${error.message}`,
        );
        // Continue with other cleanups even if one fails
      }
    }

    this.logger.log('✅ All modules cleaned successfully!');
  }

  async seedModule(moduleName: string, clean: boolean = false): Promise<void> {
    const allSeeders = this.seederRegistry.getAllSeeders();
    const chainModules = this.dependencyResolver.getModuleDependencyChain(
      moduleName,
      allSeeders,
    );

    if (!this.seederRegistry.moduleExists(moduleName)) {
      throw new Error(
        `Module "${moduleName}" not found. Available modules: ${this.getAvailableModules().join(', ')}`,
      );
    }

    this.logger.log(
      `Processing module "${moduleName}" with dependency chain: ${chainModules.join(' -> ')}`,
    );

    if (clean) {
      this.logger.log('Cleaning modules in reverse order...');
      // Clean in reverse order
      const reverseChain = [...chainModules].reverse();
      for (const name of reverseChain) {
        const seeder = this.seederRegistry.getSeeder(name);
        if (seeder) {
          try {
            await seeder.clean();
            this.logger.log(`✅ ${name} cleaned`);
          } catch (error) {
            this.logger.warn(`⚠️  Failed to clean ${name}: ${error.message}`);
          }
        }
      }
    }

    // Seed in correct dependency order
    this.logger.log('Seeding modules in dependency order...');
    for (const name of chainModules) {
      const seeder = this.seederRegistry.getSeeder(name);
      if (seeder) {
        try {
          const isSeeded = await seeder.isSeeded();
          if (!isSeeded) {
            this.logger.log(`Seeding ${name}...`);
            await seeder.seed();
            this.logger.log(`✅ ${name} seeded successfully`);
          } else {
            this.logger.log(`⏭️  ${name} already seeded, skipping...`);
          }
        } catch (error) {
          this.logger.error(`❌ Failed to seed ${name}: ${error.message}`);
          throw error;
        }
      }
    }

    this.logger.log(
      `✅ Module "${moduleName}" and dependencies processed successfully!`,
    );
  }

  getAvailableModules(): string[] {
    return this.seederRegistry.getAvailableModules();
  }

  getSeedingOrder(): string[] {
    const seeders = this.seederRegistry.getAllSeeders();
    return this.dependencyResolver
      .resolveSeederOrder(seeders)
      .map((s) => s.getModuleName());
  }

  getCleaningOrder(): string[] {
    const seeders = this.seederRegistry.getAllSeeders();
    return this.dependencyResolver
      .resolveCleanerOrder(seeders)
      .map((s) => s.getModuleName());
  }
}
