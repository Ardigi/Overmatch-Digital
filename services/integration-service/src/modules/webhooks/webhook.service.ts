import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import axios, { AxiosResponse } from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookLog } from './entities/webhook-log.entity';

export interface WebhookConfig {
  url: string;
  secret?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  retryPolicy?: {
    maxAttempts: number;
    backoffMultiplier: number;
    initialDelay: number;
  };
  timeout?: number;
}

export interface WebhookPayload {
  event: string;
  data: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface WebhookResponse {
  success: boolean;
  statusCode?: number;
  body?: any;
  error?: string;
  retryCount?: number;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly defaultTimeout = 30000; // 30 seconds
  private readonly defaultRetryPolicy = {
    maxAttempts: 3,
    backoffMultiplier: 2,
    initialDelay: 1000,
  };

  constructor(
    private configService: ConfigService,
    @InjectRepository(WebhookLog)
    private webhookLogRepository: Repository<WebhookLog>,
  ) {}

  async sendWebhook(
    config: WebhookConfig,
    payload: WebhookPayload,
    retryCount = 0,
  ): Promise<WebhookResponse> {
    const startTime = Date.now();
    const method = config.method || 'POST';
    const timeout = config.timeout || this.defaultTimeout;
    const retryPolicy = config.retryPolicy || this.defaultRetryPolicy;

    try {
      // Generate signature if secret is provided
      const signature = config.secret ? this.generateSignature(payload, config.secret) : undefined;

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': payload.event,
        'X-Webhook-Timestamp': payload.timestamp.toISOString(),
        ...config.headers,
      };

      if (signature) {
        headers['X-Webhook-Signature'] = signature;
      }

      // Send request
      const response: AxiosResponse = await axios({
        method,
        url: config.url,
        data: payload,
        headers,
        timeout,
        validateStatus: () => true, // Don't throw on non-2xx status
      });

      const responseTime = Date.now() - startTime;

      // Log webhook
      await this.logWebhook({
        url: config.url,
        method,
        payload,
        statusCode: response.status,
        responseBody: response.data,
        responseTime,
        success: response.status >= 200 && response.status < 300,
        retryCount,
      });

      if (response.status >= 200 && response.status < 300) {
        return {
          success: true,
          statusCode: response.status,
          body: response.data,
          retryCount,
        };
      }

      // Handle non-2xx responses with retry
      if (retryCount < retryPolicy.maxAttempts) {
        const delay = retryPolicy.initialDelay * Math.pow(retryPolicy.backoffMultiplier, retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        this.logger.warn(`Webhook failed with status ${response.status}, retrying...`);
        return this.sendWebhook(config, payload, retryCount + 1);
      }

      return {
        success: false,
        statusCode: response.status,
        body: response.data,
        error: `HTTP ${response.status}: ${response.statusText}`,
        retryCount,
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Log failed webhook
      await this.logWebhook({
        url: config.url,
        method,
        payload,
        error: error.message,
        responseTime,
        success: false,
        retryCount,
      });

      if (retryCount < retryPolicy.maxAttempts) {
        const delay = retryPolicy.initialDelay * Math.pow(retryPolicy.backoffMultiplier, retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        this.logger.warn(`Webhook failed with error: ${error.message}, retrying...`);
        return this.sendWebhook(config, payload, retryCount + 1);
      }

      this.logger.error(`Webhook failed after ${retryCount} attempts`, error);
      
      return {
        success: false,
        error: error.message,
        retryCount,
      };
    }
  }

  async verifySignature(
    payload: any,
    signature: string,
    secret: string,
  ): Promise<boolean> {
    try {
      const expectedSignature = this.generateSignature(payload, secret);
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      this.logger.error('Error verifying webhook signature', error);
      return false;
    }
  }

  private generateSignature(payload: any, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return `sha256=${hmac.digest('hex')}`;
  }

  private async logWebhook(data: {
    url: string;
    method: string;
    payload: any;
    statusCode?: number;
    responseBody?: any;
    error?: string;
    responseTime: number;
    success: boolean;
    retryCount: number;
  }): Promise<void> {
    try {
      const log = this.webhookLogRepository.create({
        url: data.url,
        method: data.method,
        payload: data.payload,
        statusCode: data.statusCode,
        responseBody: data.responseBody,
        error: data.error,
        responseTime: data.responseTime,
        success: data.success,
        retryCount: data.retryCount,
        timestamp: new Date(),
      });

      await this.webhookLogRepository.save(log);
    } catch (error) {
      this.logger.error('Failed to log webhook', error);
    }
  }

  async getWebhookLogs(
    filters: {
      url?: string;
      success?: boolean;
      startDate?: Date;
      endDate?: Date;
    },
    pagination: {
      page: number;
      limit: number;
    },
  ): Promise<{ logs: WebhookLog[]; total: number }> {
    const query = this.webhookLogRepository.createQueryBuilder('log');

    if (filters.url) {
      query.andWhere('log.url = :url', { url: filters.url });
    }

    if (filters.success !== undefined) {
      query.andWhere('log.success = :success', { success: filters.success });
    }

    if (filters.startDate) {
      query.andWhere('log.timestamp >= :startDate', { startDate: filters.startDate });
    }

    if (filters.endDate) {
      query.andWhere('log.timestamp <= :endDate', { endDate: filters.endDate });
    }

    query
      .orderBy('log.timestamp', 'DESC')
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit);

    const [logs, total] = await query.getManyAndCount();

    return { logs, total };
  }

  async retryFailedWebhooks(
    since: Date,
    url?: string,
  ): Promise<{ retried: number; succeeded: number; failed: number }> {
    const query = this.webhookLogRepository.createQueryBuilder('log')
      .where('log.success = :success', { success: false })
      .andWhere('log.timestamp >= :since', { since });

    if (url) {
      query.andWhere('log.url = :url', { url });
    }

    const failedLogs = await query.getMany();

    let retried = 0;
    let succeeded = 0;
    let failed = 0;

    for (const log of failedLogs) {
      retried++;
      
      const result = await this.sendWebhook(
        {
          url: log.url,
          method: log.method as any,
        },
        log.payload,
      );

      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    return { retried, succeeded, failed };
  }

  async validateWebhookUrl(url: string): Promise<boolean> {
    try {
      const parsedUrl = new URL(url);
      
      // Check if URL is HTTPS in production
      if (this.configService.get('NODE_ENV') === 'production' && parsedUrl.protocol !== 'https:') {
        return false;
      }

      // Perform HEAD request to check if endpoint is reachable
      const response = await axios.head(url, {
        timeout: 5000,
        validateStatus: () => true,
      });

      return response.status < 500;
    } catch (error) {
      return false;
    }
  }

  generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}