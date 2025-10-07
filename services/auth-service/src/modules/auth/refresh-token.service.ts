import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { LessThan, MoreThan, Repository } from 'typeorm';
import { RefreshToken } from '../../entities/refresh-token.entity';

@Injectable()
export class RefreshTokenService {
  private readonly refreshTokenTTL: number;

  constructor(
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {
    this.refreshTokenTTL = this.configService.get('JWT_REFRESH_TOKEN_TTL', 7 * 24 * 60 * 60); // 7 days in seconds
  }

  async createRefreshToken(userId: string, ipAddress?: string, userAgent?: string, sessionId?: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.refreshTokenTTL * 1000);
    const family = randomBytes(16).toString('hex'); // Generate token family for rotation tracking

    const refreshToken = this.refreshTokenRepository.create({
      token,
      userId,
      family,
      sessionId,
      metadata: {
        ipAddress,
        userAgent,
      },
      expiresAt,
    });

    await this.refreshTokenRepository.save(refreshToken);
    return token;
  }

  async validateRefreshToken(token: string): Promise<{ userId: string; sessionId?: string }> {
    const refreshToken = await this.refreshTokenRepository.findOne({ where: { token } });

    if (!refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (refreshToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    if (refreshToken.isRevoked) {
      throw new UnauthorizedException('Refresh token isRevoked');
    }

    // Update last used timestamp
    await this.refreshTokenRepository.update(refreshToken.id, { lastUsedAt: new Date() });

    return { 
      userId: refreshToken.userId,
      sessionId: refreshToken.sessionId 
    };
  }

  async revokeRefreshToken(userId: string, specificToken?: string): Promise<void> {
    const criteria: any = { userId, isRevoked: false };
    if (specificToken) {
      criteria.token = specificToken;
    }
    await this.refreshTokenRepository.update(criteria, { isRevoked: true });
  }

  async rotateRefreshToken(oldToken: string, ipAddress?: string, userAgent?: string): Promise<string> {
    // Find and validate old token
    const refreshToken = await this.refreshTokenRepository.findOne({ where: { token: oldToken } });
    
    if (!refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (refreshToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    if (refreshToken.isRevoked) {
      throw new UnauthorizedException('Refresh token isRevoked');
    }
    
    // Revoke old token
    await this.refreshTokenRepository.update(refreshToken.id, { isRevoked: true });
    
    // Create new token with the same sessionId
    return this.createRefreshToken(refreshToken.userId, ipAddress, userAgent, refreshToken.sessionId);
  }

  async revokeAllTokens(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, isRevoked: false },
      { isRevoked: true }
    );
  }

  async cleanupExpiredTokens(): Promise<void> {
    await this.refreshTokenRepository.delete({
      expiresAt: LessThan(new Date())
    });
  }

  async getActiveTokensCount(userId: string): Promise<number> {
    const tokens = await this.refreshTokenRepository.find({
      where: {
        userId,
        isRevoked: false,
        expiresAt: MoreThan(new Date())
      }
    });
    return tokens.length;
  }

  async getUserActiveTokens(userId: string): Promise<Partial<RefreshToken>[]> {
    return this.refreshTokenRepository.find({
      where: {
        userId,
        isRevoked: false,
        expiresAt: MoreThan(new Date())
      },
      select: ['id', 'metadata', 'issuedAt', 'lastUsedAt', 'sessionId'],
      order: { lastUsedAt: 'DESC' }
    });
  }

  async validateTokenWithIpCheck(token: string, ipAddress: string): Promise<{ userId: string }> {
    const refreshToken = await this.refreshTokenRepository.findOne({ where: { token } });

    if (!refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (refreshToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    if (refreshToken.isRevoked) {
      throw new UnauthorizedException('Refresh token isRevoked');
    }

    // Check IP address if it was stored with the token
    if (refreshToken.metadata?.ipAddress && refreshToken.metadata.ipAddress !== ipAddress) {
      throw new UnauthorizedException('Token used from different IP address');
    }

    // Update last used timestamp
    await this.refreshTokenRepository.update(refreshToken.id, { lastUsedAt: new Date() });

    return { userId: refreshToken.userId };
  }
}