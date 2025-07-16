import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';

// Services
import { MailService } from './mail.service';
import { EmailQueueService } from './email-queue.service';
import { EmailProcessorService } from './email-processor.service';

// Controllers

// Modules
import { RedisModule } from '../redis/redis.module';
import { EmailQueueController } from 'src/admin/email/email-queue.controller';

@Module({
  imports: [
    // Schedule module for cron jobs
    ScheduleModule.forRoot(),
    
    // Redis module for queue management
    RedisModule,
    
    // Mailer module configuration
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
            // Email sending optimizations
            pool: true, // Use connection pooling
            maxConnections: 5, // Max concurrent connections
            maxMessages: 100, // Max messages per connection
            rateDelta: 1000, // Rate limiting window (1 second)
            rateLimit: 10, // Max messages per window
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
  controllers: [
    EmailQueueController,
  ],
  providers: [
    MailService,
    EmailQueueService,
    EmailProcessorService,
  ],
  exports: [
    MailService,
    EmailQueueService,
    EmailProcessorService,
  ],
})
export class MailModule {}