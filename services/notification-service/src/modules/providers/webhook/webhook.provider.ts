import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { firstValueFrom } from 'rxjs';
import {
  DeliveryStatus,
  type NotificationProvider,
  type SendResult,
} from '../interfaces/notification-provider.interface';

interface WebhookConfig {
  defaultUrl?: string;
  defaultHeaders?: Record<string, string>;
  defaultMethod?: string;
  timeout?: number;
  retryAttempts?: number;
  signatureSecret?: string;
  signatureHeader?: string;
}

interface WebhookPayload {
  to: string;
  subject: string;
  content: string;
  metadata?: Record<string, any>;
  timestamp: string;
  messageId: string;
}

@Injectable()
export class WebhookProvider implements NotificationProvider {
  private readonly logger = new Logger(WebhookProvider.name);
  private config: WebhookConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService
  ) {
    this.config = {
      defaultUrl: this.configService.get('WEBHOOK_DEFAULT_URL'),
      defaultHeaders: this.parseHeaders(this.configService.get('WEBHOOK_DEFAULT_HEADERS', '')),
      defaultMethod: this.configService.get('WEBHOOK_DEFAULT_METHOD', 'POST'),
      timeout: this.configService.get('WEBHOOK_TIMEOUT', 30000),
      retryAttempts: this.configService.get('WEBHOOK_RETRY_ATTEMPTS', 3),
      signatureSecret: this.configService.get('WEBHOOK_SIGNATURE_SECRET'),
      signatureHeader: this.configService.get('WEBHOOK_SIGNATURE_HEADER', 'X-Webhook-Signature'),
    };
  }

  async send(to: string, subject: string, content: string, options?: any): Promise<SendResult> {
    const messageId = `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Determine webhook URL
      const url = options?.url || this.config.defaultUrl;
      if (!url) {
        throw new Error('Webhook URL not provided and no default URL configured');
      }

      // Build payload
      const payload: WebhookPayload = {
        to,
        subject,
        content,
        metadata: options?.metadata || {},
        timestamp: new Date().toISOString(),
        messageId,
      };

      // Merge custom payload if provided
      const finalPayload = options?.customPayload
        ? { ...payload, ...options.customPayload }
        : payload;

      // Build headers
      const headers = {
        'Content-Type': 'application/json',
        ...this.config.defaultHeaders,
        ...(options?.headers || {}),
      };

      // Add signature if configured
      if (this.config.signatureSecret) {
        const signature = this.generateSignature(finalPayload);
        headers[this.config.signatureHeader!] = signature;
      }

      // Determine HTTP method
      const method = (options?.method || this.config.defaultMethod || 'POST').toUpperCase();

      // Send webhook
      const response = await this.sendWithRetry(
        url,
        method,
        finalPayload,
        headers,
        this.config.retryAttempts || 3
      );

      this.logger.log(`Webhook sent successfully to ${url}: ${messageId}`);

      return {
        success: true,
        providerMessageId: messageId,
        status: DeliveryStatus.SENT,
        providerResponse: {
          status: response.status,
          data: response.data,
          headers: response.headers,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to send webhook: ${error.message}`, error.stack);
      return {
        success: false,
        providerMessageId: messageId,
        error: error.message,
        status: DeliveryStatus.FAILED,
      };
    }
  }

  async sendBulk(
    recipients: Array<{ to: string; subject: string; content: string; options?: any }>
  ): Promise<SendResult[]> {
    // Check if bulk endpoint is configured
    const bulkUrl = this.configService.get('WEBHOOK_BULK_URL');

    if (bulkUrl && recipients.length > 1) {
      return this.sendBulkWebhook(bulkUrl, recipients);
    }

    // Otherwise, send individually
    return Promise.all(
      recipients.map(({ to, subject, content, options }) =>
        this.send(to, subject, content, options)
      )
    );
  }

  private async sendBulkWebhook(
    url: string,
    recipients: Array<{ to: string; subject: string; content: string; options?: any }>
  ): Promise<SendResult[]> {
    const batchId = `webhook-batch-${Date.now()}`;

    try {
      const payload = {
        batchId,
        timestamp: new Date().toISOString(),
        notifications: recipients.map((r, index) => ({
          messageId: `${batchId}-${index}`,
          to: r.to,
          subject: r.subject,
          content: r.content,
          metadata: r.options?.metadata || {},
        })),
      };

      const headers = {
        'Content-Type': 'application/json',
        ...this.config.defaultHeaders,
      };

      if (this.config.signatureSecret) {
        headers[this.config.signatureHeader!] = this.generateSignature(payload);
      }

      const response = await firstValueFrom(
        this.httpService.post(url, payload, { headers, timeout: this.config.timeout })
      );

      this.logger.log(`Bulk webhook sent successfully to ${url}: ${batchId}`);

      // Map response to individual results
      return recipients.map((_, index) => ({
        success: true,
        providerMessageId: `${batchId}-${index}`,
        status: DeliveryStatus.SENT,
        providerResponse: response.data,
      }));
    } catch (error) {
      this.logger.error(`Failed to send bulk webhook: ${error.message}`);

      // Return failure for all recipients
      return recipients.map((_, index) => ({
        success: false,
        providerMessageId: `${batchId}-${index}`,
        error: error.message,
        status: DeliveryStatus.FAILED,
      }));
    }
  }

  async getStatus(messageId: string): Promise<DeliveryStatus> {
    // Webhook status depends on the endpoint implementation
    const statusUrl = this.configService.get('WEBHOOK_STATUS_URL');

    if (!statusUrl) {
      this.logger.warn(`Webhook status endpoint not configured for ${messageId}`);
      return DeliveryStatus.UNKNOWN;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${statusUrl}/${messageId}`, {
          timeout: this.config.timeout,
        })
      );

      // Map response status to DeliveryStatus
      const statusMapping: Record<string, DeliveryStatus> = {
        sent: DeliveryStatus.SENT,
        delivered: DeliveryStatus.DELIVERED,
        failed: DeliveryStatus.FAILED,
        bounced: DeliveryStatus.BOUNCED,
        pending: DeliveryStatus.PENDING,
      };

      const status = response.data.status || 'delivered';
      return statusMapping[status] || DeliveryStatus.UNKNOWN;
    } catch (error) {
      this.logger.error(`Failed to get webhook status: ${error.message}`);
      return DeliveryStatus.FAILED;
    }
  }

  async handleWebhook(payload: any): Promise<void> {
    // Handle incoming webhooks (delivery confirmations, etc.)
    this.logger.log('Received webhook callback', payload);

    // Emit events based on webhook type
    if (payload.event === 'delivered') {
      this.logger.log(`Message ${payload.messageId} delivered`);
    } else if (payload.event === 'failed') {
      this.logger.error(`Message ${payload.messageId} failed: ${payload.reason}`);
    }
  }

  private async sendWithRetry(
    url: string,
    method: string,
    data: any,
    headers: any,
    retryAttempts: number
  ): Promise<any> {
    let lastError: Error;

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        const config = {
          headers,
          timeout: this.config.timeout,
        };

        let response;
        switch (method) {
          case 'GET':
            response = await firstValueFrom(this.httpService.get(url, config));
            break;
          case 'PUT':
            response = await firstValueFrom(this.httpService.put(url, data, config));
            break;
          case 'PATCH':
            response = await firstValueFrom(this.httpService.patch(url, data, config));
            break;
          case 'DELETE':
            response = await firstValueFrom(this.httpService.delete(url, config));
            break;
          case 'POST':
          default:
            response = await firstValueFrom(this.httpService.post(url, data, config));
            break;
        }

        return response;
      } catch (error) {
        lastError = error;
        this.logger.warn(`Webhook attempt ${attempt}/${retryAttempts} failed: ${error.message}`);

        if (attempt < retryAttempts) {
          // Exponential backoff
          const delay = Math.min(1000 * 2 ** (attempt - 1), 10000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  private generateSignature(payload: any): string {
    if (!this.config.signatureSecret) {
      return '';
    }

    const payloadString = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', this.config.signatureSecret)
      .update(payloadString)
      .digest('hex');

    return `sha256=${signature}`;
  }

  private parseHeaders(headerString: string): Record<string, string> {
    const headers: Record<string, string> = {};

    if (!headerString) {
      return headers;
    }

    // Parse headers in format: "Key1:Value1,Key2:Value2"
    headerString.split(',').forEach((header) => {
      const [key, value] = header.split(':').map((s) => s.trim());
      if (key && value) {
        headers[key] = value;
      }
    });

    return headers;
  }

  isConfigured(): boolean {
    return !!this.config.defaultUrl || !!this.configService.get('WEBHOOK_URL_REQUIRED');
  }

  getName(): string {
    return 'webhook';
  }

  async validateConfig(): Promise<boolean> {
    const testUrl = this.configService.get('WEBHOOK_TEST_URL') || this.config.defaultUrl;

    if (!testUrl) {
      this.logger.warn('No webhook URL configured for validation');
      return false;
    }

    try {
      const testPayload = {
        test: true,
        timestamp: new Date().toISOString(),
        provider: 'webhook',
      };

      const headers = {
        'Content-Type': 'application/json',
        ...this.config.defaultHeaders,
      };

      if (this.config.signatureSecret) {
        headers[this.config.signatureHeader!] = this.generateSignature(testPayload);
      }

      const response = await firstValueFrom(
        this.httpService.post(testUrl, testPayload, {
          headers,
          timeout: 5000,
        })
      );

      return response.status >= 200 && response.status < 300;
    } catch (error) {
      this.logger.error(`Webhook configuration validation failed: ${error.message}`);
      return false;
    }
  }

  getType(): 'webhook' {
    return 'webhook';
  }

  validateRecipient(recipient: any): boolean {
    return typeof recipient === 'string' && recipient.length > 0;
  }

  validateContent(content: any): boolean {
    return content && (content.subject || content.content);
  }

  getConfig(): { provider: string; defaultUrl?: string } {
    return {
      provider: 'webhook',
      defaultUrl: this.config?.defaultUrl,
    };
  }
}
