import { SetMetadata } from '@nestjs/common';

export interface RateLimitOptions {
  // Short window (e.g., burst protection)
  short?: {
    ttl: number; // seconds
    limit: number;
  };
  // Medium window (e.g., sustained usage)
  medium?: {
    ttl: number;
    limit: number;
  };
  // Long window (e.g., daily limits)
  long?: {
    ttl: number;
    limit: number;
  };
  // Skip rate limiting for certain conditions
  skipIf?: (request: any) => boolean;
}

/**
 * Enhanced rate limiting decorator with multiple time windows
 *
 * @example
 * @RateLimit({
 *   short: { ttl: 60, limit: 10 },     // 10 requests per minute
 *   medium: { ttl: 300, limit: 50 },   // 50 requests per 5 minutes
 *   long: { ttl: 3600, limit: 500 }    // 500 requests per hour
 * })
 */
export function RateLimit(options: RateLimitOptions) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    // Store rate limit metadata for custom handling
    // The actual throttling is handled by the ThrottlerGuard using this metadata
    SetMetadata('rateLimit', options)(target, propertyKey, descriptor);

    return descriptor;
  };
}

/**
 * Common rate limit presets
 */
export const RateLimitPresets = {
  // Very restrictive - for sensitive operations
  STRICT: {
    short: { ttl: 60, limit: 3 },
    medium: { ttl: 300, limit: 10 },
    long: { ttl: 3600, limit: 30 },
  },

  // Standard API usage
  STANDARD: {
    short: { ttl: 60, limit: 20 },
    medium: { ttl: 300, limit: 100 },
    long: { ttl: 3600, limit: 1000 },
  },

  // Relaxed - for read-heavy operations
  RELAXED: {
    short: { ttl: 60, limit: 60 },
    medium: { ttl: 300, limit: 300 },
    long: { ttl: 3600, limit: 3000 },
  },

  // Authentication endpoints
  AUTH: {
    short: { ttl: 60, limit: 5 },
    medium: { ttl: 900, limit: 15 },
    long: { ttl: 3600, limit: 30 },
  },

  // File upload/download
  FILE_OPERATION: {
    short: { ttl: 60, limit: 5 },
    medium: { ttl: 300, limit: 15 },
    long: { ttl: 3600, limit: 100 },
  },

  // Webhook endpoints
  WEBHOOK: {
    short: { ttl: 1, limit: 10 }, // 10 per second
    medium: { ttl: 60, limit: 300 },
    long: { ttl: 3600, limit: 10000 },
  },
};

/**
 * Skip rate limiting for certain users/conditions
 */
export const SKIP_RATE_LIMIT = SetMetadata('skipRateLimit', true);
