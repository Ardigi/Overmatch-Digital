import { HttpService } from '@nestjs/axios';
import { 
  BadRequestException, 
  Injectable, 
  Logger, 
  NotFoundException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { ServiceDiscoveryService } from '@soc-compliance/http-common';
import * as crypto from 'crypto';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import type { CreateWebhookDto } from '../dto/create-webhook.dto';
import type { FilterWebhookEventsDto } from '../dto/filter-webhook-events.dto';
import type { ProcessIncomingWebhookDto } from '../dto/process-incoming-webhook.dto';
import type { TestWebhookDto } from '../dto/test-webhook.dto';
import type { TriggerWebhookDto } from '../dto/trigger-webhook.dto';
import type { UpdateWebhookDto } from '../dto/update-webhook.dto';
import type { WebhookStatsQueryDto } from '../dto/webhook-stats-query.dto';
import { 
  WebhookEndpoint, 
  WebhookStats, 
  WebhookStatus
} from '../entities/webhook-endpoint.entity';
import { 
  EventStatus, 
  WebhookEvent 
} from '../entities/webhook-event.entity';
import type { WebhookDeliveryService } from './webhook-delivery.service';

export interface WebhookTestResult {
  success: boolean;
  statusCode?: number;
  headers?: Record<string, string>;
  body?: any;
  responseTime?: number;
  error?: string;
}

export interface WebhookStatistics {
  totalEvents: number;
  deliveredEvents: number;
  failedEvents: number;
  pendingEvents: number;
  deliveryRate: number;
  averageResponseTime: number;
  eventsByType: Record<string, number>;
  errorsByType?: Record<string, number>;
  serviceNotificationStats?: Record<string, { success: number; failed: number }>;
  webhookInfo?: {
    name: string;
    url: string;
    status: string;
    createdAt: Date;
  };
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(WebhookEndpoint)
    private readonly webhookRepository: Repository<WebhookEndpoint>,
    @InjectRepository(WebhookEvent)
    private readonly eventRepository: Repository<WebhookEvent>,
    private readonly deliveryService: WebhookDeliveryService,
    private readonly eventEmitter: EventEmitter2,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly serviceDiscovery: ServiceDiscoveryService,
  ) {}

  async create(dto: CreateWebhookDto): Promise<WebhookEndpoint> {
    // Validate URL
    try {
      new URL(dto.url);
    } catch {
      throw new BadRequestException('Invalid webhook URL');
    }

    // Check for duplicate name
    const existing = await this.webhookRepository.findOne({
      where: {
        organizationId: dto.organizationId,
        name: dto.name,
      },
    });

    if (existing) {
      throw new BadRequestException(`Webhook with name "${dto.name}" already exists`);
    }

    const webhook = this.webhookRepository.create({
      ...dto,
      status: WebhookStatus.ACTIVE,
      stats: {
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        averageResponseTime: 0,
      },
    });

    return this.webhookRepository.save(webhook);
  }

  async findAll(organizationId: string, filters?: {
    status?: WebhookStatus;
    integrationId?: string;
    tags?: string[];
  }): Promise<WebhookEndpoint[]> {
    const queryBuilder = this.webhookRepository.createQueryBuilder('webhook');
    
    queryBuilder.where('webhook.organizationId = :organizationId', { organizationId });

    if (filters?.status) {
      queryBuilder.andWhere('webhook.status = :status', { status: filters.status });
    }

    if (filters?.integrationId) {
      queryBuilder.andWhere('webhook.integrationId = :integrationId', { integrationId: filters.integrationId });
    }

    if (filters?.tags && filters.tags.length > 0) {
      queryBuilder.andWhere('webhook.tags && :tags', { tags: filters.tags });
    }

    queryBuilder.orderBy('webhook.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  async findOne(id: string, organizationId: string): Promise<WebhookEndpoint> {
    const webhook = await this.webhookRepository.findOne({
      where: { id, organizationId },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    return webhook;
  }

  async update(
    id: string, 
    organizationId: string, 
    dto: UpdateWebhookDto
  ): Promise<WebhookEndpoint> {
    const webhook = await this.findOne(id, organizationId);

    Object.assign(webhook, dto);
    return this.webhookRepository.save(webhook);
  }

  async delete(id: string, organizationId: string): Promise<void> {
    await this.findOne(id, organizationId);
    
    await this.webhookRepository.softDelete(id);

    await this.eventEmitter.emit('webhook.deleted', {
      webhookId: id,
      organizationId,
    });
  }

  async activate(id: string, organizationId: string): Promise<WebhookEndpoint> {
    const webhook = await this.findOne(id, organizationId);

    webhook.status = WebhookStatus.ACTIVE;
    const activated = await this.webhookRepository.save(webhook);

    await this.eventEmitter.emit('webhook.activated', {
      webhookId: id,
      organizationId,
    });

    return activated;
  }

  async deactivate(id: string, organizationId: string): Promise<WebhookEndpoint> {
    const webhook = await this.findOne(id, organizationId);

    webhook.status = WebhookStatus.INACTIVE;
    const deactivated = await this.webhookRepository.save(webhook);

    await this.eventEmitter.emit('webhook.deactivated', {
      webhookId: id,
      organizationId,
    });

    return deactivated;
  }

  async testWebhook(
    id: string, 
    organizationId: string,
    dto: TestWebhookDto
  ): Promise<WebhookTestResult> {
    const webhook = await this.findOne(id, organizationId);

    try {
      const startTime = Date.now();
      
      // Prepare test payload
      const payload = this.applyTransformations(dto.payload, webhook.config.transformations);
      const signature = await this.generateSignature(webhook, JSON.stringify(payload));
      
      const headers: Record<string, string> = {
        ...webhook.config.headers,
        'Content-Type': 'application/json',
        'X-Webhook-Event': dto.eventType,
        'X-Webhook-Timestamp': new Date().toISOString(),
      };

      if (signature) {
        headers['X-Webhook-Signature'] = signature;
      }

      const response = await firstValueFrom(
        this.httpService.request({
          method: webhook.config.method || 'POST',
          url: webhook.url,
          data: payload,
          headers,
          timeout: webhook.timeoutSeconds * 1000,
          validateStatus: () => true, // Don't throw on non-2xx
        })
      );

      const responseTime = Date.now() - startTime;

      return {
        success: response.status >= 200 && response.status < 300,
        statusCode: response.status,
        headers: response.headers ? Object.fromEntries(
          Object.entries(response.headers).filter(([_, v]) => typeof v === 'string')
        ) : undefined,
        body: response.data,
        responseTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async triggerWebhook(
    id: string,
    organizationId: string,
    dto: TriggerWebhookDto
  ): Promise<WebhookEvent> {
    const webhook = await this.findOne(id, organizationId);

    // Check if event type is configured
    if (!webhook.config.events.includes(dto.eventType)) {
      throw new BadRequestException(`Event type "${dto.eventType}" not configured for this webhook`);
    }

    // Apply filters
    if (webhook.config.filters && !this.matchesFilters(dto.data, webhook.config.filters)) {
      throw new BadRequestException('Event filtered out by webhook configuration');
    }

    // Transform data
    const transformedData = this.applyTransformations(dto.data, webhook.config.transformations);

    // Create event
    const event = this.eventRepository.create({
      webhookId: id,
      eventType: dto.eventType,
      payload: transformedData,
      status: EventStatus.PENDING,
      metadata: {
        correlationId: dto.correlationId,
        priority: dto.priority || 0,
        source: 'manual',
        ...dto.metadata,
      },
    });

    const savedEvent = await this.eventRepository.save(event);

    // Queue for delivery
    await this.deliveryService.deliverWebhook(webhook, savedEvent);

    return savedEvent;
  }

  async processIncomingWebhook(
    id: string,
    data: ProcessIncomingWebhookDto
  ): Promise<{ success: boolean; eventId?: string; error?: string }> {
    const webhook = await this.webhookRepository.findOne({
      where: { id },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    // Verify signature if configured
    if (webhook.config.authentication?.type === 'signature') {
      const payloadString = JSON.stringify(data.payload);
      const isValid = await this.verifySignature(webhook, payloadString, data.signature);
      
      if (!isValid) {
        throw new BadRequestException('Invalid webhook signature');
      }
    }

    // Determine event type from payload or headers
    const eventType = data.headers?.['x-event-type'] || 
                     data.payload?.eventType || 
                     data.payload?.type || 
                     'webhook.incoming';

    // Create incoming event record
    const event = this.eventRepository.create({
      webhookId: id,
      eventType,
      payload: data.payload,
      status: EventStatus.DELIVERED,
      metadata: {
        customMetadata: {
          headers: data.headers,
          timestamp: new Date().toISOString(),
          originalEventType: eventType,
        },
      },
    });

    const savedEvent = await this.eventRepository.save(event);

    // Emit event for processing
    await this.eventEmitter.emit('webhook.incoming', {
      webhookId: id,
      eventId: savedEvent.id,
      eventType,
      payload: data.payload,
      headers: data.headers,
      organizationId: webhook.organizationId,
    });

    // Process with internal services if configured
    if (webhook.config.processWithServices !== false) {
      try {
        const processingResult = await this.processIncomingWebhookWithActions(
          id,
          eventType,
          data.payload,
          webhook.organizationId
        );
        
        // Update event with processing results
        savedEvent.metadata = {
          ...savedEvent.metadata,
          processingResult
        };
        await this.eventRepository.save(savedEvent);
        
      } catch (processingError) {
        this.logger.error(`Error processing webhook with services:`, processingError);
        
        // Update event status to indicate processing issues
        savedEvent.status = EventStatus.FAILED;
        savedEvent.metadata = {
          ...savedEvent.metadata,
          processingError: processingError.message
        };
        await this.eventRepository.save(savedEvent);
      }
    }

    return {
      success: true,
      eventId: savedEvent.id,
    };
  }

  async verifySignature(
    webhook: WebhookEndpoint,
    payload: string,
    signature?: string
  ): Promise<boolean> {
    if (!webhook.config.authentication || webhook.config.authentication.type !== 'signature') {
      return true; // No signature verification configured
    }

    if (!signature) {
      return false;
    }

    const { secret, algorithm = 'sha256' } = webhook.config.authentication;
    if (!secret) {
      return true; // No secret configured
    }

    const expectedSignature = `${algorithm}=` + crypto
      .createHmac(algorithm, secret)
      .update(payload)
      .digest('hex');

    return signature === expectedSignature;
  }

  async getEvents(
    webhookId: string,
    organizationId: string,
    filters: FilterWebhookEventsDto
  ): Promise<{ data: WebhookEvent[]; total: number; page: number; limit: number }> {
    await this.findOne(webhookId, organizationId);

    const queryBuilder = this.eventRepository.createQueryBuilder('event');
    queryBuilder.where('event.webhookId = :webhookId', { webhookId });

    if (filters.status) {
      queryBuilder.andWhere('event.status = :status', { status: filters.status });
    }

    if (filters.eventType) {
      queryBuilder.andWhere('event.eventType = :eventType', { eventType: filters.eventType });
    }

    if (filters.startDate) {
      queryBuilder.andWhere('event.createdAt >= :startDate', { startDate: filters.startDate });
    }

    if (filters.endDate) {
      queryBuilder.andWhere('event.createdAt <= :endDate', { endDate: filters.endDate });
    }

    queryBuilder.orderBy('event.createdAt', 'DESC');

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    queryBuilder.skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total, page, limit };
  }

  async getEvent(eventId: string): Promise<WebhookEvent> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return event;
  }

  async retryEvent(eventId: string, organizationId: string): Promise<WebhookEvent> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      relations: ['webhook'],
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const webhook = await this.findOne(event.webhookId, organizationId);

    if (event.status === EventStatus.DELIVERED) {
      throw new BadRequestException('Cannot retry delivered event');
    }

    const maxRetries = webhook.config.retryPolicy?.maxRetries || 3;
    if (event.deliveryAttempts >= maxRetries) {
      throw new BadRequestException('Event has reached maximum retry attempts');
    }

    // Reset event for retry
    event.status = EventStatus.PENDING;
    event.nextRetryAt = new Date(Date.now() + 5000); // 5 seconds from now
    
    const updatedEvent = await this.eventRepository.save(event);

    // Schedule retry
    await this.deliveryService.scheduleRetry(webhook, updatedEvent);

    return updatedEvent;
  }

  async resendEvents(
    webhookId: string,
    organizationId: string,
    eventIds: string[]
  ): Promise<{ totalEvents: number; queuedForResend: number; skipped: number; results: any[] }> {
    const webhook = await this.findOne(webhookId, organizationId);
    const results = [];
    let queuedForResend = 0;
    let skipped = 0;

    for (const eventId of eventIds) {
      try {
        const event = await this.eventRepository.findOne({
          where: { id: eventId, webhookId },
        });

        if (!event) {
          results.push({ eventId, status: 'not_found', error: 'Event not found' });
          skipped++;
          continue;
        }

        if (event.status === EventStatus.DELIVERED) {
          results.push({ eventId, status: 'skipped', reason: 'already_delivered' });
          skipped++;
          continue;
        }

        const maxRetries = webhook.config.retryPolicy?.maxRetries || 3;
        if (event.deliveryAttempts >= maxRetries) {
          results.push({ eventId, status: 'skipped', reason: 'max_retries_exceeded' });
          skipped++;
          continue;
        }

        // Reset for resend
        event.status = EventStatus.PENDING;
        event.nextRetryAt = new Date(Date.now() + 5000);
        await this.eventRepository.save(event);

        // Queue for delivery
        await this.deliveryService.deliverWebhook(webhook, event);
        
        results.push({ eventId, status: 'queued' });
        queuedForResend++;
      } catch (error) {
        results.push({ eventId, status: 'error', error: error.message });
        skipped++;
      }
    }

    return {
      totalEvents: eventIds.length,
      queuedForResend,
      skipped,
      results,
    };
  }

  async getStats(
    webhookId: string,
    organizationId: string,
    query: WebhookStatsQueryDto
  ): Promise<WebhookStatistics> {
    const webhook = await this.findOne(webhookId, organizationId);
    const since = new Date(Date.now() - (query.hours || 24) * 60 * 60 * 1000);

    const events = await this.eventRepository.find({
      where: { 
        webhookId,
        createdAt: since,
      },
    });

    const totalEvents = events.length;
    const deliveredEvents = events.filter(e => e.status === EventStatus.DELIVERED).length;
    const failedEvents = events.filter(e => e.status === EventStatus.FAILED).length;
    const pendingEvents = events.filter(e => 
      e.status === EventStatus.PENDING || e.status === EventStatus.RETRYING
    ).length;

    const deliveryRate = totalEvents > 0 
      ? Math.round((deliveredEvents / totalEvents) * 10000) / 100 
      : 0;

    // Calculate average response time
    const eventsWithResponseTime = events.filter(e => 
      e.response?.responseTime && e.status === EventStatus.DELIVERED
    );
    const averageResponseTime = eventsWithResponseTime.length > 0
      ? eventsWithResponseTime.reduce((sum, e) => sum + (e.response?.responseTime || 0), 0) / eventsWithResponseTime.length
      : 0;

    // Group by event type
    const eventsByType: Record<string, number> = {};
    events.forEach(event => {
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
    });

    // Get error breakdown from failed events
    const errorsByType: Record<string, number> = {};
    const failedEventsWithErrors = events.filter(e => e.status === EventStatus.FAILED && e.response?.error);
    failedEventsWithErrors.forEach(event => {
      const error = event.response?.error || 'Unknown error';
      const errorType = this.categorizeWebhookError(error);
      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
    });

    // Get service notification statistics
    let serviceNotificationStats = {};
    try {
      const notificationEvents = events.filter(e => 
        e.metadata?.processingResult?.actionsTriggered || 
        e.metadata?.customMetadata?.services
      );
      
      const serviceStats: Record<string, { success: number; failed: number }> = {};
      notificationEvents.forEach(event => {
        const triggeredServices = event.metadata?.processingResult?.actionsTriggered || [];
        const errors = event.metadata?.processingResult?.errors || [];
        
        triggeredServices.forEach((service: string) => {
          if (!serviceStats[service]) {
            serviceStats[service] = { success: 0, failed: 0 };
          }
          serviceStats[service].success++;
        });
        
        errors.forEach((error: string) => {
          const serviceName = this.extractServiceFromError(error);
          if (serviceName && serviceStats[serviceName]) {
            serviceStats[serviceName].failed++;
          }
        });
      });
      
      serviceNotificationStats = serviceStats;
    } catch (error) {
      this.logger.warn(`Could not calculate service notification stats: ${error.message}`);
    }

    return {
      totalEvents,
      deliveredEvents,
      failedEvents,
      pendingEvents,
      deliveryRate,
      averageResponseTime: Math.round(averageResponseTime),
      eventsByType,
      errorsByType,
      serviceNotificationStats,
      webhookInfo: {
        name: webhook.name,
        url: webhook.url,
        status: webhook.status,
        createdAt: webhook.createdAt
      }
    };
  }

  private categorizeWebhookError(error: string): string {
    const errorLower = error.toLowerCase();
    if (errorLower.includes('timeout')) return 'TIMEOUT_ERROR';
    if (errorLower.includes('network') || errorLower.includes('connection')) return 'NETWORK_ERROR';
    if (errorLower.includes('signature')) return 'SIGNATURE_ERROR';
    if (errorLower.includes('auth')) return 'AUTH_ERROR';
    if (errorLower.includes('rate limit')) return 'RATE_LIMIT_ERROR';
    if (errorLower.includes('payload') || errorLower.includes('format')) return 'PAYLOAD_ERROR';
    return 'UNKNOWN_ERROR';
  }

  private extractServiceFromError(error: string): string | null {
    const match = error.match(/(\w+-service)/i);
    return match ? match[1] : null;
  }

  /**
   * Notify internal services about webhook events
   */
  async notifyInternalServices(
    webhookId: string,
    eventType: string,
    payload: any,
    organizationId: string
  ): Promise<{ notified: string[]; errors: string[] }> {
    const notified: string[] = [];
    const errors: string[] = [];

    try {
      // Always log to audit-service for compliance tracking
      try {
        const auditResponse = await this.serviceDiscovery.callService<{ success: boolean }>(
          'audit-service',
          'POST',
          '/api/v1/events',
          {
            eventType: 'webhook.received',
            organizationId,
            details: {
              webhookId,
              originalEventType: eventType,
              payloadSize: JSON.stringify(payload).length,
              timestamp: new Date(),
              source: 'integration-service'
            }
          }
        );
        
        if (auditResponse.success) {
          notified.push('audit-service');
          this.logger.log(`Successfully logged webhook event to audit service`);
        } else {
          errors.push('Failed to log to audit service');
        }
      } catch (error) {
        errors.push(`Audit service error: ${error.message}`);
        this.logger.error(`Failed to log to audit service:`, error);
      }

      // Notify notification-service for user alerts
      if (eventType.includes('alert') || eventType.includes('notification') || eventType.includes('error')) {
        try {
          const notificationData = {
            organizationId,
            type: 'webhook_event',
            title: `Webhook Event: ${eventType}`,
            message: this.formatWebhookNotificationMessage(eventType, payload),
            priority: eventType.includes('error') ? 'HIGH' : 'MEDIUM',
            channels: ['in_app'],
            metadata: {
              webhookId,
              eventType,
              source: 'integration'
            }
          };

          const notificationResponse = await this.serviceDiscovery.callService<{ success: boolean }>(
            'notification-service',
            'POST',
            '/api/v1/notifications',
            notificationData
          );
          
          if (notificationResponse.success) {
            notified.push('notification-service');
            this.logger.log(`Successfully sent notification for webhook event`);
          } else {
            errors.push('Failed to send notification');
          }
        } catch (error) {
          errors.push(`Notification service error: ${error.message}`);
          this.logger.error(`Failed to send notification:`, error);
        }
      }

      // Notify workflow-service for automated workflows
      if (eventType.includes('workflow') || eventType.includes('approval') || eventType.includes('control')) {
        try {
          const workflowTrigger = {
            organizationId,
            triggerType: 'webhook_event',
            eventType,
            payload,
            metadata: {
              webhookId,
              timestamp: new Date(),
              source: 'integration'
            }
          };

          const workflowResponse = await this.serviceDiscovery.callService<{ success: boolean; data?: any }>(
            'workflow-service',
            'POST',
            '/api/v1/workflows/trigger',
            workflowTrigger
          );
          
          if (workflowResponse.success) {
            notified.push('workflow-service');
            this.logger.log(`Successfully triggered workflow for webhook event`);
            
            // If workflows were triggered, log the workflow IDs
            if ((workflowResponse.data as any)?.triggeredWorkflows) {
              this.logger.log(`Triggered workflows: ${(workflowResponse.data as any).triggeredWorkflows.join(', ')}`);
            }
          } else {
            errors.push('Failed to trigger workflows');
          }
        } catch (error) {
          errors.push(`Workflow service error: ${error.message}`);
          this.logger.error(`Failed to trigger workflows:`, error);
        }
      }

      // Notify evidence-service for evidence collection events
      if (eventType.includes('evidence') || eventType.includes('document') || eventType.includes('file')) {
        try {
          const evidenceData = {
            organizationId,
            projectId: payload.projectId || `webhook-${webhookId}`,
            title: `Evidence from Webhook: ${eventType}`,
            description: `Evidence collected via webhook integration`,
            type: this.mapWebhookToEvidenceType(eventType, payload),
            isAutomated: true,
            verified: false,
            collectedDate: new Date(),
            metadata: {
              webhookId,
              eventType,
              originalPayload: payload,
              source: 'webhook'
            }
          };

          // Only create evidence if we have meaningful data
          if (payload.fileUrl || payload.document || payload.evidence) {
            (evidenceData as any).fileUrl = payload.fileUrl || payload.document?.url;
            (evidenceData as any).fileName = payload.fileName || payload.document?.name;
            
            const evidenceResponse = await this.serviceDiscovery.callService<{ success: boolean }>(
              'evidence-service',
              'POST',
              '/api/v1/evidence',
              evidenceData
            );
            
            if (evidenceResponse.success) {
              notified.push('evidence-service');
              this.logger.log(`Successfully created evidence from webhook event`);
            } else {
              errors.push('Failed to create evidence');
            }
          }
        } catch (error) {
          errors.push(`Evidence service error: ${error.message}`);
          this.logger.error(`Failed to create evidence:`, error);
        }
      }

      // Notify control-service for control status updates
      if (eventType.includes('control') || eventType.includes('compliance') || eventType.includes('status')) {
        try {
          const controlUpdate = {
            organizationId,
            eventType: 'webhook_status_update',
            details: {
              webhookId,
              originalEventType: eventType,
              payload,
              timestamp: new Date()
            }
          };

          const controlResponse = await this.serviceDiscovery.callService<{ success: boolean }>(
            'control-service',
            'POST',
            '/api/v1/controls/webhook-update',
            controlUpdate
          );
          
          if (controlResponse.success) {
            notified.push('control-service');
            this.logger.log(`Successfully notified control service of webhook event`);
          } else {
            errors.push('Failed to notify control service');
          }
        } catch (error) {
          errors.push(`Control service error: ${error.message}`);
          this.logger.error(`Failed to notify control service:`, error);
        }
      }

      // Notify AI service for intelligent processing if configured
      if (payload.aiProcessing || eventType.includes('analysis') || eventType.includes('insight')) {
        try {
          const aiRequest = {
            organizationId,
            requestType: 'webhook_analysis',
            data: payload,
            context: {
              webhookId,
              eventType,
              timestamp: new Date()
            }
          };

          const aiResponse = await this.serviceDiscovery.callService<{ success: boolean }>(
            'ai-service',
            'POST',
            '/api/v1/analysis/webhook',
            aiRequest
          );
          
          if (aiResponse.success) {
            notified.push('ai-service');
            this.logger.log(`Successfully submitted webhook for AI analysis`);
          } else {
            errors.push('Failed to submit for AI analysis');
          }
        } catch (error) {
          errors.push(`AI service error: ${error.message}`);
          this.logger.error(`Failed to submit for AI analysis:`, error);
        }
      }

    } catch (error) {
      this.logger.error(`Error notifying internal services about webhook event:`, error);
      errors.push(`General error: ${error.message}`);
    }

    // Log summary
    this.logger.log(`Webhook notification summary - Notified: [${notified.join(', ')}], Errors: ${errors.length}`);

    return { notified, errors };
  }

  private formatWebhookNotificationMessage(eventType: string, payload: any): string {
    const eventTypeFormatted = eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    if (eventType.includes('error')) {
      return `Webhook Error: ${eventTypeFormatted} - ${payload.error || 'Unknown error occurred'}`;
    }
    
    if (eventType.includes('alert')) {
      return `Alert: ${eventTypeFormatted} - ${payload.message || 'Alert triggered'}`;
    }
    
    if (payload.message) {
      return `${eventTypeFormatted}: ${payload.message}`;
    }
    
    return `${eventTypeFormatted} event received via webhook`;
  }

  private mapWebhookToEvidenceType(eventType: string, payload: any): string {
    if (eventType.includes('document') || payload.document) return 'DOCUMENT';
    if (eventType.includes('screenshot') || payload.screenshot) return 'SCREENSHOT';
    if (eventType.includes('log') || payload.logs) return 'LOG_FILE';
    if (eventType.includes('config') || payload.configuration) return 'CONFIGURATION';
    if (eventType.includes('report') || payload.report) return 'REPORT';
    if (eventType.includes('attestation') || payload.attestation) return 'ATTESTATION';
    return 'OTHER';
  }

  /**
   * Process incoming webhooks and trigger real actions
   */
  async processIncomingWebhookWithActions(
    webhookId: string,
    eventType: string,
    payload: any,
    organizationId: string
  ): Promise<{ success: boolean; actionsTriggered: string[]; errors: string[] }> {
    const actionsTriggered: string[] = [];
    const errors: string[] = [];

    try {
      // First, process the standard webhook
      const standardResult = await this.processIncomingWebhook(webhookId, {
        payload,
        headers: {},
      });

      if (!standardResult.success) {
        errors.push('Failed to process standard webhook');
        return { success: false, actionsTriggered, errors };
      }

      // Then notify services and track which actions were triggered
      const notificationResult = await this.notifyInternalServices(webhookId, eventType, payload, organizationId);
      actionsTriggered.push(...notificationResult.notified);
      errors.push(...notificationResult.errors);

      // Trigger specific actions based on event type
      if (eventType.includes('sync')) {
        try {
          // Trigger a data sync
          await this.serviceDiscovery.callService(
            'integration-service',
            'POST',
            `/api/v1/integrations/${payload.integrationId}/sync`,
            {
              mode: 'incremental',
              entities: payload.entities || ['all'],
              triggeredBy: 'webhook'
            }
          );
          actionsTriggered.push('data-sync');
        } catch (error) {
          errors.push(`Failed to trigger data sync: ${error.message}`);
        }
      }

      if (eventType.includes('backup')) {
        try {
          // Trigger backup workflow
          await this.serviceDiscovery.callService(
            'workflow-service',
            'POST',
            '/api/v1/workflows/trigger',
            {
              organizationId,
              triggerType: 'backup_request',
              payload
            }
          );
          actionsTriggered.push('backup-workflow');
        } catch (error) {
          errors.push(`Failed to trigger backup: ${error.message}`);
        }
      }

      return {
        success: errors.length === 0,
        actionsTriggered,
        errors
      };

    } catch (error) {
      this.logger.error(`Error processing webhook with actions:`, error);
      return {
        success: false,
        actionsTriggered,
        errors: [`Processing error: ${error.message}`]
      };
    }
  }

  private matchesFilters(data: any, filters: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value)) {
        if (!value.includes(data[key])) {
          return false;
        }
      } else if (data[key] !== value) {
        return false;
      }
    }
    return true;
  }

  private applyTransformations(data: any, transformations?: any): any {
    if (!transformations) {
      return data;
    }

    let result = { ...data };

    // Exclude fields
    if (transformations.excludeFields) {
      transformations.excludeFields.forEach((field: string) => {
        delete result[field];
      });
    }

    // Include only specific fields
    if (transformations.includeFields) {
      const newResult: any = {};
      transformations.includeFields.forEach((field: string) => {
        if (field in result) {
          newResult[field] = result[field];
        }
      });
      result = newResult;
    }

    // Field mappings
    if (transformations.fieldMappings) {
      const mapped: any = {};
      for (const [source, target] of Object.entries(transformations.fieldMappings)) {
        if (source in result) {
          mapped[target as string] = result[source];
          delete result[source];
        }
      }
      result = { ...result, ...mapped };
    }

    return result;
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
}