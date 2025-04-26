import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  constructor(
    private mailerService: MailerService,
    private configService: ConfigService,
  ) { }

  async sendVerificationEmail(email: string, name: string, role: string, token: string) {
    const appUrl = this.configService.get<string>('APP_URL');
    const verificationUrl = `${appUrl}/auth/${role}/verify/${token}`;

    await this.mailerService.sendMail({
      to: email,
      subject: 'Please verify your email',
      template: './email-verification', // Create this template in the templates directory
      context: {
        name,
        verificationUrl,
      },
    });
  }

  async sendPasswordResetEmail(email: string, name: string, token: string) {
    const appUrl = this.configService.get<string>('APP_URL');
    const resetUrl = `${appUrl}/auth/reset-password/${token}`;

    await this.mailerService.sendMail({
      to: email,
      subject: 'Password Reset Request',
      template: './password-reset', // Create this template in the templates directory
      context: {
        name,
        resetUrl,
      },
    });
  }
}
