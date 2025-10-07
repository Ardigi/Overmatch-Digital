import { HttpService } from '@nestjs/axios';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job, Queue } from 'bull';
import * as crypto from 'crypto';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { WebhookEndpoint } from '../entities/webhook-endpoint.entity';
import { EventStatus, WebhookEvent } from '../entities/webhook-event.entity';

export interface WebhookDeliveryJob {
  webhookId: string;
  eventId: string;
  attempt: number;
}

@Injectable()
@Processor('webhook-delivery')
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);

  constructor(
    @InjectQueue('webhook-delivery') private readonly deliveryQueue: Queue,
    @InjectRepository(WebhookEvent)
    private readonly eventRepository: Repository<WebhookEvent>,
    @InjectRepository(WebhookEndpoint)
    private readonly webhookRepository: Repository<WebhookEndpoint>,
    private readonly httpService: HttpService,
  ) {}

  async deliverWebhook(webhook: WebhookEndpoint, event: WebhookEvent): Promise<void> {
    const job: WebhookDeliveryJob = {
      webhookId: webhook.id,
      eventId: event.id,
      attempt: 0,
    };

    await this.deliveryQueue.add('deliver', job, {
      attempts: webhook.config.retryPolicy?.maxRetries || 3,
      backoff: {
        type: 'exponential',
        delay: webhook.config.retryPolicy?.retryDelay || 1000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  async scheduleRetry(webhook: WebhookEndpoint, event: WebhookEvent): Promise<void> {
    const job: WebhookDeliveryJob = {
      webhookId: webhook.id,
      eventId: event.id,
      attempt: event.deliveryAttempts,
    };

    const retryDelay = this.calculateRetryDelay(
      event.deliveryAttempts,
      webhook.config.retryPolicy?.retryDelay || 1000,
      webhook.config.retryPolicy?.backoffMultiplier || 2,
    );

    await this.deliveryQueue.add('deliver', job, {
      delay: retryDelay,
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  @Process('deliver')
  async processDeliveryQueue(job: Job<WebhookDeliveryJob>): Promise<void> {
    const { webhookId, eventId, attempt } = job.data;

    try {
      const webhook = await this.webhookRepository.findOne({
        where: { id: webhookId },
      });

      if (!webhook) {
        this.logger.error(`Webhook ${webhookId} not found`);
        return;
      }

      if (webhook.status !== 'ACTIVE') {
        this.logger.warn(`Webhook ${webhookId} is not active, skipping delivery`);
        return;
      }

      const event = await this.eventRepository.findOne({
        where: { id: eventId },
      });

      if (!event) {
        this.logger.error(`Event ${eventId} not found`);
        return;
      }

      // Update event status
      event.status = EventStatus.RETRYING;
      event.deliveryAttempts = attempt + 1;
      event.lastAttemptAt = new Date();
      await this.eventRepository.save(event);

      // Prepare request
      const startTime = Date.now();
      const payload = JSON.stringify(event.payload);
      const signature = await this.generateSignature(webhook, payload);

      const headers: Record<string, string> = {
        ...webhook.config.headers,
        'Content-Type': 'application/json',
        'X-Webhook-Event-Id': event.id,
        'X-Webhook-Event-Type': event.eventType,
        'X-Webhook-Timestamp': new Date().toISOString(),
        'X-Webhook-Attempt': String(event.deliveryAttempts),
      };

      if (signature) {
        headers['X-Webhook-Signature'] = signature;
      }

      // Apply rate limiting if configured
      if (webhook.config.rateLimit) {
        await this.applyRateLimit(webhook);
      }

      // Send request
      const response = await firstValueFrom(
        this.httpService.request({
          method: webhook.config.method || 'POST',
          url: webhook.url,
          data: event.payload,
          headers,
          timeout: webhook.timeoutSeconds * 1000,
          validateStatus: () => true,
        })
      );

      const responseTime = Date.now() - startTime;

      // Update event with response
      event.response = {
        statusCode: response.status,
        headers: response.headers ? Object.fromEntries(
          Object.entries(response.headers).filter(([_, v]) => typeof v === 'string')
        ) : undefined,
        body: response.data,
        responseTime,
      };

      if (response.status >= 200 && response.status < 300) {
        event.status = EventStatus.DELIVERED;
        this.logger.log(`Successfully delivered webhook event ${eventId}`);

        // Update webhook stats
        await this.updateWebhookStats(webhook, true, responseTime);
      } else {
        event.status = EventStatus.FAILED;
        event.error = `HTTP ${response.status}: ${response.statusText}`;
        this.logger.error(`Failed to deliver webhook event ${eventId}: ${event.error}`);

        // Update webhook stats
        await this.updateWebhookStats(webhook, false);

        // Schedule retry if attempts remain
        if (event.deliveryAttempts < (webhook.config.retryPolicy?.maxRetries || 3)) {
          event.nextRetryAt = new Date(
            Date.now() + this.calculateRetryDelay(
              event.deliveryAttempts,
              webhook.config.retryPolicy?.retryDelay || 1000,
              webhook.config.retryPolicy?.backoffMultiplier || 2,
            )
          );
          await this.scheduleRetry(webhook, event);
        }
      }

      await this.eventRepository.save(event);
    } catch (error) {
      this.logger.error(`Error processing webhook delivery: ${error.message}`, error.stack);

      // Update event with error
      const event = await this.eventRepository.findOne({
        where: { id: eventId },
      });

      if (event) {
        event.status = EventStatus.FAILED;
        event.error = error.message;
        await this.eventRepository.save(event);
      }

      // Re-throw to let Bull handle retry
      throw error;
    }
  }

  private async generateSignature(webhook: WebhookEndpoint, payload: string): Promise<string | null> {
    if (!webhook.config.authentication || webhook.config.authentication.type !== 'signature') {
      return null;
    }

    const { secret, algorithm = 'sha256' } = webhook.config.authentication;
    if (!secret) {
      return null;
    }

    return `${algorithm}=` + crypto
      .createHmac(algorithm, secret)
      .update(payload)
      .digest('hex');
  }

  private calculateRetryDelay(
    attempt: number,
    baseDelay: number,
    multiplier: number,
  ): number {
    return baseDelay * multiplier ** attempt;
  }

  private async updateWebhookStats(
    webhook: WebhookEndpoint,
    success: boolean,
    responseTime?: number,
  ): Promise<void> {
    webhook.stats.totalDeliveries++;
    
    if (success) {
      webhook.stats.successfulDeliveries++;
      webhook.stats.lastSuccessAt = new Date();
    } else {
      webhook.stats.failedDeliveries++;
      webhook.stats.lastFailureAt = new Date();
    }

    webhook.stats.lastDeliveryAt = new Date();

    if (responseTime) {
      // Update average response time
      const currentAvg = webhook.stats.averageResponseTime || 0;
      const currentCount = webhook.stats.successfulDeliveries - 1;
      webhook.stats.averageResponseTime = 
        (currentAvg * currentCount + responseTime) / webhook.stats.successfulDeliveries;
    }

    await this.webhookRepository.save(webhook);
  }

  private async applyRateLimit(webhook: WebhookEndpoint): Promise<void> {
    if (!webhook.config.rateLimit) {
      return;
    }

    const { maxRequests, windowMs } = webhook.config.rateLimit;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get recent events for this webhook
    const recentEvents = await this.eventRepository
      .createQueryBuilder('event')
      .where('event.webhookId = :webhookId', { webhookId: webhook.id })
      .andWhere('event.createdAt > :windowStart', { windowStart: new Date(windowStart) })
      .andWhere('event.status IN (:...statuses)', { 
        statuses: [EventStatus.DELIVERED, EventStatus.RETRYING] 
      })
      .getCount();

    if (recentEvents >= maxRequests) {
      // Calculate delay until next window
      const oldestEventTime = await this.eventRepository
        .createQueryBuilder('event')
        .select('MIN(event.createdAt)', 'oldest')
        .where('event.webhookId = :webhookId', { webhookId: webhook.id })
        .andWhere('event.createdAt > :windowStart', { windowStart: new Date(windowStart) })
        .getRawOne();

      if (oldestEventTime?.oldest) {
        const delay = new Date(oldestEventTime.oldest).getTime() + windowMs - now;
        this.logger.debug(`Rate limit exceeded for webhook ${webhook.id}, waiting ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, Math.max(delay, 1000)));
      }
    }
  }
}