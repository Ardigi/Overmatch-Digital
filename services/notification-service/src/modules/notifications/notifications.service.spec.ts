import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { CacheService } from '@soc-compliance/cache-common';
import type { Queue } from 'bull';
import { Repository } from 'typeorm';
import { KafkaService } from '../kafka/kafka.service';
import {
  Notification,
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  NotificationType,
} from './entities/notification.entity';
import type { NotificationPreference } from './entities/notification-preference.entity';
import type { NotificationTemplate } from './entities/notification-template.entity';
import { NotificationsService } from './notifications.service';
import type { UserDataService } from './services/user-data.service';
import {
  createMockRepository,
  createMockQueryBuilder,
  createMockQueue,
  createMockConfigService,
  createMockKafkaService,
  createMockUserDataService,
  createMockEventEmitter,
  createMockCacheService,
  createMockNotification,
  createMockTemplate,
  createMockPreference,
} from './__mocks__/test-factories';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notificationRepository: jest.Mocked<Repository<Notification>>;
  let templateRepository: jest.Mocked<Repository<NotificationTemplate>>;
  let preferenceRepository: jest.Mocked<Repository<NotificationPreference>>;
  let notificationQueue: jest.Mocked<Queue>;
  let configService: jest.Mocked<ConfigService>;
  let kafkaService: jest.Mocked<KafkaService>;
  let userDataService: jest.Mocked<UserDataService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(() => {
    // Create mocks using type-safe factories
    notificationRepository = createMockRepository<Notification>();
    templateRepository = createMockRepository<NotificationTemplate>();
    preferenceRepository = createMockRepository<NotificationPreference>();
    notificationQueue = createMockQueue();
    configService = createMockConfigService();
    kafkaService = createMockKafkaService();
    userDataService = createMockUserDataService();
    eventEmitter = createMockEventEmitter();
    cacheService = createMockCacheService();

    // Configure default mock behaviors
    configService.get.mockReturnValue('test-value');

    // Create service instance with manual instantiation
    service = new NotificationsService(
      notificationRepository,
      templateRepository,
      preferenceRepository,
      notificationQueue,
      configService,
      kafkaService,
      userDataService,
      eventEmitter,
      cacheService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a notification successfully', async () => {
      // Arrange
      const createDto = {
        type: NotificationType.TRANSACTIONAL,
        channel: NotificationChannel.EMAIL,
        priority: NotificationPriority.HIGH,
        category: NotificationCategory.USER,
        recipient: {
          id: 'user-123',
          email: 'john@example.com',
          name: 'John Doe',
        },
        templateId: 'template-123',
        variables: {
          firstName: 'John',
          company: 'Acme Corp',
        },
      };

      const mockUser = {
        id: 'user-123',
        organizationId: 'org-123',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      const mockTemplate = createMockTemplate({
        id: 'template-123',
        code: 'welcome_email',
        organizationId: 'org-123',
      });

      const mockPreference = createMockPreference({
        userId: 'user-123',
        organizationId: 'org-123',
      });

      const mockNotification = createMockNotification({
        organizationId: 'org-123',
        recipientId: 'user-123',
        templateId: mockTemplate.id,
        channel: NotificationChannel.EMAIL,
        recipient: {
          id: 'user-123',
          email: mockUser.email,
          name: 'John Doe',
        },
        priority: NotificationPriority.HIGH,
      });

      // The service doesn't need to fetch user data since recipient info is provided
      templateRepository.findOne.mockResolvedValue(mockTemplate);
      preferenceRepository.findOne.mockResolvedValue(mockPreference);
      notificationRepository.create.mockReturnValue(mockNotification);
      notificationRepository.save.mockResolvedValue(mockNotification);
      notificationQueue.add.mockResolvedValue({
        id: 'job-123',
        data: { notificationId: mockNotification.id },
      } as any);

      // Act
      const result = await service.create('org-123', createDto, 'user-123');

      // Assert
      expect(result).toEqual(mockNotification);
      expect(templateRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: 'template-123',
          organizationId: 'org-123',
          isActive: true,
        },
      });
      expect(notificationRepository.save).toHaveBeenCalledWith(expect.any(Notification));
      expect(notificationQueue.add).toHaveBeenCalledWith(
        'send-notification',
        { 
          notificationId: mockNotification.id,
          organizationId: 'org-123',
        },
        expect.any(Object),
      );
    });

    it('should throw BadRequestException if content is missing and no template provided', async () => {
      // Arrange
      const createDto = {
        type: NotificationType.TRANSACTIONAL,
        channel: NotificationChannel.EMAIL,
        priority: NotificationPriority.HIGH,
        category: NotificationCategory.USER,
        recipient: {
          id: 'user-123',
          email: 'user@example.com',
          name: 'Test User',
        },
        // No templateId and no content
      };

      // Act & Assert
      await expect(service.create('org-123', createDto, 'user-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if template not found', async () => {
      // Arrange
      const createDto = {
        type: NotificationType.TRANSACTIONAL,
        channel: NotificationChannel.EMAIL,
        priority: NotificationPriority.HIGH,
        category: NotificationCategory.USER,
        recipient: {
          id: 'user-123',
          email: 'user@example.com',
          name: 'Test User',
        },
        templateId: 'nonexistent-template',
      };

      templateRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create('org-123', createDto, 'user-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated notifications', async () => {
      // Arrange
      const query = {
        page: 1,
        limit: 10,
        status: NotificationStatus.DELIVERED,
        sortBy: 'createdAt',
        sortOrder: 'DESC' as const,
      };

      const mockNotification = createMockNotification({
        status: NotificationStatus.DELIVERED,
      });

      const mockQueryBuilder = createMockQueryBuilder<Notification>();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockNotification], 1]);
      notificationRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await service.findAll('org-123', query);

      // Assert
      expect(result).toEqual({
        items: [mockNotification],
        total: 1,
      });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'notification.organizationId = :organizationId',
        { organizationId: 'org-123' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'notification.status = :status',
        { status: NotificationStatus.DELIVERED },
      );
    });

    it('should filter by date range', async () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const query = { 
        page: 1,
        limit: 10,
        startDate, 
        endDate,
        sortBy: 'createdAt',
        sortOrder: 'DESC' as const,
      };

      const mockQueryBuilder = createMockQueryBuilder<Notification>();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      notificationRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      await service.findAll('org-123', query);

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'notification.createdAt BETWEEN :startDate AND :endDate',
        { startDate, endDate },
      );
    });
  });

  describe('findOne', () => {
    it('should return a notification by id', async () => {
      // Arrange
      const mockNotification = createMockNotification();
      notificationRepository.findOne.mockResolvedValue(mockNotification);

      // Act
      const result = await service.findOne('org-123', 'notification-123');

      // Assert
      expect(result).toEqual(mockNotification);
      expect(notificationRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: 'notification-123',
          organizationId: 'org-123',
        },
      });
    });

    it('should throw NotFoundException if notification not found', async () => {
      // Arrange
      notificationRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne('org-123', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('cancel', () => {
    it('should cancel a pending notification', async () => {
      // Arrange
      const mockNotification = createMockNotification({
        status: NotificationStatus.PENDING,
      });

      const mockJob = {
        id: 'job-123',
        data: { notificationId: 'notification-123' },
        remove: jest.fn(),
      };

      notificationRepository.findOne.mockResolvedValue(mockNotification);
      const cancelledNotification = createMockNotification({
        ...mockNotification,
        status: NotificationStatus.FAILED,
        lastError: 'Cancelled by user',
      });
      notificationRepository.save.mockResolvedValue(cancelledNotification);
      notificationQueue.getJobs.mockResolvedValue([mockJob as any]);

      // Act
      const result = await service.cancel('org-123', 'notification-123', 'user-123');

      // Assert
      expect(result.status).toBe(NotificationStatus.FAILED);
      expect(result.lastError).toBe('Cancelled by user');
      expect(mockJob.remove).toHaveBeenCalled();
    });

    it('should throw BadRequestException if notification already sent', async () => {
      // Arrange
      const mockNotification = createMockNotification({
        status: NotificationStatus.DELIVERED,
      });
      notificationRepository.findOne.mockResolvedValue(mockNotification);

      // Act & Assert
      await expect(
        service.cancel('org-123', 'notification-123', 'user-123'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStats', () => {
    it('should return notification statistics', async () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockStats = [
        { channel: 'email', status: 'delivered', count: '80' },
        { channel: 'email', status: 'failed', count: '5' },
        { channel: 'email', status: 'pending', count: '10' },
        { channel: 'sms', status: 'delivered', count: '5' },
      ];
      
      const mockEngagement = {
        opened: '48',
        clicked: '24',
      };

      // Create two separate query builders for the two queries
      const statsQueryBuilder = createMockQueryBuilder<Notification>();
      statsQueryBuilder.getRawMany.mockResolvedValue(mockStats);
      
      const engagementQueryBuilder = createMockQueryBuilder<Notification>();
      engagementQueryBuilder.getRawOne.mockResolvedValue(mockEngagement);
      
      // Return different query builders for each call
      notificationRepository.createQueryBuilder
        .mockImplementationOnce(() => statsQueryBuilder)
        .mockImplementationOnce(() => engagementQueryBuilder);

      // Act
      const result = await service.getStats('org-123', startDate, endDate);
      

      // Assert
      expect(result).toEqual({
        total: 100,
        byChannel: {
          email: 95,
          sms: 5,
        },
        byStatus: {
          delivered: 85,
          failed: 5,
          pending: 10,
        },
        deliveryRate: 85,
        openRate: 56.470588235294116,
        clickRate: 28.235294117647058,
      });
    });
  });

  describe('caching', () => {
    it('should use Cacheable decorator for stats', async () => {
      // The @Cacheable decorator is applied to getStats method
      // This test verifies the method exists and can be called
      
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      const mockStats = [
        { channel: 'email', status: 'delivered', count: '50' },
      ];
      
      const mockEngagement = {
        opened: '30',
        clicked: '15',
      };
      
      // Create two separate query builders for the two queries
      const statsQueryBuilder = createMockQueryBuilder<Notification>();
      statsQueryBuilder.getRawMany.mockResolvedValue(mockStats);
      
      const engagementQueryBuilder = createMockQueryBuilder<Notification>();
      engagementQueryBuilder.getRawOne.mockResolvedValue(mockEngagement);
      
      // Return different query builders for each call
      notificationRepository.createQueryBuilder
        .mockImplementationOnce(() => statsQueryBuilder)
        .mockImplementationOnce(() => engagementQueryBuilder);
      
      // Act
      const result = await service.getStats('org-123', startDate, endDate);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.total).toBe(50);
      // The actual caching is handled by the @Cacheable decorator
    });
  });
});