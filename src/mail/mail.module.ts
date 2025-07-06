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
        // Debug: Print ALL environment variables related to mail
        console.log('=== MAIL CONFIG DEBUG ===');

        // Debug: Check config service access patterns
        console.log('\nConfig Service access:');
        console.log('config.get("mail.host"):', config.get('mail.host'));
        console.log('config.get("MAIL_HOST"):', config.get('MAIL_HOST'));
        console.log('config.get("mail"):', config.get('mail'));

        // Try different access patterns
        const mailConfig = {
          host: config.get('mail.host'),
          port: config.get('mail.port') || 587,
          secure: config.get('mail.secure'),
          user: config.get('mail.user'),
          password: config.get('mail.password'),
          from: config.get('mail.from'),
        };

        console.log('\nResolved mail config:');
        console.log('Host:', mailConfig.host);
        console.log('Port:', mailConfig.port);
        console.log('Secure:', mailConfig.secure);
        console.log('User:', mailConfig.user);
        console.log('Password exists:', !!mailConfig.password);
        console.log('From:', mailConfig.from);
        console.log('=== END MAIL CONFIG DEBUG ===\n');

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
