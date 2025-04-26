import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthController } from './auth.controller';
import { LocalAdminStrategy, LocalAdvertiserStrategy, LocalClientStrategy, LocalPublisherStrategy } from './strategies/authentication.strategy';
import { JwtStrategy } from './strategies/authorization.strategy';
import { MailModule } from 'src/mail/mail.module';
import { LoginValidationMiddleware } from './middlewares/login.middleware';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    MailModule,
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
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalAdvertiserStrategy,
    LocalPublisherStrategy,
    LocalClientStrategy,
    LocalAdminStrategy,
    JwtStrategy
  ],
  exports: [AuthService],
})

export class AuthModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoginValidationMiddleware)
      .forRoutes(
        { path: 'auth/admin/login', method: RequestMethod.POST },
        { path: 'auth/advertiser/login', method: RequestMethod.POST },
        { path: 'auth/publisher/login', method: RequestMethod.POST }
      );
  }
}