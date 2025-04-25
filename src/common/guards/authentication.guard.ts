import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UnauthorizedException } from '../exceptions/custom.exception';

/**
 * AdvertiserGuard - Protects routes that require advertiser authentication
 *
 * This guard extends the JWT authentication guard and adds role-specific validation.
 * It ensures that:
 * 1. The request contains a valid JWT token (authenticated user)
 * 2. The user has the 'advertiser' role
 *
 * The guard performs these checks in sequence:
 * 1. First, it validates the JWT token using the parent JWT strategy
 * 2. If the token is valid, it then checks if the user has the advertiser role
 * 3. If either check fails, access is denied
 *
 * This prevents cross-role access - publishers cannot access advertiser-only routes
 * even if they have a valid JWT token.
 *
 * Example usage:
 * @Get('advertiser/dashboard')
 * @UseGuards(JwtAdvertiserGuard)
 * getDashboard() { ... }
 */
@Injectable()
export class AdvertiserGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // First ensure JWT validation is done
    const isJwtValid = await super.canActivate(context);

    if (!isJwtValid) {
      return false;
    }

    // Get the request object
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Check if the user has the advertiser role
    if (!user || user.role !== 'advertiser') {
      throw new UnauthorizedException('Advertiser');
    }

    return true;
  }
}

/**
 * PublisherGuard - Protects routes that require publisher authentication
 *
 * This guard extends the JWT authentication guard and adds role-specific validation.
 * It ensures that:
 * 1. The request contains a valid JWT token (authenticated user)
 * 2. The user has the 'publisher' role
 *
 * The guard performs these checks in sequence:
 * 1. First, it validates the JWT token using the parent JWT strategy
 * 2. If the token is valid, it then checks if the user has the publisher role
 * 3. If either check fails, access is denied
 *
 * This prevents cross-role access - advertisers cannot access publisher-only routes
 * even if they have a valid JWT token.
 *
 * Example usage:
 * @Get('publisher/dashboard')
 * @UseGuards(JwtPublisherGuard)
 * getDashboard() { ... }
 */
@Injectable()
export class PublisherGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // First ensure JWT validation is done
    const isJwtValid = await super.canActivate(context);

    if (!isJwtValid) {
      return false;
    }

    // Get the request object
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Check if the user has the publisher role
    if (!user || user.role !== 'publisher') {
      throw new UnauthorizedException();
    }

    return true;
  }
}


/**
 * AdminGuard - Protects routes that require admin authentication
 *
 * This guard extends the JWT authentication guard and adds role-specific validation.
 * It ensures that:
 * 1. The request contains a valid JWT token (authenticated user)
 * 2. The user has the 'admin' role
 *
 * The guard performs these checks in sequence:
 * 1. First, it validates the JWT token using the parent JWT strategy
 * 2. If the token is valid, it then checks if the user has the admin role
 * 3. If either check fails, access is denied
 *
 * This prevents cross-role access - advertisers cannot access admin-only routes
 * even if they have a valid JWT token.
 */
@Injectable()
export class AdminGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // First ensure JWT validation is done
    const isJwtValid = await super.canActivate(context);

    if (!isJwtValid) {
      return false;
    }

    // Get the request object
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Check if the user has the publisher role
    if (!user || user.role !== 'admin') {
      throw new UnauthorizedException();
    }

    return true;
  }
}
