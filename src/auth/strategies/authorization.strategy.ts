import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private configService: ConfigService,
        private prisma: PrismaService,
    ) {
        const jwtSecret = configService.get<string>('jwt.secret');
        if (!jwtSecret) {
            throw new Error('JWT_SECRET is not defined in environment variables');
        }
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: jwtSecret,
        });
    }

    // Main validate method called by Passport
    async validate(payload: any) {
        // Check which role is in the token and call the appropriate validation method
        if (payload.role === 'advertiser') {
            const user = await this.validateAdvertiser(payload);
            return { ...user, role: 'advertiser' };
        } else if (payload.role === 'publisher') {
            const user = await this.validatePublisher(payload);
            return { ...user, role: 'publisher' };
        } else if (payload.role === 'admin') {
            const user = await this.validateAdmin(payload);
            return { ...user, role: 'admin' };
        } else {
            throw new UnauthorizedException('Invalid user role');
        }
    }

    async validateAdvertiser(payload: any) {
        const advertiser = await this.prisma.advertiser.findUnique({
            where: { id: payload.sub },
            select: {
                id: true,
                email: true,
                name: true,
                companyName: true,
                companySize: true,
                emailVerifiedAt: true,
            },
        });

        if (!advertiser) {
            throw new UnauthorizedException('Advertiser not found');
        }

        if (!advertiser.emailVerifiedAt) {
            throw new UnauthorizedException('Email not verified');
        }

        return advertiser;
    }

    async validatePublisher(payload: any) {
        const publisher = await this.prisma.publisher.findUnique({
            where: { id: payload.sub },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                emailVerifiedAt: true,
            },
        });

        if (!publisher) {
            throw new UnauthorizedException('Publisher not found');
        }

        // // Note: If you don't want to require email verification for publishers,
        // // you can remove this check
        // if (!publisher.emailVerifiedAt) {
        //     throw new UnauthorizedException('Email not verified');
        // }

        return publisher;
    }

    async validateAdmin(payload: any) {
        const admin = await this.prisma.admin.findUnique({
            where: { id: payload.sub },
            select: {
                id: true,
                email: true,
                name: true,
                emailVerifiedAt: true,
            },
        });

        if (!admin) {
            throw new UnauthorizedException('Admin not found');
        }

        // // Note: If you don't want to require email verification for admins,
        // // you can remove this check
        // if (!admin.emailVerifiedAt) {
        //     throw new UnauthorizedException('Email not verified');
        // }

        return admin;
    }
}