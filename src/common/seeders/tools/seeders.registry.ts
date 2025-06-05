import { Injectable, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ISeeder } from '../interfaces/seeder.interface';

@Injectable()
export class SeederRegistry {
  private readonly seeders = new Map<string, Type<ISeeder>>();

  constructor(private moduleRef: ModuleRef) {}

  registerSeeders(seeders: Type<ISeeder>[]): void {
    for (const seeder of seeders) {
      const instance = this.moduleRef.get(seeder, { strict: false }) as ISeeder;
      this.seeders.set(instance.getModuleName().toLowerCase(), seeder);
    }
  }

  moduleExists(moduleName: string): boolean {
    return this.seeders.has(moduleName.toLowerCase());
  }

  getAllSeeders(): ISeeder[] {
    return Array.from(this.seeders.values()).map(
      (seeder) => this.moduleRef.get(seeder, { strict: false }) as ISeeder,
    );
  }

  getSeeder(moduleName: string): ISeeder | undefined {
    const SeederClass = this.seeders.get(moduleName.toLowerCase());
    if (!SeederClass) return undefined;
    return this.moduleRef.get(SeederClass, { strict: false });
  }

  getAvailableModules(): string[] {
    return Array.from(this.seeders.keys());
  }
}
