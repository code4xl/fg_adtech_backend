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
import { AdvertiserClientController } from './advertiser.client.controller';
import { AdvertiserClientService } from './advertiser.client.service';
import { MailService } from 'src/mail/mail.service';
import { MailModule } from 'src/mail/mail.module';
import { AuthService } from 'src/auth/auth.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { CampaignEligibilityService } from 'src/rtb/services/campaign-eligibility.service';
import { CampaignTargetingService } from 'src/rtb/services/campaign-targeting.service';

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
    MailModule,
    JwtModule,
  ],
  controllers: [
    AdvertiserController,
    AdvertiserTargetingController,
    AdvertiserCampaignController,
    AdvertiserCreativeController,
    CampaignBudgetTrackerController,
    AdvertiserClientController,
  ],
  providers: [
    AdvertiserService,
    AdvertiserCampaignService,
    AdvertiserHelper,
    AdvertiserTargetingService,
    AdvertiserCreativeService,
    AdvertiserClientService,
    CreativeNotificationService,
    CampaignBudgetTrackerService,
    CampaignEligibilityService,
    CampaignTargetingService,
    RedisService,
    S3StorageService,
    MailService,
    AuthService,
    JwtService,
  ],
  exports: [AdvertiserService],
})

export class AdvertiserModule { }
