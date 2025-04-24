import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './config/configuration';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { PublishersModule } from './publishers/publishers.module';
import { PrismaService } from './prisma/prisma.service';
import { AdvertiserModule } from './advertiser/advertiser.module';

import { SuccessInterceptor } from './common/interceptors/success.interceptor';
import { AllExceptionsFilter } from './common/filters/global.exception';
import { ExceptionsModule } from './common/exceptions/exceptions.module';
import { CampaignModule } from './campaign/campaign.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: `.env.${process.env.NODE_ENV}`,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: configService.get<number>('throttle.ttl', 60000),
            limit: configService.get<number>('throttle.limit', 10000),
          },
        ],
      }),
    }),
    PrismaModule,
    AuthModule,
    PublishersModule,
    AdvertiserModule,
    ExceptionsModule,
    // CampaignModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SuccessInterceptor,
    },
  ],
})
export class AppModule {}
