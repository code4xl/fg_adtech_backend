import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private mailerService: MailerService,
    private configService: ConfigService,
  ) {}

  /**
   * Send verification email
   */
  async sendVerificationEmail(
    email: string,
    name: string,
    role: string,
    token: string
  ): Promise<void> {
    try {
      const startTime = Date.now();
      const appUrl = this.configService.get<string>('template.url');
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

      const sendTime = Date.now() - startTime;
      this.logger.debug(`Verification email sent to ${email} in ${sendTime}ms`);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${email}: ${error.message}`);
      throw error;
    }
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
  ): Promise<void> {
    try {
      const startTime = Date.now();
      const appUrl = this.configService.get<string>('template.url');
      const loginUrl = `${appUrl}/client/login`;

      await this.mailerService.sendMail({
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

      const sendTime = Date.now() - startTime;
      this.logger.debug(`Client welcome email sent to ${clientEmail} in ${sendTime}ms`);
    } catch (error) {
      this.logger.error(`Failed to send client welcome email to ${clientEmail}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    email: string,
    role: string,
    resetLink: string
  ): Promise<void> {
    try {
      const startTime = Date.now();

      await this.mailerService.sendMail({
        to: email,
        subject: 'Password Reset Request',
        template: './password-reset',
        context: {
          resetLink,
        },
      });

      const sendTime = Date.now() - startTime;
      this.logger.debug(`Password reset email sent to ${email} in ${sendTime}ms`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send MFA code email
   */
  async sendMfaCodeEmail(
    email: string,
    verificationCode: string,
    expiryMinutes: number
  ): Promise<void> {
    try {
      const startTime = Date.now();
      const appName = this.configService.get<string>('template.name', 'Ocean Ad Network');

      await this.mailerService.sendMail({
        to: email,
        subject: `${appName} - Your Login Verification Code`,
        template: './mfa-code',
        context: {
          verificationCode,
          expiryMinutes,
          appName,
        },
      });

      const sendTime = Date.now() - startTime;
      this.logger.debug(`MFA code email sent to ${email} in ${sendTime}ms`);
    } catch (error) {
      this.logger.error(`Failed to send MFA code email to ${email}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send test email (for debugging)
   */
  async sendTestEmail(email: string): Promise<void> {
    try {
      const startTime = Date.now();

      await this.mailerService.sendMail({
        to: email,
        subject: 'Test Email from Ocean Ad Network',
        html: `
          <h1>Test Email</h1>
          <p>This is a test email sent at ${new Date().toISOString()}</p>
          <p>If you received this email, the email system is working correctly.</p>
        `,
      });

      const sendTime = Date.now() - startTime;
      this.logger.debug(`Test email sent to ${email} in ${sendTime}ms`);
    } catch (error) {
      this.logger.error(`Failed to send test email to ${email}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send bulk emails (for notifications, etc.)
   */
  async sendBulkEmails(emails: {
    to: string;
    subject: string;
    template?: string;
    context?: any;
    html?: string;
  }[]): Promise<{ sent: number; failed: number; errors: string[] }> {
    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const emailData of emails) {
      try {
        const startTime = Date.now();

        const mailOptions: any = {
          to: emailData.to,
          subject: emailData.subject,
        };

        if (emailData.template && emailData.context) {
          mailOptions.template = emailData.template;
          mailOptions.context = emailData.context;
        } else if (emailData.html) {
          mailOptions.html = emailData.html;
        } else {
          throw new Error('Either template with context or html must be provided');
        }

        await this.mailerService.sendMail(mailOptions);

        const sendTime = Date.now() - startTime;
        this.logger.debug(`Bulk email sent to ${emailData.to} in ${sendTime}ms`);
        results.sent++;
      } catch (error) {
        this.logger.error(`Failed to send bulk email to ${emailData.to}: ${error.message}`);
        results.failed++;
        results.errors.push(`${emailData.to}: ${error.message}`);
      }
    }

    this.logger.log(`Bulk email results: ${results.sent} sent, ${results.failed} failed`);
    return results;
  }

  /**
   * Validate email configuration
   */
  async validateEmailConfig(): Promise<{
    isValid: boolean;
    message: string;
    config: any;
  }> {
    try {
      const config = {
        host: this.configService.get<string>('mail.host'),
        port: this.configService.get<number>('mail.port'),
        user: this.configService.get<string>('mail.user'),
        from: this.configService.get<string>('mail.from'),
        secure: this.configService.get<boolean>('mail.secure'),
      };

      // Check if all required config is present
      if (!config.host || !config.port || !config.user || !config.from) {
        return {
          isValid: false,
          message: 'Missing required email configuration',
          config: { ...config, password: '[HIDDEN]' },
        };
      }

      // Test email connection
      await this.mailerService.sendMail({
        to: config.user, // Send to same email as sender for testing
        subject: 'Email Configuration Test',
        html: '<p>Email configuration is working correctly!</p>',
      });

      return {
        isValid: true,
        message: 'Email configuration is valid and working',
        config: { ...config, password: '[HIDDEN]' },
      };
    } catch (error) {
      return {
        isValid: false,
        message: `Email configuration validation failed: ${error.message}`,
        config: null,
      };
    }
  }

  /**
   * Get email service statistics
   */
  getEmailStats(): {
    service: string;
    isConfigured: boolean;
    host: string;
    port: number;
    secure: boolean;
  } {
    return {
      service: 'NodeMailer with SMTP',
      isConfigured: !!(
        this.configService.get<string>('mail.host') &&
        this.configService.get<number>('mail.port') &&
        this.configService.get<string>('mail.user')
      ),
      host: this.configService.get<string>('mail.host') || 'Not configured',
      port: this.configService.get<number>('mail.port') || 0,
      secure: this.configService.get<boolean>('mail.secure') || false,
    };
  }
}