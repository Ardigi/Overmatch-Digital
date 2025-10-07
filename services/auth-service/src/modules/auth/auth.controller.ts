import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Logger,
  Post,
  Request,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { RateLimit, RateLimitPresets } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { MfaService } from '../mfa/mfa.service';
import { OrganizationStatus } from '../users/entities/organization.entity';
import { UserStatus } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetupDto } from './dto/setup.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { EmailVerificationService } from './email-verification.service';
import { ForgotPasswordService } from './forgot-password.service';
import { CombinedAuthGuard } from './guards/combined-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PasswordPolicyService } from './password-policy.service';
import { RefreshTokenService } from './refresh-token.service';

@Controller('api/v1/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private authService: AuthService,
    private usersService: UsersService,
    private passwordPolicyService: PasswordPolicyService,
    private emailVerificationService: EmailVerificationService,
    private forgotPasswordService: ForgotPasswordService,
    private refreshTokenService: RefreshTokenService,
    private mfaService: MfaService,
    private configService: ConfigService,
  ) {}

  @Public()
  @Post('setup')
  async setup(@Body() setupDto: SetupDto) {
    try {
      // Check if any users exist
      const users = await this.usersService.findAll();
      if (users.length > 0) {
        throw new BadRequestException('System already initialized');
      }

      // Validate setup key - must be explicitly set in production
      const expectedSetupKey = this.configService.get('SETUP_KEY');
      if (!expectedSetupKey) {
        throw new ServiceUnavailableException('Setup key not configured. Please set SETUP_KEY environment variable.');
      }
      if (setupDto.setupKey !== expectedSetupKey) {
        throw new UnauthorizedException('Invalid setup key');
      }

      // Validate password even for initial setup
      const passwordValidation = await this.passwordPolicyService.validatePassword(setupDto.password);
      if (!passwordValidation.isValid) {
        throw new BadRequestException({
          message: 'Password validation failed',
          errors: passwordValidation.errors
        });
      }

      // Create first admin user
      this.logger.log('Creating first admin user...');
      const user = await this.usersService.createFirstUser(
        setupDto.email,
        setupDto.password,
        setupDto.organizationName,
        setupDto.firstName,
        setupDto.lastName
      );
      this.logger.log('User created successfully');

      // Auto-login the admin user
      return this.authService.login(
        { email: setupDto.email, password: setupDto.password },
        '127.0.0.1',
        'Setup'
      );
    } catch (error) {
      this.logger.error('Setup failed:', error);
      this.logger.error('Error stack:', error.stack);
      
      // Re-throw known exceptions as-is
      if (error instanceof BadRequestException || 
          error instanceof UnauthorizedException) {
        throw error;
      }
      
      // Only wrap unexpected errors
      if (process.env.NODE_ENV === 'development') {
        throw new BadRequestException({
          message: 'Setup failed',
          error: error.message,
          stack: error.stack,
        });
      }
      
      throw error;
    }
  }

  @Public()
  @Post('dev-init')
  async devInit() {
    // Development only endpoint - NEVER use in production
    if (process.env.NODE_ENV !== 'development') {
      throw new ForbiddenException('This endpoint is only available in development');
    }

    try {
      // Check if any users exist
      const userCount = await this.usersService.count();
      if (userCount > 0) {
        return { message: 'Users already exist', count: userCount };
      }

      // Direct database access to create minimal user
      const userRepo = this.usersService['userRepository'];
      const orgRepo = this.usersService['organizationRepository'];
      
      // Create minimal organization
      const org = orgRepo.create({
        name: 'Dev Organization',
        status: OrganizationStatus.ACTIVE,
      });
      const savedOrg = await orgRepo.save(org);
      
      // Generate secure random password for development
      const crypto = require('crypto');
      const devPassword = process.env.DEV_INIT_PASSWORD || crypto.randomBytes(16).toString('hex');
      const hashedPassword = await bcrypt.hash(devPassword, 10);
      
      const user = userRepo.create({
        email: 'test@example.com',
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
        roles: ['user'],
        emailVerified: true,
        status: UserStatus.ACTIVE,
        organization: savedOrg,
      });
      
      const savedUser = await userRepo.save(user);
      
      return {
        message: 'Dev user created',
        user: {
          id: savedUser.id,
          email: savedUser.email,
          organizationId: savedOrg.id,
        },
        // Only show password in development
        ...(process.env.NODE_ENV === 'development' && { devPassword }),
      };
    } catch (error) {
      return {
        message: 'Dev init failed',
        error: error.message,
        stack: error.stack,
      };
    }
  }

  // SECURITY: Removed vulnerable keycloak-login endpoint that bypassed JWT verification
  // For proper Keycloak integration, use the standard login endpoint with proper validation

  @Public()
  @Post('validate')
  @UseGuards(RateLimitGuard)
  @RateLimit(RateLimitPresets.STANDARD)
  @HttpCode(HttpStatus.OK)
  async validateToken(@Body('token') token: string) {
    // SECURITY: Validate JWT token using Keycloak JWKS
    if (!token) {
      return { valid: false, error: 'Token is required' };
    }
    
    return this.authService.validateToken(token);
  }

  @Public()
  @Post('login')
  @UseGuards(RateLimitGuard)
  @RateLimit(RateLimitPresets.AUTH)
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
    @Request() req: any,
  ) {
    // Debug logging - detailed DTO analysis
    console.log('=== DEBUG AuthController login ===');
    console.log('Controller received body:', req.body);
    console.log('Controller loginDto type:', typeof loginDto);
    console.log('Controller loginDto constructor:', loginDto?.constructor?.name);
    console.log('Controller loginDto instanceof LoginDto:', loginDto instanceof LoginDto);
    console.log('Controller loginDto keys:', Object.keys(loginDto || {}));
    console.log('Controller loginDto values:', JSON.stringify(loginDto, null, 2));
    console.log('Headers:', req.headers);
    console.log('=== END DEBUG ===');
    
    return this.authService.login(loginDto, ipAddress, userAgent);
  }

  @Public()
  @Post('register')
  @UseGuards(RateLimitGuard)
  @RateLimit(RateLimitPresets.AUTH)
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    // Normalize the DTO to handle both flat and nested formats
    const normalizedDto = {
      email: registerDto.email,
      password: registerDto.password,
      firstName: registerDto.firstName || registerDto.profile?.firstName,
      lastName: registerDto.lastName || registerDto.profile?.lastName,
      organizationId: registerDto.organizationId,
      organizationName: registerDto.organizationName,
    };

    // Validate required fields
    if (!normalizedDto.firstName || !normalizedDto.lastName) {
      throw new BadRequestException('First name and last name are required');
    }

    // Validate password confirmation if provided
    if (registerDto.confirmPassword && registerDto.password !== registerDto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // Validate password
    const passwordValidation = await this.passwordPolicyService.validatePassword(registerDto.password);
    if (!passwordValidation.isValid) {
      throw new BadRequestException({
        message: 'Password validation failed',
        errors: passwordValidation.errors
      });
    }

    // Register user
    const user = await this.authService.register(normalizedDto);

    // Send verification email
    await this.emailVerificationService.sendVerificationEmail(user);

    // Return response in E2E expected format
    const { password, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      message: 'Registration successful. Please check your email to verify your account.',
    };
  }

  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @Post('logout')
  @RateLimit(RateLimitPresets.STANDARD)
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req) {
    await this.authService.logout(req.user.id, req.user.sessionId);
    return { message: 'Logged out successfully' };
  }

  @UseGuards(CombinedAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @Post('mfa/generate')
  @RateLimit(RateLimitPresets.MFA)
  async generateMfaSecret(@Request() req) {
    return this.mfaService.generateSecret(req.user.id);
  }

  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @Post('mfa/enable')
  @RateLimit(RateLimitPresets.MFA)
  async enableMfa(@Request() req, @Body('token') token: string) {
    return this.mfaService.enableMfa(req.user.id, token);
  }

  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @Post('mfa/disable')
  @RateLimit(RateLimitPresets.MFA)
  async disableMfa(@Request() req) {
    return this.mfaService.disableMfa(req.user.id);
  }

  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @Post('mfa/verify')
  @RateLimit(RateLimitPresets.MFA)
  async verifyMfa(@Request() req, @Body('token') token: string) {
    return this.mfaService.verifyToken(req.user.id, token);
  }

  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @Get('mfa/status')
  @RateLimit(RateLimitPresets.STANDARD)
  async getMfaStatus(@Request() req) {
    return this.mfaService.getUserMFAStatus(req.user.id);
  }

  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @Post('mfa/backup-codes')
  @RateLimit(RateLimitPresets.MFA)
  async generateBackupCodes(@Request() req) {
    return this.mfaService.generateBackupCodesForUser(req.user.id);
  }

  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @Get('mfa/backup-codes')
  @RateLimit(RateLimitPresets.STANDARD)
  async getBackupCodes(@Request() req) {
    return this.mfaService.getBackupCodes(req.user.id);
  }

  @Public()
  @Post('refresh')
  @UseGuards(RateLimitGuard)
  @RateLimit(RateLimitPresets.STANDARD)
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() refreshDto: RefreshTokenDto,
    @Ip() ipAddress?: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    // Only pass additional parameters if they are provided
    if (ipAddress !== undefined || userAgent !== undefined) {
      return this.authService.refreshAccessToken(refreshDto.refresh_token, ipAddress, userAgent);
    }
    return this.authService.refreshAccessToken(refreshDto.refresh_token);
  }

  @Public()
  @Post('verify-email')
  @UseGuards(RateLimitGuard)
  @RateLimit(RateLimitPresets.STANDARD)
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() verifyDto: VerifyEmailDto) {
    return this.emailVerificationService.verifyEmail(verifyDto.token);
  }

  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @Post('resend-verification')
  @RateLimit(RateLimitPresets.STANDARD)
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Request() req) {
    await this.emailVerificationService.resendVerificationEmail(req.user.id);
    return { 
      message: 'Verification email sent successfully' 
    };
  }

  @Public()
  @Post('forgot-password')
  @UseGuards(RateLimitGuard)
  @RateLimit(RateLimitPresets.PASSWORD_RESET)
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() forgotDto: ForgotPasswordDto) {
    await this.forgotPasswordService.initiatePasswordReset(forgotDto.email);
    // Don't reveal if email exists for security
    return { 
      message: 'If the email exists, a password reset link has been sent' 
    };
  }

  @Public()
  @Post('reset-password')
  @UseGuards(RateLimitGuard)
  @RateLimit(RateLimitPresets.PASSWORD_RESET)
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetDto: ResetPasswordDto) {
    // Validate new password
    const passwordValidation = await this.passwordPolicyService.validatePassword(resetDto.password);
    if (!passwordValidation.isValid) {
      throw new BadRequestException({
        message: 'Password validation failed',
        errors: passwordValidation.errors
      });
    }

    await this.forgotPasswordService.resetPassword(resetDto.token, resetDto.password);
    return { 
      success: true,
      message: 'Password reset successfully' 
    };
  }

  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @Post('change-password')
  @RateLimit(RateLimitPresets.AUTH)
  @HttpCode(HttpStatus.OK)
  async changePassword(@Request() req, @Body() changePasswordDto: ChangePasswordDto) {
    // Validate password confirmation
    if (changePasswordDto.newPassword !== changePasswordDto.confirmNewPassword) {
      throw new BadRequestException('New passwords do not match');
    }

    // Validate new password policy
    const passwordValidation = await this.passwordPolicyService.validatePassword(changePasswordDto.newPassword);
    if (!passwordValidation.isValid) {
      throw new BadRequestException({
        message: 'Password validation failed',
        errors: passwordValidation.errors
      });
    }

    // Change the password
    await this.authService.changePassword(
      req.user.id,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword
    );

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }

  @Public()
  @Post('seed')
  @HttpCode(HttpStatus.CREATED)
  async seed() {
    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
      throw new ForbiddenException('Seed endpoint is only available in development');
    }
    return this.authService.seedInitialData();
  }
}