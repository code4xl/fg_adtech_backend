import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { RedisModule } from '../redis/redis.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationController } from './notification.controller';
import { NotificationGateway } from './notification.gateway';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CampaignNotificationService } from './services/campaign.notification.service';
import { InventoryNotificationService } from './services/inventory.notification.service';
import { BudgetNotificationService } from './services/budget.notification.service';
import { BudgetNotificationJob } from 'src/rtb/jobs/daily/budget-notification.job';

@Module({
  imports: [RedisModule, PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: configService.get<string>('jwt.expiresIn') || '1d',
        },
      }),
    }),
  ],
  providers: [
    NotificationService,
    NotificationGateway,
    CampaignNotificationService,
    InventoryNotificationService,
    BudgetNotificationService,
    BudgetNotificationJob,
  ],
  controllers: [NotificationController],
  exports: [
    NotificationService,
    CampaignNotificationService,
    InventoryNotificationService,
    BudgetNotificationService
  ],
})
export class NotificationModule { }