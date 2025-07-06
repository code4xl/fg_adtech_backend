// src/mail/mail.module.ts - Debug version
import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';
import { MailService } from './mail.service';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const mailConfig = {
          host: config.get('mail.host'),
          port: config.get('mail.port') || 587,
          secure: config.get('mail.secure'),
          user: config.get('mail.user'),
          password: config.get('mail.password'),
          from: config.get('mail.from'),
        };

        return {
          transport: {
            host: mailConfig.host,
            port: parseInt(mailConfig.port.toString()),
            secure: mailConfig.secure,
            auth: {
              user: mailConfig.user,
              pass: mailConfig.password,
            },
            tls: {
              rejectUnauthorized: false,
            },
          },
          defaults: {
            from: `"Ocean Ad Network" <${mailConfig.from}>`,
          },
          template: {
            dir: join(process.cwd(), 'src', 'mail', 'templates'),
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true,
            },
          },
        };
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
