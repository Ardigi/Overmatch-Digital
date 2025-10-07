import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { MfaService } from '../mfa/mfa.service';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { SetupDto } from './dto/setup.dto';
import { EmailVerificationService } from './email-verification.service';
import { ForgotPasswordService } from './forgot-password.service';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CombinedAuthGuard } from './guards/combined-auth.guard';
import { PasswordPolicyService } from './password-policy.service';
import { RefreshTokenService } from './refresh-token.service';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockUsersService: jest.Mocked<UsersService>;
  let mockPasswordPolicyService: jest.Mocked<PasswordPolicyService>;
  let mockEmailVerificationService: jest.Mocked<EmailVerificationService>;
  let mockForgotPasswordService: jest.Mocked<ForgotPasswordService>;
  let mockRefreshTokenService: jest.Mocked<RefreshTokenService>;
  let mockMfaService: jest.Mocked<MfaService>;
  let mockConfigService: jest.Mocked<ConfigService>;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    password: '$2a$10$hashedpassword',
    status: 'active',
    emailVerified: true,
    emailVerifiedAt: new Date(),
    organization: {
      id: 'org-123',
      name: 'Test Organization',
    },
    roles: ['user'],
  };

  const mockAuthResponse = {
    accessToken: 'jwt-access-token',
    refreshToken: 'jwt-refresh-token',
    expiresIn: 1800, // 30 minutes
    tokenType: 'Bearer',
    user: {
      id: mockUser.id,
      email: mockUser.email,
      firstName: mockUser.firstName,
      lastName: mockUser.lastName,
      roles: mockUser.roles,
      organizationId: mockUser.organization.id,
    },
  };

  beforeEach(() => {
    // Create mocks for all dependencies
    mockAuthService = {
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      refreshAccessToken: jest.fn(),
      verifyEmail: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      changePassword: jest.fn(),
      seedInitialData: jest.fn(),
    } as any;

    mockUsersService = {
      findAll: jest.fn(),
      createFirstUser: jest.fn(),
      create: jest.fn(),
      findByEmail: jest.fn(),
      count: jest.fn(),
    } as any;

    mockPasswordPolicyService = {
      validatePassword: jest.fn(),
    } as any;

    mockEmailVerificationService = {
      sendVerificationEmail: jest.fn(),
      verifyEmail: jest.fn(),
      resendVerificationEmail: jest.fn(),
    } as any;

    mockForgotPasswordService = {
      initiatePasswordReset: jest.fn(),
      resetPassword: jest.fn(),
    } as any;

    mockRefreshTokenService = {
      createRefreshToken: jest.fn(),
      validateRefreshToken: jest.fn(),
      revokeRefreshToken: jest.fn(),
    } as any;

    mockMfaService = {
      generateSecret: jest.fn(),
      enableMfa: jest.fn(),
      disableMfa: jest.fn(),
      verifyToken: jest.fn(),
      getUserMFAStatus: jest.fn(),
      generateBackupCodesForUser: jest.fn(),
      getBackupCodes: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn(),
    } as any;

    // Manually instantiate the controller with all mocked dependencies
    controller = new AuthController(
      mockAuthService,
      mockUsersService,
      mockPasswordPolicyService,
      mockEmailVerificationService,
      mockForgotPasswordService,
      mockRefreshTokenService,
      mockMfaService,
      mockConfigService
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('setup', () => {
    const setupDto: SetupDto = {
      email: 'admin@example.com',
      password: 'SecurePassword123!',
      firstName: 'Admin',
      lastName: 'User',
      organizationName: 'Test Organization',
      setupKey: 'test-setup-key',
    };

    beforeEach(() => {
      // Mock the setup key validation
      mockConfigService.get.mockReturnValue('test-setup-key');
    });

    it('should create the first admin user when no users exist', async () => {
      mockUsersService.findAll.mockResolvedValue([]);
      mockPasswordPolicyService.validatePassword.mockResolvedValue({
        isValid: true,
        errors: [],
      });
      mockUsersService.createFirstUser.mockResolvedValue(mockUser);
      mockAuthService.login.mockResolvedValue(mockAuthResponse);

      const result = await controller.setup(setupDto);

      expect(mockUsersService.findAll).toHaveBeenCalled();
      expect(mockPasswordPolicyService.validatePassword).toHaveBeenCalledWith(setupDto.password);
      expect(mockUsersService.createFirstUser).toHaveBeenCalledWith(
        setupDto.email,
        setupDto.password,
        setupDto.organizationName,
        setupDto.firstName,
        setupDto.lastName
      );
      expect(mockAuthService.login).toHaveBeenCalledWith(
        { email: setupDto.email, password: setupDto.password },
        '127.0.0.1',
        'Setup'
      );
      expect(result).toEqual(mockAuthResponse);
    });

    it('should throw BadRequestException when users already exist', async () => {
      mockUsersService.findAll.mockResolvedValue([mockUser]);

      await expect(controller.setup(setupDto)).rejects.toThrow(
        new BadRequestException('System already initialized')
      );
    });

    it('should throw UnauthorizedException for invalid setup key', async () => {
      mockUsersService.findAll.mockResolvedValue([]);
      mockConfigService.get.mockReturnValue('different-setup-key');

      const invalidSetupDto = { ...setupDto, setupKey: 'wrong-key' };

      await expect(controller.setup(invalidSetupDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException for invalid password', async () => {
      mockUsersService.findAll.mockResolvedValue([]);
      mockPasswordPolicyService.validatePassword.mockResolvedValue({
        isValid: false,
        errors: ['Password must be at least 8 characters'],
      });

      await expect(controller.setup(setupDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'newuser@example.com',
      password: 'SecurePassword123!',
      firstName: 'New',
      lastName: 'User',
      organizationName: 'New Organization',
    };

    it('should register a new user and return user object with id', async () => {
      mockPasswordPolicyService.validatePassword.mockResolvedValue({
        isValid: true,
        errors: [],
      });
      mockAuthService.register.mockResolvedValue(mockUser);
      mockEmailVerificationService.sendVerificationEmail.mockResolvedValue(undefined);

      const result = await controller.register(registerDto);

      expect(mockPasswordPolicyService.validatePassword).toHaveBeenCalledWith(registerDto.password);
      expect(mockAuthService.register).toHaveBeenCalledWith({
        email: registerDto.email,
        password: registerDto.password,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        organizationId: registerDto.organizationId,
        organizationName: registerDto.organizationName,
      });
      expect(mockEmailVerificationService.sendVerificationEmail).toHaveBeenCalledWith(mockUser);

      // Should return response in E2E expected format
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('message');
      expect(result.user).toHaveProperty('id');
      expect(result.user).toHaveProperty('email');
      expect(result.user).toHaveProperty('firstName');
      expect(result.user).toHaveProperty('lastName');
      expect(result.user).not.toHaveProperty('password');
    });

    it('should throw BadRequestException for invalid password', async () => {
      mockPasswordPolicyService.validatePassword.mockResolvedValue({
        isValid: false,
        errors: ['Password must contain at least one uppercase letter'],
      });

      await expect(controller.register(registerDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should login user and return standardized response', async () => {
      mockAuthService.login.mockResolvedValue(mockAuthResponse);

      const result = await controller.login(loginDto, '192.168.1.1', 'Mozilla/5.0', {});

      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto, '192.168.1.1', 'Mozilla/5.0');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user).toHaveProperty('id');
      expect(result.user).toHaveProperty('roles');
    });

    it('should handle MFA requirement', async () => {
      const mfaResponse = {
        requiresMfa: true,
        mfaMethods: ['totp'],
        tempToken: 'temp-token',
      };
      mockAuthService.login.mockResolvedValue(mfaResponse);

      const result = await controller.login(loginDto, '192.168.1.1', 'Mozilla/5.0', {});

      expect(result).toEqual(mfaResponse);
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      const req = { user: { id: 'user-123', sessionId: 'session-123' } };
      mockAuthService.logout.mockResolvedValue(undefined);

      const result = await controller.logout(req);

      expect(mockAuthService.logout).toHaveBeenCalledWith('user-123', 'session-123');
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });

  describe('refresh', () => {
    it('should refresh access token', async () => {
      const refreshDto = { refresh_token: 'valid-refresh-token' };
      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 1800,
        tokenType: 'Bearer',
      };
      mockAuthService.refreshAccessToken.mockResolvedValue(newTokens);

      const result = await controller.refresh(refreshDto);

      expect(mockAuthService.refreshAccessToken).toHaveBeenCalledWith(refreshDto.refresh_token);
      expect(result).toEqual(newTokens);
    });
  });

  describe('verifyEmail', () => {
    it('should verify email with valid token', async () => {
      const verifyDto = { token: 'valid-email-token' };
      mockEmailVerificationService.verifyEmail.mockResolvedValue({
        success: true,
        message: 'Email verified successfully',
      });

      const result = await controller.verifyEmail(verifyDto);

      expect(mockEmailVerificationService.verifyEmail).toHaveBeenCalledWith(verifyDto.token);
      expect(result).toEqual({
        success: true,
        message: 'Email verified successfully',
      });
    });
  });

  describe('resendVerification', () => {
    it('should resend verification email', async () => {
      const req = { user: { id: 'user-123' } };
      mockEmailVerificationService.resendVerificationEmail.mockResolvedValue(undefined);

      const result = await controller.resendVerification(req);

      expect(mockEmailVerificationService.resendVerificationEmail).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({
        message: 'Verification email sent successfully',
      });
    });
  });

  describe('forgotPassword', () => {
    it('should initiate password reset', async () => {
      const forgotDto = { email: 'test@example.com' };
      mockForgotPasswordService.initiatePasswordReset.mockResolvedValue(undefined);

      const result = await controller.forgotPassword(forgotDto);

      expect(mockForgotPasswordService.initiatePasswordReset).toHaveBeenCalledWith(forgotDto.email);
      expect(result).toEqual({
        message: 'If the email exists, a password reset link has been sent',
      });
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const resetDto = {
        token: 'valid-reset-token',
        password: 'NewSecurePassword123!',
      };
      mockPasswordPolicyService.validatePassword.mockResolvedValue({
        isValid: true,
        errors: [],
      });
      mockForgotPasswordService.resetPassword.mockResolvedValue(undefined);

      const result = await controller.resetPassword(resetDto);

      expect(mockPasswordPolicyService.validatePassword).toHaveBeenCalledWith(resetDto.password);
      expect(mockForgotPasswordService.resetPassword).toHaveBeenCalledWith(
        resetDto.token,
        resetDto.password
      );
      expect(result).toEqual({
        success: true,
        message: 'Password reset successfully',
      });
    });

    it('should throw BadRequestException for weak password', async () => {
      const resetDto = {
        token: 'valid-reset-token',
        password: 'weak',
      };
      mockPasswordPolicyService.validatePassword.mockResolvedValue({
        isValid: false,
        errors: ['Password is too weak'],
      });

      await expect(controller.resetPassword(resetDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const req = { user: mockUser };

      const result = await controller.getProfile(req);

      expect(result).toEqual(mockUser);
    });
  });

  describe('MFA endpoints', () => {
    describe('generateMfaSecret', () => {
      it('should generate MFA secret', async () => {
        const req = { user: { id: 'user-123' } };
        const mfaSecret = {
          secret: 'base32secret',
          qrCode: 'data:image/png;base64,...',
        };
        mockMfaService.generateSecret.mockResolvedValue(mfaSecret);

        const result = await controller.generateMfaSecret(req);

        expect(mockMfaService.generateSecret).toHaveBeenCalledWith('user-123');
        expect(result).toEqual(mfaSecret);
      });
    });

    describe('enableMfa', () => {
      it('should enable MFA with valid token', async () => {
        const req = { user: { id: 'user-123' } };
        const token = '123456';
        const enableResult = { enabled: true, backupCodes: ['code1', 'code2'] };
        mockMfaService.enableMfa.mockResolvedValue(enableResult);

        const result = await controller.enableMfa(req, token);

        expect(mockMfaService.enableMfa).toHaveBeenCalledWith('user-123', token);
        expect(result).toEqual(enableResult);
      });
    });

    describe('getMfaStatus', () => {
      it('should return MFA status', async () => {
        const req = { user: { id: 'user-123' } };
        const mfaStatus = {
          enabled: true,
          enabledMethods: ['totp'],
          backupCodesRemaining: 5,
        };
        mockMfaService.getUserMFAStatus.mockResolvedValue(mfaStatus);

        const result = await controller.getMfaStatus(req);

        expect(mockMfaService.getUserMFAStatus).toHaveBeenCalledWith('user-123');
        expect(result).toEqual(mfaStatus);
      });
    });
  });
});
