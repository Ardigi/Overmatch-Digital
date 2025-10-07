import {
  Injectable,
  NestMiddleware,
  BadRequestException,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { validate as uuidValidate } from 'uuid';
import sanitizeHtml from 'sanitize-html';
import { createHash } from 'crypto';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  sanitizedData?: any;
}

export interface ValidationError {
  field: string;
  value: any;
  message: string;
  code: string;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
}

@Injectable()
export class EnterpriseValidationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(EnterpriseValidationMiddleware.name);
  private readonly requestCache = new Map<string, { count: number; resetTime: number }>();
  
  // SQL injection patterns
  private readonly sqlInjectionPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|EXECUTE|SCRIPT|JAVASCRIPT)\b)/gi,
    /(--|\/\*|\*\/|xp_|sp_|0x)/gi,
    /(\bOR\b\s*\d+\s*=\s*\d+)/gi,
    /(\bAND\b\s*\d+\s*=\s*\d+)/gi,
    /(['"])\s*OR\s*\1\s*=\s*\1/gi,
  ];

  // XSS patterns
  private readonly xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<img[^>]*onerror=/gi,
    /<svg[^>]*onload=/gi,
  ];

  // Path traversal patterns
  private readonly pathTraversalPatterns = [
    /\.\.\//g,
    /\.\.%2f/gi,
    /\.\.%5c/gi,
    /%2e%2e/gi,
    /\.\.\\/g,
  ];

  // Command injection patterns
  private readonly commandInjectionPatterns = [
    /[;&|`$()]/g,
    /\$\{.*\}/g,
    /\$\(.*\)/g,
  ];

  use(req: Request, res: Response, next: NextFunction) {
    try {
      // 1. Request ID for tracing
      const requestId = this.generateRequestId(req);
      req['requestId'] = requestId;
      res.setHeader('X-Request-ID', requestId);

      // 2. Rate limiting check
      if (!this.checkRateLimit(req)) {
        throw new BadRequestException({
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests',
          error: 'RATE_LIMIT_EXCEEDED',
        });
      }

      // 3. Validate content type
      this.validateContentType(req);

      // 4. Validate request size
      this.validateRequestSize(req);

      // 5. Sanitize and validate headers
      this.sanitizeHeaders(req);

      // 6. Validate and sanitize URL parameters
      if (req.params) {
        req.params = this.sanitizeObject(req.params);
        this.validateUrlParameters(req.params);
      }

      // 7. Validate and sanitize query parameters
      if (req.query) {
        req.query = this.sanitizeObject(req.query);
        this.validateQueryParameters(req.query);
      }

      // 8. Validate and sanitize request body
      if (req.body) {
        const validation = this.validateAndSanitizeBody(req.body);
        if (!validation.isValid) {
          throw new BadRequestException({
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'Validation failed',
            errors: validation.errors,
          });
        }
        req.body = validation.sanitizedData;
      }

      // 9. Check for malicious patterns
      this.detectMaliciousPatterns(req);

      // 10. Add security headers
      this.addSecurityHeaders(res);

      // Log the validated request
      this.logger.debug(`Request validated: ${req.method} ${req.path}`, {
        requestId,
        userId: req['user']?.id,
        organizationId: req['user']?.organizationId,
      });

      next();
    } catch (error) {
      this.logger.error('Validation middleware error:', error);
      
      if (error instanceof BadRequestException) {
        res.status(error.getStatus()).json(error.getResponse());
      } else {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal validation error',
          error: 'VALIDATION_ERROR',
        });
      }
    }
  }

  private generateRequestId(req: Request): string {
    const traceId = req.headers['x-trace-id'] as string;
    if (traceId && uuidValidate(traceId)) {
      return traceId;
    }
    
    // Generate deterministic ID based on request
    const hash = createHash('sha256');
    hash.update(`${Date.now()}-${req.ip}-${Math.random()}`);
    return hash.digest('hex').substring(0, 32);
  }

  private checkRateLimit(req: Request): boolean {
    const key = this.getRateLimitKey(req);
    const now = Date.now();
    const windowMs = 60000; // 1 minute window
    const maxRequests = 100; // Max 100 requests per minute

    const record = this.requestCache.get(key);
    
    if (!record || record.resetTime < now) {
      this.requestCache.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return true;
    }

    if (record.count >= maxRequests) {
      return false;
    }

    record.count++;
    return true;
  }

  private getRateLimitKey(req: Request): string {
    // Use user ID if authenticated, otherwise use IP
    const userId = req['user']?.id;
    if (userId) {
      return `user:${userId}`;
    }
    
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `ip:${ip}`;
  }

  private validateContentType(req: Request): void {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      const contentType = req.headers['content-type'];
      
      if (!contentType) {
        throw new BadRequestException({
          message: 'Content-Type header is required',
          error: 'MISSING_CONTENT_TYPE',
        });
      }

      const allowedTypes = [
        'application/json',
        'application/x-www-form-urlencoded',
        'multipart/form-data',
      ];

      const isAllowed = allowedTypes.some(type => contentType.includes(type));
      
      if (!isAllowed) {
        throw new BadRequestException({
          message: 'Invalid Content-Type',
          error: 'INVALID_CONTENT_TYPE',
        });
      }
    }
  }

  private validateRequestSize(req: Request): void {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    
    if (contentLength > maxSize) {
      throw new BadRequestException({
        message: 'Request payload too large',
        error: 'PAYLOAD_TOO_LARGE',
      });
    }
  }

  private sanitizeHeaders(req: Request): void {
    const dangerousHeaders = [
      'x-forwarded-host',
      'x-forwarded-proto',
      'x-forwarded-for',
    ];

    // Remove potentially dangerous headers in production
    if (process.env.NODE_ENV === 'production') {
      dangerousHeaders.forEach(header => {
        delete req.headers[header];
      });
    }

    // Sanitize custom headers
    Object.keys(req.headers).forEach(key => {
      if (typeof req.headers[key] === 'string') {
        req.headers[key] = this.sanitizeString(req.headers[key] as string);
      }
    });
  }

  private validateUrlParameters(params: any): void {
    // Validate UUIDs
    const uuidParams = ['id', 'userId', 'organizationId', 'policyId', 'controlId'];
    
    uuidParams.forEach(param => {
      if (params[param] && !uuidValidate(params[param])) {
        throw new BadRequestException({
          message: `Invalid ${param} format`,
          error: 'INVALID_UUID',
          field: param,
        });
      }
    });

    // Validate enums
    if (params.status) {
      const validStatuses = ['draft', 'published', 'archived', 'approved', 'rejected'];
      if (!validStatuses.includes(params.status)) {
        throw new BadRequestException({
          message: 'Invalid status value',
          error: 'INVALID_ENUM',
          field: 'status',
        });
      }
    }
  }

  private validateQueryParameters(query: any): void {
    // Validate pagination
    if (query.page) {
      const page = parseInt(query.page, 10);
      if (isNaN(page) || page < 1 || page > 10000) {
        throw new BadRequestException({
          message: 'Invalid page number',
          error: 'INVALID_PAGINATION',
          field: 'page',
        });
      }
    }

    if (query.limit) {
      const limit = parseInt(query.limit, 10);
      if (isNaN(limit) || limit < 1 || limit > 100) {
        throw new BadRequestException({
          message: 'Invalid limit value (1-100)',
          error: 'INVALID_PAGINATION',
          field: 'limit',
        });
      }
    }

    // Validate sort parameters
    if (query.sortBy) {
      const allowedSortFields = [
        'createdAt',
        'updatedAt',
        'name',
        'status',
        'priority',
      ];
      
      if (!allowedSortFields.includes(query.sortBy)) {
        throw new BadRequestException({
          message: 'Invalid sort field',
          error: 'INVALID_SORT',
          field: 'sortBy',
        });
      }
    }

    if (query.sortOrder) {
      if (!['asc', 'desc', 'ASC', 'DESC'].includes(query.sortOrder)) {
        throw new BadRequestException({
          message: 'Invalid sort order',
          error: 'INVALID_SORT',
          field: 'sortOrder',
        });
      }
    }

    // Validate date ranges
    if (query.startDate || query.endDate) {
      this.validateDateRange(query.startDate, query.endDate);
    }
  }

  private validateAndSanitizeBody(body: any): ValidationResult {
    const errors: ValidationError[] = [];
    const sanitized = this.deepSanitize(body);

    // Check for required fields based on the operation
    // This would be customized based on your DTOs
    
    // Validate field lengths
    this.validateFieldLengths(sanitized, errors);
    
    // Validate field formats
    this.validateFieldFormats(sanitized, errors);
    
    // Check for prohibited fields
    this.checkProhibitedFields(sanitized, errors);

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: sanitized,
    };
  }

  private deepSanitize(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepSanitize(item));
    }

    if (typeof obj === 'object') {
      const sanitized = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          // Sanitize the key itself
          const sanitizedKey = this.sanitizeString(key);
          sanitized[sanitizedKey] = this.deepSanitize(obj[key]);
        }
      }
      return sanitized;
    }

    return obj;
  }

  private sanitizeString(str: string): string {
    if (typeof str !== 'string') {
      return str;
    }

    // Remove null bytes
    let sanitized = str.replace(/\0/g, '');
    
    // HTML sanitization
    sanitized = sanitizeHtml(sanitized, {
      allowedTags: [],
      allowedAttributes: {},
      disallowedTagsMode: 'discard',
    });
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    // Remove control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
    
    return sanitized;
  }

  private sanitizeObject(obj: any): any {
    const sanitized = {};
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const sanitizedKey = this.sanitizeString(key);
        
        if (typeof obj[key] === 'string') {
          sanitized[sanitizedKey] = this.sanitizeString(obj[key]);
        } else if (Array.isArray(obj[key])) {
          sanitized[sanitizedKey] = obj[key].map(item =>
            typeof item === 'string' ? this.sanitizeString(item) : item
          );
        } else {
          sanitized[sanitizedKey] = obj[key];
        }
      }
    }
    
    return sanitized;
  }

  private detectMaliciousPatterns(req: Request): void {
    const dataToCheck = JSON.stringify({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    // Check for SQL injection
    for (const pattern of this.sqlInjectionPatterns) {
      if (pattern.test(dataToCheck)) {
        this.logger.warn('SQL injection attempt detected', {
          requestId: req['requestId'],
          ip: req.ip,
          pattern: pattern.toString(),
        });
        
        throw new BadRequestException({
          message: 'Invalid characters detected',
          error: 'MALICIOUS_PATTERN_DETECTED',
        });
      }
    }

    // Check for XSS
    for (const pattern of this.xssPatterns) {
      if (pattern.test(dataToCheck)) {
        this.logger.warn('XSS attempt detected', {
          requestId: req['requestId'],
          ip: req.ip,
          pattern: pattern.toString(),
        });
        
        throw new BadRequestException({
          message: 'Invalid content detected',
          error: 'MALICIOUS_PATTERN_DETECTED',
        });
      }
    }

    // Check for path traversal
    for (const pattern of this.pathTraversalPatterns) {
      if (pattern.test(dataToCheck)) {
        this.logger.warn('Path traversal attempt detected', {
          requestId: req['requestId'],
          ip: req.ip,
        });
        
        throw new BadRequestException({
          message: 'Invalid path pattern',
          error: 'MALICIOUS_PATTERN_DETECTED',
        });
      }
    }
  }

  private validateFieldLengths(data: any, errors: ValidationError[]): void {
    const fieldLimits = {
      name: 255,
      description: 1000,
      title: 255,
      content: 10000,
      email: 320,
      phone: 20,
      url: 2048,
    };

    for (const field in fieldLimits) {
      if (data[field] && typeof data[field] === 'string') {
        if (data[field].length > fieldLimits[field]) {
          errors.push({
            field,
            value: data[field].substring(0, 50) + '...',
            message: `Field exceeds maximum length of ${fieldLimits[field]}`,
            code: 'FIELD_TOO_LONG',
          });
        }
      }
    }
  }

  private validateFieldFormats(data: any, errors: ValidationError[]): void {
    // Email validation
    if (data.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        errors.push({
          field: 'email',
          value: data.email,
          message: 'Invalid email format',
          code: 'INVALID_EMAIL',
        });
      }
    }

    // URL validation
    if (data.url || data.website) {
      const urlField = data.url ? 'url' : 'website';
      try {
        new URL(data[urlField]);
      } catch {
        errors.push({
          field: urlField,
          value: data[urlField],
          message: 'Invalid URL format',
          code: 'INVALID_URL',
        });
      }
    }

    // Phone validation
    if (data.phone) {
      const phoneRegex = /^[\d\s\-\+\(\)]+$/;
      if (!phoneRegex.test(data.phone)) {
        errors.push({
          field: 'phone',
          value: data.phone,
          message: 'Invalid phone number format',
          code: 'INVALID_PHONE',
        });
      }
    }
  }

  private checkProhibitedFields(data: any, errors: ValidationError[]): void {
    const prohibited = [
      '__proto__',
      'constructor',
      'prototype',
      '$where',
      'mapReduce',
      '$regex',
    ];

    const checkObject = (obj: any, path = ''): void => {
      for (const key in obj) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (prohibited.includes(key)) {
          errors.push({
            field: currentPath,
            value: key,
            message: 'Prohibited field name',
            code: 'PROHIBITED_FIELD',
          });
        }

        if (typeof obj[key] === 'object' && obj[key] !== null) {
          checkObject(obj[key], currentPath);
        }
      }
    };

    checkObject(data);
  }

  private validateDateRange(startDate: string, endDate: string): void {
    if (startDate) {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) {
        throw new BadRequestException({
          message: 'Invalid start date format',
          error: 'INVALID_DATE',
          field: 'startDate',
        });
      }
      
      // Don't allow dates too far in the past
      const minDate = new Date();
      minDate.setFullYear(minDate.getFullYear() - 10);
      if (start < minDate) {
        throw new BadRequestException({
          message: 'Start date too far in the past',
          error: 'INVALID_DATE_RANGE',
          field: 'startDate',
        });
      }
    }

    if (endDate) {
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        throw new BadRequestException({
          message: 'Invalid end date format',
          error: 'INVALID_DATE',
          field: 'endDate',
        });
      }
      
      // Don't allow dates too far in the future
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() + 5);
      if (end > maxDate) {
        throw new BadRequestException({
          message: 'End date too far in the future',
          error: 'INVALID_DATE_RANGE',
          field: 'endDate',
        });
      }
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (start > end) {
        throw new BadRequestException({
          message: 'Start date must be before end date',
          error: 'INVALID_DATE_RANGE',
        });
      }
      
      // Maximum range of 1 year
      const maxRange = 365 * 24 * 60 * 60 * 1000;
      if (end.getTime() - start.getTime() > maxRange) {
        throw new BadRequestException({
          message: 'Date range exceeds maximum of 1 year',
          error: 'DATE_RANGE_TOO_LARGE',
        });
      }
    }
  }

  private addSecurityHeaders(res: Response): void {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // Remove sensitive headers
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');
  }
}