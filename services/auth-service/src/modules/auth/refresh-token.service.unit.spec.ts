import { UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { MoreThan } from 'typeorm';
import { RefreshTokenService } from './refresh-token.service';

jest.mock('crypto');

describe('RefreshTokenService (Unit)', () => {
  let service: RefreshTokenService;
  let refreshTokenRepository: any;
  let configService: any;
  let jwtService: any;

  const mockRefreshToken = {
    id: 'token-123',
    token: 'mock-token-hash',
    userId: 'user-123',
    family: 'token-family-123',
    sessionId: 'session-123',
    metadata: {
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
    },
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    isRevoked: false,
    createdAt: new Date(),
    lastUsedAt: new Date(),
  };

  beforeEach(() => {
    // Create mock repositories and services
    refreshTokenRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
    };

    configService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          JWT_REFRESH_TOKEN_TTL: 7 * 24 * 60 * 60, // 7 days in seconds
        };
        return config[key] || defaultValue;
      }),
    };

    jwtService = {
      signAsync: jest.fn(),
      verify: jest.fn(),
    };

    // Create service instance with mocked dependencies
    service = new RefreshTokenService(refreshTokenRepository, configService, jwtService);

    jest.clearAllMocks();
  });

  describe('createRefreshToken', () => {
    it('should create a new refresh token', async () => {
      const mockToken = 'mock-random-token';
      (crypto.randomBytes as jest.Mock).mockReturnValue({
        toString: jest.fn().mockReturnValue(mockToken),
      });

      refreshTokenRepository.create.mockReturnValue(mockRefreshToken);
      refreshTokenRepository.save.mockResolvedValue(mockRefreshToken);

      const result = await service.createRefreshToken('user-123', '127.0.0.1', 'Mozilla/5.0');

      expect(crypto.randomBytes).toHaveBeenCalledWith(32);
      expect(refreshTokenRepository.create).toHaveBeenCalledWith({
        token: mockToken,
        userId: 'user-123',
        family: expect.any(String),
        sessionId: undefined,
        metadata: {
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
        },
        expiresAt: expect.any(Date),
      });
      expect(refreshTokenRepository.save).toHaveBeenCalledWith(mockRefreshToken);
      expect(result).toBe(mockToken);
    });

    it('should create token without ipAddress and userAgent', async () => {
      const mockToken = 'mock-random-token';
      (crypto.randomBytes as jest.Mock).mockReturnValue({
        toString: jest.fn().mockReturnValue(mockToken),
      });

      refreshTokenRepository.create.mockReturnValue(mockRefreshToken);
      refreshTokenRepository.save.mockResolvedValue(mockRefreshToken);

      const result = await service.createRefreshToken('user-123');

      expect(refreshTokenRepository.create).toHaveBeenCalledWith({
        token: mockToken,
        userId: 'user-123',
        family: expect.any(String),
        sessionId: undefined,
        metadata: {
          ipAddress: undefined,
          userAgent: undefined,
        },
        expiresAt: expect.any(Date),
      });
      expect(result).toBe(mockToken);
    });
  });

  describe('validateRefreshToken', () => {
    it('should validate and return userId for valid token', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(mockRefreshToken);

      const result = await service.validateRefreshToken('mock-token-hash');

      expect(refreshTokenRepository.findOne).toHaveBeenCalledWith({
        where: { token: 'mock-token-hash' },
      });
      expect(result).toEqual({ userId: 'user-123', sessionId: 'session-123' });
    });

    it('should throw UnauthorizedException for non-existent token', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(null);

      await expect(service.validateRefreshToken('invalid-token')).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token')
      );
    });

    it('should throw UnauthorizedException for expired token', async () => {
      const expiredToken = {
        ...mockRefreshToken,
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
      };
      refreshTokenRepository.findOne.mockResolvedValue(expiredToken);

      await expect(service.validateRefreshToken('expired-token')).rejects.toThrow(
        new UnauthorizedException('Refresh token expired')
      );
    });

    it('should throw UnauthorizedException for revoked token', async () => {
      const revokedToken = {
        ...mockRefreshToken,
        isRevoked: true,
      };
      refreshTokenRepository.findOne.mockResolvedValue(revokedToken);

      await expect(service.validateRefreshToken('revoked-token')).rejects.toThrow(
        new UnauthorizedException('Refresh token isRevoked')
      );
    });

    it('should update lastUsedAt timestamp', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(mockRefreshToken);

      await service.validateRefreshToken('mock-token-hash');

      expect(refreshTokenRepository.update).toHaveBeenCalledWith(mockRefreshToken.id, {
        lastUsedAt: expect.any(Date),
      });
    });
  });

  describe('revokeRefreshToken', () => {
    it('should revoke all tokens for a user', async () => {
      await service.revokeRefreshToken('user-123');

      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        { userId: 'user-123', isRevoked: false },
        { isRevoked: true }
      );
    });

    it('should revoke a specific token', async () => {
      await service.revokeRefreshToken('user-123', 'specific-token');

      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        { userId: 'user-123', token: 'specific-token', isRevoked: false },
        { isRevoked: true }
      );
    });
  });

  describe('revokeAllTokens', () => {
    it('should revoke all tokens for a user', async () => {
      await service.revokeAllTokens('user-123');

      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        { userId: 'user-123', isRevoked: false },
        { isRevoked: true }
      );
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired tokens', async () => {
      await service.cleanupExpiredTokens();

      expect(refreshTokenRepository.delete).toHaveBeenCalledWith({
        expiresAt: expect.any(Object), // LessThan operator
      });
    });
  });

  describe('getActiveTokensCount', () => {
    it('should return count of active tokens for user', async () => {
      const mockTokens = [mockRefreshToken, { ...mockRefreshToken, id: 'token-456' }];
      refreshTokenRepository.find.mockResolvedValue(mockTokens);

      const result = await service.getActiveTokensCount('user-123');

      expect(refreshTokenRepository.find).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          isRevoked: false,
          expiresAt: MoreThan(expect.any(Date)),
        },
      });
      expect(result).toBe(2);
    });

    it('should return 0 when no active tokens', async () => {
      refreshTokenRepository.find.mockResolvedValue([]);

      const result = await service.getActiveTokensCount('user-123');

      expect(result).toBe(0);
    });
  });

  describe('getUserActiveTokens', () => {
    it('should return active tokens with device info', async () => {
      const mockTokens = [
        mockRefreshToken,
        {
          ...mockRefreshToken,
          id: 'token-456',
          token: 'another-token',
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome/91.0',
        },
      ];
      refreshTokenRepository.find.mockResolvedValue(mockTokens);

      const result = await service.getUserActiveTokens('user-123');

      expect(refreshTokenRepository.find).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          isRevoked: false,
          expiresAt: MoreThan(expect.any(Date)),
        },
        select: ['id', 'metadata', 'issuedAt', 'lastUsedAt', 'sessionId'],
        order: { lastUsedAt: 'DESC' },
      });
      expect(result).toEqual(mockTokens);
    });
  });

  describe('rotateRefreshToken', () => {
    it('should create new token and revoke old one', async () => {
      const oldToken = 'old-token';
      const newToken = 'new-token';

      refreshTokenRepository.findOne.mockResolvedValue(mockRefreshToken);
      (crypto.randomBytes as jest.Mock).mockReturnValue({
        toString: jest.fn().mockReturnValue(newToken),
      });
      refreshTokenRepository.create.mockReturnValue({ ...mockRefreshToken, token: newToken });
      refreshTokenRepository.save.mockResolvedValue({ ...mockRefreshToken, token: newToken });

      const result = await service.rotateRefreshToken(oldToken);

      expect(refreshTokenRepository.findOne).toHaveBeenCalledWith({
        where: { token: oldToken },
      });
      expect(refreshTokenRepository.update).toHaveBeenCalledWith(mockRefreshToken.id, {
        isRevoked: true,
      });
      expect(result).toBe(newToken);
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(null);

      await expect(service.rotateRefreshToken('invalid-token')).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token')
      );
    });
  });

  describe('validateTokenWithIpCheck', () => {
    it('should validate token with matching IP', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(mockRefreshToken);

      const result = await service.validateTokenWithIpCheck('mock-token-hash', '127.0.0.1');

      expect(result).toEqual({ userId: 'user-123' });
    });

    it('should throw UnauthorizedException for mismatched IP', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(mockRefreshToken);

      await expect(
        service.validateTokenWithIpCheck('mock-token-hash', '192.168.1.1')
      ).rejects.toThrow(new UnauthorizedException('Token used from different IP address'));
    });

    it('should allow validation when token has no IP stored', async () => {
      const tokenWithoutIp = { ...mockRefreshToken, metadata: { ...mockRefreshToken.metadata, ipAddress: null } };
      refreshTokenRepository.findOne.mockResolvedValue(tokenWithoutIp);

      const result = await service.validateTokenWithIpCheck('mock-token-hash', '192.168.1.1');

      expect(result).toEqual({ userId: 'user-123' });
    });
  });
});
