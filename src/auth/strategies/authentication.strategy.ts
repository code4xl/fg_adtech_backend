import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { Request } from 'express';
import { BadRequestException } from 'src/common/exceptions/custom.exception';

@Injectable()
export class LocalAdvertiserStrategy extends PassportStrategy(
  Strategy,
  'advertiser',
) {
  private readonly logger = new Logger(LocalAdvertiserStrategy.name);
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
    });
  }

  async validate(email: string, password: string): Promise<any> {
    const user = await this.authService.validateUser(
      email,
      password,
      'advertiser',
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }
}

@Injectable()
export class LocalPublisherStrategy extends PassportStrategy(
  Strategy,
  'publisher',
) {
  private readonly logger = new Logger(LocalPublisherStrategy.name);
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
    });
  }

  async validate(email: string, password: string): Promise<any> {
    // this.logger.debug(
    //   `Validating publisher with email: ${email} and password: ${password}`,
    // );
    const user = await this.authService.validateUser(
      email,
      password,
      'publisher',
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials ');
    }

    return user;
  }
}

@Injectable()
export class LocalClientStrategy extends PassportStrategy(Strategy, 'client') {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
    });
  }

  async validate(email: string, password: string): Promise<any> {
    const user = await this.authService.validateUser(email, password, 'client');

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
