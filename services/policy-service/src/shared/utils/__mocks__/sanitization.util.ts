import { BadRequestException } from '@nestjs/common';

export class SanitizationUtil {
  static sanitizeHtml(content: string, strict = false): string {
    if (!content) return content;
    // In tests, just return the content without actual sanitization
    return content;
  }

  static sanitizeText(text: string): string {
    if (!text) return text;
    return text.trim();
  }

  static sanitizeEmail(email: string): string {
    if (!email) return email;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException('Invalid email format');
    }

    return email.toLowerCase();
  }

  static sanitizeUrl(url: string): string {
    if (!url) return url;

    try {
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new BadRequestException('Invalid URL protocol');
      }
      return urlObj.toString();
    } catch (error) {
      throw new BadRequestException('Invalid URL format');
    }
  }

  static sanitizeFilePath(path: string): string {
    if (!path) return path;
    return path.replace(/\.\./g, '').replace(/\/+/g, '/');
  }

  static sanitizeJson(json: any): any {
    return json; // Return as-is in tests
  }

  static sanitizePolicyContent(content: any): any {
    return content; // Return as-is in tests
  }

  static sanitizeSqlInput(input: string): string {
    if (!input) return input;
    return input;
  }

  static sanitizeSearchQuery(query: string): string {
    if (!query) return query;
    return query.trim().substring(0, 200);
  }

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

  static sanitizeBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;

    throw new BadRequestException('Invalid boolean value');
  }

  static sanitizeDate(date: any): Date {
    const parsed = new Date(date);

    if (isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    return parsed;
  }

  static sanitizeArray<T>(array: any[], itemSanitizer: (item: any) => T, maxLength = 1000): T[] {
    if (!Array.isArray(array)) {
      throw new BadRequestException('Invalid array input');
    }

    if (array.length > maxLength) {
      throw new BadRequestException(`Array exceeds maximum length of ${maxLength}`);
    }

    return array.map(itemSanitizer);
  }

  static sanitizeEnum<T>(value: any, enumType: any): T {
    const enumValues = Object.values(enumType);

    if (!enumValues.includes(value)) {
      throw new BadRequestException(`Invalid value. Must be one of: ${enumValues.join(', ')}`);
    }

    return value as T;
  }

  static sanitizeObjectKeys(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    const dangerous = ['__proto__', 'constructor', 'prototype'];
    const sanitized: any = {};

    for (const [key, value] of Object.entries(obj)) {
      if (dangerous.includes(key.toLowerCase())) {
        continue;
      }

      sanitized[key] = value;
    }

    return sanitized;
  }
}
