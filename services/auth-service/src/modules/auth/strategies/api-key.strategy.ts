import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-custom';
import type { ApiKeysService } from '../../api-keys/api-keys.service';
import { UsersService } from '../../users/users.service';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(
    private apiKeysService: ApiKeysService,
    private usersService: UsersService
  ) {
    super();
  }

  async validate(req: Request): Promise<any> {
    // Extract API key from X-API-Key header
    const token = req.headers['x-api-key'] as string;

    if (!token) {
      throw new UnauthorizedException('API key missing');
    }
    // Extract IP address
    const ip = req.ip || req.socket.remoteAddress;

    try {
      // Validate API key
      const apiKey = await this.apiKeysService.validateApiKey(token, ip);

      if (!apiKey) {
        throw new UnauthorizedException('Invalid API key');
      }

      // Check rate limit
      const rateLimitCheck = await this.apiKeysService.checkRateLimit(apiKey.id);
      if (!rateLimitCheck.allowed) {
        throw new UnauthorizedException('Rate limit exceeded');
      }

      // Track usage (async, don't wait)
      this.trackUsage(req, apiKey.id);

      // Get user associated with API key
      const user = await this.usersService.findOne(apiKey.userId);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Return user with API key context
      return {
        ...user,
        apiKeyId: apiKey.id,
        apiKeyScopes: apiKey.scopes,
        apiKeyPermissions: apiKey.permissions,
        isApiKey: true,
      };
    } catch (error) {
      throw new UnauthorizedException(error.message || 'Invalid API key');
    }
  }

  private async trackUsage(req: Request, apiKeyId: string): Promise<void> {
    try {
      await this.apiKeysService.trackUsage(apiKeyId, {
        endpoint: req.path,
        method: req.method,
        statusCode: 0, // Will be updated by middleware
        responseTime: 0, // Will be updated by middleware
        ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
        userAgent: req.get('user-agent'),
        headers: this.sanitizeHeaders(req.headers),
        queryParams: req.query,
      });
    } catch (error) {
      // Log error but don't fail the request
      console.error('Failed to track API key usage:', error);
    }
  }

  private sanitizeHeaders(headers: any): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const allowedHeaders = [
      'content-type',
      'content-length',
      'accept',
      'accept-language',
      'origin',
      'referer',
    ];

    for (const header of allowedHeaders) {
      if (headers[header]) {
        sanitized[header] = headers[header];
      }
    }

    return sanitized;
  }
}
