import { Injectable, ConflictException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { CreateAdvertiserDto } from 'src/advertisers/dto/create-advertiser.dto';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
        private mailService: MailService,
        private configService: ConfigService,
    ) { }

    async signup(createAdvertiserDto: CreateAdvertiserDto) {
        // Check if email already exists
        const existingUser = await this.prisma.advertiser.findUnique({
            where: { email: createAdvertiserDto.email },
        });

        if (existingUser) {
            throw new ConflictException('Email already in use');
        }

        // Check if mobile already exists
        const existingMobile = await this.prisma.advertiser.findUnique({
            where: { mobile: createAdvertiserDto.mobile },
        });

        if (existingMobile) {
            throw new ConflictException('Mobile number already in use');
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
            message: 'Registration successful. Please check your email to verify your account.',
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

    async validateUser(email: string, password: string) {
        const user = await this.prisma.advertiser.findUnique({
            where: { email },
        });

        if (!user) {
            return null;
        }

        // Check if email is verified
        if (!user.emailVerifiedAt) {
            throw new UnauthorizedException('Please verify your email first');
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return null;
        }

        // Remove password from returned object
        const { password: _, ...result } = user;
        return result;
    }

    async login(user: any) {
        const payload = { sub: user.id, email: user.email };

        return {
            accessToken: this.jwtService.sign(payload),
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                companyName: user.companyName,
            },
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