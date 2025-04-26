import { Injectable, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { BaseSeeder } from '../base.seeder';

/**
 * Registry for all seeders in the application
 * Provides methods to get all seeders or specific seeders by module name
 */
@Injectable()
export class SeederRegistry {
    private seeders: BaseSeeder[] = [];

    constructor(private moduleRef: ModuleRef) { }

    /**
     * Register all available seeders
     * @param seederTypes Array of seeder class types
     */
    registerSeeders(seederTypes: Type<BaseSeeder>[]) {
        this.seeders = seederTypes.map(type => this.moduleRef.get(type));
    }

    /**
     * Get all registered seeders
     */
    getAllSeeders(): BaseSeeder[] {
        return this.seeders;
    }

    /**
     * Get a specific seeder by module name
     */
    getSeederByModule(moduleName: string): BaseSeeder | undefined {
        return this.seeders.find(seeder => seeder.getModuleName() === moduleName);
    }

    /**
     * Get all available module names
     */
    getAvailableModules(): string[] {
        return this.seeders.map(seeder => seeder.getModuleName());
    }

    /**
     * Check if a module exists
     */
    moduleExists(moduleName: string): boolean {
        return this.seeders.some(seeder => seeder.getModuleName() === moduleName);
    }
}