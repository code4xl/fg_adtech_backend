import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SeederRegistry } from './tools/seeders.registry';
import { BaseSeeder } from './base.seeder';
import { DependencyResolver } from './tools/dependency.resolver';

@Injectable()
export class MainSeederService {
    private readonly logger = new Logger(MainSeederService.name);

    constructor(
        private prisma: PrismaService,
        private dependencyResolver: DependencyResolver,
        private seederRegistry: SeederRegistry,
    ) { }

    /**
     * Seed all modules in the correct order
     */
    async seedAll(): Promise<void> {
        this.logger.log('Starting to seed all modules...');

        try {
            const seeders = this.seederRegistry.getAllSeeders();
            const orderedSeeders = this.dependencyResolver.resolveSeederOrder(seeders);

            // Seed each module in order
            for (const seeder of orderedSeeders) {
                const moduleName = seeder.getModuleName();
                this.logger.log(`Seeding module: ${moduleName}`);
                await seeder.seed();
                this.logger.log(`Completed seeding module: ${moduleName}`);
            }

            this.logger.log('All modules seeded successfully');
        } catch (error) {
            this.logger.error('Error seeding all modules');
            this.logger.error(error);
            throw error;
        }
    }

    /**
     * Clean all modules in the correct order (reverse of seeding)
     */
    async cleanAll(): Promise<void> {
        this.logger.log('Starting to clean all modules...');

        try {
            const seeders = this.seederRegistry.getAllSeeders();
            const orderedCleaners = this.dependencyResolver.resolveCleanerOrder(seeders);

            // Clean each module in reverse order
            for (const seeder of orderedCleaners) {
                const moduleName = seeder.getModuleName();
                this.logger.log(`Cleaning module: ${moduleName}`);
                await seeder.clean();
                this.logger.log(`Completed cleaning module: ${moduleName}`);
            }

            this.logger.log('All modules cleaned successfully');
        } catch (error) {
            this.logger.error('Error cleaning all modules');
            this.logger.error(error);
            throw error;
        }
    }

    /**
     * Clean and seed all modules
     */
    async resetAndSeedAll(): Promise<void> {
        await this.cleanAll();
        await this.seedAll();
    }

    /**
     * Seed a specific module and all its dependencies and dependents
     * @param moduleName The name of the module to seed
     * @param cleanFirst Whether to clean the modules first
     */
    async seedModule(moduleName: string, cleanFirst: boolean = true): Promise<void> {
        if (!this.seederRegistry.moduleExists(moduleName)) {
            throw new Error(`Module "${moduleName}" not found. Available modules: ${this.seederRegistry.getAvailableModules().join(', ')}`);
        }

        this.logger.log(`Starting to seed module: ${moduleName}`);

        try {
            const allSeeders = this.seederRegistry.getAllSeeders();
            const moduleChain = this.dependencyResolver.getModuleDependencyChain(moduleName, allSeeders);

            this.logger.log(`Module chain to process: ${moduleChain.join(', ')}`);

            // Filter seeders to only include those in the module chain
            const seedersToProcess = allSeeders.filter(s =>
                moduleChain.includes(s.getModuleName())
            );

            // Resolve order for seeding and cleaning
            const orderedSeeders = this.dependencyResolver.resolveSeederOrder(seedersToProcess);
            const orderedCleaners = this.dependencyResolver.resolveCleanerOrder(seedersToProcess);

            // Clean modules if required
            if (cleanFirst) {
                for (const seeder of orderedCleaners) {
                    const currentModule = seeder.getModuleName();
                    this.logger.log(`Cleaning module: ${currentModule}`);
                    await seeder.clean();
                    this.logger.log(`Completed cleaning module: ${currentModule}`);
                }
            }

            // Seed modules
            for (const seeder of orderedSeeders) {
                const currentModule = seeder.getModuleName();
                this.logger.log(`Seeding module: ${currentModule}`);
                await seeder.seed();
                this.logger.log(`Completed seeding module: ${currentModule}`);
            }

            this.logger.log(`Module ${moduleName} and related modules seeded successfully`);
        } catch (error) {
            this.logger.error(`Error seeding module: ${moduleName}`);
            this.logger.error(error);
            throw error;
        }
    }

    /**
     * Show the seeding order for all modules
     */
    getSeedingOrder(): string[] {
        const seeders = this.seederRegistry.getAllSeeders();
        const orderedSeeders = this.dependencyResolver.resolveSeederOrder(seeders);
        return orderedSeeders.map(s => s.getModuleName());
    }

    /**
     * Show the cleaning order for all modules
     */
    getCleaningOrder(): string[] {
        const seeders = this.seederRegistry.getAllSeeders();
        const orderedCleaners = this.dependencyResolver.resolveCleanerOrder(seeders);
        return orderedCleaners.map(s => s.getModuleName());
    }

    /**
     * List all available modules that can be seeded
     */
    getAvailableModules(): string[] {
        return this.seederRegistry.getAvailableModules();
    }
}