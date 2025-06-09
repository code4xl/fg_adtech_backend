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


  /**
   * Send client welcome email with login credentials
   */
  async sendClientWelcomeEmail(
    clientEmail: string,
    clientName: string,
    password: string,
    advertiserName: string,
    advertiserEmail: string,
    advertiserCompany: string
  ) {
    const appUrl = this.configService.get<string>('APP_URL');
    const loginUrl = `${appUrl}/client/login`;

    return await this.mailerService.sendMail({
      to: clientEmail,
      subject: `Welcome to Ocean Ad Network - Your Account is Ready!`,
      template: './client-welcome',
      context: {
        clientName,
        email: clientEmail,
        password,
        advertiserName,
        advertiserEmail,
        advertiserCompany,
        loginUrl,
        appUrl,
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
