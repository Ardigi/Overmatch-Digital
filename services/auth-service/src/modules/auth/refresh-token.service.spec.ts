import { UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { RefreshToken } from './entities/refresh-token.entity';
import { RefreshTokenService } from './refresh-token.service';

jest.mock('crypto');

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let mockRefreshTokenRepository: any;
  let mockConfigService: any;
  let mockJwtService: any;

  const mockRefreshToken = {
    id: 'token-123',
    token: 'mock-refresh-token',
    userId: 'user-123',
    ipAddress: '127.0.0.1',
    userAgent: 'Test User Agent',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    revoked: false,
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockRefreshTokenRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue(7 * 24 * 60 * 60), // 7 days in seconds
    };

    mockJwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };

    // Manual instantiation
    service = new RefreshTokenService(
      mockRefreshTokenRepository,
      mockConfigService,
      mockJwtService
    );

    jest.clearAllMocks();
  });

  describe('createRefreshToken', () => {
    const mockToken = 'mock-random-token';

    beforeEach(() => {
      (crypto.randomBytes as jest.Mock).mockReturnValue({
        toString: jest.fn().mockReturnValue(mockToken),
      });
    });

    it('should create a refresh token', async () => {
      mockRefreshTokenRepository.create.mockReturnValue(mockRefreshToken);
      mockRefreshTokenRepository.save.mockResolvedValue(mockRefreshToken);

      const result = await service.createRefreshToken('user-123', '127.0.0.1', 'Test User Agent');

      expect(result).toBe(mockToken);
      expect(crypto.randomBytes).toHaveBeenCalledWith(32);
      expect(mockRefreshTokenRepository.create).toHaveBeenCalledWith({
        token: mockToken,
        userId: 'user-123',
        family: expect.any(String),
        sessionId: undefined,
        metadata: {
          ipAddress: '127.0.0.1',
          userAgent: 'Test User Agent',
        },
        expiresAt: expect.any(Date),
      });
      expect(mockRefreshTokenRepository.save).toHaveBeenCalledWith(mockRefreshToken);
    });

    it('should create a refresh token without optional parameters', async () => {
      mockRefreshTokenRepository.create.mockReturnValue(mockRefreshToken);
      mockRefreshTokenRepository.save.mockResolvedValue(mockRefreshToken);

      const result = await service.createRefreshToken('user-123');

      expect(result).toBe(mockToken);
      expect(mockRefreshTokenRepository.create).toHaveBeenCalledWith({
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
    });

    it('should use custom TTL from config', async () => {
      const customTTL = 14 * 24 * 60 * 60; // 14 days
      mockConfigService.get.mockReturnValue(customTTL);

      // Re-instantiate service to pick up new config
      const serviceWithCustomTTL = new RefreshTokenService(
        mockRefreshTokenRepository,
        mockConfigService,
        mockJwtService
      );

      mockRefreshTokenRepository.create.mockReturnValue(mockRefreshToken);
      mockRefreshTokenRepository.save.mockResolvedValue(mockRefreshToken);

      await serviceWithCustomTTL.createRefreshToken('user-123');

      const createdToken = mockRefreshTokenRepository.create.mock.calls[0][0];
      const expectedExpiry = new Date(Date.now() + customTTL * 1000);
      const actualExpiry = createdToken.expiresAt;

      // Check that expiry is within 1 second of expected (to account for execution time)
      expect(Math.abs(actualExpiry.getTime() - expectedExpiry.getTime())).toBeLessThan(1000);
    });
  });

  describe('validateRefreshToken', () => {
    it('should validate a valid refresh token', async () => {
      mockRefreshTokenRepository.findOne.mockResolvedValue(mockRefreshToken);

      const result = await service.validateRefreshToken('mock-refresh-token');

      expect(result).toEqual({ userId: 'user-123' });
      expect(mockRefreshTokenRepository.findOne).toHaveBeenCalledWith({
        where: { token: 'mock-refresh-token' },
      });
    });

    it('should throw UnauthorizedException for non-existent token', async () => {
      mockRefreshTokenRepository.findOne.mockResolvedValue(null);

      await expect(service.validateRefreshToken('invalid-token')).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token')
      );
    });

    it('should throw UnauthorizedException for expired token', async () => {
      const expiredToken = {
        ...mockRefreshToken,
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      };
      mockRefreshTokenRepository.findOne.mockResolvedValue(expiredToken);

      await expect(service.validateRefreshToken('expired-token')).rejects.toThrow(
        new UnauthorizedException('Refresh token expired')
      );
    });

    it('should throw UnauthorizedException for revoked token', async () => {
      const revokedToken = {
        ...mockRefreshToken,
        isRevoked: true,
      };
      mockRefreshTokenRepository.findOne.mockResolvedValue(revokedToken);

      await expect(service.validateRefreshToken('revoked-token')).rejects.toThrow(
        new UnauthorizedException('Refresh token isRevoked')
      );
    });
  });

  describe('revokeRefreshToken', () => {
    it('should revoke all refresh tokens for a user', async () => {
      await service.revokeRefreshToken('user-123');

      expect(mockRefreshTokenRepository.update).toHaveBeenCalledWith(
        { userId: 'user-123', isRevoked: false },
        { isRevoked: true }
      );
    });
  });

  describe('rotateRefreshToken', () => {
    const oldToken = 'old-refresh-token';
    const newToken = 'new-refresh-token';

    beforeEach(() => {
      (crypto.randomBytes as jest.Mock).mockReturnValue({
        toString: jest.fn().mockReturnValue(newToken),
      });
    });

    it('should rotate a valid refresh token', async () => {
      mockRefreshTokenRepository.findOne.mockResolvedValue(mockRefreshToken);
      mockRefreshTokenRepository.update.mockResolvedValue({ affected: 1 });
      mockRefreshTokenRepository.create.mockReturnValue({ ...mockRefreshToken, token: newToken });
      mockRefreshTokenRepository.save.mockResolvedValue({ ...mockRefreshToken, token: newToken });

      const result = await service.rotateRefreshToken(oldToken, '192.168.1.1', 'New User Agent');

      expect(result).toBe(newToken);
      expect(mockRefreshTokenRepository.findOne).toHaveBeenCalledWith({
        where: { token: oldToken },
      });
      expect(mockRefreshTokenRepository.update).toHaveBeenCalledWith('token-123', {
        isRevoked: true,
      });
      expect(mockRefreshTokenRepository.create).toHaveBeenCalledWith({
        token: newToken,
        userId: 'user-123',
        family: expect.any(String),
        sessionId: undefined,
        metadata: {
          ipAddress: '192.168.1.1',
          userAgent: 'New User Agent',
        },
        expiresAt: expect.any(Date),
      });
    });

    it('should throw UnauthorizedException for invalid old token', async () => {
      mockRefreshTokenRepository.findOne.mockResolvedValue(null);

      await expect(service.rotateRefreshToken('invalid-token')).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token')
      );
    });

    it('should throw UnauthorizedException for expired old token', async () => {
      const expiredToken = {
        ...mockRefreshToken,
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      };
      mockRefreshTokenRepository.findOne.mockResolvedValue(expiredToken);

      await expect(service.rotateRefreshToken(oldToken)).rejects.toThrow(
        new UnauthorizedException('Refresh token expired')
      );
    });

    it('should throw UnauthorizedException for revoked old token', async () => {
      const revokedToken = {
        ...mockRefreshToken,
        isRevoked: true,
      };
      mockRefreshTokenRepository.findOne.mockResolvedValue(revokedToken);

      await expect(service.rotateRefreshToken(oldToken)).rejects.toThrow(
        new UnauthorizedException('Refresh token isRevoked')
      );
    });

    it('should rotate token without optional parameters', async () => {
      mockRefreshTokenRepository.findOne.mockResolvedValue(mockRefreshToken);
      mockRefreshTokenRepository.update.mockResolvedValue({ affected: 1 });
      mockRefreshTokenRepository.create.mockReturnValue({ ...mockRefreshToken, token: newToken });
      mockRefreshTokenRepository.save.mockResolvedValue({ ...mockRefreshToken, token: newToken });

      const result = await service.rotateRefreshToken(oldToken);

      expect(result).toBe(newToken);
      expect(mockRefreshTokenRepository.create).toHaveBeenCalledWith({
        token: newToken,
        userId: 'user-123',
        family: expect.any(String),
        sessionId: undefined,
        metadata: {
          ipAddress: undefined,
          userAgent: undefined,
        },
        expiresAt: expect.any(Date),
      });
    });
  });
});
