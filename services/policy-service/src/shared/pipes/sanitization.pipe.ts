import { type ArgumentMetadata, Injectable, type PipeTransform } from '@nestjs/common';
import { SanitizationUtil } from '../utils/sanitization.util';

@Injectable()
export class SanitizationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    // Skip if no value
    if (!value) return value;

    // Handle different types based on metadata
    const { type, metatype } = metadata;

    // For body and query parameters, sanitize recursively
    if (type === 'body' || type === 'query') {
      return this.sanitizeObject(value);
    }

    // For params, sanitize as text
    if (type === 'param') {
      return SanitizationUtil.sanitizeText(value);
    }

    return value;
  }

  private sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
      return SanitizationUtil.sanitizeText(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    if (obj && typeof obj === 'object') {
      const sanitized: any = {};

      for (const [key, value] of Object.entries(obj)) {
        // Skip functions and undefined values
        if (typeof value === 'function' || value === undefined) {
          continue;
        }

        // Sanitize key to prevent prototype pollution
        const sanitizedKey = SanitizationUtil.sanitizeText(key);

        // Skip dangerous keys
        if (['__proto__', 'constructor', 'prototype'].includes(sanitizedKey.toLowerCase())) {
          continue;
        }

        // List of fields that should not be sanitized (UUIDs, IDs, etc.)
        const skipSanitizationFields = [
          'id',
          'userId',
          'organizationId',
          'ownerId',
          'createdBy',
          'updatedBy',
          'delegateOwnerId',
          'frameworkId',
          'controlId',
          'policyId',
          'templateId',
          'clientId',
          'evidenceId',
          'riskId',
          'assessmentId',
        ];

        // Don't sanitize UUID fields or date fields
        if (skipSanitizationFields.includes(key) || key.endsWith('Id') || key.endsWith('Date')) {
          sanitized[sanitizedKey] = value;
        } else {
          // Recursively sanitize value
          sanitized[sanitizedKey] = this.sanitizeObject(value);
        }
      }

      return sanitized;
    }

    return obj;
  }
}

@Injectable()
export class HtmlSanitizationPipe implements PipeTransform {
  constructor(private readonly strict = false) {}

  transform(value: any, metadata: ArgumentMetadata) {
    if (!value) return value;

    if (typeof value === 'string') {
      return SanitizationUtil.sanitizeHtml(value, this.strict);
    }

    if (value && typeof value === 'object') {
      return this.sanitizeObjectHtml(value);
    }

    return value;
  }

  private sanitizeObjectHtml(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObjectHtml(item));
    }

    const sanitized: any = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = SanitizationUtil.sanitizeHtml(value, this.strict);
      } else if (value && typeof value === 'object') {
        sanitized[key] = this.sanitizeObjectHtml(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

@Injectable()
export class PolicyContentSanitizationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (!value) return value;

    // Specifically handle policy content structure
    if (value.content) {
      value.content = SanitizationUtil.sanitizePolicyContent(value.content);
    }

    // Sanitize other text fields
    if (value.title) {
      value.title = SanitizationUtil.sanitizeText(value.title);
    }

    if (value.description) {
      value.description = SanitizationUtil.sanitizeHtml(value.description);
    }

    if (value.summary) {
      value.summary = SanitizationUtil.sanitizeHtml(value.summary);
    }

    if (value.tags && Array.isArray(value.tags)) {
      value.tags = value.tags.map((tag) => SanitizationUtil.sanitizeText(tag));
    }

    if (value.keywords && Array.isArray(value.keywords)) {
      value.keywords = value.keywords.map((kw) => SanitizationUtil.sanitizeText(kw));
    }

    if (value.metadata) {
      value.metadata = SanitizationUtil.sanitizeJson(value.metadata);
    }

    return value;
  }
}
