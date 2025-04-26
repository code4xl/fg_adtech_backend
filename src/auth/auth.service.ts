import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { CreateAdvertiserDto } from 'src/advertiser/dto/create-advertiser.dto';
import {
  DuplicateResourceException,
  EmailAlreadyVerifiedException,
  ResourceNotFoundException,
} from 'src/common/exceptions/custom.exception';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
    private config: ConfigService,
  ) {}

  // This function is used to register a new advertiser.
  async signup(createAdvertiserDto: CreateAdvertiserDto) {
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

    // Send verification email
    await this.mailService.sendVerificationEmail(
      user.email,
      user.name,
      'advertiser',
      verificationToken,
    );

    return {
      message:
        'Registration successful. Please check your email to verify your account.',
      user,
    };
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

      return { message: 'Email verified successfully' };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new BadRequestException(
          'Verification token has expired. Please request a new one.',
        );
      }
      throw new BadRequestException('Invalid verification token');
    }
  }

  // This function gets called from the LocalStrategy to validate which user is logging in.
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
      });

      // Note: No email verification check for publishers as per your requirements
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

    // Add role to the user object for use in token generation and authorization
    return { ...result, role };
  }

  // The localstrategy will return the user object to this function and it will generate a JWT token for the user.
  async login(user: any) {
    // Create JWT payload with user ID, email and role
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    // Generate response data based on role
    // const userData = user;

    // Add specific fields based on user type
    // if (user.role === 'advertiser') {
    //   Object.assign(userData, {
    //     name: user.name,
    //     companyName: user.companyName,
    //   });
    // } else if (user.role === 'publisher') {
    //   Object.assign(userData, {
    //     name: `${user.firstName} ${user.lastName}`,
    //   });
    // } else if (user.role === 'admin') {
    //   Object.assign(userData, {
    //     name: user.name,
    //   });
    // }

    return {
      accessToken: this.jwtService.sign(payload),
      user: user,
    };
  }

  async resendVerificationEmail(email: string) {
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

    // Send verification email
    await this.mailService.sendVerificationEmail(
      user.email,
      user.name,
      'advertiser',
      verificationToken,
    );

    return 'Verification email resent successfully';
  }
}
