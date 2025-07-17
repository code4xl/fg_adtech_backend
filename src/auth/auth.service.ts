import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailQueueService } from '../mail/email-queue.service';
import * as bcrypt from 'bcryptjs';
import { CreateAdvertiserDto } from 'src/advertiser/dto/create-advertiser.dto';
import {
  DuplicateResourceException,
  EmailAlreadyVerifiedException,
  ResourceNotFoundException,
} from 'src/common/exceptions/custom.exception';
import { ConfigService } from '@nestjs/config';
import { CreatePublisherSignupDto } from 'src/publishers/dto/create-publisher-signup.dto';
import { PublisherSignupTierService } from 'src/admin/publisher/admin.publisher-signup-tier.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailQueueService: EmailQueueService,
    private config: ConfigService,
    private publisherSignupTierService: PublisherSignupTierService,
  ) {}

  // This function is used to register a new advertiser.
  async signup(createAdvertiserDto: CreateAdvertiserDto) {
    const startTime = Date.now();
    
    try {
      const existingUser = await this.prisma.advertiser.findUnique({
        where: { email: createAdvertiserDto.email },
      });

      if (existingUser) {
        throw new DuplicateResourceException(
          'Advertiser',
          'email',
          createAdvertiserDto.email,
        );
      }

      // Check if mobile already exists
      const existingMobile = await this.prisma.advertiser.findUnique({
        where: { mobile: createAdvertiserDto.mobile },
      });

      if (existingMobile) {
        throw new DuplicateResourceException(
          'Advertiser',
          'mobile',
          createAdvertiserDto.mobile,
        );
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(createAdvertiserDto.password, 10);

      // Generate verification token using jwt
      const verificationToken = this.jwtService.sign(
        {
          email: createAdvertiserDto.email,
          purpose: 'email_verification',
        },
        {
          expiresIn: this.config.get('auth.verificationTokenExpiry'),
        },
      );

      // Create user without verifying email yet
      const user = await this.prisma.advertiser.create({
        data: {
          ...createAdvertiserDto,
          password: hashedPassword,
          emailVerifiedAt: null, // Will be set when email is verified
          verificationToken, // Add this field to your Prisma schema
        },
      });

      // Queue verification email instead of sending immediately
      const emailJobId = await this.emailQueueService.queueVerificationEmail(
        user.email,
        user.name,
        'advertiser',
        verificationToken,
        3 // High priority for verification emails
      );

      const processingTime = Date.now() - startTime;
      this.logger.log(`Advertiser signup completed in ${processingTime}ms (email queued: ${emailJobId})`);

      return {
        message: 'Registration successful. Please check your email to verify your account.',
        advertiser: user,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`Advertiser signup failed after ${processingTime}ms: ${error.message}`);
      throw error;
    }
  }

  async verifyEmail(token: string) {
    try {
      const payload = this.jwtService.verify(token);

      const user = await this.prisma.advertiser.findUnique({
        where: { email: payload.email },
      });

      if (!user) {
        throw new ResourceNotFoundException('User');
      }

      if (user.emailVerifiedAt) {
        return 'Email already verified';
      }

      if (user.verificationToken !== token) {
        throw new BadRequestException('Invalid verification token');
      }

      await this.prisma.advertiser.update({
        where: { id: user.id },
        data: {
          emailVerifiedAt: new Date(),
          verificationToken: null,
        },
      });

      return 'Email verified successfully';
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new BadRequestException(
          'Verification token has expired. Please request a new one.',
        );
      }
      throw new BadRequestException('Invalid verification token');
    }
  }

  async verifyPublisherEmail(token: string) {
    try {
      const payload = this.jwtService.verify(token);

      const user = await this.prisma.publisher.findUnique({
        where: { email: payload.email },
      });

      if (!user) {
        throw new ResourceNotFoundException('User');
      }

      if (user.emailVerifiedAt) {
        return 'Email already verified';
      }

      if (user.verificationToken !== token) {
        throw new BadRequestException('Invalid verification token');
      }

      await this.prisma.publisher.update({
        where: { id: user.id },
        data: {
          emailVerifiedAt: new Date(),
          verificationToken: null,
        },
      });

      return 'Email verified successfully';
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new BadRequestException(
          'Verification token has expired. Please request a new one.',
        );
      }
      throw new BadRequestException('Invalid verification token');
    }
  }

  // The localstrategy will return the user object to this function and it will generate a JWT token for the user.
  async login(user: any) {
    // If MFA is required, just pass through the MFA response
    if (user.requiresMfa) {
      return {
        requiresMfa: true,
        tempToken: user.tempToken,
        maskedEmail: user.maskedEmail,
      };
    }

    // Create JWT payload with user ID, email and role
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: user,
    };
  }

  async resendVerificationEmail(email: string) {
    const startTime = Date.now();
    
    try {
      const user = await this.prisma.advertiser.findUnique({
        where: { email },
      });

      if (!user) {
        throw new ResourceNotFoundException('User');
      }

      if (user.emailVerifiedAt) {
        throw new EmailAlreadyVerifiedException();
      }

      // Generate verification token using jwt
      const verificationToken = this.jwtService.sign(
        {
          email,
          purpose: 'email_verification',
        },
        {
          expiresIn: this.config.get('auth.verificationTokenExpiry'),
        },
      );

      // Update user with new verification token
      await this.prisma.advertiser.update({
        where: { id: user.id },
        data: { verificationToken },
      });

      // Queue verification email
      const emailJobId = await this.emailQueueService.queueVerificationEmail(
        user.email,
        user.name,
        'advertiser',
        verificationToken,
        3 // High priority
      );

      const processingTime = Date.now() - startTime;
      this.logger.log(`Verification email resend completed in ${processingTime}ms (email queued: ${emailJobId})`);

      return { 
        message: 'Verification email has been sent.',
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`Verification email resend failed after ${processingTime}ms: ${error.message}`);
      throw error;
    }
  }

  async resendPublisherVerificationEmail(email: string) {
    const startTime = Date.now();
    
    try {
      const user = await this.prisma.publisher.findUnique({
        where: { email },
      });

      if (!user) {
        throw new ResourceNotFoundException('User');
      }

      if (user.emailVerifiedAt) {
        throw new EmailAlreadyVerifiedException();
      }

      // Generate verification token using jwt
      const verificationToken = this.jwtService.sign(
        {
          email,
          purpose: 'email_verification',
        },
        {
          expiresIn: this.config.get('auth.verificationTokenExpiry'),
        },
      );

      // Update user with new verification token
      await this.prisma.publisher.update({
        where: { id: user.id },
        data: { verificationToken },
      });

      // Queue verification email
      const emailJobId = await this.emailQueueService.queueVerificationEmail(
        user.email,
        `${user.firstName} ${user.lastName}`,
        'publisher',
        verificationToken,
        3 // High priority
      );

      const processingTime = Date.now() - startTime;
      this.logger.log(`Publisher verification email resend completed in ${processingTime}ms (email queued: ${emailJobId})`);

      return { 
        message: 'Verification email has been sent.',
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`Publisher verification email resend failed after ${processingTime}ms: ${error.message}`);
      throw error;
    }
  }

  // MFA Implementation
  private generateVerificationCode(): string {
    // Generate a random 6-digit code
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    let maskedLocal = localPart;

    if (localPart.length > 2) {
      maskedLocal =
        localPart[0] +
        '*'.repeat(localPart.length - 2) +
        localPart[localPart.length - 1];
    } else {
      maskedLocal = '*'.repeat(localPart.length);
    }

    return `${maskedLocal}@${domain}`;
  }

  async verifyMfaCode(
    code: string,
    tempToken: string,
    role: string,
  ): Promise<any> {
    try {
      // Verify and decode the temporary token
      const payload = this.jwtService.verify(tempToken);

      if (payload.purpose !== 'mfa_verification') {
        throw new UnauthorizedException('Invalid token purpose');
      }

      // Get the user based on role
      let user;
      if (role === 'advertiser') {
        user = await this.prisma.advertiser.findUnique({
          where: { id: payload.sub },
        });
      } else if (role === 'publisher') {
        user = await this.prisma.publisher.findUnique({
          where: { id: payload.sub },
        });
      } else if (role === 'admin') {
        user = await this.prisma.admin.findUnique({
          where: { id: payload.sub },
        });
      } else {
        throw new BadRequestException('Invalid role');
      }

      if (!user) {
        throw new ResourceNotFoundException('User');
      }

      // Check if code has expired
      if (!user.mfaCodeExpiry || new Date() > user.mfaCodeExpiry) {
        throw new UnauthorizedException('Verification code has expired');
      }

      // Check if code matches
      if (user.mfaVerificationCode !== code) {
        throw new UnauthorizedException('Invalid verification code');
      }

      // Clear the verification code
      if (role === 'advertiser') {
        await this.prisma.advertiser.update({
          where: { id: user.id },
          data: { mfaVerificationCode: null, mfaCodeExpiry: null },
        });
      } else if (role === 'publisher') {
        await this.prisma.publisher.update({
          where: { id: user.id },
          data: { mfaVerificationCode: null, mfaCodeExpiry: null },
        });
      } else if (role === 'admin') {
        await this.prisma.admin.update({
          where: { id: user.id },
          data: { mfaVerificationCode: null, mfaCodeExpiry: null },
        });
      }

      // Remove sensitive data
      const { password, mfaVerificationCode, mfaCodeExpiry, ...userData } =
        user;

      // Generate the real JWT token
      const jwtPayload = {
        sub: user.id,
        email: user.email,
        role: role,
      };

      return {
        accessToken: this.jwtService.sign(jwtPayload),
        user: { ...userData, role },
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException(
          'Session has expired, please login again',
        );
      }
      throw error;
    }
  }

  async toggleMfa(userId: string, role: string, enable: boolean): Promise<any> {
    if (role === 'advertiser') {
      await this.prisma.advertiser.update({
        where: { id: userId },
        data: { mfaEnabled: enable },
      });
    } else if (role === 'publisher') {
      await this.prisma.publisher.update({
        where: { id: userId },
        data: { mfaEnabled: enable },
      });
    } else if (role === 'admin') {
      await this.prisma.admin.update({
        where: { id: userId },
        data: { mfaEnabled: enable },
      });
    } else {
      throw new BadRequestException('Invalid role');
    }

    return {
      message: enable ? 'MFA has been enabled' : 'MFA has been disabled',
    };
  }

  async findUserByEmail(email: string, role: string) {
    if (role === 'advertiser') {
      return this.prisma.advertiser.findUnique({
        where: { email },
      });
    } else if (role === 'publisher') {
      return this.prisma.publisher.findUnique({
        where: { email },
      });
    } else if (role === 'admin') {
      return this.prisma.admin.findUnique({
        where: { email },
      });
    } else if (role === 'client') {
      return this.prisma.client.findUnique({
        where: { email },
      });
    }
  }

  async requestPasswordReset(email: string, role: string) {
    const startTime = Date.now();
    
    try {
      // Find user
      const user = await this.findUserByEmail(email, role);
      if (!user) {
        throw new ResourceNotFoundException('User');
      }

      // Generate reset token
      const resetToken = this.jwtService.sign(
        { email, purpose: 'password_reset' },
        { expiresIn: '1h' },
      );

      // Build reset URL
      const resetLink = `${this.config.get('template.url')}/auth/${role}/reset-password/validate?token=${resetToken}&email=${email}`;

      // Update user with reset token and expiry
      const resetTokenExpiry = new Date();
      resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1);

      if (role === 'advertiser') {
        await this.prisma.advertiser.update({
          where: { email },
          data: {
            resetPasswordToken: resetToken,
            resetPasswordExpires: resetTokenExpiry,
          },
        });
      } else if (role === 'publisher') {
        await this.prisma.publisher.update({
          where: { email },
          data: {
            resetPasswordToken: resetToken,
            resetPasswordExpires: resetTokenExpiry,
          },
        });
      } else if (role == 'client') {
        await this.prisma.client.update({
          where: { email },
          data: {
            resetPasswordToken: resetToken,
            resetPasswordExpires: resetTokenExpiry,
          },
        });
      }

      // Queue password reset email
      const emailJobId = await this.emailQueueService.queuePasswordResetEmail(
        email,
        role,
        resetLink,
        2 // Medium priority
      );

      const processingTime = Date.now() - startTime;
      this.logger.log(`Password reset request completed in ${processingTime}ms (email queued: ${emailJobId})`);

      return { 
        message: 'Password reset email sent',
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`Password reset request failed after ${processingTime}ms: ${error.message}`);
      throw error;
    }
  }

  async verifyResetToken(email: string, token: string): Promise<boolean> {
    // Verify JWT token first
    try {
      const payload = this.jwtService.verify(token);
      if (payload.email !== email || payload.purpose !== 'password_reset') {
        return false;
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  async resetPassword(
    role: string,
    email: string,
    token: string,
    newPassword: string,
  ) {
    // Verify token
    const isValid = await this.verifyResetToken(email, token);
    if (!isValid) {
      throw new BadRequestException('Invalid or expired token');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password and clear reset token
    if (role === 'advertiser') {
      await this.prisma.advertiser.update({
        where: { email },
        data: {
          password: hashedPassword,
          resetPasswordToken: null,
          resetPasswordExpires: null,
        },
      });
    } else if (role === 'publisher') {
      await this.prisma.publisher.update({
        where: { email },
        data: {
          password: hashedPassword,
          resetPasswordToken: null,
          resetPasswordExpires: null,
        },
      });
    } else if (role === 'admin') {
      await this.prisma.admin.update({
        where: { email },
        data: {
          password: hashedPassword,
        },
      });
    } else if (role === 'client') {
      await this.prisma.client.update({
        where: { email },
        data: {
          password: hashedPassword,
        },
      });
    }

    return { message: 'Password has been reset successfully' };
  }

  // Updated publisherSignup method
  async publisherSignup(createPublisherSignupDto: CreatePublisherSignupDto) {
    const startTime = Date.now();
    
    try {
      const existingUser = await this.prisma.publisher.findUnique({
        where: { email: createPublisherSignupDto.email },
      });

      if (existingUser) {
        throw new DuplicateResourceException(
          'Publisher',
          'email',
          createPublisherSignupDto.email,
        );
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(
        createPublisherSignupDto.password,
        10,
      );

      // Generate verification token using jwt
      const verificationToken = this.jwtService.sign(
        {
          email: createPublisherSignupDto.email,
          purpose: 'email_verification',
        },
        {
          expiresIn: this.config.get('auth.verificationTokenExpiry'),
        },
      );

      // Get default publisher tier
      const defaultTier = await this.publisherSignupTierService.getBasicTierForSignup();

      // Create user without verifying email yet
      const user = await this.prisma.publisher.create({
        data: {
          firstName: createPublisherSignupDto.firstName,
          lastName: createPublisherSignupDto.lastName,
          email: createPublisherSignupDto.email,
          password: hashedPassword,
          emailVerifiedAt: null,
          verificationToken,
          tierId: defaultTier.id, // Assign default tier
          paymentThreshold: 100.0, // Default payment threshold
        },
        include: {
          tier: true, // Include tier information in response
        },
      });

      // Queue verification email
      const emailJobId = await this.emailQueueService.queueVerificationEmail(
        user.email,
        `${user.firstName} ${user.lastName}`,
        'publisher',
        verificationToken,
        3 // High priority
      );

      // Remove sensitive data before returning
      const { password, mfaVerificationCode, mfaCodeExpiry, ...result } = user;

      const processingTime = Date.now() - startTime;
      this.logger.log(`Publisher signup completed in ${processingTime}ms (email queued: ${emailJobId})`);

      return {
        message: 'Registration successful. Please check your email to verify your account.',
        publisher: result,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`Publisher signup failed after ${processingTime}ms: ${error.message}`);
      throw error;
    }
  }

  // Updated validateUser method - Publisher section
  async validateUser(
    email: string,
    password: string,
    role: 'advertiser' | 'publisher' | 'client' | 'admin',
  ) {
    let user;

    // Find user in the appropriate database based on role
    if (role === 'advertiser') {
      user = await this.prisma.advertiser.findUnique({
        where: { email },
      });

      // Check if email is verified for advertisers
      if (user && !user.emailVerifiedAt) {
        throw new UnauthorizedException('Please verify your email first');
      }
    } else if (role === 'publisher') {
      user = await this.prisma.publisher.findUnique({
        where: { email },
        include: {
          tier: true, // Include tier information for publishers
        },
      });

      // Check if email is verified for publishers
      if (user && !user.emailVerifiedAt) {
        throw new UnauthorizedException('Please verify your email first');
      }
    } else if (role === 'admin') {
      user = await this.prisma.admin.findUnique({
        where: { email },
      });
    } else if (role === 'client') {
      user = await this.prisma.client.findUnique({
        where: { email },
      });
    }

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    // Remove password from returned object
    const { password: _, ...result } = user;

    // Check if MFA is enabled for this user
    if (result.mfaEnabled) {
      // Generate a 6-digit verification code
      const verificationCode = this.generateVerificationCode();

      // Set expiry time (10 minutes from now)
      const codeExpiry = new Date();
      codeExpiry.setMinutes(codeExpiry.getMinutes() + 10);

      // Store the code in the user's record
      if (role === 'advertiser') {
        await this.prisma.advertiser.update({
          where: { id: user.id },
          data: {
            mfaVerificationCode: verificationCode,
            mfaCodeExpiry: codeExpiry,
          },
        });
      } else if (role === 'publisher') {
        await this.prisma.publisher.update({
          where: { id: user.id },
          data: {
            mfaVerificationCode: verificationCode,
            mfaCodeExpiry: codeExpiry,
          },
        });
      } else if (role === 'admin') {
        await this.prisma.admin.update({
          where: { id: user.id },
          data: {
            mfaVerificationCode: verificationCode,
            mfaCodeExpiry: codeExpiry,
          },
        });
      }

      // Queue MFA code email
      const emailJobId = await this.emailQueueService.queueMfaCodeEmail(
        result.email,
        verificationCode,
        10,
        3 // High priority for MFA
      );

      this.logger.log(`MFA code email queued: ${emailJobId}`);

      // Generate temporary token for MFA verification
      const tempToken = this.jwtService.sign(
        {
          sub: result.id,
          email: result.email,
          role: role,
          purpose: 'mfa_verification',
        },
        {
          expiresIn: '15m', // Temporary token expires in 15 minutes
        },
      );

      // Return MFA required response
      return {
        requiresMfa: true,
        tempToken,
        maskedEmail: this.maskEmail(result.email),
        role, // Include role for later use
      };
    }

    // Add role to the user object for use in token generation and authorization
    return { ...result, role };
  }
}