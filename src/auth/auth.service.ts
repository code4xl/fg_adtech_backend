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
import { DuplicateResourceException } from 'src/common/exceptions/custom.exception';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) { }

  async signup(createAdvertiserDto: CreateAdvertiserDto) {
    // Check if email already exists
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

    // Generate verification token
    const verificationToken = uuidv4();

    // Create user without verifying email yet
    const user = await this.prisma.advertiser.create({
      data: {
        ...createAdvertiserDto,
        password: hashedPassword,
        emailVerifiedAt: null, // Will be set when email is verified
        verificationToken, // Add this field to your Prisma schema
      },
      select: {
        id: true,
        name: true,
        email: true,
        companyName: true,
        companySize: true,
      },
    });

    // Send verification email
    await this.mailService.sendVerificationEmail(
      user.email,
      user.name,
      verificationToken,
    );

    return {
      message:
        'Registration successful. Please check your email to verify your account.',
      user,
    };
  }

  async verifyEmail(token: string) {
    // Find user by verification token
    const user = await this.prisma.advertiser.findFirst({
      where: { verificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    if (user.emailVerifiedAt) {
      return { message: 'Email already verified' };
    }

    // Update user to mark email as verified
    await this.prisma.advertiser.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        verificationToken: null, // Clear the token after use
      },
    });

    return { message: 'Email verified successfully' };
  }

  // This function gets called from the LocalStrategy to validate which user is logging in.
  async validateUser(
    email: string,
    password: string,
    role: 'advertiser' | 'publisher' | 'admin',
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
      throw new BadRequestException('User not found');
    }

    if (user.emailVerifiedAt) {
      throw new BadRequestException('Email already verified');
    }

    // Generate new verification token
    const verificationToken = uuidv4();

    // Update user with new verification token
    await this.prisma.advertiser.update({
      where: { id: user.id },
      data: { verificationToken },
    });

    // Send verification email
    await this.mailService.sendVerificationEmail(
      user.email,
      user.name,
      verificationToken,
    );

    return { message: 'Verification email sent' };
  }
}
