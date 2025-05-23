import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  Param,
  Query,
  Res,
  BadRequestException,
  UnauthorizedException,
  HttpCode,
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
  ClientAuthenticationGuard,
  PublisherAuthenticationGuard,
} from 'src/common/guards/authentication.guard';
import { AdminGuard, AdvertiserGuard, ClientGuard, PublisherGuard } from 'src/common/guards/authorization.guard';
import { CreateAdvertiserDto } from 'src/advertiser/dto/create-advertiser.dto';
import { LoginDto } from './dto/login.dto';
import { RequestPasswordResetDto, ResetPasswordDto } from './dto/reset-password.dto';
import { ValidationFailedException } from 'src/common/exceptions/custom.exception';
import { CreatePublisherSignupDto } from 'src/publishers/dto/create-publisher-signup.dto';
import { ToggleMfaDto, VerifyMfaDto } from './dto/mfa.dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleGuard } from 'src/common/guards/role.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

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

  @Post('publisher/signup')
  @ApiOperation({ summary: 'Register a new publisher' })
  @ApiResponse({
    status: 201,
    description: 'Publisher has been successfully registered.',
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  async publisherSignup(@Body() createPublisherSignupDto: CreatePublisherSignupDto) {
    return this.authService.publisherSignup(createPublisherSignupDto);
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

  @Get('publisher/verify/:token')
  @ApiOperation({ summary: 'Verify publisher email address' })
  @ApiResponse({ status: 200, description: 'Email verified successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token.' })
  @ApiBody({ required: false })
  async verifyPublisherEmail(@Param('token') token: string) {
    return this.authService.verifyPublisherEmail(token);
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

  @Post('publisher/resendVerification')
  @ApiOperation({ summary: 'Resend verification email to publisher' })
  @ApiResponse({ status: 200, description: 'Verification email sent.' })
  @ApiResponse({
    status: 400,
    description: 'Email not found or already verified.',
  })
  async resendPublisherVerification(@Body() { email }: { email: string }) {
    return this.authService.resendPublisherVerificationEmail(email);
  }

  @Post('publisher/login')
  @UseGuards(PublisherAuthenticationGuard)
  @ApiOperation({ summary: 'Login as a publisher' })
  @ApiResponse({ status: 200, description: 'Authentication successful.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async publisherLogin(@Body() LoginDto: LoginDto, @Request() req) {
    return this.authService.login(req.user);
  }

  @Post('client/login')
  @UseGuards(ClientAuthenticationGuard)
  @ApiOperation({ summary: 'Login as a client' })
  @ApiResponse({ status: 200, description: 'Authentication successful.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async clientLogin(@Body() LoginDto: LoginDto, @Request() req) {
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

  // MFA Endpoints
  @Post(':role/verify-mfa')
  @ApiOperation({ summary: 'Verify MFA code and complete login' })
  @ApiResponse({ status: 200, description: 'MFA verification successful' })
  @ApiResponse({ status: 401, description: 'Invalid or expired verification code' })
  @HttpCode(200)
  async verifyMfa(@Param('role') role: string, @Body() verifyMfaDto: VerifyMfaDto) {
    const validRoles = ['admin', 'advertiser', 'publisher'];
    if (!validRoles.includes(role)) {
      throw new BadRequestException('Invalid role specified');
    }
    
    return this.authService.verifyMfaCode(verifyMfaDto.code, verifyMfaDto.tempToken, role);
  }

  @Post(':role/toggle-mfa')
  @ApiOperation({ summary: 'Enable or disable MFA for user' })
  @ApiResponse({ status: 200, description: 'MFA setting updated successfully' })
  @Roles('admin', 'advertiser', 'publisher')
  @UseGuards(AuthGuard('jwt'), RoleGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  async toggleMfa(@Request() req, @Param('role') role: string, @Body() toggleMfaDto: ToggleMfaDto) {
    const validRoles = ['admin', 'advertiser', 'publisher'];
    if (!validRoles.includes(role)) {
      throw new BadRequestException('Invalid role specified');
    }
    
    // Ensure the role matches the authenticated user's role
    if (req.user.role !== role) {
      throw new UnauthorizedException('Unauthorized to perform this action');
    }
    
    return this.authService.toggleMfa(req.user.id, role, toggleMfaDto.enable);
  }

  // Reset Password functionality for all roles
  async validateRole(role: string) {
    const validRoles = ['client', 'advertiser', 'admin', 'publisher'];
    if (!validRoles.includes(role)) {
      return false;
    }

    return true;
  }

  @Post(':role/forgot-password')
  async requestPasswordReset(@Param('role') role: string, @Body() dto: RequestPasswordResetDto) {
    let isValidRole = await this.validateRole(role);

    if (!isValidRole) {
      throw new BadRequestException(`Invalid url.`);
    }

    // Check email also
    const user = await this.authService.findUserByEmail(dto.email, role);
    if (!user) {
      throw new ValidationFailedException(['Email not found']);
    }

    return this.authService.requestPasswordReset(dto.email, role);
  }

  @Get('reset-password/:role')
  async validateResetToken(
    @Param('role') role: string,
    @Query('token') token: string,
    @Query('email') email: string,
    @Res() res,
  ) {
    try {
      // Verify token
      await this.authService.verifyResetToken(email, token);

      // Redirect to frontend reset password page with params
      return res.json({ message: "Done" });
    } catch (error) {
      // Redirect to error page if token is invalid
      return res.redirect(`${process.env.FRONTEND_URL}/reset-password-error`);
    }
  }

  @Post('reset-password/:role')
  @ApiOperation({ summary: 'Reset password' })
  @ApiResponse({ status: 200, description: 'Password reset successfully.' })
  async resetPassword(
    @Param('role') role: string,
    @Query('token') token: string,
    @Query('email') email: string,
    @Body() dto: ResetPasswordDto,
  ) {
    // Make sure passwords match
    if (dto.password !== dto.confirmPassword) {
      throw new ValidationFailedException(['Passwords do not match']);
    }

    return this.authService.resetPassword(role, email, token, dto.password);
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

  // Test Routes for publisher
  @Get('client/profile')
  @UseGuards(ClientGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Client profile' })
  @ApiResponse({
    status: 200,
    description: 'Client Profile retrieved successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getClientProfile(@Request() req): any {
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
