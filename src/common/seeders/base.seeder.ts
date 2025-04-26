import { PrismaService } from '../../prisma/prisma.service';
import { Logger } from '@nestjs/common';

export abstract class BaseSeeder {
    protected readonly logger = new Logger(this.constructor.name);

    constructor(protected readonly prisma: PrismaService) { }

    /**
     * Get the name of the module/table this seeder handles
     */
    abstract getModuleName(): string;

    /**
     * Get the names of dependent modules that should be seeded before this one
     */
    abstract getDependencies(): string[];

    /**
     * Execute the seeding logic for this module
     */
    abstract seed(): Promise<void>;

    /**
     * Clean data for this module
     */
    abstract clean(): Promise<void>;

    /**
     * Check if module has been seeded
     */
    abstract isSeeded(): Promise<boolean>;
}