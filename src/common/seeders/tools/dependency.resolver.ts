import { Injectable, Logger } from '@nestjs/common';
import { BaseSeeder } from '../base.seeder';

/**
 * Responsible for resolving dependencies between seeders
 * and determining the correct order for seeding and cleaning
 */
@Injectable()
export class DependencyResolver {
    private readonly logger = new Logger(DependencyResolver.name);

    /**
     * Sort seeders based on their dependencies
     * Uses topological sort to ensure seeders run in the correct order
     */
    resolveSeederOrder(seeders: BaseSeeder[]): BaseSeeder[] {
        const moduleMap = new Map<string, BaseSeeder>();
        const graph = new Map<string, string[]>();

        // Build the dependency graph
        for (const seeder of seeders) {
            const moduleName = seeder.getModuleName();
            moduleMap.set(moduleName, seeder);
            graph.set(moduleName, seeder.getDependencies());
        }

        // Perform topological sort
        const visited = new Set<string>();
        const sorted: string[] = [];

        const visit = (moduleName: string, path: string[] = []) => {
            // Detect circular dependencies
            if (path.includes(moduleName)) {
                const cycle = [...path.slice(path.indexOf(moduleName)), moduleName].join(' -> ');
                throw new Error(`Circular dependency detected: ${cycle}`);
            }

            if (visited.has(moduleName)) return;

            visited.add(moduleName);

            // Visit dependencies first
            const dependencies = graph.get(moduleName) || [];
            for (const dependency of dependencies) {
                if (!moduleMap.has(dependency)) {
                    this.logger.warn(`Missing dependency: ${dependency} for module ${moduleName}`);
                    continue;
                }
                visit(dependency, [...path, moduleName]);
            }

            // Add to sorted list
            sorted.push(moduleName);
        };

        // Visit all modules
        for (const moduleName of moduleMap.keys()) {
            if (!visited.has(moduleName)) {
                visit(moduleName);
            }
        }

        // Map back to seeder instances and filter out undefined values
        return sorted
            .map(moduleName => moduleMap.get(moduleName))
            .filter((seeder): seeder is BaseSeeder => seeder !== undefined);
    }

    /**
     * Return the seeders in the reverse order for cleaning
     * Ensures child tables are cleaned before parent tables
     */
    resolveCleanerOrder(seeders: BaseSeeder[]): BaseSeeder[] {
        return [...this.resolveSeederOrder(seeders)].reverse();
    }

    /**
     * Get all dependent modules for a given module
     * This includes both direct and indirect dependencies
     */
    getDependentModules(targetModule: string, seeders: BaseSeeder[]): Set<string> {
        const dependents = new Set<string>();
        const moduleMap = new Map<string, string[]>();

        // Build reverse dependency graph
        for (const seeder of seeders) {
            const moduleName = seeder.getModuleName();
            const dependencies = seeder.getDependencies();

            for (const dependency of dependencies) {
                if (!moduleMap.has(dependency)) {
                    moduleMap.set(dependency, []);
                }
                moduleMap.get(dependency)!.push(moduleName);
            }
        }

        // Recursive function to find all dependent modules
        const findDependents = (module: string) => {
            const directDependents = moduleMap.get(module) || [];

            for (const dependent of directDependents) {
                if (!dependents.has(dependent)) {
                    dependents.add(dependent);
                    findDependents(dependent);
                }
            }
        };

        findDependents(targetModule);
        return dependents;
    }

    /**
     * Get all dependencies and dependents for a target module
     * This ensures we get all modules that need to be processed 
     * when seeding a specific module
     */
    getModuleDependencyChain(targetModule: string, seeders: BaseSeeder[]): string[] {
        const seederMap = new Map<string, BaseSeeder>();
        seeders.forEach(seeder => seederMap.set(seeder.getModuleName(), seeder));

        // Get the target seeder
        const targetSeeder = seeders.find(s => s.getModuleName() === targetModule);
        if (!targetSeeder) {
            throw new Error(`Module ${targetModule} not found`);
        }

        // Get all dependencies
        const dependencies = new Set<string>();
        const collectDependencies = (moduleName: string) => {
            const seeder = seederMap.get(moduleName);
            if (!seeder) return;

            for (const dep of seeder.getDependencies()) {
                dependencies.add(dep);
                collectDependencies(dep);
            }
        };

        collectDependencies(targetModule);

        // Get all modules that depend on this module
        const dependents = this.getDependentModules(targetModule, seeders);

        // Combine and return unique list
        return [...new Set([...dependencies, targetModule, ...dependents])];
    }
}