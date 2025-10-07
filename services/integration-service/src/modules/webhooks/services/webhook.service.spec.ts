// Mock ServiceDiscoveryService before importing WebhookService
jest.mock('@soc-compliance/http-common', () => ({
  ServiceDiscoveryService: jest.fn(),
}));

// Mock WebhookDeliveryService to avoid Bull queue issues
jest.mock('./webhook-delivery.service', () => ({
  WebhookDeliveryService: jest.fn().mockImplementation(() => ({
    deliverWebhook: jest.fn(),
    scheduleRetry: jest.fn(),
    processDeliveryQueue: jest.fn(),
  })),
}));

import { HttpService } from '@nestjs/axios';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { of, throwError } from 'rxjs';
import { Repository } from 'typeorm';
import {
  type WebhookConfig,
  WebhookEndpoint,
  WebhookStatus,
} from '../entities/webhook-endpoint.entity';
import { EventStatus, WebhookEvent } from '../entities/webhook-event.entity';
import { WebhookService } from './webhook.service';

// Mock factories
const createMockRepository = <T extends object = any>(): jest.Mocked<Repository<T>> => {
  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getMany: jest.fn(),
    getOne: jest.fn(),
  };

  return {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    softDelete: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
    merge: jest.fn(),
    preload: jest.fn(),
    query: jest.fn(),
    clear: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
  } as any;
};

const createMockEventEmitter = (): any => ({
  emit: jest.fn(),
  emitAsync: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  many: jest.fn(),
  off: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
  hasListeners: jest.fn(),
  prependListener: jest.fn(),
  prependOnceListener: jest.fn(),
  prependMany: jest.fn(),
  listeners: jest.fn(),
  listenersAny: jest.fn(),
  eventNames: jest.fn(),
  listenerCount: jest.fn(),
  setMaxListeners: jest.fn(),
  getMaxListeners: jest.fn(),
  waitFor: jest.fn(),
});

describe('WebhookService', () => {
  let service: WebhookService;
  let webhookRepository: any;
  let eventRepository: any;
  let deliveryService: any;
  let eventEmitter: any;
  let httpService: any;
  let configService: any;

  const mockWebhook = {
    id: 'webhook-123',
    organizationId: 'org-123',
    integrationId: 'integration-123',
    name: 'Client Update Webhook',
    description: 'Notifies external system of client updates',
    url: 'https://api.external.com/webhooks/client-update',
    status: WebhookStatus.ACTIVE,
    config: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'encrypted-key',
      },
      events: ['client.created', 'client.updated', 'client.deleted'],
      retryPolicy: {
        maxRetries: 3,
        retryDelay: 1000,
        backoffMultiplier: 2,
      },
      authentication: {
        type: 'signature',
        secret: 'webhook-secret',
        algorithm: 'sha256',
      },
      filters: {
        clientType: ['enterprise', 'premium'],
      },
      transformations: {
        excludeFields: ['internal_notes', 'credit_score'],
        includeFields: ['id', 'name', 'status', 'contracts'],
      },
    } as WebhookConfig,
    sslVerification: true,
    timeoutSeconds: 30,
    tags: ['client-sync', 'production'],
    stats: {
      totalDeliveries: 1250,
      successfulDeliveries: 1200,
      failedDeliveries: 50,
      averageResponseTime: 450,
      lastDeliveryAt: new Date(),
      lastSuccessAt: new Date(),
      lastFailureAt: undefined,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockWebhookEvent = {
    id: 'event-123',
    webhookId: 'webhook-123',
    eventType: 'client.updated',
    status: EventStatus.PENDING,
    payload: {
      id: 'client-456',
      name: 'Acme Corp',
      status: 'active',
      type: 'enterprise',
      updatedAt: new Date(),
    },
    deliveryAttempts: 0,
    lastAttemptAt: null,
    nextRetryAt: null,
    response: null,
    error: null,
    metadata: {
      correlationId: 'correlation-123',
      priority: 1,
      source: 'client-service',
    },
    createdAt: new Date(),
  };

  beforeEach(() => {
    // Create mocks
    webhookRepository = createMockRepository();
    eventRepository = createMockRepository();
    deliveryService = {
      deliverWebhook: jest.fn(),
      scheduleRetry: jest.fn(),
      processDeliveryQueue: jest.fn(),
    } as any;
    eventEmitter = createMockEventEmitter();
    httpService = {
      post: jest.fn(),
      get: jest.fn(),
      request: jest.fn(),
    } as any;
    configService = {
      get: jest.fn(),
    } as any;

    // Mock ServiceDiscoveryService
    const mockServiceDiscovery = {
      getService: jest.fn(),
      callService: jest.fn(),
    } as any;

    // Manual instantiation
    service = new WebhookService(
      webhookRepository,
      eventRepository,
      deliveryService,
      eventEmitter,
      httpService,
      configService,
      mockServiceDiscovery
    );

    jest.clearAllMocks();
    jest.clearAllTimers();

    // Setup default config values
    configService.get.mockImplementation((key: string) => {
      const configs: Record<string, number> = {
        WEBHOOK_DEFAULT_TIMEOUT: 30,
        WEBHOOK_MAX_RETRIES: 3,
        WEBHOOK_RETRY_DELAY: 1000,
      };
      return configs[key];
    });
  });

  describe('create', () => {
    it('should create a new webhook', async () => {
      const createDto = {
        organizationId: 'org-123',
        name: 'Order Processing Webhook',
        description: 'Notifies order system',
        url: 'https://api.orders.com/webhook',
        config: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          events: ['order.created'],
          retryPolicy: {
            maxRetries: 5,
            retryDelay: 2000,
            backoffMultiplier: 2,
          },
        } as WebhookConfig,
        sslVerification: true,
        timeoutSeconds: 30,
        tags: ['orders'],
      };

      webhookRepository.findOne.mockResolvedValue(null);
      webhookRepository.create.mockReturnValue({
        ...createDto,
        status: WebhookStatus.ACTIVE,
      });
      webhookRepository.save.mockResolvedValue({
        ...mockWebhook,
        ...createDto,
        id: 'webhook-456',
      });

      const result = await service.create(createDto);

      expect(webhookRepository.findOne).toHaveBeenCalledWith({
        where: {
          organizationId: createDto.organizationId,
          name: createDto.name,
        },
      });
      expect(webhookRepository.create).toHaveBeenCalledWith({
        ...createDto,
        status: WebhookStatus.ACTIVE,
        stats: {
          totalDeliveries: 0,
          successfulDeliveries: 0,
          failedDeliveries: 0,
          averageResponseTime: 0,
        },
      });
      expect(result.status).toBe(WebhookStatus.ACTIVE);
    });

    it('should handle duplicate webhook names', async () => {
      const createDto = {
        organizationId: 'org-123',
        name: 'Duplicate Webhook',
        url: 'https://api.example.com',
        config: {} as WebhookConfig,
      };

      webhookRepository.findOne.mockResolvedValue(mockWebhook);

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });

    it('should validate webhook URL', async () => {
      const createDto = {
        organizationId: 'org-123',
        name: 'Invalid URL Webhook',
        url: 'not-a-valid-url',
        config: {} as WebhookConfig,
      };

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('testWebhook', () => {
    it('should successfully test webhook', async () => {
      const testDto = {
        eventType: 'client.updated',
        payload: {
          id: 'test-client',
          name: 'Test Client',
        },
      };

      webhookRepository.findOne.mockResolvedValue(mockWebhook);
      httpService.request.mockReturnValue(
        of({
          status: 200,
          statusText: 'OK',
          headers: { 'x-request-id': 'test-123' },
          data: { received: true },
          config: {},
        })
      );

      const result = await service.testWebhook('webhook-123', 'org-123', testDto);

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.headers).toHaveProperty('x-request-id');
    });

    it('should handle test failures', async () => {
      const testDto = {
        eventType: 'client.updated',
        payload: {},
      };

      webhookRepository.findOne.mockResolvedValue(mockWebhook);

      const errorMessage = 'Request failed with status code 500';
      httpService.request.mockReturnValue(throwError(new Error(errorMessage)));

      const result = await service.testWebhook('webhook-123', 'org-123', testDto);

      expect(result.success).toBe(false);
      // When an error is thrown, the service returns { success: false, error: error.message }
      expect(result.error).toBeDefined();
      expect(result.error).toBe(errorMessage);
      // statusCode is not included in error responses
      expect(result.statusCode).toBeUndefined();
    });

    it('should respect timeout settings', async () => {
      const testDto = {
        eventType: 'test.event',
        payload: {},
      };

      webhookRepository.findOne.mockResolvedValue(mockWebhook);
      httpService.request.mockReturnValue(
        throwError({ code: 'ECONNABORTED', message: 'timeout of 30000ms exceeded' })
      );

      const result = await service.testWebhook('webhook-123', 'org-123', testDto);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  describe('triggerWebhook', () => {
    it('should create and queue webhook event', async () => {
      const triggerDto = {
        eventType: 'client.created',
        data: {
          id: 'client-789',
          name: 'New Client',
          clientType: 'enterprise',
        },
        correlationId: 'manual-123',
        priority: 1,
        metadata: { source: 'manual' },
      };

      webhookRepository.findOne.mockResolvedValue(mockWebhook);
      eventRepository.create.mockReturnValue({
        ...mockWebhookEvent,
        ...triggerDto,
        payload: triggerDto.data,
      });
      eventRepository.save.mockResolvedValue({
        ...mockWebhookEvent,
        id: 'event-456',
      });
      deliveryService.deliverWebhook.mockResolvedValue({
        success: true,
        statusCode: 200,
      });

      const result = await service.triggerWebhook('webhook-123', 'org-123', triggerDto);

      expect(eventRepository.create).toHaveBeenCalledWith({
        webhookId: 'webhook-123',
        eventType: triggerDto.eventType,
        payload: {
          id: 'client-789',
          name: 'New Client',
        },
        status: EventStatus.PENDING,
        metadata: {
          correlationId: 'manual-123',
          priority: 1,
          source: 'manual',
        },
      });
      expect(deliveryService.deliverWebhook).toHaveBeenCalled();
    });

    it('should filter events based on webhook configuration', async () => {
      const triggerDto = {
        eventType: 'client.created',
        data: {
          id: 'client-789',
          name: 'Basic Client',
          type: 'basic', // Not in filter
        },
      };

      const webhookWithFilter = {
        ...mockWebhook,
        config: {
          ...mockWebhook.config,
          filters: {
            clientType: ['enterprise', 'premium'],
          },
        },
      };

      webhookRepository.findOne.mockResolvedValue(webhookWithFilter);

      await expect(service.triggerWebhook('webhook-123', 'org-123', triggerDto)).rejects.toThrow(
        'Event filtered out by webhook configuration'
      );
    });

    it('should apply data transformations', async () => {
      const triggerDto = {
        eventType: 'client.updated',
        data: {
          id: 'client-789',
          name: 'Client Corp',
          clientType: 'enterprise',
          internal_notes: 'Sensitive info',
          credit_score: 750,
          status: 'active',
        },
      };

      webhookRepository.findOne.mockResolvedValue(mockWebhook);
      eventRepository.create.mockReturnValue(mockWebhookEvent);
      eventRepository.save.mockResolvedValue(mockWebhookEvent);

      await service.triggerWebhook('webhook-123', 'org-123', triggerDto);

      expect(eventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.not.objectContaining({
            internal_notes: expect.anything(),
            credit_score: expect.anything(),
          }),
        })
      );
    });
  });

  describe('processIncomingWebhook', () => {
    it('should process incoming webhook with signature verification', async () => {
      const incomingData = {
        payload: {
          data: {
            externalId: 'ext-123',
            action: 'updated',
          },
        },
        headers: {
          'x-webhook-signature': 'sha256=valid-signature',
          'x-webhook-timestamp': new Date().toISOString(),
        },
        signature: 'sha256=valid-signature',
      };

      const mockIncomingWebhook = {
        ...mockWebhook,
        config: {
          ...mockWebhook.config,
          authentication: {
            type: 'signature',
            secret: 'webhook-secret',
            algorithm: 'sha256',
          },
        },
      };

      webhookRepository.findOne.mockResolvedValue(mockIncomingWebhook);
      eventRepository.create.mockReturnValue(mockWebhookEvent);
      eventRepository.save.mockResolvedValue({
        ...mockWebhookEvent,
        id: 'event-incoming-123',
      });

      // Mock signature verification
      jest.spyOn(service, 'verifySignature').mockResolvedValue(true);

      const result = await service.processIncomingWebhook('webhook-123', incomingData);

      expect(service.verifySignature).toHaveBeenCalledWith(
        mockIncomingWebhook,
        expect.any(String),
        incomingData.signature
      );
      expect(result.success).toBe(true);
      expect(eventEmitter.emit).toHaveBeenCalledWith('webhook.incoming', expect.any(Object));
    });

    it('should reject invalid signatures', async () => {
      const incomingData = {
        payload: { data: {} },
        headers: { 'x-webhook-signature': 'invalid' },
        signature: 'invalid',
      };

      webhookRepository.findOne.mockResolvedValue(mockWebhook);
      jest.spyOn(service, 'verifySignature').mockResolvedValue(false);

      await expect(service.processIncomingWebhook('webhook-123', incomingData)).rejects.toThrow(
        'Invalid webhook signature'
      );
    });
  });

  describe('verifySignature', () => {
    it('should verify HMAC signature', async () => {
      const webhook = {
        ...mockWebhook,
        config: {
          ...mockWebhook.config,
          authentication: {
            type: 'signature' as const,
            secret: 'test-secret',
            algorithm: 'sha256',
          },
        },
      };

      const payload = '{"test":"data"}';
      const expectedSignature =
        'sha256=' + crypto.createHmac('sha256', 'test-secret').update(payload).digest('hex');

      const result = await service.verifySignature(webhook, payload, expectedSignature);

      expect(result).toBe(true);
    });

    it('should handle missing authentication config', async () => {
      const webhook = {
        ...mockWebhook,
        config: {
          ...mockWebhook.config,
          authentication: undefined,
        },
      };

      const result = await service.verifySignature(webhook, 'payload', 'signature');

      expect(result).toBe(true); // No auth = always valid
    });
  });

  describe('Event Management', () => {
    describe('getEvents', () => {
      it('should return paginated events with filters', async () => {
        const filters = {
          status: EventStatus.DELIVERED,
          eventType: 'client.updated',
          startDate: new Date('2024-01-15'),
          endDate: new Date('2024-01-16'),
          page: 1,
          limit: 20,
        };

        const mockQueryBuilder = eventRepository.createQueryBuilder();
        mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockWebhookEvent], 1]);

        webhookRepository.findOne.mockResolvedValue(mockWebhook);

        const result = await service.getEvents('webhook-123', 'org-123', filters);

        expect(eventRepository.createQueryBuilder).toHaveBeenCalled();
        expect(mockQueryBuilder.where).toHaveBeenCalledWith('event.webhookId = :webhookId', {
          webhookId: 'webhook-123',
        });
        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('event.status = :status', {
          status: EventStatus.DELIVERED,
        });
        expect(result.data).toEqual([mockWebhookEvent]);
        expect(result.total).toBe(1);
      });
    });

    describe('retryEvent', () => {
      it('should retry failed event', async () => {
        const failedEvent = {
          ...mockWebhookEvent,
          status: EventStatus.FAILED,
          deliveryAttempts: 2,
          error: 'Connection timeout',
        };

        eventRepository.findOne.mockResolvedValue(failedEvent);
        webhookRepository.findOne.mockResolvedValue(mockWebhook);
        eventRepository.save.mockResolvedValue({
          ...failedEvent,
          status: EventStatus.PENDING,
          nextRetryAt: new Date(Date.now() + 5000),
        });
        deliveryService.scheduleRetry.mockResolvedValue(true);

        const result = await service.retryEvent('event-123', 'org-123');

        expect(result.status).toBe(EventStatus.PENDING);
        expect(result.nextRetryAt).toBeDefined();
        expect(deliveryService.scheduleRetry).toHaveBeenCalled();
      });

      it('should not retry delivered events', async () => {
        const deliveredEvent = {
          ...mockWebhookEvent,
          status: EventStatus.DELIVERED,
          webhookId: 'webhook-123',
        };

        eventRepository.findOne.mockResolvedValue(deliveredEvent);
        webhookRepository.findOne.mockResolvedValue(mockWebhook);

        await expect(service.retryEvent('event-123', 'org-123')).rejects.toThrow(
          'Cannot retry delivered event'
        );
      });

      it('should respect max retry limits', async () => {
        const maxRetriesEvent = {
          ...mockWebhookEvent,
          status: EventStatus.FAILED,
          deliveryAttempts: 3, // Already at max
        };

        eventRepository.findOne.mockResolvedValue(maxRetriesEvent);
        webhookRepository.findOne.mockResolvedValue(mockWebhook);

        await expect(service.retryEvent('event-123', 'org-123')).rejects.toThrow(
          'Event has reached maximum retry attempts'
        );
      });
    });
  });

  describe('getStats', () => {
    it('should calculate webhook statistics', async () => {
      const events = [
        { ...mockWebhookEvent, status: EventStatus.DELIVERED, response: { responseTime: 200 } },
        { ...mockWebhookEvent, status: EventStatus.DELIVERED, response: { responseTime: 300 } },
        { ...mockWebhookEvent, status: EventStatus.FAILED },
      ];

      webhookRepository.findOne.mockResolvedValue(mockWebhook);
      eventRepository.find.mockResolvedValue(events);

      const result = await service.getStats('webhook-123', 'org-123', { hours: 24 });

      expect(result.totalEvents).toBe(3);
      expect(result.deliveredEvents).toBe(2);
      expect(result.failedEvents).toBe(1);
      expect(result.deliveryRate).toBeCloseTo(66.67);
      expect(result.averageResponseTime).toBe(250);
    });

    it('should group events by type', async () => {
      const events = [
        { ...mockWebhookEvent, eventType: 'client.created' },
        { ...mockWebhookEvent, eventType: 'client.created' },
        { ...mockWebhookEvent, eventType: 'client.updated' },
      ];

      webhookRepository.findOne.mockResolvedValue(mockWebhook);
      eventRepository.find.mockResolvedValue(events);

      const result = await service.getStats('webhook-123', 'org-123', { hours: 24 });

      expect(result.eventsByType).toEqual({
        'client.created': 2,
        'client.updated': 1,
      });
    });
  });

  describe('activate/deactivate', () => {
    it('should activate webhook', async () => {
      const inactiveWebhook = {
        ...mockWebhook,
        status: WebhookStatus.INACTIVE,
      };

      webhookRepository.findOne.mockResolvedValue(inactiveWebhook);
      webhookRepository.save.mockResolvedValue({
        ...inactiveWebhook,
        status: WebhookStatus.ACTIVE,
      });

      const result = await service.activate('webhook-123', 'org-123');

      expect(result.status).toBe(WebhookStatus.ACTIVE);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'webhook.activated',
        expect.objectContaining({ webhookId: 'webhook-123' })
      );
    });

    it('should deactivate webhook', async () => {
      webhookRepository.findOne.mockResolvedValue(mockWebhook);
      webhookRepository.save.mockResolvedValue({
        ...mockWebhook,
        status: WebhookStatus.INACTIVE,
      });

      const result = await service.deactivate('webhook-123', 'org-123');

      expect(result.status).toBe(WebhookStatus.INACTIVE);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'webhook.deactivated',
        expect.objectContaining({ webhookId: 'webhook-123' })
      );
    });
  });

  describe('update', () => {
    it('should update webhook configuration', async () => {
      const updateDto = {
        config: {
          ...mockWebhook.config,
          retryPolicy: {
            maxRetries: 5,
            retryDelay: 5000,
            backoffMultiplier: 3,
          },
        },
        tags: ['client-sync', 'production', 'priority'],
      };

      webhookRepository.findOne.mockResolvedValue(mockWebhook);
      webhookRepository.save.mockResolvedValue({
        ...mockWebhook,
        ...updateDto,
      });

      const result = await service.update('webhook-123', 'org-123', updateDto);

      expect(result.config.retryPolicy.maxRetries).toBe(5);
      expect(result.tags).toContain('priority');
    });
  });

  describe('delete', () => {
    it('should soft delete webhook and associated events', async () => {
      webhookRepository.findOne.mockResolvedValue(mockWebhook);
      webhookRepository.softDelete.mockResolvedValue({ affected: 1 });

      await service.delete('webhook-123', 'org-123');

      expect(webhookRepository.softDelete).toHaveBeenCalledWith('webhook-123');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'webhook.deleted',
        expect.objectContaining({
          webhookId: 'webhook-123',
          organizationId: 'org-123',
        })
      );
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.restoreAllMocks();
  });

  afterAll(() => {
    jest.useRealTimers();
  });
});
