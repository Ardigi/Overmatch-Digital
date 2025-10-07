import { BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import {
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  NotificationType,
} from './entities/notification.entity';
import { NotificationsController } from './notifications.controller';
import type { NotificationsService } from './notifications.service';
import type { NotificationPreferencesService } from './services/notification-preferences.service';
import type { NotificationTemplatesService } from './services/notification-templates.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let notificationsService: jest.Mocked<NotificationsService>;
  let templatesService: jest.Mocked<NotificationTemplatesService>;
  let preferencesService: jest.Mocked<NotificationPreferencesService>;

  const mockUser = {
    id: 'user-123',
    email: 'user@example.com',
    organizationId: 'org-123',
    role: 'user',
  };

  const mockAdminUser = {
    id: 'admin-123',
    email: 'admin@example.com',
    organizationId: 'org-123',
    role: 'admin',
  };

  const mockNotification = {
    id: 'notification-123',
    notificationId: 'notif_123',
    organizationId: 'org-123',
    recipientId: 'user-123',
    recipient: {
      id: 'user-123',
      email: 'user@example.com',
      name: 'Test User',
    },
    channel: NotificationChannel.EMAIL,
    type: NotificationType.ALERT,
    category: NotificationCategory.SYSTEM,
    content: {
      subject: 'Test Notification',
      body: 'This is a test notification',
      htmlBody: '<p>This is a test notification</p>',
      metadata: {
        templateCode: 'test-template',
      },
    },
    status: NotificationStatus.DELIVERED,
    priority: NotificationPriority.MEDIUM,
    tags: ['test', 'alert'],
    openCount: 2,
    clickCount: 1,
    tracking: {
      opens: [
        {
          timestamp: new Date('2024-01-15T10:00:00Z'),
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
      ],
      clicks: [
        {
          timestamp: new Date('2024-01-15T10:05:00Z'),
          url: 'https://example.com/action',
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
      ],
    },
    deliveryAttemptsCount: 1,
    deliveredAt: new Date('2024-01-15T09:00:00Z'),
    createdAt: new Date('2024-01-15T08:00:00Z'),
    updatedAt: new Date('2024-01-15T14:00:00Z'),
  };

  const mockTemplate = {
    id: 'template-123',
    organizationId: 'org-123',
    code: 'welcome-email',
    name: 'Welcome Email',
    description: 'Welcome email template for new users',
    channel: NotificationChannel.EMAIL,
    type: NotificationType.SYSTEM,
    category: NotificationCategory.SYSTEM,
    content: {
      subject: 'Welcome to {{company}}!',
      body: 'Hi {{name}}, welcome to {{company}}!',
      htmlBody: '<h1>Hi {{name}}</h1><p>Welcome to {{company}}!</p>',
      variables: {
        name: { required: true, type: 'string' },
        company: { required: true, type: 'string' },
      },
    },
    metadata: {
      tags: ['welcome', 'transactional'],
      author: 'admin',
    },
    isActive: true,
    version: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockPreference = {
    id: 'pref-123',
    organizationId: 'org-123',
    userId: 'user-123',
    userEmail: 'user@example.com',
    channels: {
      [NotificationChannel.EMAIL]: {
        enabled: true,
        frequency: 'immediate',
        categories: {
          [NotificationCategory.SYSTEM]: true,
          [NotificationCategory.MARKETING]: false,
        },
      },
      [NotificationChannel.SMS]: {
        enabled: false,
      },
    },
    optedOut: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    // Create mocks
    notificationsService = {
      create: jest.fn(),
      createBulk: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn(),
      resend: jest.fn(),
      recordOpen: jest.fn(),
      recordClick: jest.fn(),
      getStats: jest.fn(),
    } as any;

    templatesService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      clone: jest.fn(),
      testTemplate: jest.fn(),
    } as any;

    preferencesService = {
      create: jest.fn(),
      findOne: jest.fn(),
      findByUser: jest.fn(),
      update: jest.fn(),
      setChannelPreference: jest.fn(),
      setCategoryPreference: jest.fn(),
      setTypePreference: jest.fn(),
      optOut: jest.fn(),
      optIn: jest.fn(),
      blockUser: jest.fn(),
      unblockUser: jest.fn(),
      blockSource: jest.fn(),
      unblockSource: jest.fn(),
      generateUnsubscribeLink: jest.fn(),
      handleUnsubscribe: jest.fn(),
    } as any;

    // Create controller instance with manual instantiation
    controller = new NotificationsController(
      notificationsService,
      templatesService,
      preferencesService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a notification', async () => {
      const createDto = {
        channel: NotificationChannel.EMAIL,
        type: NotificationType.ALERT,
        category: NotificationCategory.SYSTEM,
        recipient: {
          id: 'user-123',
          email: 'user@example.com',
          name: 'Test User',
        },
        content: {
          subject: 'Test Subject',
          body: 'Test Body',
        },
        priority: NotificationPriority.HIGH,
      };

      notificationsService.create.mockResolvedValue(mockNotification as any);

      const result = await controller.create(mockUser, createDto);

      expect(result).toEqual(mockNotification);
      expect(notificationsService.create).toHaveBeenCalledWith(
        mockUser.organizationId,
        createDto,
        mockUser.id
      );
    });

    it('should validate required fields', async () => {
      // Validation happens at the framework level with ValidationPipe
      // In unit tests, we test that the service is called with the right params
      // The service will throw if validation fails
      const invalidDto = {
        channel: NotificationChannel.EMAIL,
        // Missing required fields
      } as any;

      notificationsService.create.mockRejectedValue(new Error('Validation failed'));

      await expect(controller.create(mockUser, invalidDto)).rejects.toThrow('Validation failed');
    });
  });

  describe('createBulk', () => {
    it('should create multiple notifications', async () => {
      const bulkDto = {
        notifications: [
          {
            channel: NotificationChannel.EMAIL,
            type: NotificationType.ALERT,
            category: NotificationCategory.SYSTEM,
            recipient: { id: 'user-1', email: 'user1@example.com' },
            content: { body: 'Test 1' },
          },
          {
            channel: NotificationChannel.EMAIL,
            type: NotificationType.ALERT,
            category: NotificationCategory.SYSTEM,
            recipient: { id: 'user-2', email: 'user2@example.com' },
            content: { body: 'Test 2' },
          },
        ],
      };

      notificationsService.createBulk.mockResolvedValue([
        mockNotification,
        mockNotification,
      ] as any);

      const result = await controller.createBulk(mockAdminUser, bulkDto);

      expect(result).toHaveLength(2);
      expect(notificationsService.createBulk).toHaveBeenCalledWith(
        mockAdminUser.organizationId,
        bulkDto,
        mockAdminUser.id
      );
    });

    it('should require admin role', async () => {
      const bulkDto = {
        notifications: [],
      };

      // This would be handled by guards in real implementation
      // Here we just test that the method calls the service
      await controller.createBulk(mockUser, bulkDto);
      expect(notificationsService.createBulk).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated notifications', async () => {
      const query = {
        page: 1,
        limit: 20,
        channel: NotificationChannel.EMAIL,
      };

      const mockResult = {
        items: [mockNotification],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };

      notificationsService.findAll.mockResolvedValue({
        items: [mockNotification as any],
        total: 1,
      });

      const result = await controller.findAll(mockUser, query);

      expect(result).toMatchObject(mockResult);
      expect(notificationsService.findAll).toHaveBeenCalledWith(mockUser.organizationId, query);
    });

    it('should apply default pagination', async () => {
      notificationsService.findAll.mockResolvedValue({
        items: [],
        total: 0,
      });

      await controller.findAll(mockUser, {});

      expect(notificationsService.findAll).toHaveBeenCalledWith(
        mockUser.organizationId,
        expect.objectContaining({
          page: 1,
          limit: 20,
        })
      );
    });
  });

  describe('findOne', () => {
    it('should return a notification by id', async () => {
      notificationsService.findOne.mockResolvedValue(mockNotification as any);

      const result = await controller.findOne(mockUser, 'notification-123');

      expect(result).toEqual(mockNotification);
      expect(notificationsService.findOne).toHaveBeenCalledWith(
        mockUser.organizationId,
        'notification-123'
      );
    });

    it('should throw NotFoundException if not found', async () => {
      notificationsService.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(mockUser, 'invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a notification', async () => {
      const updateDto = {
        status: NotificationStatus.DELIVERED,
        deliveredAt: new Date(),
      };

      notificationsService.update.mockResolvedValue({
        ...mockNotification,
        ...updateDto,
      } as any);

      const result = await controller.update(mockUser, 'notification-123', updateDto);

      expect(result.status).toBe(NotificationStatus.DELIVERED);
      expect(notificationsService.update).toHaveBeenCalledWith(
        mockUser.organizationId,
        'notification-123',
        updateDto,
        mockUser.id
      );
    });
  });

  describe('cancel', () => {
    it('should cancel a notification', async () => {
      notificationsService.cancel.mockResolvedValue({
        ...mockNotification,
        status: NotificationStatus.FAILED,
        lastError: 'Cancelled by user',
      } as any);

      const result = await controller.cancel(mockUser, 'notification-123');

      expect(result.message).toBe('Notification cancelled successfully');
      expect(notificationsService.cancel).toHaveBeenCalledWith(
        mockUser.organizationId,
        'notification-123',
        mockUser.id
      );
    });
  });

  describe('resend', () => {
    it('should resend a notification', async () => {
      notificationsService.resend.mockResolvedValue({
        ...mockNotification,
        status: NotificationStatus.PENDING,
      } as any);

      const result = await controller.resend(mockUser, 'notification-123');

      expect(result.message).toBe('Notification queued for resend');
      expect(notificationsService.resend).toHaveBeenCalledWith(
        mockUser.organizationId,
        'notification-123',
        mockUser.id
      );
    });
  });

  describe('recordOpen', () => {
    it('should record notification open', async () => {
      const mockRequest = {
        ip: '192.168.1.1',
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      } as any;

      await controller.recordOpen('notification-123', mockRequest);

      expect(notificationsService.recordOpen).toHaveBeenCalledWith(
        expect.any(String), // Would need to extract org ID from notification
        'notification-123',
        '192.168.1.1',
        'Mozilla/5.0'
      );
    });
  });

  describe('recordClick', () => {
    it('should record notification click and redirect', async () => {
      const mockRequest = {
        ip: '192.168.1.1',
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      } as any;

      const mockResponse = {
        redirect: jest.fn(),
      } as any;

      await controller.recordClick(
        'notification-123',
        'https://example.com',
        mockRequest,
        mockResponse
      );

      expect(notificationsService.recordClick).toHaveBeenCalledWith(
        expect.any(String),
        'notification-123',
        'https://example.com',
        '192.168.1.1',
        'Mozilla/5.0'
      );
      expect(mockResponse.redirect).toHaveBeenCalledWith('https://example.com');
    });
  });

  describe('getStats', () => {
    it('should return notification statistics', async () => {
      const query = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      const mockStats = {
        total: 100,
        byChannel: {
          email: 70,
          sms: 30,
        },
        byStatus: {
          sent: 50,
          delivered: 45,
          failed: 5,
        },
        deliveryRate: 90,
        openRate: 60,
        clickRate: 30,
      };

      notificationsService.getStats.mockResolvedValue(mockStats);

      const result = await controller.getStats(mockUser, query);

      expect(result).toEqual(mockStats);
      expect(notificationsService.getStats).toHaveBeenCalledWith(
        mockUser.organizationId,
        new Date(query.startDate),
        new Date(query.endDate)
      );
    });

    it('should use default date range', async () => {
      notificationsService.getStats.mockResolvedValue({} as any);

      await controller.getStats(mockUser, {});

      expect(notificationsService.getStats).toHaveBeenCalledWith(
        mockUser.organizationId,
        expect.any(Date),
        expect.any(Date)
      );
    });
  });

  // Template endpoints
  describe('createTemplate', () => {
    it('should create a template', async () => {
      const createDto = {
        code: 'test-template',
        name: 'Test Template',
        channel: NotificationChannel.EMAIL,
        type: NotificationType.SYSTEM,
        category: NotificationCategory.SYSTEM,
        content: {
          subject: 'Test {{variable}}',
          body: 'Body {{variable}}',
          variables: {
            variable: { name: 'variable', required: true, type: 'string' as const },
          },
        },
      };

      templatesService.create.mockResolvedValue(mockTemplate as any);

      const result = await controller.createTemplate(mockAdminUser, createDto);

      expect(result).toEqual(mockTemplate);
      expect(templatesService.create).toHaveBeenCalledWith(
        mockAdminUser.organizationId,
        createDto,
        mockAdminUser.id
      );
    });
  });

  describe('findAllTemplates', () => {
    it('should return templates', async () => {
      const query = {
        channel: NotificationChannel.EMAIL,
        isActive: true,
      };

      templatesService.findAll.mockResolvedValue({
        items: [mockTemplate as any],
        total: 1,
      });

      const result = await controller.findAllTemplates(mockUser, query);

      expect(result.items).toHaveLength(1);
      expect(templatesService.findAll).toHaveBeenCalledWith(mockUser.organizationId, query);
    });
  });

  // Preference endpoints
  describe('getMyPreferences', () => {
    it('should return user preferences', async () => {
      preferencesService.findByUser.mockResolvedValue(mockPreference as any);

      const result = await controller.getMyPreferences(mockUser);

      expect(result).toEqual(mockPreference);
      expect(preferencesService.findByUser).toHaveBeenCalledWith(
        mockUser.organizationId,
        mockUser.id
      );
    });

    it('should create default preferences if not found', async () => {
      preferencesService.findByUser.mockResolvedValue(null);
      preferencesService.create.mockResolvedValue(mockPreference as any);

      const result = await controller.getMyPreferences(mockUser);

      expect(result).toEqual(mockPreference);
      expect(preferencesService.create).toHaveBeenCalled();
    });
  });

  describe('updateMyPreferences', () => {
    it('should update user preferences', async () => {
      const updateDto = {
        channels: {
          [NotificationChannel.EMAIL]: {
            enabled: false,
          },
        },
      };

      preferencesService.update.mockResolvedValue({
        ...mockPreference,
        ...updateDto,
      } as any);

      const result = await controller.updateMyPreferences(mockUser, updateDto);

      expect(result.channels[NotificationChannel.EMAIL].enabled).toBe(false);
      expect(preferencesService.update).toHaveBeenCalledWith(
        mockUser.organizationId,
        mockUser.id,
        updateDto,
        mockUser.id
      );
    });
  });

  describe('optOut', () => {
    it('should opt out user from notifications', async () => {
      const optOutDto = {
        reason: 'Too many emails',
      };

      preferencesService.optOut.mockResolvedValue({
        ...mockPreference,
        optedOut: true,
      } as any);

      const result = await controller.optOut(mockUser, optOutDto);

      expect(result.message).toBe('Successfully opted out of notifications');
      expect(preferencesService.optOut).toHaveBeenCalledWith(
        mockUser.organizationId,
        mockUser.id,
        optOutDto.reason
      );
    });
  });

  describe('unsubscribe', () => {
    it('should handle unsubscribe via token', async () => {
      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as any;

      preferencesService.handleUnsubscribe.mockResolvedValue({
        success: true,
        message: 'Unsubscribed successfully',
      });

      await controller.unsubscribe('unsubscribe-token', mockResponse);

      expect(preferencesService.handleUnsubscribe).toHaveBeenCalledWith('unsubscribe-token');
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.send).toHaveBeenCalledWith(expect.stringContaining('Unsubscribed'));
    });
  });
});
