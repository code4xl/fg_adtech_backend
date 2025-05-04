import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { CreativeService } from './creative.service';
import { CreativeController } from './creative.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { CreativeHelperService } from './creative.helper';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    MulterModule.register({
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max file size
      },
    }),
  ],
  controllers: [
    CreativeController,
  ],
  providers: [
    CreativeService,
    CreativeHelperService,
  ],
  exports: [
    CreativeService
  ]
})
export class CreativeModule { }