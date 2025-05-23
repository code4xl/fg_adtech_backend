import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { CreativeService } from './creative.service';
import { CreativeController } from './creative.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { CreativeHelperService } from './creative.helper';
import { CreativeNotificationService } from 'src/notification/services/creative.notification.service';
import { NotificationModule } from 'src/notification/notification.module';
import { AdminCreativeController } from './admin-creative.controller';
import { S3Module } from 'src/common/services/s3.module';
import { S3StorageService } from 'src/common/services/s3-storage.service';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    NotificationModule,
    MulterModule.register({
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max file size
      },
    }),
    S3Module,
  ],
  controllers: [
    CreativeController,
    AdminCreativeController,
  ],
  providers: [
    CreativeService,
    CreativeHelperService,
    CreativeNotificationService,
    S3StorageService,
  ],
  exports: [
    CreativeService,
  ]
})
export class CreativeModule { }