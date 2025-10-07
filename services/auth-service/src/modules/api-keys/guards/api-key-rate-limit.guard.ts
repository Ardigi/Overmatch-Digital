import { HttpException, HttpStatus, Injectable,  } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ApiKeyRateLimiterService } from '../api-key-rate-limiter.service';

export interface ApiKeyRateLimitOptions {
  limit: number;
  windowSeconds: number;
  skipIfAuthenticated?: boolean;
  endpointSpecific?: boolean;
}

export const API_KEY_RATE_LIMIT_KEY = 'api-key-rate-limit';

@Injectable()
export class ApiKeyRateLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rateLimiterService: ApiKeyRateLimiterService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip rate limiting in test environment
    if (process.env.NODE_ENV === 'test') {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Only apply to API key authenticated requests
    if (!user?.apiKeyId) {
      return true;
    }

    // Get rate limit configuration
    const rateLimitOptions = this.reflector.getAllAndOverride<ApiKeyRateLimitOptions>(
      API_KEY_RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!rateLimitOptions) {
      return true;
    }

    // Skip if authenticated via JWT and configured to skip
    if (rateLimitOptions.skipIfAuthenticated && !user.isApiKey) {
      return true;
    }

    // Check rate limit
    const result = rateLimitOptions.endpointSpecific
      ? await this.rateLimiterService.checkEndpointRateLimit(
          user.apiKeyId,
          request.path,
          request.method,
          rateLimitOptions.limit,
          rateLimitOptions.windowSeconds
        )
      : await this.rateLimiterService.checkRateLimit(
          user.apiKeyId,
          rateLimitOptions.limit,
          rateLimitOptions.windowSeconds
        );

    // Set rate limit headers
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', result.limit);
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader('X-RateLimit-Reset', Math.floor(result.resetAt.getTime() / 1000));

    if (!result.allowed) {
      response.setHeader('Retry-After', result.retryAfter);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded',
          error: 'Too Many Requests',
          retryAfter: result.retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    return true;
  }
}
