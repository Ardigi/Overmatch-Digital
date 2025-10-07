import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Observable } from 'rxjs';

/**
 * Security Headers Interceptor
 *
 * Adds comprehensive security headers to all HTTP responses to protect against
 * common web vulnerabilities including XSS, clickjacking, and content sniffing.
 *
 * Implements OWASP security header recommendations for 2025.
 */
@Injectable()
export class SecurityHeadersInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Prevent MIME type sniffing
    response.setHeader('X-Content-Type-Options', 'nosniff');

    // Enable XSS filter and block mode
    response.setHeader('X-XSS-Protection', '1; mode=block');

    // Prevent clickjacking
    response.setHeader('X-Frame-Options', 'DENY');

    // Strict Transport Security (HSTS) - 1 year
    response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    // Referrer Policy - prevent leaking sensitive URLs
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions Policy (formerly Feature Policy)
    response.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=()'
    );

    // Content Security Policy - strict policy for APIs
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; " +
        "frame-ancestors 'none'; " +
        "form-action 'none'; " +
        "base-uri 'none'; " +
        'upgrade-insecure-requests'
    );

    // Remove sensitive headers
    response.removeHeader('X-Powered-By');
    response.removeHeader('Server');

    // Add custom security headers
    response.setHeader('X-API-Version', process.env.API_VERSION || '1.0');
    response.setHeader('X-Request-ID', context.switchToHttp().getRequest().id || 'unknown');

    // Cache control for sensitive data
    if (this.isSensitiveEndpoint(context)) {
      response.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
      );
      response.setHeader('Pragma', 'no-cache');
      response.setHeader('Expires', '0');
    }

    return next.handle();
  }

  /**
   * Determine if the endpoint handles sensitive data
   */
  private isSensitiveEndpoint(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const path = request.route?.path || '';

    // List of sensitive endpoints that should never be cached
    const sensitivePatterns = [
      '/policies',
      '/assessments',
      '/compliance',
      '/controls',
      '/risks',
      '/auth',
      '/users',
      '/api-keys',
    ];

    return sensitivePatterns.some((pattern) => path.includes(pattern));
  }
}
