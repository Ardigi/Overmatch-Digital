import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { MfaService } from '../mfa/mfa.service';
import { DeviceFingerprintService } from '../security/device-fingerprint.service';
import { SessionService } from '../sessions/session.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import type { LoginDto } from './dto/login.dto';
import { RefreshTokenService } from './refresh-token.service';

jest.mock('bcryptjs');

describe('AuthService - Session Integration', () => {
  let authService: AuthService;
  let sessionService: SessionService;
  let deviceFingerprintService: DeviceFingerprintService;
  let usersService: UsersService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    password: '$2a$10$abcdef123456', // bcrypt hash
    firstName: 'Test',
    lastName: 'User',
    emailVerified: true,
    status: 'active',
    roles: ['user'],
    permissions: [],
    organization: { id: 'org-123' },
  };

  const mockSessionService = {
    createSession: jest.fn().mockResolvedValue('session-123'),
    updateSessionData: jest.fn().mockResolvedValue(true),
    getSession: jest.fn().mockResolvedValue({
      userId: 'user-123',
      sessionId: 'session-123',
    }),
    updateActivity: jest.fn().mockResolvedValue(true),
    destroySession: jest.fn().mockResolvedValue(undefined),
    destroyAllUserSessions: jest.fn().mockResolvedValue(3),
    updateDeviceInfo: jest.fn().mockResolvedValue(undefined),
  };

  const mockDeviceFingerprintService = {
    generateFingerprint: jest.fn().mockReturnValue({
      hash: 'device-fingerprint-hash',
      components: {
        browser: { name: 'Chrome', version: '120' },
        os: { name: 'Windows', version: '10' },
        device: { type: 'desktop' },
      },
      trustScore: 85,
    }),
  };

  const mockJwtService = {
    signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
  };

  const mockUsersService = {
    findByEmail: jest.fn().mockResolvedValue(mockUser),
    updateLastLogin: jest.fn().mockResolvedValue(undefined),
    findOne: jest.fn().mockResolvedValue(mockUser),
  };

  const mockRefreshTokenService = {
    createRefreshToken: jest.fn().mockResolvedValue('mock-refresh-token'),
    validateRefreshToken: jest.fn().mockResolvedValue({
      userId: 'user-123',
      sessionId: 'session-123',
    }),
    rotateRefreshToken: jest.fn().mockResolvedValue('new-refresh-token'),
    revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
  };

  const mockMfaService = {
    getUserMFAStatus: jest.fn().mockResolvedValue({ enabled: false }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
        {
          provide: DeviceFingerprintService,
          useValue: mockDeviceFingerprintService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('30m'),
          },
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: RefreshTokenService,
          useValue: mockRefreshTokenService,
        },
        {
          provide: MfaService,
          useValue: mockMfaService,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    sessionService = module.get<SessionService>(SessionService);
    deviceFingerprintService = module.get<DeviceFingerprintService>(DeviceFingerprintService);
    usersService = module.get<UsersService>(UsersService);

    // Mock bcrypt compare
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login with session integration', () => {
    it('should create a session on successful login', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const result = await authService.login(loginDto, '192.168.1.1', 'Mozilla/5.0');

      expect(sessionService.createSession).toHaveBeenCalledWith({
        userId: 'user-123',
        organizationId: 'org-123',
        email: 'test@example.com',
        roles: ['user'],
        permissions: [],
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        deviceFingerprint: undefined,
        metadata: { sessionId: undefined },
      });

      expect(sessionService.updateSessionData).toHaveBeenCalledWith('session-123', {
        metadata: { sessionId: 'session-123' },
      });

      expect(result).toMatchObject({
        accessToken: 'mock-jwt-token',
        refreshToken: 'mock-refresh-token',
        sessionId: 'session-123',
      });
    });

    it('should handle device fingerprint when provided', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
        deviceFingerprint: {
          screenResolution: '1920x1080',
          timezone: 'UTC',
          language: 'en-US',
        },
      };

      const result = await authService.login(loginDto, '192.168.1.1', 'Mozilla/5.0');

      expect(deviceFingerprintService.generateFingerprint).toHaveBeenCalledWith({
        userAgent: 'Mozilla/5.0',
        clientData: loginDto.deviceFingerprint,
      });

      expect(sessionService.updateDeviceInfo).toHaveBeenCalledWith(
        'user-123',
        'device-fingerprint-hash',
        expect.objectContaining({
          fingerprint: 'device-fingerprint-hash',
          name: 'Chrome on Windows',
          type: 'desktop',
        })
      );

      expect(sessionService.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceFingerprint: 'device-fingerprint-hash',
        })
      );
    });

    it('should include sessionId in JWT payload', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      await authService.login(loginDto, '192.168.1.1', 'Mozilla/5.0');

      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-123',
        }),
        expect.any(Object)
      );
    });

    it('should pass sessionId to refresh token creation', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      await authService.login(loginDto, '192.168.1.1', 'Mozilla/5.0');

      expect(mockRefreshTokenService.createRefreshToken).toHaveBeenCalledWith(
        'user-123',
        '192.168.1.1',
        'Mozilla/5.0',
        'session-123'
      );
    });
  });

  describe('logout with session integration', () => {
    it('should destroy specific session when sessionId provided', async () => {
      await authService.logout('user-123', 'session-123');

      expect(mockRefreshTokenService.revokeRefreshToken).toHaveBeenCalledWith('user-123');
      expect(sessionService.destroySession).toHaveBeenCalledWith('session-123');
      expect(sessionService.destroyAllUserSessions).not.toHaveBeenCalled();
    });

    it('should destroy all sessions when no sessionId provided', async () => {
      await authService.logout('user-123');

      expect(mockRefreshTokenService.revokeRefreshToken).toHaveBeenCalledWith('user-123');
      expect(sessionService.destroyAllUserSessions).toHaveBeenCalledWith('user-123');
      expect(sessionService.destroySession).not.toHaveBeenCalled();
    });
  });

  describe('refreshAccessToken with session integration', () => {
    it('should validate and update session activity', async () => {
      const result = await authService.refreshAccessToken(
        'refresh-token',
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(sessionService.getSession).toHaveBeenCalledWith('session-123');
      expect(sessionService.updateActivity).toHaveBeenCalledWith('session-123');

      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-123',
        }),
        expect.any(Object)
      );
    });

    it('should handle refresh token without sessionId', async () => {
      mockRefreshTokenService.validateRefreshToken.mockResolvedValueOnce({
        userId: 'user-123',
        sessionId: undefined,
      });

      const result = await authService.refreshAccessToken(
        'refresh-token',
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(sessionService.getSession).not.toHaveBeenCalled();
      expect(sessionService.updateActivity).not.toHaveBeenCalled();

      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: undefined,
        }),
        expect.any(Object)
      );
    });
  });
});
