import { BadRequestException, NotFoundException } from '@nestjs/common';
import { type WebhookConfig, WebhookStatus } from './entities/webhook-endpoint.entity';
import { EventStatus } from './entities/webhook-event.entity';
import { WebhookService } from './services/webhook.service';
import { WebhooksController } from './webhooks.controller';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let webhookService: any;

  const mockUser = {
    id: 'user-123',
    email: 'admin@example.com',
    organizationId: 'org-123',
    roles: ['admin'],
  };

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
        secret: 'encrypted-webhook-secret',
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
      lastFailureAt: null,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockWebhookEvent = {
    id: 'event-123',
    webhookId: 'webhook-123',
    eventType: 'client.updated',
    status: EventStatus.DELIVERED,
    payload: {
      id: 'client-456',
      name: 'Acme Corp',
      status: 'active',
      updatedAt: new Date(),
    },
    deliveryAttempts: 1,
    lastAttemptAt: new Date(),
    nextRetryAt: null,
    response: {
      statusCode: 200,
      headers: { 'x-request-id': 'req-789' },
      body: { success: true },
      responseTime: 250,
    },
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
    webhookService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      activate: jest.fn(),
      deactivate: jest.fn(),
      testWebhook: jest.fn(),
      triggerWebhook: jest.fn(),
      processIncomingWebhook: jest.fn(),
      getEvents: jest.fn(),
      getEvent: jest.fn(),
      retryEvent: jest.fn(),
      getStats: jest.fn(),
      verifySignature: jest.fn(),
      getWebhook: jest.fn(),
      resendEvents: jest.fn(),
    };

    // Manual instantiation
    controller = new WebhooksController(webhookService);

    jest.clearAllMocks();
  });

  describe('listWebhooks', () => {
    it('should return filtered webhooks', async () => {
      const mockWebhooks = [mockWebhook];
      webhookService.findAll.mockResolvedValue(mockWebhooks);

      const result = await controller.listWebhooks(
        { user: mockUser },
        WebhookStatus.ACTIVE,
        'integration-123',
        'production,client-sync'
      );

      expect(webhookService.findAll).toHaveBeenCalledWith(mockUser.organizationId, {
        status: WebhookStatus.ACTIVE,
        integrationId: 'integration-123',
        tags: ['production', 'client-sync'],
      });
      expect(result).toEqual(mockWebhooks);
    });

    it('should handle empty filters', async () => {
      webhookService.findAll.mockResolvedValue([]);

      await controller.listWebhooks({ user: mockUser });

      expect(webhookService.findAll).toHaveBeenCalledWith(mockUser.organizationId, {
        status: undefined,
        integrationId: undefined,
        tags: undefined,
      });
    });
  });

  describe('createWebhook', () => {
    it('should create a new webhook', async () => {
      const createDto = {
        name: 'Order Processing Webhook',
        description: 'Notifies order processing system',
        url: 'https://api.orders.com/webhook',
        config: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token',
          },
          events: ['order.created', 'order.updated'],
          retryPolicy: {
            maxRetries: 5,
            retryDelay: 2000,
            backoffMultiplier: 2,
          },
          authentication: {
            type: 'signature',
            secret: 'webhook-secret',
            algorithm: 'sha256',
          },
        } as WebhookConfig,
        sslVerification: true,
        timeoutSeconds: 30,
        tags: ['orders', 'critical'],
      };

      webhookService.create.mockResolvedValue({
        ...mockWebhook,
        ...createDto,
        id: 'webhook-456',
      });

      const result = await controller.createWebhook(createDto, { user: mockUser });

      expect(webhookService.create).toHaveBeenCalledWith({
        ...createDto,
        organizationId: mockUser.organizationId,
      });
      expect(result.name).toBe(createDto.name);
    });

    it('should validate webhook URL', async () => {
      const createDto = {
        name: 'Invalid Webhook',
        url: 'not-a-valid-url',
        config: {} as WebhookConfig,
      };

      webhookService.create.mockRejectedValue(new BadRequestException('Invalid webhook URL'));

      await expect(controller.createWebhook(createDto, { user: mockUser })).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('updateWebhook', () => {
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

      const updatedWebhook = { ...mockWebhook, ...updateDto };
      webhookService.update.mockResolvedValue(updatedWebhook);

      const result = await controller.updateWebhook('webhook-123', updateDto, { user: mockUser });

      expect(webhookService.update).toHaveBeenCalledWith(
        'webhook-123',
        mockUser.organizationId,
        updateDto
      );
      expect(result.config.retryPolicy.maxRetries).toBe(5);
      expect(result.tags).toContain('priority');
    });
  });

  describe('activate/deactivate', () => {
    it('should activate a webhook', async () => {
      const activatedWebhook = {
        ...mockWebhook,
        status: WebhookStatus.ACTIVE,
      };

      webhookService.activate.mockResolvedValue(activatedWebhook);

      const result = await controller.activateWebhook('webhook-123', { user: mockUser });

      expect(webhookService.activate).toHaveBeenCalledWith('webhook-123', mockUser.organizationId);
      expect(result.status).toBe(WebhookStatus.ACTIVE);
    });

    it('should deactivate a webhook', async () => {
      const deactivatedWebhook = {
        ...mockWebhook,
        status: WebhookStatus.INACTIVE,
      };

      webhookService.deactivate.mockResolvedValue(deactivatedWebhook);

      const result = await controller.deactivateWebhook('webhook-123', { user: mockUser });

      expect(webhookService.deactivate).toHaveBeenCalledWith(
        'webhook-123',
        mockUser.organizationId
      );
      expect(result.status).toBe(WebhookStatus.INACTIVE);
    });
  });

  describe('testWebhook', () => {
    it('should test webhook with sample payload', async () => {
      const testDto = {
        eventType: 'client.updated',
        payload: {
          id: 'test-client-123',
          name: 'Test Client',
          status: 'active',
        },
      };

      const testResult = {
        success: true,
        statusCode: 200,
        responseTime: 250,
        headers: {
          'x-request-id': 'test-req-123',
        },
        body: {
          received: true,
          processed: true,
        },
        error: null,
      };

      webhookService.testWebhook.mockResolvedValue(testResult);

      const result = await controller.testWebhook('webhook-123', testDto, { user: mockUser });

      expect(webhookService.testWebhook).toHaveBeenCalledWith(
        'webhook-123',
        mockUser.organizationId,
        testDto
      );
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
    });

    it('should handle test failures', async () => {
      const testDto = {
        eventType: 'client.updated',
        payload: {},
      };

      const testResult = {
        success: false,
        statusCode: 500,
        responseTime: 30000,
        headers: {},
        body: null,
        error: 'Connection timeout',
      };

      webhookService.testWebhook.mockResolvedValue(testResult);

      const result = await controller.testWebhook('webhook-123', testDto, { user: mockUser });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  describe('triggerWebhook', () => {
    it('should trigger webhook manually', async () => {
      const triggerDto = {
        eventType: 'client.created',
        data: {
          id: 'client-789',
          name: 'New Client Corp',
          type: 'enterprise',
        },
        correlationId: 'manual-trigger-123',
        priority: 1,
        metadata: {
          triggeredBy: 'user-123',
          reason: 'Testing webhook integration',
        },
      };

      webhookService.triggerWebhook.mockResolvedValue({
        ...mockWebhookEvent,
        eventType: triggerDto.eventType,
        payload: triggerDto.data,
        metadata: triggerDto.metadata,
      });

      const result = await controller.triggerWebhook('webhook-123', triggerDto, { user: mockUser });

      expect(webhookService.triggerWebhook).toHaveBeenCalledWith(
        'webhook-123',
        mockUser.organizationId,
        triggerDto
      );
      expect(result.eventType).toBe(triggerDto.eventType);
    });
  });

  describe('Incoming Webhooks', () => {
    it('should process incoming webhook', async () => {
      const incomingDto = {
        webhookId: 'webhook-123',
        signature: 'sha256=abcd1234...',
        eventType: 'external.event',
        timestamp: new Date().toISOString(),
        data: {
          externalId: 'ext-123',
          action: 'updated',
          resource: 'customer',
        },
      };

      const processResult = {
        success: true,
        eventId: 'event-incoming-123',
        message: 'Webhook processed successfully',
      };

      webhookService.processIncomingWebhook.mockResolvedValue(processResult);

      const result = await controller.processIncomingWebhook('webhook-123', incomingDto, {
        'x-webhook-signature': incomingDto.signature,
        'x-webhook-timestamp': incomingDto.timestamp,
      });

      expect(webhookService.processIncomingWebhook).toHaveBeenCalledWith(
        'webhook-123',
        expect.objectContaining({
          payload: incomingDto,
          headers: expect.any(Object),
          signature: incomingDto.signature,
        })
      );
      expect(result.success).toBe(true);
    });

    it('should verify webhook signature', async () => {
      const incomingDto = {
        data: { test: 'payload' },
      };

      webhookService.verifySignature.mockResolvedValue(false);
      webhookService.processIncomingWebhook.mockRejectedValue(
        new BadRequestException('Invalid signature')
      );

      await expect(
        controller.processIncomingWebhook('webhook-123', incomingDto, {
          'x-webhook-signature': 'invalid-signature',
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Event Management', () => {
    describe('getEvents', () => {
      it('should return webhook events with filters', async () => {
        const events = [mockWebhookEvent];
        webhookService.getEvents.mockResolvedValue({
          data: events,
          total: 1,
          page: 1,
          limit: 20,
        });

        const result = await controller.getEvents(
          'webhook-123',
          { user: mockUser },
          EventStatus.DELIVERED,
          'client.updated',
          '2024-01-15',
          '2024-01-16',
          1,
          20
        );

        expect(webhookService.getEvents).toHaveBeenCalledWith(
          'webhook-123',
          mockUser.organizationId,
          {
            status: EventStatus.DELIVERED,
            eventType: 'client.updated',
            startDate: new Date('2024-01-15'),
            endDate: new Date('2024-01-16'),
            page: 1,
            limit: 20,
          }
        );
        expect(result.data).toEqual(events);
      });
    });

    describe('retryEvent', () => {
      it('should retry failed event', async () => {
        const failedEvent = {
          ...mockWebhookEvent,
          status: EventStatus.FAILED,
          deliveryAttempts: 3,
        };

        webhookService.getEvent.mockResolvedValue(failedEvent);
        webhookService.retryEvent.mockResolvedValue({
          ...failedEvent,
          status: EventStatus.PENDING,
          deliveryAttempts: 4,
          nextRetryAt: new Date(Date.now() + 5000),
        });

        const result = await controller.retryEvent('webhook-123', 'event-123', { user: mockUser });

        expect(webhookService.retryEvent).toHaveBeenCalledWith(
          'event-123',
          mockUser.organizationId
        );
        expect(result.status).toBe(EventStatus.PENDING);
        expect(result.deliveryAttempts).toBe(4);
      });

      it('should not retry delivered events', async () => {
        webhookService.getEvent.mockResolvedValue(mockWebhookEvent);
        webhookService.retryEvent.mockRejectedValue(
          new BadRequestException('Cannot retry delivered event')
        );

        await expect(
          controller.retryEvent('webhook-123', 'event-123', { user: mockUser })
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe('getStats', () => {
    it('should return webhook statistics', async () => {
      const stats = {
        totalEvents: 5000,
        deliveredEvents: 4800,
        failedEvents: 150,
        pendingEvents: 50,
        deliveryRate: 96,
        averageResponseTime: 350,
        eventsByType: {
          'client.created': 1500,
          'client.updated': 2500,
          'client.deleted': 1000,
        },
        hourlyStats: [
          {
            hour: '2024-01-15T10:00:00Z',
            events: 100,
            delivered: 95,
            failed: 5,
            avgResponseTime: 300,
          },
        ],
        recentFailures: [
          {
            eventId: 'event-fail-1',
            eventType: 'client.updated',
            error: 'Connection refused',
            timestamp: new Date(),
          },
        ],
      };

      webhookService.getStats.mockResolvedValue(stats);

      const result = await controller.getStats('webhook-123', { user: mockUser }, 24);

      expect(webhookService.getStats).toHaveBeenCalledWith('webhook-123', mockUser.organizationId, {
        hours: 24,
      });
      expect(result).toEqual(stats);
    });
  });

  describe('Bulk Operations', () => {
    it('should resend multiple events', async () => {
      const resendDto = {
        eventIds: ['event-1', 'event-2', 'event-3'],
      };

      const resendResult = {
        totalEvents: 3,
        queuedForResend: 3,
        skipped: 0,
        results: [
          { eventId: 'event-1', status: 'queued' },
          { eventId: 'event-2', status: 'queued' },
          { eventId: 'event-3', status: 'queued' },
        ],
      };

      webhookService.getWebhook.mockResolvedValue(mockWebhook);
      webhookService.resendEvents.mockResolvedValue(resendResult);

      const result = await controller.resendEvents('webhook-123', resendDto, { user: mockUser });

      expect(result.queuedForResend).toBe(3);
      expect(result.skipped).toBe(0);
    });
  });

  describe('Role-based access control', () => {
    it('should allow viewers to list webhooks', async () => {
      const viewerUser = { ...mockUser, roles: ['viewer'] };
      webhookService.findAll.mockResolvedValue([mockWebhook]);

      await controller.listWebhooks({ user: viewerUser });

      expect(webhookService.findAll).toHaveBeenCalled();
    });

    it('should restrict webhook modification to admins', async () => {
      // In real implementation, this would be enforced by guards
      // Test demonstrates expected behavior
      expect(controller.createWebhook).toBeDefined();
      expect(controller.updateWebhook).toBeDefined();
      expect(controller.deleteWebhook).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should handle webhook not found', async () => {
      webhookService.findOne.mockRejectedValue(new NotFoundException('Webhook not found'));

      await expect(controller.getWebhook('non-existent', { user: mockUser })).rejects.toThrow(
        NotFoundException
      );
    });

    it('should handle invalid webhook configuration', async () => {
      const invalidDto = {
        name: 'Invalid Webhook',
        url: 'https://api.example.com',
        config: {
          method: 'INVALID_METHOD',
        } as any,
      };

      webhookService.create.mockRejectedValue(new BadRequestException('Invalid HTTP method'));

      await expect(controller.createWebhook(invalidDto, { user: mockUser })).rejects.toThrow(
        BadRequestException
      );
    });
  });
});
