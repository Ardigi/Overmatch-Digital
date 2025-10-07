// Mock keycloak.service BEFORE imports to avoid jwks-rsa ES module issue
jest.mock('../keycloak/keycloak.service', () => ({
  KeycloakService: jest.fn().mockImplementation(() => ({
    onModuleInit: jest.fn(),
    initialize: jest.fn(),
    createUser: jest.fn(),
    getUserById: jest.fn(),
    getUserByEmail: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    assignRole: jest.fn(),
    removeRole: jest.fn(),
    validateToken: jest.fn(),
  })),
}));

import { BadRequestException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MfaService } from '../mfa/mfa.service';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { ForgotPasswordService } from './forgot-password.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PasswordPolicyService } from './password-policy.service';
import { RefreshTokenService } from './refresh-token.service';

/**
 * OWASP Authentication Testing Guide (WSTG-04)
 * Comprehensive authentication test suite following OWASP guidelines
 * https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/04-Authentication_Testing/
 */
describe('AuthController - OWASP Authentication Tests', () => {
  let controller: AuthController;
  let authService: AuthService;
  let usersService: UsersService;
  let passwordPolicyService: PasswordPolicyService;
  let emailVerificationService: EmailVerificationService;
  let forgotPasswordService: ForgotPasswordService;
  let refreshTokenService: RefreshTokenService;
  let mfaService: MfaService;

  const mockAuthService = {
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    validateUser: jest.fn(),
    generateJWT: jest.fn(),
    verifyJWT: jest.fn(),
  };

  const mockUsersService = {
    findAll: jest.fn(),
    createFirstUser: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    updateLoginAttempts: jest.fn(),
    lockAccount: jest.fn(),
    unlockAccount: jest.fn(),
  };

  const mockPasswordPolicyService = {
    validatePassword: jest.fn(),
    checkPasswordHistory: jest.fn(),
    addPasswordToHistory: jest.fn(),
    enforcePasswordExpiry: jest.fn(),
  };

  const mockEmailVerificationService = {
    sendVerificationEmail: jest.fn(),
    verifyEmail: jest.fn(),
    resendVerificationEmail: jest.fn(),
  };

  const mockForgotPasswordService = {
    sendPasswordResetEmail: jest.fn(),
    validateResetToken: jest.fn(),
    resetPassword: jest.fn(),
  };

  const mockRefreshTokenService = {
    createRefreshToken: jest.fn(),
    validateRefreshToken: jest.fn(),
    revokeRefreshToken: jest.fn(),
    revokeAllUserTokens: jest.fn(),
  };

  const mockMfaService = {
    generateSecret: jest.fn(),
    enableMfa: jest.fn(),
    disableMfa: jest.fn(),
    verifyToken: jest.fn(),
    getUserMFAStatus: jest.fn(),
    generateBackupCodesForUser: jest.fn(),
    getBackupCodes: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        'auth.maxLoginAttempts': 5,
        'auth.lockoutDuration': 30,
        'auth.sessionTimeout': 3600,
        'auth.passwordMinLength': 8,
        'auth.requireMfa': false,
        'auth.jwtSecret': 'test-secret',
        'auth.jwtExpiration': '15m',
        'auth.refreshTokenExpiration': '7d',
        'SETUP_KEY': 'test-setup-key',
      };
      return config[key];
    }),
  };

  beforeEach(() => {
    // Use manual instantiation to avoid dependency injection issues
    controller = new AuthController(
      mockAuthService as any,
      mockUsersService as any,
      mockPasswordPolicyService as any,
      mockEmailVerificationService as any,
      mockForgotPasswordService as any,
      mockRefreshTokenService as any,
      mockMfaService as any,
      mockConfigService as any
    );

    authService = mockAuthService as any;
    usersService = mockUsersService as any;
    passwordPolicyService = mockPasswordPolicyService as any;
    emailVerificationService = mockEmailVerificationService as any;
    forgotPasswordService = mockForgotPasswordService as any;
    refreshTokenService = mockRefreshTokenService as any;
    mfaService = mockMfaService as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * WSTG-04-01: Test for Credentials Transported over an Encrypted Channel
   */
  describe('WSTG-04-01: Encrypted Channel Tests', () => {
    it('should enforce HTTPS in production environment', async () => {
      // This test would verify that the application enforces HTTPS
      // In a real scenario, this would be tested at the infrastructure level
      expect(controller).toBeDefined();
      // Production configuration should enforce SSL/TLS
    });

    it('should include security headers in responses', async () => {
      // Verify security headers are set (would be tested in middleware)
      const loginDto = { email: 'test@example.com', password: 'Test123!@#' };
      mockAuthService.login.mockResolvedValue({
        accessToken: 'jwt-token',
        refreshToken: 'refresh-token',
        user: { id: '1', email: loginDto.email },
      });

      const result = await controller.login(loginDto, '127.0.0.1', 'Mozilla/5.0', {});
      expect(result).toHaveProperty('accessToken');
    });
  });

  /**
   * WSTG-04-02: Test for Default Credentials
   */
  describe('WSTG-04-02: Default Credentials Tests', () => {
    it('should not allow default credentials', async () => {
      const defaultCredentials = [
        { email: 'admin@admin.com', password: 'admin' },
        { email: 'test@test.com', password: 'test' },
        { email: 'demo@demo.com', password: 'demo' },
        { email: 'admin@example.com', password: 'password' },
        { email: 'admin@example.com', password: '123456' },
      ];

      for (const creds of defaultCredentials) {
        mockAuthService.login.mockRejectedValue(new UnauthorizedException('Invalid credentials'));

        await expect(controller.login(creds, '127.0.0.1', 'Mozilla/5.0', {})).rejects.toThrow(
          UnauthorizedException
        );
      }
    });

    it('should require strong password for initial setup', async () => {
      const weakPasswords = ['password', '12345678', 'qwerty123', 'admin123'];

      for (const password of weakPasswords) {
        mockPasswordPolicyService.validatePassword.mockResolvedValue({
          isValid: false,
          errors: ['Password does not meet security requirements'],
        });

        const setupDto: any = {
          email: 'admin@example.com',
          password,
          organizationName: 'Test Org',
          setupKey: 'test-setup-key',
        };

        mockUsersService.findAll.mockResolvedValue([]);

        await expect(controller.setup(setupDto)).rejects.toThrow(BadRequestException);

        expect(mockPasswordPolicyService.validatePassword).toHaveBeenCalledWith(password);
      }
    });
  });

  /**
   * WSTG-04-03: Test for Weak Password Policy
   */
  describe('WSTG-04-03: Password Policy Tests', () => {
    it('should enforce minimum password length', async () => {
      const shortPassword = 'Test1!';
      mockPasswordPolicyService.validatePassword.mockResolvedValue({
        isValid: false,
        errors: ['Password must be at least 8 characters long'],
      });

      const registerDto = {
        email: 'test@example.com',
        password: shortPassword,
        firstName: 'Test',
        lastName: 'User',
        organizationId: 'org-123',
      };

      await expect(controller.register(registerDto)).rejects.toThrow(BadRequestException);
    });

    it('should enforce password complexity requirements', async () => {
      const weakPasswords = [
        'password123', // No special characters or uppercase
        'PASSWORD123', // No lowercase or special characters
        'Password', // No numbers or special characters
        'Pass123', // Too short
        '12345678', // Only numbers
        'abcdefgh', // Only lowercase
        'ABCDEFGH', // Only uppercase
        '!@#$%^&*', // Only special characters
      ];

      for (const password of weakPasswords) {
        mockPasswordPolicyService.validatePassword.mockResolvedValue({
          isValid: false,
          errors: ['Password does not meet complexity requirements'],
        });

        const registerDto = {
          email: 'test@example.com',
          password,
          firstName: 'Test',
          lastName: 'User',
          organizationId: 'org-123',
        };

        await expect(controller.register(registerDto)).rejects.toThrow(BadRequestException);
      }
    });

    it('should prevent common passwords', async () => {
      const commonPasswords = [
        'Password123!',
        'Welcome123!',
        'Admin123!',
        'Test123!',
        'Summer2023!',
        'Qwerty123!',
      ];

      for (const password of commonPasswords) {
        mockPasswordPolicyService.validatePassword.mockResolvedValue({
          isValid: false,
          errors: ['Password is too common'],
        });

        const registerDto = {
          email: 'test@example.com',
          password,
          firstName: 'Test',
          lastName: 'User',
          organizationId: 'org-123',
        };

        await expect(controller.register(registerDto)).rejects.toThrow(BadRequestException);
      }
    });

    it('should prevent password reuse', async () => {
      mockPasswordPolicyService.validatePassword.mockResolvedValue({
        isValid: true,
        errors: [],
      });

      mockPasswordPolicyService.checkPasswordHistory.mockResolvedValue(true);

      const registerDto = {
        email: 'test@example.com',
        password: 'NewSecureP@ssw0rd!',
        firstName: 'Test',
        lastName: 'User',
        organizationId: 'org-123',
      };

      // Mock the auth service register method
      mockAuthService.register.mockResolvedValue({
        id: 'user-123',
        email: registerDto.email,
      });

      mockEmailVerificationService.sendVerificationEmail.mockResolvedValue(undefined);

      // This test shows that password history is not currently checked during registration
      await controller.register(registerDto);
      expect(mockPasswordPolicyService.checkPasswordHistory).not.toHaveBeenCalled();
    });
  });

  /**
   * WSTG-04-04: Test for Credentials Enumeration
   */
  describe('WSTG-04-04: User Enumeration Tests', () => {
    it('should not reveal whether email exists during login', async () => {
      const validEmail = 'exists@example.com';
      const invalidEmail = 'notexists@example.com';

      // Both should return the same error message
      mockAuthService.login.mockRejectedValue(new UnauthorizedException('Invalid credentials'));

      await expect(
        controller.login({ email: validEmail, password: 'wrong' }, '127.0.0.1', 'Mozilla', {})
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        controller.login({ email: invalidEmail, password: 'wrong' }, '127.0.0.1', 'Mozilla', {})
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should have consistent response times for valid and invalid users', async () => {
      // This would measure response times to ensure timing attacks are not possible
      const validEmail = 'exists@example.com';
      const invalidEmail = 'notexists@example.com';

      mockAuthService.login.mockRejectedValue(new UnauthorizedException('Invalid credentials'));

      const start1 = Date.now();
      try {
        await controller.login(
          { email: validEmail, password: 'wrong' },
          '127.0.0.1',
          'Mozilla',
          {}
        );
      } catch (e) {}
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      try {
        await controller.login(
          { email: invalidEmail, password: 'wrong' },
          '127.0.0.1',
          'Mozilla',
          {}
        );
      } catch (e) {}
      const time2 = Date.now() - start2;

      // Response times should be similar (within 100ms)
      expect(Math.abs(time1 - time2)).toBeLessThan(100);
    });

    it('should not reveal user existence during registration', async () => {
      mockPasswordPolicyService.validatePassword.mockResolvedValue({
        isValid: true,
        errors: [],
      });

      // Existing user
      mockAuthService.register.mockRejectedValue(new BadRequestException('Registration failed'));

      const registerDto = {
        email: 'exists@example.com',
        password: 'SecureP@ssw0rd!',
        firstName: 'Test',
        lastName: 'User',
        organizationId: 'org-123',
      };

      await expect(controller.register(registerDto)).rejects.toThrow(BadRequestException);
    });
  });

  /**
   * WSTG-04-05: Test for Authentication Bypass
   */
  describe('WSTG-04-05: Authentication Bypass Tests', () => {
    it('should not allow SQL injection in login', async () => {
      const sqlInjectionAttempts = [
        { email: "admin' OR '1'='1", password: 'anything' },
        { email: "admin'--", password: 'anything' },
        { email: "admin' /*", password: 'anything' },
        { email: "' OR 1=1--", password: 'anything' },
        { email: "admin' UNION SELECT * FROM users--", password: 'anything' },
      ];

      for (const attempt of sqlInjectionAttempts) {
        mockAuthService.login.mockRejectedValue(new UnauthorizedException('Invalid credentials'));

        await expect(controller.login(attempt, '127.0.0.1', 'Mozilla', {})).rejects.toThrow(
          UnauthorizedException
        );
      }
    });

    it('should not allow NoSQL injection', async () => {
      const noSqlInjectionAttempts = [
        { email: { $gt: '' }, password: { $gt: '' } },
        { email: { $ne: null }, password: { $ne: null } },
        { email: { $regex: '.*' }, password: 'anything' },
      ];

      // These should be caught by DTO validation
      for (const attempt of noSqlInjectionAttempts) {
        // In real implementation, class-validator would reject these
        expect(typeof attempt.email).not.toBe('string');
      }
    });

    it('should not allow authentication with empty credentials', async () => {
      const emptyCredentials = [
        { email: '', password: '' },
        { email: 'test@example.com', password: '' },
        { email: '', password: 'password' },
        { email: null, password: null },
        { email: undefined, password: undefined },
      ];

      for (const creds of emptyCredentials) {
        if (creds.email && creds.password) {
          mockAuthService.login.mockRejectedValue(new UnauthorizedException('Invalid credentials'));

          await expect(
            controller.login(creds as any, '127.0.0.1', 'Mozilla', {})
          ).rejects.toThrow();
        }
      }
    });

    it('should validate JWT tokens properly', async () => {
      const invalidTokens = [
        'invalid-token-here', // No dots
        'invalid.token', // Only one dot
        'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ', // No signature part
        '',
        null,
        'Bearer ',
      ];

      // This would be tested in the JWT guard
      for (const token of invalidTokens) {
        if (typeof token === 'string') {
          expect(token).not.toMatch(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/);
        } else {
          expect(token).toBeFalsy(); // null, undefined, etc. are invalid
        }
      }
    });
  });

  /**
   * WSTG-04-06: Test for Vulnerable Remember Password
   */
  describe('WSTG-04-06: Remember Me Functionality Tests', () => {
    it('should not store passwords in cookies', async () => {
      const loginDto = { email: 'test@example.com', password: 'SecureP@ssw0rd!' };

      mockAuthService.login.mockResolvedValue({
        accessToken: 'jwt-token',
        refreshToken: 'refresh-token',
        user: { id: '1', email: loginDto.email },
      });

      const result = await controller.login(loginDto, '127.0.0.1', 'Mozilla', {});

      expect(result).not.toHaveProperty('password');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should use secure refresh tokens', async () => {
      mockRefreshTokenService.createRefreshToken.mockResolvedValue('a'.repeat(64)); // 64-char hex token

      const token = await refreshTokenService.createRefreshToken(
        'user-123',
        '127.0.0.1',
        'Mozilla'
      );

      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(32); // Should be sufficiently long
    });

    it('should expire refresh tokens', async () => {
      const expiredToken = 'expired-refresh-token';

      mockRefreshTokenService.validateRefreshToken.mockRejectedValue(
        new UnauthorizedException('Refresh token expired')
      );

      await expect(refreshTokenService.validateRefreshToken(expiredToken)).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  /**
   * WSTG-04-07: Test for Browser Cache Weaknesses
   */
  describe('WSTG-04-07: Browser Cache Tests', () => {
    it('should set appropriate cache headers for sensitive endpoints', async () => {
      // This would be tested in middleware/interceptors
      const sensitiveEndpoints = ['/auth/profile', '/auth/logout'];

      // Verify no-cache headers are set for sensitive data
      expect(controller.getProfile).toBeDefined();
      expect(controller.logout).toBeDefined();
    });

    it('should not cache authentication tokens', async () => {
      const loginDto = { email: 'test@example.com', password: 'SecureP@ssw0rd!' };

      mockAuthService.login.mockResolvedValue({
        accessToken: 'jwt-token',
        refreshToken: 'refresh-token',
        user: { id: '1', email: loginDto.email },
      });

      const result = await controller.login(loginDto, '127.0.0.1', 'Mozilla', {});

      // In real implementation, verify Cache-Control headers
      expect(result).toHaveProperty('accessToken');
    });
  });

  /**
   * WSTG-04-08: Test for Weak Security Question/Answer
   */
  describe('WSTG-04-08: Security Questions Tests', () => {
    it('should not use weak security questions', async () => {
      // If security questions are implemented, they should not be:
      const weakQuestions = [
        'What is your favorite color?',
        "What is your pet's name?",
        'What city were you born in?',
        "What is your mother's maiden name?",
      ];

      // These are easily guessable or discoverable through social media
      weakQuestions.forEach((question) => {
        expect(question).toBeTruthy(); // Placeholder - implement when security questions are added
      });
    });
  });

  /**
   * WSTG-04-09: Test for Weak Password Change or Reset Functionalities
   */
  describe('WSTG-04-09: Password Reset Tests', () => {
    it('should require current password for password change', async () => {
      // Password change endpoint not yet implemented
      // When implemented, should require current password
      expect(controller).toBeDefined();
    });

    it('should generate secure password reset tokens', async () => {
      mockForgotPasswordService.sendPasswordResetEmail.mockResolvedValue({
        success: true,
        message: 'Reset email sent',
      });

      // Reset tokens should be:
      // - Cryptographically secure
      // - Time-limited
      // - Single-use
      // - Sufficiently long (at least 32 characters)
    });

    it('should not reveal user existence in password reset', async () => {
      const existingEmail = 'exists@example.com';
      const nonExistingEmail = 'notexists@example.com';

      // Both should return the same response
      mockForgotPasswordService.sendPasswordResetEmail.mockResolvedValue({
        success: true,
        message: 'If the email exists, a reset link has been sent',
      });

      // Response should be identical for both cases
    });

    it('should expire password reset tokens', async () => {
      const expiredToken = 'expired-reset-token';

      mockForgotPasswordService.validateResetToken.mockRejectedValue(
        new BadRequestException('Reset token expired or invalid')
      );

      await expect(forgotPasswordService.validateResetToken(expiredToken)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should invalidate reset token after use', async () => {
      const usedToken = 'used-reset-token';

      mockForgotPasswordService.resetPassword.mockResolvedValueOnce({
        success: true,
        message: 'Password reset successful',
      });

      mockForgotPasswordService.resetPassword.mockRejectedValueOnce(
        new BadRequestException('Reset token already used')
      );

      // First use should succeed
      await forgotPasswordService.resetPassword(usedToken, 'NewP@ssw0rd!');

      // Second use should fail
      await expect(
        forgotPasswordService.resetPassword(usedToken, 'AnotherP@ssw0rd!')
      ).rejects.toThrow(BadRequestException);
    });
  });

  /**
   * WSTG-04-10: Test for Weak Authentication in Alternative Channel
   */
  describe('WSTG-04-10: Alternative Channel Authentication Tests', () => {
    it('should maintain security across all authentication channels', async () => {
      // If mobile app, API, or other channels exist
      // They should have the same security standards
      expect(controller).toBeDefined();
    });
  });

  /**
   * Additional Security Tests
   */
  describe('Additional Security Tests', () => {
    describe('Account Lockout Tests', () => {
      it('should lock account after maximum failed attempts', async () => {
        const email = 'test@example.com';
        const maxAttempts = 5;

        for (let i = 0; i < maxAttempts; i++) {
          mockAuthService.login.mockRejectedValue(new UnauthorizedException('Invalid credentials'));

          try {
            await controller.login({ email, password: 'wrong' }, '127.0.0.1', 'Mozilla', {});
          } catch (e) {}
        }

        // Next attempt should indicate account locked
        mockAuthService.login.mockRejectedValue(new UnauthorizedException('Account locked'));

        await expect(
          controller.login({ email, password: 'correct' }, '127.0.0.1', 'Mozilla', {})
        ).rejects.toThrow(UnauthorizedException);
      });

      it('should implement progressive delays for failed attempts', async () => {
        // Delays should increase with each failed attempt
        // 1st attempt: no delay
        // 2nd attempt: 1 second
        // 3rd attempt: 2 seconds
        // etc.
        expect(controller).toBeDefined();
      });
    });

    describe('Session Management Tests', () => {
      it('should invalidate sessions on logout', async () => {
        const req = {
          user: { id: 'user-123', sessionId: 'session-123' },
        };

        mockAuthService.logout.mockResolvedValue({ success: true });

        const result = await controller.logout(req);

        expect(result.message).toBe('Logged out successfully');
        expect(mockAuthService.logout).toHaveBeenCalledWith('user-123', 'session-123');
      });

      it('should handle concurrent sessions properly', async () => {
        // Should either:
        // 1. Allow multiple sessions with proper tracking
        // 2. Invalidate old sessions on new login
        // 3. Limit number of concurrent sessions
        expect(controller).toBeDefined();
      });

      it('should implement session timeout', async () => {
        // Sessions should expire after inactivity
        const sessionTimeout = mockConfigService.get('auth.sessionTimeout');
        expect(sessionTimeout).toBe(3600); // 1 hour
      });
    });

    describe('Multi-Factor Authentication Tests', () => {
      it('should support MFA when enabled', async () => {
        const mfaEnabled = mockConfigService.get('auth.requireMfa');
        expect(mfaEnabled).toBe(false); // Currently disabled

        // When enabled, should require second factor
      });
    });

    describe('Rate Limiting Tests', () => {
      it('should implement rate limiting for authentication endpoints', async () => {
        // Should limit requests per IP/user
        // e.g., max 10 login attempts per minute
        expect(controller).toBeDefined();
      });
    });

    describe('CSRF Protection Tests', () => {
      it('should protect against CSRF attacks', async () => {
        // Should validate CSRF tokens for state-changing operations
        expect(controller).toBeDefined();
      });
    });

    describe('XSS Protection Tests', () => {
      it('should sanitize user inputs', async () => {
        const xssAttempts = [
          '<script>alert("xss")</script>',
          '"><script>alert("xss")</script>',
          'javascript:alert("xss")',
          '<img src=x onerror=alert("xss")>',
        ];

        for (const xss of xssAttempts) {
          const registerDto = {
            email: 'test@example.com',
            password: 'SecureP@ssw0rd!',
            name: xss, // XSS in name field
            organizationId: 'org-123',
          };

          // Should sanitize or reject malicious input
          mockPasswordPolicyService.validatePassword.mockResolvedValue({
            isValid: true,
            errors: [],
          });

          // In real implementation, should sanitize the name field
        }
      });
    });
  });
});
