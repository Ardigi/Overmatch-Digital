import { HttpException, HttpStatus, Injectable,  } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../../modules/redis/redis.service';
import type { RateLimitOptions } from '../decorators/rate-limit.decorator';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private redisService: RedisService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip rate limiting if disabled globally (for testing)
    if (process.env.DISABLE_RATE_LIMIT === 'true') {
      return true;
    }

    const skipRateLimit = this.reflector.get<boolean>('skipRateLimit', context.getHandler());

    if (skipRateLimit) {
      return true;
    }

    const rateLimitOptions = this.reflector.get<RateLimitOptions>(
      'rateLimit',
      context.getHandler()
    );

    if (!rateLimitOptions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const identifier = this.getIdentifier(request);

    // Skip if condition is met
    if (rateLimitOptions.skipIf && rateLimitOptions.skipIf(request)) {
      return true;
    }

    // Check all configured time windows
    const violations = [];

    if (rateLimitOptions.short) {
      const shortViolation = await this.checkRateLimit(
        identifier,
        'short',
        rateLimitOptions.short.ttl,
        rateLimitOptions.short.limit
      );
      if (shortViolation) violations.push(shortViolation);
    }

    if (rateLimitOptions.medium) {
      const mediumViolation = await this.checkRateLimit(
        identifier,
        'medium',
        rateLimitOptions.medium.ttl,
        rateLimitOptions.medium.limit
      );
      if (mediumViolation) violations.push(mediumViolation);
    }

    if (rateLimitOptions.long) {
      const longViolation = await this.checkRateLimit(
        identifier,
        'long',
        rateLimitOptions.long.ttl,
        rateLimitOptions.long.limit
      );
      if (longViolation) violations.push(longViolation);
    }

    if (violations.length > 0) {
      // Find the most restrictive violation
      const worstViolation = violations.reduce((prev, current) =>
        prev.retryAfter > current.retryAfter ? prev : current
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests',
          error: 'Rate limit exceeded',
          details: {
            window: worstViolation.window,
            limit: worstViolation.limit,
            ttl: worstViolation.ttl,
            retryAfter: worstViolation.retryAfter,
          },
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    return true;
  }

  private getIdentifier(request: any): string {
    // Priority: API key > User ID > IP address
    if (request.headers['x-api-key']) {
      return `api-key:${request.headers['x-api-key']}`;
    }

    if (request.user && request.user.id) {
      return `user:${request.user.id}`;
    }

    // Get real IP from proxy headers or fall back to connection IP
    const ip =
      request.headers['x-real-ip'] ||
      request.headers['x-forwarded-for']?.split(',')[0].trim() ||
      request.connection.remoteAddress ||
      request.ip;

    return `ip:${ip}`;
  }

  private async checkRateLimit(
    identifier: string,
    window: string,
    ttl: number,
    limit: number
  ): Promise<{ window: string; ttl: number; limit: number; retryAfter: number } | null> {
    const key = `rate-limit:${identifier}:${window}`;
    const redis = this.redisService.getClient();

    const current = await redis.incr(key);

    if (current === 1) {
      await redis.expire(key, ttl);
    }

    if (current > limit) {
      const ttlRemaining = await redis.ttl(key);
      return {
        window,
        ttl,
        limit,
        retryAfter: ttlRemaining > 0 ? ttlRemaining : ttl,
      };
    }

    return null;
  }
}
