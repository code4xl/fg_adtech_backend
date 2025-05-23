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
      template: './email-verification',
      context: {
        name,
        verificationUrl,
      },
    });
  }

  async sendPasswordResetEmail(email: string, role: string, resetLink: string) {
    return await this.mailerService.sendMail({
      to: email,
      subject: 'Password Reset Request',
      template: './password-reset',
      context: {
        resetLink,
      },
    });
  }

  async sendMfaCodeEmail(email: string, verificationCode: string, expiryMinutes: number) {
    const appName = this.configService.get<string>('APP_NAME', 'Ocean Ad Network');
    
    return await this.mailerService.sendMail({
      to: email,
      subject: `${appName} - Your Login Verification Code`,
      template: './mfa-code',
      context: {
        verificationCode,
        expiryMinutes,
        appName,
      },
    });
  }
}
