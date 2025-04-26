import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  Param,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import {
  AdminAuthenticationGuard,
  AdvertiserAuthenticationGuard,
  PublisherAuthenticationGuard,
} from 'src/common/guards/authentication.guard';
import {
  AdminGuard,
  AdvertiserGuard,
  PublisherGuard,
} from 'src/common/guards/authorization.guard';
import { CreateAdvertiserDto } from 'src/advertiser/dto/create-advertiser.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('advertiser/signup')
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
  async advertiserLogin(@Body() LoginDto: LoginDto, @Request() req) {
    return this.authService.login(req.user);
  }

  @Get('advertiser/verify/:token')
  @ApiOperation({ summary: 'Verify email address' })
  @ApiResponse({ status: 200, description: 'Email verified successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token.' })
  @ApiBody({ required: false })
  async verifyEmail(@Param('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('advertiser/resendVerification')
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiResponse({ status: 200, description: 'Verification email sent.' })
  @ApiResponse({
    status: 400,
    description: 'Email not found or already verified.',
  })
  async resendVerification(@Body() { email }: { email: string }) {
    return this.authService.resendVerificationEmail(email);
  }

  @Post('publisher/login')
  @UseGuards(PublisherAuthenticationGuard)
  @ApiOperation({ summary: 'Login as a publisher' })
  @ApiResponse({ status: 200, description: 'Authentication successful.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async publisherLogin(@Body() LoginDto: LoginDto, @Request() req) {
    return this.authService.login(req.user);
  }

  @Post('admin/login')
  @UseGuards(AdminAuthenticationGuard)
  @ApiOperation({ summary: 'Login as a admin' })
  @ApiResponse({ status: 200, description: 'Authentication successful.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Missing required fields.',
  })
  async adminLogin(@Body() LoginDto: LoginDto, @Request() req) {
    return this.authService.login(req.user);
  }

  // Test Routes for advertiser
  @Get('advertiser/profile')
  @UseGuards(AdvertiserGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Advertiser profile' })
  @ApiResponse({
    status: 200,
    description: 'Advertiser Profile retrieved successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getAdvertiserProfile(@Request() req): any {
    return req.user;
  }

  // Test Routes for publisher
  @Get('publisher/profile')
  @UseGuards(PublisherGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Publisher profile' })
  @ApiResponse({
    status: 200,
    description: 'Publisher Profile retrieved successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getPublisherProfile(@Request() req): any {
    return req.user;
  }

  // Test Routes for Admin
  @Get('admin/profile')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Admin profile' })
  @ApiResponse({
    status: 200,
    description: 'Admin Profile retrieved successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getAdminProfile(@Request() req): any {
    return req.user;
  }
}
