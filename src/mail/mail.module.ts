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
            useFactory: (config: ConfigService) => ({
                transport: {
                    host: config.get('mail.host'),
                    port: config.get('mail.port'),
                    secure: config.get('mail.secure'),
                    auth: {
                        user: config.get('mail.user'),
                        pass: config.get('mail.password'),
                    },
                },
                defaults: {
                    from: `"No Reply" <${config.get('mail.from')}>`,
                },
                template: {
                    dir: join(__dirname, '..', 'mail', 'templates'),
                    adapter: new HandlebarsAdapter(),
                    options: {
                        strict: true,
                    },
                },
            }),
        }),
    ],
    providers: [MailService],
    exports: [MailService],
})
export class MailModule { }