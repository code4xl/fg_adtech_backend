import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminSeeder } from './modules/admin.seeder';
import { AdvertiserSeeder } from './modules/advertiser.seeder';
import { UserSeeder } from './modules/user.seeder';
import { ProductSeeder } from './modules/product.seeder';
import { MainSeederService } from './main.seeder';
import { DependencyResolver } from './tools/dependency.resolver';
import { SeederRegistry } from './tools/seeders.registry';


// Add new seeders to this array
const SEEDERS = [
    AdminSeeder,
    AdvertiserSeeder,
    UserSeeder,
    ProductSeeder,
];

@Module({
    imports: [PrismaModule],
    providers: [
        MainSeederService,
        DependencyResolver,
        SeederRegistry,
        ...SEEDERS,
        {
            provide: 'SEEDERS',
            useFactory: (...seeders) => seeders,
            inject: SEEDERS,
        },
    ],
    exports: [MainSeederService],
})
export class SeederModule {
    constructor(
        private seederRegistry: SeederRegistry,
    ) {
        // Register all seeders to the registry
        this.seederRegistry.registerSeeders(SEEDERS);
    }
}