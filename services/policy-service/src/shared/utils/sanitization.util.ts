import { BadRequestException } from '@nestjs/common';
import DOMPurify from 'isomorphic-dompurify';
import sanitizeHtml from 'sanitize-html';

export class SanitizationUtil {
  /**
   * Default options for HTML sanitization
   */
  private static readonly DEFAULT_HTML_OPTIONS = {
    allowedTags: [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'br',
      'strong',
      'em',
      'u',
      's',
      'blockquote',
      'ul',
      'ol',
      'li',
      'a',
      'code',
      'pre',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target'],
      '*': ['class', 'id'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      a: ['http', 'https', 'mailto'],
    },
    transformTags: {
      a: (tagName, attribs) => {
        // Add rel="noopener noreferrer" to external links
        if (attribs.target === '_blank') {
          attribs.rel = 'noopener noreferrer';
        }
        return { tagName, attribs };
      },
    },
  };

  /**
   * Strict options for critical fields (removes all HTML)
   */
  private static readonly STRICT_OPTIONS = {
    allowedTags: [],
    allowedAttributes: {},
  };

  /**
   * Sanitize HTML content with configurable strictness
   */
  static sanitizeHtml(content: string, strict = false): string {
    if (!content) return content;

    const options = strict
      ? SanitizationUtil.STRICT_OPTIONS
      : SanitizationUtil.DEFAULT_HTML_OPTIONS;

    // First pass with sanitize-html
    let sanitized = sanitizeHtml(content, options);

    // Second pass with DOMPurify for additional security
    sanitized = DOMPurify.sanitize(sanitized, {
      ALLOWED_TAGS: options.allowedTags as string[],
      ALLOWED_ATTR: Object.keys(options.allowedAttributes || {}),
    });

    return sanitized;
  }

  /**
   * Sanitize plain text input (removes all HTML/scripts)
   */
  static sanitizeText(text: string): string {
    if (!text) return text;

    // Remove all HTML tags and entities
    return SanitizationUtil.sanitizeHtml(text, true)
      .replace(/&[a-zA-Z0-9#]+;/g, '') // Remove HTML entities
      .trim();
  }

  /**
   * Sanitize and validate email
   */
  static sanitizeEmail(email: string): string {
    if (!email) return email;

    const sanitized = SanitizationUtil.sanitizeText(email).toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(sanitized)) {
      throw new BadRequestException('Invalid email format');
    }

    return sanitized;
  }

  /**
   * Sanitize and validate URL
   */
  static sanitizeUrl(url: string): string {
    if (!url) return url;

    const sanitized = SanitizationUtil.sanitizeText(url);

    try {
      const urlObj = new URL(sanitized);

      // Only allow http(s) protocols
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new BadRequestException('Invalid URL protocol');
      }

      return urlObj.toString();
    } catch (error) {
      throw new BadRequestException('Invalid URL format');
    }
  }

  /**
   * Sanitize file paths (prevent directory traversal)
   */
  static sanitizeFilePath(path: string): string {
    if (!path) return path;

    // Remove any directory traversal attempts
    const sanitized = path
      .replace(/\.\./g, '')
      .replace(/[<>:"|?*]/g, '') // Remove invalid characters
      .replace(/\\/g, '/') // Normalize path separators
      .replace(/\/+/g, '/'); // Remove duplicate slashes

    // Ensure path doesn't start with /
    return sanitized.replace(/^\//, '');
  }

  /**
   * Sanitize JSON input
   */
  static sanitizeJson<T = unknown>(json: T): T {
    if (typeof json === 'string') {
      return SanitizationUtil.sanitizeText(json) as T;
    }

    if (Array.isArray(json)) {
      return json.map((item) => SanitizationUtil.sanitizeJson(item)) as T;
    }

    if (json && typeof json === 'object') {
      const sanitized: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(json)) {
        // Sanitize the key
        const sanitizedKey = SanitizationUtil.sanitizeText(key);

        // Recursively sanitize the value
        sanitized[sanitizedKey] = SanitizationUtil.sanitizeJson(value);
      }

      return sanitized as T;
    }

    return json;
  }

  /**
   * Sanitize policy-specific content
   */
  static sanitizePolicyContent<T extends Record<string, unknown>>(content: T): T {
    if (!content) return content;

    const sanitized: any = { ...content };

    // Sanitize sections
    if (content.sections && Array.isArray(content.sections)) {
      sanitized.sections = (content.sections as any[]).map((section) => {
        if (typeof section !== 'object' || section === null) {
          return section;
        }
        
        const sectionObj = section as Record<string, unknown>;
        const sanitizedSection = { ...sectionObj };
        
        if (typeof sectionObj.title === 'string') {
          sanitizedSection.title = SanitizationUtil.sanitizeText(sectionObj.title);
        }
        
        if (typeof sectionObj.content === 'string') {
          sanitizedSection.content = SanitizationUtil.sanitizeHtml(sectionObj.content);
        }
        
        if (sectionObj.subsections && Array.isArray(sectionObj.subsections)) {
          sanitizedSection.subsections = sectionObj.subsections.map((sub) => {
            if (typeof sub !== 'object' || sub === null) {
              return sub;
            }
            
            const subObj = sub as Record<string, unknown>;
            const sanitizedSub = { ...subObj };
            
            if (typeof subObj.title === 'string') {
              sanitizedSub.title = SanitizationUtil.sanitizeText(subObj.title);
            }
            
            if (typeof subObj.content === 'string') {
              sanitizedSub.content = SanitizationUtil.sanitizeHtml(subObj.content);
            }
            
            return sanitizedSub;
          });
        }
        
        return sanitizedSection;
      });
    }

    // Sanitize metadata
    if (content.metadata) {
      sanitized.metadata = SanitizationUtil.sanitizeJson(content.metadata);
    }

    // Sanitize tags
    if (content.tags && Array.isArray(content.tags)) {
      sanitized.tags = (content.tags as any[]).map((tag) => {
        if (typeof tag === 'string') {
          return SanitizationUtil.sanitizeText(tag);
        }
        return tag;
      });
    }

    return sanitized as T;
  }

  /**
   * Validate and sanitize SQL-like input (prevent SQL injection)
   */
  static sanitizeSqlInput(input: string): string {
    if (!input) return input;

    // Remove common SQL injection patterns
    const dangerous =
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script|javascript|vbscript)\b)|(['";\\])/gi;

    if (dangerous.test(input)) {
      throw new BadRequestException('Invalid input detected');
    }

    return SanitizationUtil.sanitizeText(input);
  }

  /**
   * Sanitize search queries
   */
  static sanitizeSearchQuery(query: string): string {
    if (!query) return query;

    // Remove special characters that could break search
    return query
      .replace(/[<>'"]/g, '') // Remove potential XSS characters
      .replace(/[*?]/g, '') // Remove wildcards if not allowed
      .trim()
      .substring(0, 200); // Limit query length
  }

  /**
   * Sanitize numeric input
   */
  static sanitizeNumber(value: any, min?: number, max?: number): number {
    const num = Number(value);

    if (isNaN(num)) {
      throw new BadRequestException('Invalid numeric value');
    }

    if (min !== undefined && num < min) {
      throw new BadRequestException(`Value must be at least ${min}`);
    }

    if (max !== undefined && num > max) {
      throw new BadRequestException(`Value must be at most ${max}`);
    }

    return num;
  }

  /**
   * Sanitize boolean input
   */
  static sanitizeBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;

    throw new BadRequestException('Invalid boolean value');
  }

  /**
   * Sanitize date input
   */
  static sanitizeDate(date: any): Date {
    const parsed = new Date(date);

    if (isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    // Prevent dates too far in the past or future
    const now = new Date();
    const maxFuture = new Date(now.getFullYear() + 100, 0, 1);
    const maxPast = new Date(1900, 0, 1);

    if (parsed > maxFuture || parsed < maxPast) {
      throw new BadRequestException('Date out of acceptable range');
    }

    return parsed;
  }

  /**
   * Sanitize array input
   */
  static sanitizeArray<T>(array: any[], itemSanitizer: (item: any) => T, maxLength = 1000): T[] {
    if (!Array.isArray(array)) {
      throw new BadRequestException('Invalid array input');
    }

    if (array.length > maxLength) {
      throw new BadRequestException(`Array exceeds maximum length of ${maxLength}`);
    }

    return array.map(itemSanitizer);
  }

  /**
   * Sanitize enum value
   */
  static sanitizeEnum<T>(value: any, enumType: any): T {
    const enumValues = Object.values(enumType);

    if (!enumValues.includes(value)) {
      throw new BadRequestException(`Invalid value. Must be one of: ${enumValues.join(', ')}`);
    }

    return value as T;
  }

  /**
   * Sanitize object keys (prevent prototype pollution)
   */
  static sanitizeObjectKeys(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    const dangerous = ['__proto__', 'constructor', 'prototype'];
    const sanitized: any = {};

    for (const [key, value] of Object.entries(obj)) {
      if (dangerous.includes(key.toLowerCase())) {
        continue; // Skip dangerous keys
      }

      sanitized[SanitizationUtil.sanitizeText(key)] = value;
    }

    return sanitized;
  }
}
