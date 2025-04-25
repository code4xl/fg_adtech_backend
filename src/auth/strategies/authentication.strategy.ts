import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { Request } from 'express';

@Injectable()
export class LocalAdvertiserStrategy extends PassportStrategy(Strategy, 'advertiser') {
    constructor(private authService: AuthService) {
        super({
            usernameField: 'email',
            passwordField: 'password',
        });
    }

    async validate(email: string, password: string): Promise<any> {
        const user = await this.authService.validateUser(email, password, 'advertiser');

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        return user;
    }
}

@Injectable()
export class LocalPublisherStrategy extends PassportStrategy(Strategy, 'publisher') {
    constructor(private authService: AuthService) {
        super({
            usernameField: 'email',
            passwordField: 'password',
        });
    }

    async validate(email: string, password: string): Promise<any> {
        const user = await this.authService.validateUser(email, password, 'publisher');

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        return user;
    }
}

@Injectable()
export class LocalAdminStrategy extends PassportStrategy(Strategy, 'admin') {
    constructor(private authService: AuthService) {
        super({
            usernameField: 'email',
            passwordField: 'password',
        });
    }

    async validate(email: string, password: string): Promise<any> {
        const user = await this.authService.validateUser(email, password, 'admin');

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        return user;
    }
}