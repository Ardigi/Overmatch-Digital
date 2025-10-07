import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SanitizationUtil } from '../../../shared/utils/sanitization.util';

@Injectable()
export class EventSanitizationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // For Kafka events, we need to sanitize the incoming event data
    const data = context.switchToRpc().getData();

    if (data && data.value) {
      try {
        const event = JSON.parse(data.value.toString());

        // Sanitize event metadata
        if (event.metadata) {
          event.metadata = this.sanitizeEventMetadata(event.metadata);
        }

        // Update the data with sanitized event
        data.value = Buffer.from(JSON.stringify(event));
      } catch (error) {
        // If parsing fails, let the handler deal with it
      }
    }

    return next.handle();
  }

  private sanitizeEventMetadata(metadata: any): any {
    if (!metadata) return metadata;

    const sanitized: any = {};

    for (const [key, value] of Object.entries(metadata)) {
      const sanitizedKey = SanitizationUtil.sanitizeText(key);

      if (typeof value === 'string') {
        // Special handling for different metadata fields
        if (key === 'reason' || key === 'description' || key === 'comment') {
          sanitized[sanitizedKey] = SanitizationUtil.sanitizeHtml(value, true);
        } else if (key === 'email') {
          sanitized[sanitizedKey] = SanitizationUtil.sanitizeEmail(value);
        } else if (key === 'url' || key === 'webhook') {
          sanitized[sanitizedKey] = SanitizationUtil.sanitizeUrl(value);
        } else {
          sanitized[sanitizedKey] = SanitizationUtil.sanitizeText(value);
        }
      } else if (Array.isArray(value)) {
        sanitized[sanitizedKey] = value.map((item) =>
          typeof item === 'string' ? SanitizationUtil.sanitizeText(item) : item
        );
      } else if (value && typeof value === 'object') {
        sanitized[sanitizedKey] = this.sanitizeEventMetadata(value);
      } else {
        sanitized[sanitizedKey] = value;
      }
    }

    return sanitized;
  }
}
