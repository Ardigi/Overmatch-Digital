import {
  Injectable,
  NestMiddleware,
  BadRequestException,
  Logger,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { validate as uuidValidate } from 'uuid';
import * as sanitizeHtml from 'sanitize-html';
import { createHash } from 'crypto';
import * as fileType from 'file-type';
import * as path from 'path';

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

export interface FileValidationResult {
  isValid: boolean;
  mimeType?: string;
  extension?: string;
  size?: number;
  checksum?: string;
  errors?: string[];
}

@Injectable()
export class EnterpriseValidationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(EnterpriseValidationMiddleware.name);
  private readonly requestCache = new Map<string, { count: number; resetTime: number }>();
  private readonly uploadCache = new Map<string, { size: number; timestamp: number }>();
  
  // File upload limits
  private readonly MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly MAX_TOTAL_UPLOAD_SIZE = 500 * 1024 * 1024; // 500MB per user per hour
  private readonly UPLOAD_WINDOW_MS = 3600000; // 1 hour
  
  // Allowed file types for evidence
  private readonly ALLOWED_FILE_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed',
    'video/mp4',
    'video/mpeg',
    'audio/mpeg',
    'audio/wav',
  ];

  private readonly ALLOWED_EXTENSIONS = [
    '.pdf', '.jpg', '.jpeg', '.png', '.gif',
    '.doc', '.docx', '.xls', '.xlsx',
    '.txt', '.csv', '.zip',
    '.mp4', '.mpeg', '.mp3', '.wav',
  ];
  
  // SQL injection patterns
  private readonly sqlInjectionPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|EXECUTE|SCRIPT|JAVASCRIPT)\b)/gi,
    /(--|\/\*|\*\/|xp_|sp_|0x)/gi,
    /(\bOR\b\s*\d+\s*=\s*\d+)/gi,
    /(\bAND\b\s*\d+\s*=\s*\d+)/gi,
    /(['\"])\s*OR\s*\1\s*=\s*\1/gi,
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

  // Malware signatures (basic)
  private readonly malwareSignatures = [
    /EICAR-STANDARD-ANTIVIRUS-TEST-FILE/,
    /\x4D\x5A/, // PE header
    /\x7F\x45\x4C\x46/, // ELF header
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

      // 3. Check upload rate limiting
      if (this.isUploadRequest(req) && !this.checkUploadRateLimit(req)) {
        throw new PayloadTooLargeException({
          message: 'Upload quota exceeded',
          error: 'UPLOAD_QUOTA_EXCEEDED',
        });
      }

      // 4. Validate content type
      this.validateContentType(req);

      // 5. Validate request size
      this.validateRequestSize(req);

      // 6. Sanitize and validate headers
      this.sanitizeHeaders(req);

      // 7. Validate and sanitize URL parameters
      if (req.params) {
        req.params = this.sanitizeObject(req.params);
        this.validateUrlParameters(req.params);
      }

      // 8. Validate and sanitize query parameters
      if (req.query) {
        req.query = this.sanitizeObject(req.query);
        this.validateQueryParameters(req.query);
      }

      // 9. Validate and sanitize request body
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

      // 10. Validate file uploads if present
      if (req.files || req.file) {
        this.validateFileUploads(req);
      }

      // 11. Check for malicious patterns
      this.detectMaliciousPatterns(req);

      // 12. Add security headers
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
      
      if (error instanceof BadRequestException || error instanceof PayloadTooLargeException) {
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

  private checkUploadRateLimit(req: Request): boolean {
    const userId = req['user']?.id || req.ip;
    const key = `upload:${userId}`;
    const now = Date.now();
    
    const record = this.uploadCache.get(key);
    
    if (!record || record.timestamp < now - this.UPLOAD_WINDOW_MS) {
      this.uploadCache.set(key, {
        size: 0,
        timestamp: now,
      });
      return true;
    }

    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    
    if (record.size + contentLength > this.MAX_TOTAL_UPLOAD_SIZE) {
      return false;
    }

    record.size += contentLength;
    return true;
  }

  private isUploadRequest(req: Request): boolean {
    const contentType = req.headers['content-type'] || '';
    return contentType.includes('multipart/form-data') ||
           req.path.includes('/upload') ||
           req.path.includes('/evidence');
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
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    
    if (contentLength > this.MAX_FILE_SIZE) {
      throw new PayloadTooLargeException({
        message: `Request payload too large (max ${this.MAX_FILE_SIZE} bytes)`,
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
    const uuidParams = ['id', 'userId', 'organizationId', 'evidenceId', 'controlId', 'documentId'];
    
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
      const validStatuses = ['pending', 'collected', 'verified', 'approved', 'rejected', 'expired'];
      if (!validStatuses.includes(params.status)) {
        throw new BadRequestException({
          message: 'Invalid status value',
          error: 'INVALID_ENUM',
          field: 'status',
        });
      }
    }

    if (params.type) {
      const validTypes = ['document', 'screenshot', 'log', 'report', 'certificate', 'audit', 'scan'];
      if (!validTypes.includes(params.type)) {
        throw new BadRequestException({
          message: 'Invalid evidence type',
          error: 'INVALID_ENUM',
          field: 'type',
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
        'collectedAt',
        'verifiedAt',
        'expiresAt',
        'name',
        'status',
        'type',
        'size',
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

    // Validate evidence-specific filters
    if (query.controlIds) {
      const controlIds = Array.isArray(query.controlIds) ? query.controlIds : [query.controlIds];
      controlIds.forEach((id: string) => {
        if (!uuidValidate(id)) {
          throw new BadRequestException({
            message: 'Invalid control ID in filter',
            error: 'INVALID_UUID',
            field: 'controlIds',
          });
        }
      });
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

    // Evidence-specific validations
    this.validateEvidenceFields(sanitized, errors);

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: sanitized,
    };
  }

  private validateEvidenceFields(data: any, errors: ValidationError[]): void {
    // Validate evidence expiration date
    if (data.expiresAt) {
      const expiresAt = new Date(data.expiresAt);
      const now = new Date();
      
      if (expiresAt <= now) {
        errors.push({
          field: 'expiresAt',
          value: data.expiresAt,
          message: 'Expiration date must be in the future',
          code: 'INVALID_EXPIRATION',
        });
      }
      
      // Maximum 5 years in the future
      const maxExpiration = new Date();
      maxExpiration.setFullYear(maxExpiration.getFullYear() + 5);
      
      if (expiresAt > maxExpiration) {
        errors.push({
          field: 'expiresAt',
          value: data.expiresAt,
          message: 'Expiration date too far in the future (max 5 years)',
          code: 'EXPIRATION_TOO_FAR',
        });
      }
    }

    // Validate evidence metadata
    if (data.metadata) {
      if (typeof data.metadata !== 'object') {
        errors.push({
          field: 'metadata',
          value: data.metadata,
          message: 'Metadata must be an object',
          code: 'INVALID_METADATA',
        });
      } else {
        const metadataStr = JSON.stringify(data.metadata);
        if (metadataStr.length > 10000) {
          errors.push({
            field: 'metadata',
            value: 'metadata object',
            message: 'Metadata too large (max 10KB)',
            code: 'METADATA_TOO_LARGE',
          });
        }
      }
    }

    // Validate tags
    if (data.tags) {
      if (!Array.isArray(data.tags)) {
        errors.push({
          field: 'tags',
          value: data.tags,
          message: 'Tags must be an array',
          code: 'INVALID_TAGS',
        });
      } else if (data.tags.length > 20) {
        errors.push({
          field: 'tags',
          value: data.tags,
          message: 'Too many tags (max 20)',
          code: 'TOO_MANY_TAGS',
        });
      } else {
        data.tags.forEach((tag: any, index: number) => {
          if (typeof tag !== 'string' || tag.length > 50) {
            errors.push({
              field: `tags[${index}]`,
              value: tag,
              message: 'Invalid tag format or length (max 50 chars)',
              code: 'INVALID_TAG',
            });
          }
        });
      }
    }
  }

  private validateFileUploads(req: Request): void {
    const files = req.files || (req.file ? [req.file] : []);
    
    if (!Array.isArray(files)) {
      throw new BadRequestException({
        message: 'Invalid file upload format',
        error: 'INVALID_FILE_UPLOAD',
      });
    }

    files.forEach((file: any) => {
      const validation = this.validateFile(file);
      
      if (!validation.isValid) {
        throw new BadRequestException({
          message: 'File validation failed',
          error: 'INVALID_FILE',
          details: validation.errors,
        });
      }

      // Add validation metadata to file object
      file.validatedMimeType = validation.mimeType;
      file.checksum = validation.checksum;
    });
  }

  private validateFile(file: any): FileValidationResult {
    const errors: string[] = [];
    const result: FileValidationResult = {
      isValid: true,
      size: file.size,
    };

    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      errors.push(`File too large (max ${this.MAX_FILE_SIZE / (1024 * 1024)}MB)`);
      result.isValid = false;
    }

    // Validate file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!this.ALLOWED_EXTENSIONS.includes(ext)) {
      errors.push(`File extension not allowed: ${ext}`);
      result.isValid = false;
    }
    result.extension = ext;

    // Validate MIME type
    if (file.mimetype && !this.ALLOWED_FILE_TYPES.includes(file.mimetype)) {
      errors.push(`File type not allowed: ${file.mimetype}`);
      result.isValid = false;
    }
    result.mimeType = file.mimetype;

    // Check for malware signatures (basic)
    if (file.buffer) {
      const bufferStr = file.buffer.toString('hex');
      for (const signature of this.malwareSignatures) {
        if (signature.test(bufferStr)) {
          errors.push('Potential malware detected');
          result.isValid = false;
          break;
        }
      }

      // Calculate checksum
      const hash = createHash('sha256');
      hash.update(file.buffer);
      result.checksum = hash.digest('hex');
    }

    // Validate filename
    if (this.pathTraversalPatterns.some(pattern => pattern.test(file.originalname))) {
      errors.push('Invalid filename - potential path traversal');
      result.isValid = false;
    }

    result.errors = errors;
    return result;
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
      notes: 5000,
      reference: 100,
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
    if (data.url || data.website || data.sourceUrl) {
      const urlField = data.url ? 'url' : data.website ? 'website' : 'sourceUrl';
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

    // Hash validation (for checksums)
    if (data.checksum || data.hash) {
      const hashField = data.checksum ? 'checksum' : 'hash';
      const hashRegex = /^[a-f0-9]{64}$/i; // SHA-256
      if (!hashRegex.test(data[hashField])) {
        errors.push({
          field: hashField,
          value: data[hashField],
          message: 'Invalid hash format (expected SHA-256)',
          code: 'INVALID_HASH',
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
      'system',
      'admin',
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