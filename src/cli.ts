// import { NestFactory } from '@nestjs/core';
// import { CommandModule, CommandService } from 'nestjs-command';
// import { Logger } from '@nestjs/common';
// import { AppCommandModule } from './common/seeders/commands/command.module';

// async function bootstrap() {
//     const logger = new Logger('CLI');

//     try {
//         const app = await NestFactory.createApplicationContext(AppCommandModule, {
//             logger: ['error', 'warn', 'log'],
//         });

//         logger.log('Starting CLI application...');

//         try {
//             await app.select(CommandModule).get(CommandService).exec();
//             await app.close();
//         } catch (error) {
//             logger.error('CLI command execution failed', error);
//             await app.close();
//             process.exit(1);
//         }
//     } catch (error) {
//         logger.error('Failed to start CLI application', error);
//         process.exit(1);
//     }
// }

// bootstrap();
