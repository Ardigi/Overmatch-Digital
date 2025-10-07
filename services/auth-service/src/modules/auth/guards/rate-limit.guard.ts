import { HttpException, HttpStatus, Injectable, Logger,  } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export interface RateLimitOptions {
  points: number; // Number of requests
  duration: number; // Time window in seconds
  blockDuration?: number; // Block duration in seconds after limit exceeded
  keyPrefix?: string; // Custom key prefix
}

export const RATE_LIMIT_KEY = 'rateLimit';

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blockedUntil?: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly storage = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private reflector: Reflector) {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.storage.entries()) {
        if (entry.resetTime < now && (!entry.blockedUntil || entry.blockedUntil < now)) {
          this.storage.delete(key);
        }
      }
    }, 60000);
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip rate limiting in test environment
    if (process.env.NODE_ENV === 'test') {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Get rate limit options from decorator
    const rateLimitOptions = this.reflector.get<RateLimitOptions>(
      RATE_LIMIT_KEY,
      context.getHandler()
    );

    if (!rateLimitOptions) {
      return true; // No rate limit configured
    }

    const { points, duration, blockDuration = 0, keyPrefix = 'rl' } = rateLimitOptions;

    // Generate key based on IP and endpoint
    const ip = request.ip || request.connection.remoteAddress || 'unknown';
    const endpoint = `${request.method}:${request.path}`;
    const key = `${keyPrefix}:${endpoint}:${ip}`;

    const now = Date.now();
    const windowMs = duration * 1000;

    // Get or create entry
    let entry = this.storage.get(key);

    // Check if blocked
    if (entry && entry.blockedUntil && entry.blockedUntil > now) {
      const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
      response.setHeader('Retry-After', retryAfter);
      response.setHeader('X-RateLimit-Limit', points);
      response.setHeader('X-RateLimit-Remaining', 0);
      response.setHeader('X-RateLimit-Reset', new Date(entry.blockedUntil).toISOString());

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests, please try again later.',
          error: 'Too Many Requests',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // Reset if window expired
    if (!entry || entry.resetTime <= now) {
      entry = {
        count: 0,
        resetTime: now + windowMs,
      };
      this.storage.set(key, entry);
    }

    // Set response headers
    const remaining = Math.max(0, points - entry.count - 1);
    response.setHeader('X-RateLimit-Limit', points);
    response.setHeader('X-RateLimit-Remaining', remaining);
    response.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());

    // Check if limit exceeded
    if (entry.count >= points) {
      // Block if configured
      if (blockDuration > 0) {
        entry.blockedUntil = now + blockDuration * 1000;
      }

      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      response.setHeader('Retry-After', retryAfter);

      this.logger.warn(`Rate limit exceeded for ${key}`);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded, please try again later.',
          error: 'Too Many Requests',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // Increment counter
    entry.count++;

    return true;
  }
}
