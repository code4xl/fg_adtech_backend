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
import { AdminModule } from './admin/admin.module';

import { RedisModule } from './redis/redis.module';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KafkaModule } from './kafka/kafka.module';
import { ResilienceModule } from './common/resilience/resilience.module';
import { NotificationModule } from './notification/notification.module';
import { TimescaleModule } from './timescale/timescale.module';
import { RTBModule } from './rtb_old/rtb.module';
import { CdnModule } from './cdn/cdn.module';
import { SharedModule } from './shared/shared.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
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
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'nestjs-app',
              brokers: (configService.get<string>('kafka.brokers') ?? '').split(
                ',',
              ),
            },
            consumer: {
              groupId: 'nestjs-consumer',
              allowAutoTopicCreation: true,
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
    PrismaModule,
    AuthModule,
    PublishersModule,
    AdvertiserModule,
    ExceptionsModule,
    AdminModule,
    RedisModule,
    KafkaModule,
    ResilienceModule,
    NotificationModule,
    RTBModule,
    TimescaleModule,
    CdnModule,
    SharedModule,
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
