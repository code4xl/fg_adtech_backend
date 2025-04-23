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

    async validate(payload: any) {
        const user = await this.prisma.advertiser.findUnique({
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

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        if (!user.emailVerifiedAt) {
            throw new UnauthorizedException('Email not verified');
        }

        return user;
    }
}