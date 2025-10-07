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
    refreshTokens: jest.fn(),
  })),
}));

import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { MfaService } from '../mfa/mfa.service';
import { DeviceFingerprintService } from '../security/device-fingerprint.service';
import { SessionService } from '../sessions/session.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import {
  MockJwtService,
  MockConfigService,
  MockUsersService,
  MockRefreshTokenService,
  MockMfaService,
  MockSessionService,
  MockDeviceFingerprintService,
  MockAnomalyDetectionService,
  MockEventEmitter,
  MockMetricsService,
  MockTracingService,
  MockLoggingService,
  createMockJwtService,
  createMockConfigService,
  createMockUsersService,
  createMockRefreshTokenService,
  createMockMfaService,
  createMockSessionService,
  createMockDeviceFingerprintService,
  createMockAnomalyDetectionService,
  createMockEventEmitter,
  createMockMetricsService,
  createMockTracingService,
  createMockLoggingService,
} from './test-types/auth-service-mocks.types';

jest.mock('bcryptjs');

describe('AuthService', () => {
  let service: AuthService;
  let mockJwtService: MockJwtService;
  let mockConfigService: MockConfigService;
  let mockUsersService: MockUsersService;
  let mockRefreshTokenService: MockRefreshTokenService;
  let mockMfaService: MockMfaService;
  let mockSessionService: MockSessionService;
  let mockDeviceFingerprintService: MockDeviceFingerprintService;
  let mockAnomalyDetectionService: MockAnomalyDetectionService;
  let mockEventEmitter: MockEventEmitter;
  let mockMetricsService: MockMetricsService;
  let mockTracingService: MockTracingService;
  let mockLoggingService: MockLoggingService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    password: '$2a$10$hashedpassword',
    firstName: 'Test',
    lastName: 'User',
    emailVerified: true,
    status: 'active',
    roles: ['user'],
    organization: {
      id: 'org-123',
      name: 'Test Organization',
    },
  };

  beforeEach(() => {
    mockJwtService = createMockJwtService();
    mockConfigService = createMockConfigService();
    mockUsersService = createMockUsersService();
    mockRefreshTokenService = createMockRefreshTokenService();
    mockMfaService = createMockMfaService();
    mockSessionService = createMockSessionService();
    mockDeviceFingerprintService = createMockDeviceFingerprintService();
    mockAnomalyDetectionService = createMockAnomalyDetectionService();
    mockEventEmitter = createMockEventEmitter();
    mockMetricsService = createMockMetricsService();
    mockTracingService = createMockTracingService();
    mockLoggingService = createMockLoggingService();

    // Manual instantiation with properly typed mocks
    // Note: Test mocks are partial implementations of the full services
    // We use 'as any' here because the mocks only implement the methods we need for testing
    // This is a common and acceptable practice in unit testing
    service = new AuthService(
      mockJwtService as any,
      mockConfigService as any,
      mockUsersService as any,
      mockRefreshTokenService as any,
      mockMfaService as any,
      mockSessionService as any,
      mockDeviceFingerprintService as any,
      mockAnomalyDetectionService as any,
      mockEventEmitter as any,
      mockMetricsService as any,
      mockTracingService as any,
      mockLoggingService as any
    );

    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      email: 'newuser@example.com',
      password: 'SecurePassword123!',
      firstName: 'New',
      lastName: 'User',
      organizationName: 'New Organization',
      organizationId: 'org-123', // Add organizationId for non-first users
    };

    it('should successfully register a new user', async () => {
      const createdUser = { ...mockUser, email: registerDto.email };

      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.count.mockResolvedValue(1); // Not the first user
      mockUsersService.findAll.mockResolvedValue([{ organizationId: 'org-123' }]);
      mockUsersService.create.mockResolvedValue(createdUser);

      const result = await service.register(registerDto);

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(registerDto.email);
      expect(mockUsersService.create).toHaveBeenCalledWith(
        {
          email: registerDto.email,
          password: registerDto.password, // Raw password passed to UsersService
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          organizationId: registerDto.organizationId,
        },
        null
      );
      expect(result).toEqual(createdUser);
    });

    it('should throw ConflictException if user already exists', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        new ConflictException('User with this email already exists')
      );

      expect(mockUsersService.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for first user in development', async () => {
      process.env.NODE_ENV = 'development';
      const firstUserDto = {
        email: 'firstuser@example.com',
        password: 'SecurePassword123!',
        firstName: 'First',
        lastName: 'User',
        organizationName: 'First Organization',
        // No organizationId - triggers the first user check
      };
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.count.mockResolvedValue(0); // First user

      await expect(service.register(firstUserDto)).rejects.toThrow(
        new BadRequestException('Please use POST /auth/setup to create the first admin user')
      );

      expect(mockUsersService.create).not.toHaveBeenCalled();
      process.env.NODE_ENV = 'test';
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    beforeEach(() => {
      mockMfaService.getUserMFAStatus.mockResolvedValue({
        enabled: false,
        enabledMethods: [],
      });
    });

    it('should successfully login with valid credentials', async () => {
      const accessToken = 'jwt-access-token';
      const refreshToken = 'jwt-refresh-token';

      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signAsync.mockResolvedValue(accessToken);
      mockRefreshTokenService.createRefreshToken.mockResolvedValue(refreshToken);

      const result = await service.login(loginDto, '127.0.0.1', 'UserAgent');

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(loginDto.email);
      expect(bcrypt.compare).toHaveBeenCalledWith(loginDto.password, mockUser.password);
      expect(mockUsersService.updateLastLogin).toHaveBeenCalledWith(mockUser.id);
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: mockUser.id,
          email: mockUser.email,
          roles: mockUser.roles,
          organizationId: mockUser.organization.id,
          permissions: [],
          sessionId: 'session-123',
        },
        {
          expiresIn: '30m',
        }
      );
      expect(result).toEqual({
        accessToken,
        refreshToken,
        expiresIn: 1800,
        tokenType: 'Bearer',
        sessionId: 'session-123',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          roles: mockUser.roles,
          organizationId: mockUser.organization.id,
        },
      });
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials')
      );
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials')
      );
    });

    it('should throw ForbiddenException for unverified email', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production'; // Force non-development mode

      const unverifiedUser = { ...mockUser, emailVerified: false };
      mockUsersService.findByEmail.mockResolvedValue(unverifiedUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(
        new ForbiddenException('Please verify your email before logging in')
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should throw UnauthorizedException for inactive account', async () => {
      const inactiveUser = { ...mockUser, status: 'inactive' };
      mockUsersService.findByEmail.mockResolvedValue(inactiveUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Account is not active')
      );
    });

    it('should require MFA when enabled', async () => {
      const mfaSessionToken = 'mfa-session-token';
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockMfaService.getUserMFAStatus.mockResolvedValue({
        enabled: true,
        enabledMethods: ['totp'],
      });
      mockJwtService.signAsync.mockResolvedValue(mfaSessionToken);

      const result = await service.login(loginDto);

      expect(result).toEqual({
        requiresMfa: true,
        mfaMethods: ['totp'],
        mfaSessionToken,
      });
    });

    it('should verify MFA token when provided', async () => {
      const loginWithMfa = { ...loginDto, mfaToken: '123456' };
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockMfaService.getUserMFAStatus.mockResolvedValue({
        enabled: true,
        enabledMethods: ['totp'],
      });
      mockMfaService.verifyToken.mockResolvedValue({ valid: true });
      mockJwtService.signAsync.mockResolvedValue('jwt-token');
      mockRefreshTokenService.createRefreshToken.mockResolvedValue('refresh-token');

      const result = await service.login(loginWithMfa);

      expect(mockMfaService.verifyToken).toHaveBeenCalledWith(mockUser.id, '123456');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn');
      expect(result).toHaveProperty('tokenType');
      expect(result.expiresIn).toBe(1800);
      expect(result.tokenType).toBe('Bearer');
    });

    it('should throw UnauthorizedException for invalid MFA token', async () => {
      const loginWithMfa = { ...loginDto, mfaToken: 'invalid' };
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockMfaService.getUserMFAStatus.mockResolvedValue({
        enabled: true,
        enabledMethods: ['totp'],
      });
      mockMfaService.verifyToken.mockResolvedValue({ valid: false });

      await expect(service.login(loginWithMfa)).rejects.toThrow(
        new UnauthorizedException('Invalid MFA token')
      );
    });

    it('should skip MFA for test user in development', async () => {
      const testUser = { ...mockUser, email: 'admin@overmatch.digital' };
      process.env.NODE_ENV = 'development';

      mockUsersService.findByEmail.mockResolvedValue(testUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockMfaService.getUserMFAStatus.mockResolvedValue({
        enabled: true,
        enabledMethods: ['totp'],
      });
      mockJwtService.signAsync.mockResolvedValue('jwt-token');
      mockRefreshTokenService.createRefreshToken.mockResolvedValue('refresh-token');

      const result = await service.login({ email: testUser.email, password: 'password' });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn');
      expect(result).toHaveProperty('tokenType');
      expect(result.expiresIn).toBe(1800);
      expect(result.tokenType).toBe('Bearer');
      expect(result).not.toHaveProperty('requiresMfa');

      process.env.NODE_ENV = 'test';
    });
  });

  describe('logout', () => {
    it('should revoke refresh token', async () => {
      await service.logout('user-123', 'session-123');

      expect(mockRefreshTokenService.revokeRefreshToken).toHaveBeenCalledWith('user-123');
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token with valid refresh token', async () => {
      const refreshToken = 'valid-refresh-token';
      const newAccessToken = 'new-access-token';
      const newRefreshToken = 'new-refresh-token';

      mockRefreshTokenService.validateRefreshToken.mockResolvedValue({
        userId: mockUser.id,
        sessionId: 'session-123',
      });
      mockUsersService.findOne.mockResolvedValue(mockUser);
      mockJwtService.signAsync.mockResolvedValue(newAccessToken);
      mockRefreshTokenService.rotateRefreshToken.mockResolvedValue(newRefreshToken);
      mockSessionService.getSession.mockResolvedValue({ sessionId: 'session-123' });

      const result = await service.refreshAccessToken(refreshToken);

      expect(mockRefreshTokenService.validateRefreshToken).toHaveBeenCalledWith(refreshToken);
      expect(mockUsersService.findOne).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 1800,
        tokenType: 'Bearer',
      });
    });

    it('should throw error for invalid refresh token', async () => {
      mockRefreshTokenService.validateRefreshToken.mockRejectedValue(
        new UnauthorizedException('Invalid refresh token')
      );

      await expect(service.refreshAccessToken('invalid-token')).rejects.toThrow();
    });
  });

  describe('validateUser', () => {
    it('should return user data for valid credentials', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password123');

      expect(result).toBeDefined();
      expect(result.password).toBeUndefined();
      expect(result.email).toBe(mockUser.email);
    });

    it('should return null for invalid credentials', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('test@example.com', 'wrongpassword');

      expect(result).toBeNull();
    });

    it('should return null for non-existent user', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent@example.com', 'password');

      expect(result).toBeNull();
    });
  });

  describe('seedInitialData', () => {
    it('should create admin user if not exists', async () => {
      const adminUser = {
        email: 'admin@overmatch.digital',
        firstName: 'Admin',
        lastName: 'User',
      };

      mockUsersService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      mockUsersService.createFirstUser.mockResolvedValue(adminUser);

      const result = await service.seedInitialData();

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith('admin@soc-compliance.com');
      expect(mockUsersService.createFirstUser).toHaveBeenCalledWith(
        'admin@soc-compliance.com',
        'Admin@123!',
        'SOC Compliance Platform'
      );
      expect(result).toEqual({ message: 'Seed data created successfully' });
    });

    it('should skip if admin user already exists', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);

      const result = await service.seedInitialData();

      expect(mockUsersService.createFirstUser).not.toHaveBeenCalled();
      expect(result).toEqual({ message: 'Admin user already exists' });
    });

    it('should handle errors during seeding', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.createFirstUser.mockRejectedValue(new Error('Database error'));

      await expect(service.seedInitialData()).rejects.toThrow(BadRequestException);
    });
  });
});
