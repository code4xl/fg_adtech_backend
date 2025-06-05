import { Module } from '@nestjs/common';
import { AdvertiserService } from './advertiser.service';
import { AdvertiserController } from './advertiser.controller';
import { AdvertiserTargetingController } from './advertiser.targetting.controller';
import { AdvertiserCampaignController } from './advertiser.campaign.controller';
import { AdvertiserCampaignService } from './advertiser.campaign.service';
import { AdvertiserHelper } from './advertiser.helper';
import { AdvertiserTargetingService } from './advertiser.targeting.service';
import { AdvertiserCreativeController } from './advertiser.creative.controller';
import { AdvertiserCreativeService } from './advertiser.creative.service';
import { CreativeNotificationService } from 'src/notification/services/creative.notification.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { S3StorageService } from 'src/common/services/s3-storage.service';
import { NotificationService } from 'src/notification/notification.service';
import { RedisService } from 'src/redis/redis.service';
import { S3Module } from 'src/common/services/s3.module';
import { MulterModule } from '@nestjs/platform-express';
import { NotificationModule } from 'src/notification/notification.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CampaignBudgetTrackerController } from './advertiser.campaign-budget.controller';
import { CampaignBudgetTrackerService } from './advertiser.campaign-budget.service';

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
    AdvertiserController,
    AdvertiserTargetingController,
    AdvertiserCampaignController,
    AdvertiserCreativeController,
    CampaignBudgetTrackerController,
  ],
  providers: [
    AdvertiserService,
    AdvertiserCampaignService,
    AdvertiserHelper,
    AdvertiserTargetingService,
    AdvertiserCreativeService,
    CreativeNotificationService,
    CampaignBudgetTrackerService,
    S3StorageService,
  ],
  exports: [AdvertiserService],
})

export class AdvertiserModule { }
