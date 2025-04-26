import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * AdvertiserAuthGuard - Used specifically for advertiser login
 * 
 * This guard protects the advertiser login endpoint and uses the 'advertiser' 
 * strategy defined in LocalAdvertiserStrategy.
 * 
 * When applied to a route, it will:
 * 1. Extract email and password from the request body
 * 2. Call the validateAdvertiser method from AuthService
 * 3. If credentials are valid, it attaches the user to the request object
 * 4. If credentials are invalid, it throws an UnauthorizedException
 * 
 * Example usage:
 * @Post('advertiser/login')
 * @UseGuards(AdvertiserAuthGuard)
 * async login(@Request() req) { ... }
 */
@Injectable()
export class AdvertiserAuthenticationGuard extends AuthGuard('advertiser') { }


/**
 * PublisherAuthGuard - Used specifically for publisher login
 * 
 * This guard protects the publisher login endpoint and uses the 'publisher'
 * strategy defined in LocalPublisherStrategy.
 * 
 * When applied to a route, it will:
 * 1. Extract email and password from the request body
 * 2. Call the validatePublisher method from AuthService
 * 3. If credentials are valid, it attaches the user to the request object
 * 4. If credentials are invalid, it throws an UnauthorizedException
 * 
 * Example usage:
 * @Post('publisher/login')
 * @UseGuards(PublisherAuthGuard)
 * async login(@Request() req) { ... }
 */
@Injectable()
export class PublisherAuthenticationGuard extends AuthGuard('publisher') { }

/**
 * AdminAuthGuard - Used specifically for admin login
 * 
 * This guard protects the publisher login endpoint and uses the 'publisher'
 * strategy defined in LocalAdminStrategy.
 * 
 * When applied to a route, it will:
 * 1. Extract email and password from the request body
 * 2. Call the validatePublisher method from AuthService
 * 3. If credentials are valid, it attaches the user to the request object
 * 4. If credentials are invalid, it throws an UnauthorizedException
 * 
 * Example usage:
 * @Post('publisher/login')
 * @UseGuards(PublisherAuthGuard)
 * async login(@Request() req) { ... }
 */
@Injectable()
export class AdminAuthenticationGuard extends AuthGuard('admin') { }