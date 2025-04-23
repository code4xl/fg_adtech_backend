import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './config/configuration';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { AdvertisersModule } from './advertisers/advertisers.module';
import { PrismaModule } from './prisma/prisma.module';
import { PublishersModule } from './publishers/publishers.module';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [ConfigModule.forRoot(
    {
      isGlobal: true,
      load: [configuration],
      envFilePath: `.env.${process.env.NODE_ENV}`,
    }
  ),
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
    AdvertisersModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService, {
    provide: APP_GUARD,
    useClass: ThrottlerGuard
  }],
})
export class AppModule { }