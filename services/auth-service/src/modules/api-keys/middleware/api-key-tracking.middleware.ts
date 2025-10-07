import { Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { ApiKeysService } from '../api-keys.service';

export interface RequestWithApiKey extends Request {
  user?: any;
  apiKeyUsageId?: string;
}

@Injectable()
export class ApiKeyTrackingMiddleware implements NestMiddleware {
  constructor(private apiKeysService: ApiKeysService) {}

  use(req: RequestWithApiKey, res: Response, next: NextFunction) {
    if (!req.user?.apiKeyId) {
      return next();
    }

    const startTime = Date.now();
    const requestSize = parseInt(req.get('content-length') || '0');

    // Store original end function
    const originalEnd = res.end;
    const apiKeysService = this.apiKeysService;
    const apiKeyId = req.user.apiKeyId;

    // Override end function to capture response details
    res.end = (...args) => {
      const responseTime = Date.now() - startTime;
      const statusCode = res.statusCode;
      const responseSize = parseInt(res.get('content-length') || '0');

      // Update usage tracking with response details
      apiKeysService
        .trackUsage(apiKeyId, {
          endpoint: req.path,
          method: req.method,
          statusCode,
          responseTime,
          requestSize,
          responseSize,
          ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
          userAgent: req.get('user-agent'),
          headers: sanitizeHeaders(req.headers),
          queryParams: req.query,
          errorMessage: statusCode >= 400 ? res.statusMessage : undefined,
        })
        .catch((err) => {
          console.error('Failed to update API key usage:', err);
        });

      // Call original end function
      return originalEnd.apply(res, args);
    };

    next();
  }
}

function sanitizeHeaders(headers: any): Record<string, string> {
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
