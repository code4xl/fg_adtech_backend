// // src/seeder/seeder.controller.ts
// import { Controller, Post, Get, Body, Query } from '@nestjs/common';
// import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
// import { MainSeederService } from 'src/common/seeders/main.seeder';

// @ApiTags('Seeders')
// @Controller('seeders')
// export class SeedDbController {
//   constructor(private readonly seederService: MainSeederService) {}

//   @Post('seed-all')
//   @ApiOperation({ summary: 'Seed all modules' })
//   @ApiQuery({ name: 'clean', required: false, type: Boolean })
//   async seedAll(@Query('clean') clean: boolean = false) {
//     if (clean) {
//       await this.seederService.cleanAll();
//     }
//     await this.seederService.seedAll();
//     return { message: 'All modules seeded successfully!' };
//   }

//   @Post('seed-module')
//   @ApiOperation({ summary: 'Seed a specific module and its dependencies' })
//   async seedModule(@Body() body: { module: string; clean: boolean }) {
//     await this.seederService.seedModule(body.module, body.clean);
//     return { message: `Module ${body.module} seeded successfully!` };
//   }

//   @Get('info')
//   @ApiOperation({
//     summary: 'Get information about available seeders and their order',
//   })
//   async getSeedInfo() {
//     const availableModules = this.seederService.getAvailableModules();
//     const seedingOrder = this.seederService.getSeedingOrder();
//     const cleaningOrder = this.seederService.getCleaningOrder();

//     return {
//       availableModules,
//       seedingOrder,
//       cleaningOrder,
//     };
//   }

//   @Post('clean')
//   @ApiOperation({ summary: 'Clean all data from the database' })
//   async cleanAll() {
//     await this.seederService.cleanAll();
//     return { message: 'Database cleaned successfully!' };
//   }
// }
