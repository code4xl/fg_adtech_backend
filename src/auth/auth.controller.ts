import { Controller, Post, Body, Get, UseGuards, Request, Param, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CreateAdvertiserDto } from 'src/advertisers/dto/create-advertiser.dto';
import { LocalAuthGuard } from 'src/common/guards/local.guard';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt.guard';


@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('signup')
    @ApiOperation({ summary: 'Register a new advertiser' })
    @ApiResponse({ status: 201, description: 'Advertiser has been successfully registered.' })
    @ApiResponse({ status: 400, description: 'Bad request.' })
    async signup(@Body() createAdvertiserDto: CreateAdvertiserDto) {
        return this.authService.signup(createAdvertiserDto);
    }

    @Post('login')
    @UseGuards(LocalAuthGuard)
    @ApiOperation({ summary: 'Login with credentials' })
    @ApiResponse({ status: 200, description: 'Authentication successful.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async login(@Body() loginDto: LoginDto, @Request() req) {
        return this.authService.login(req.user);
    }

    @Get('verify/:token')
    @ApiOperation({ summary: 'Verify email address' })
    @ApiResponse({ status: 200, description: 'Email verified successfully.' })
    @ApiResponse({ status: 400, description: 'Invalid or expired token.' })
    async verifyEmail(@Param('token') token: string) {
        return this.authService.verifyEmail(token);
    }

    @Get('profile')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get user profile' })
    @ApiResponse({ status: 200, description: 'Profile retrieved successfully.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    async getProfile(@Request() req) {
        return req.user;
    }

    @Post('resend-verification')
    @ApiOperation({ summary: 'Resend verification email' })
    @ApiResponse({ status: 200, description: 'Verification email sent.' })
    @ApiResponse({ status: 400, description: 'Email not found or already verified.' })
    async resendVerification(@Body() { email }: { email: string }) {
        return this.authService.resendVerificationEmail(email);
    }
}