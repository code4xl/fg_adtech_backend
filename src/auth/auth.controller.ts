import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  Param,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { CreateAdvertiserDto } from 'src/advertisers/dto/create-advertiser.dto';
import { AdvertiserAuthenticationGuard, PublisherAuthenticationGuard } from 'src/common/guards/local.guard';
import { AdvertiserGuard, PublisherGuard } from 'src/common/guards/auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('signup')
  @ApiOperation({ summary: 'Register a new advertiser' })
  @ApiResponse({
    status: 201,
    description: 'Advertiser has been successfully registered.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  async advertiserSignup(@Body() createAdvertiserDto: CreateAdvertiserDto) {
    return this.authService.signup(createAdvertiserDto);
  }

  @Post('advertiser/login')
  @UseGuards(AdvertiserAuthenticationGuard)
  @ApiOperation({ summary: 'Login as an advertiser' })
  @ApiResponse({ status: 200, description: 'Authentication successful.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async advertiserLogin(@Request() req) {
    return this.authService.login(req.user);
  }

  @Post('publisher/login')
  @UseGuards(PublisherAuthenticationGuard)
  @ApiOperation({ summary: 'Login as a publisher' })
  @ApiResponse({ status: 200, description: 'Authentication successful.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async publisherLogin(@Request() req) {
    return this.authService.login(req.user);
  }

  @Get('verify/:token')
  @ApiOperation({ summary: 'Verify email address' })
  @ApiResponse({ status: 200, description: 'Email verified successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token.' })
  async verifyEmail(@Param('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiResponse({ status: 200, description: 'Verification email sent.' })
  @ApiResponse({
    status: 400,
    description: 'Email not found or already verified.',
  })
  async resendVerification(@Body() { email }: { email: string }) {
    return this.authService.resendVerificationEmail(email);
  }

  // Test Routes for advertiser
  @Get('advertiser/profile')
  @UseGuards(AdvertiserGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Advertiser profile' })
  @ApiResponse({ status: 200, description: 'Advertiser Profile retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getAdvertiserProfile(@Request() req): any {
    return req.user;
  }

  // Test Routes for publisher
  @Get('publisher/profile')
  @UseGuards(PublisherGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Publisher profile' })
  @ApiResponse({ status: 200, description: 'Publisher Profile retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getPublisherProfile(@Request() req): any {
    return req.user;
  }
}