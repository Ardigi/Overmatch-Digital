import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { CacheService } from '@soc-compliance/cache-common';
import type { Queue } from 'bull';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { KafkaService } from '../../kafka/kafka.service';
import type { UserDataService } from '../services/user-data.service';
import { 
  Notification, 
  NotificationStatus,
  NotificationChannel,
  NotificationType,
  NotificationPriority,
  NotificationCategory
} from '../entities/notification.entity';
import { NotificationPreference } from '../entities/notification-preference.entity';
import { NotificationTemplate } from '../entities/notification-template.entity';

// Type-safe mock factories
export function createMockRepository<T>(): jest.Mocked<Repository<T>> {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    findOneOrFail: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
    query: jest.fn(),
    clear: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
    hasId: jest.fn(),
    getId: jest.fn(),
    metadata: {
      targetName: 'MockEntity',
      connection: {} as any, // Only place we use 'as any' - for complex metadata
      columns: [],
      relations: [],
    },
    target: {} as any,
    manager: {} as any,
    queryRunner: undefined,
  } as unknown as jest.Mocked<Repository<T>>;
}

export function createMockQueryBuilder<T>(): jest.Mocked<SelectQueryBuilder<T>> {
  const mockQueryBuilder: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    having: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getOne: jest.fn(),
    getManyAndCount: jest.fn(),
    getCount: jest.fn(),
    getRawMany: jest.fn(),
    getRawOne: jest.fn(),
    execute: jest.fn(),
  };
  return mockQueryBuilder;
}

export function createMockQueue(): jest.Mocked<Queue> {
  return {
    add: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    count: jest.fn(),
    empty: jest.fn(),
    clean: jest.fn(),
    close: jest.fn(),
    removeJobs: jest.fn(),
    getJob: jest.fn(),
    getJobs: jest.fn(),
    getJobCounts: jest.fn(),
    getCompletedCount: jest.fn(),
    getFailedCount: jest.fn(),
    getDelayedCount: jest.fn(),
    getActiveCount: jest.fn(),
    getWaitingCount: jest.fn(),
    getPausedCount: jest.fn(),
    getWaiting: jest.fn(),
    getActive: jest.fn(),
    getDelayed: jest.fn(),
    getCompleted: jest.fn(),
    getFailed: jest.fn(),
    process: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    off: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    emit: jest.fn(),
    addListener: jest.fn(),
    setMaxListeners: jest.fn(),
    getMaxListeners: jest.fn(),
    listeners: jest.fn(),
    rawListeners: jest.fn(),
    listenerCount: jest.fn(),
    prependListener: jest.fn(),
    prependOnceListener: jest.fn(),
    eventNames: jest.fn(),
  } as unknown as jest.Mocked<Queue>;
}

export function createMockConfigService(): jest.Mocked<ConfigService> {
  return {
    get: jest.fn(),
    getOrThrow: jest.fn(),
    set: jest.fn(),
  } as unknown as jest.Mocked<ConfigService>;
}

export function createMockKafkaService(): jest.Mocked<KafkaService> {
  return {
    emit: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<KafkaService>;
}

export function createMockUserDataService(): jest.Mocked<UserDataService> {
  return {
    getUserById: jest.fn(),
    getUsersByIds: jest.fn(),
    getUserByEmail: jest.fn(),
    getUsersByOrganization: jest.fn(),
    validateUserAccess: jest.fn(),
    getUserPreferences: jest.fn(),
  } as unknown as jest.Mocked<UserDataService>;
}

export function createMockEventEmitter(): jest.Mocked<EventEmitter2> {
  return {
    emit: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    off: jest.fn(),
    addListener: jest.fn(),
    prependListener: jest.fn(),
    prependOnceListener: jest.fn(),
    eventNames: jest.fn(),
    listeners: jest.fn(),
    listenerCount: jest.fn(),
    getMaxListeners: jest.fn(),
    setMaxListeners: jest.fn(),
    rawListeners: jest.fn(),
  } as unknown as jest.Mocked<EventEmitter2>;
}

export function createMockCacheService(): jest.Mocked<CacheService> {
  return {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    flush: jest.fn(),
    isHealthy: jest.fn(),
    getStats: jest.fn(),
    mget: jest.fn(),
    mset: jest.fn(),
    keys: jest.fn(),
    ttl: jest.fn(),
    expire: jest.fn(),
  } as unknown as jest.Mocked<CacheService>;
}

// Mock entity factories
export function createMockNotification(overrides?: Partial<Notification>): Notification {
  const notification = new Notification();
  notification.id = 'notification-123';
  notification.organizationId = 'org-123';
  notification.notificationId = 'notif_test123';
  notification.recipientId = 'user-123';
  notification.templateId = 'template-123';
  notification.channel = NotificationChannel.EMAIL;
  notification.type = NotificationType.TRANSACTIONAL;
  notification.recipient = {
    id: 'user-123',
    userId: 'user-123',
    email: 'user@example.com',
    name: 'Test User',
  };
  notification.content = {
    subject: 'Test Subject',
    body: 'Test Body',
    htmlBody: '<p>Test Body</p>',
  };
  notification.status = NotificationStatus.PENDING;
  notification.priority = NotificationPriority.MEDIUM;
  notification.category = NotificationCategory.SYSTEM;
  notification.scheduledFor = null;
  notification.sentAt = null;
  notification.deliveredAt = null;
  notification.openedAt = null;
  notification.clickedAt = null;
  notification.lastError = null;
  notification.retryCount = 0;
  notification.openCount = 0;
  notification.clickCount = 0;
  notification.deliveryAttemptsCount = 0;
  notification.isTransactional = false;
  notification.metadata = {};
  notification.tags = [];
  notification.createdAt = new Date('2024-01-01');
  notification.updatedAt = new Date('2024-01-01');
  notification.createdBy = 'user-123';
  
  return Object.assign(notification, overrides);
}

export function createMockTemplate(overrides?: Partial<NotificationTemplate>): NotificationTemplate {
  const template = new NotificationTemplate();
  template.id = 'template-123';
  template.organizationId = 'org-123';
  template.name = 'Welcome Email';
  template.code = 'welcome_email';
  template.description = 'Welcome email for new users';
  template.channel = NotificationChannel.EMAIL;
  template.type = NotificationType.TRANSACTIONAL;
  template.category = NotificationCategory.USER;
  template.content = {
    subject: 'Welcome to {{company}}!',
    body: 'Hi {{firstName}}, Welcome to {{company}}!',
    htmlBody: '<h1>Hi {{firstName}}</h1><p>Welcome to {{company}}!</p>',
    variables: {
      firstName: { name: 'firstName', type: 'string', required: true },
      company: { name: 'company', type: 'string', required: true },
    },
  };
  template.metadata = {
    tags: ['onboarding', 'welcome'],
  };
  template.isActive = true;
  template.version = 1;
  template.createdAt = new Date('2024-01-01');
  template.updatedAt = new Date('2024-01-01');
  template.createdBy = 'user-123';
  
  return Object.assign(template, overrides);
}

export function createMockPreference(overrides?: Partial<NotificationPreference>): NotificationPreference {
  const preference = new NotificationPreference();
  preference.id = 'pref-123';
  preference.organizationId = 'org-123';
  preference.userId = 'user-123';
  preference.userEmail = 'user@example.com';
  preference.channels = {
    [NotificationChannel.EMAIL]: { enabled: true },
    [NotificationChannel.SMS]: { enabled: false },
    [NotificationChannel.IN_APP]: { enabled: true },
    [NotificationChannel.SLACK]: { enabled: false },
    [NotificationChannel.TEAMS]: { enabled: false },
    [NotificationChannel.WEBHOOK]: { enabled: false },
  };
  preference.doNotDisturb = {
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
    timezone: 'UTC',
  };
  preference.stats = {
    received: 0,
    opened: 0,
    clicked: 0,
    optedOut: 0,
  };
  preference.optedOut = false;
  preference.unsubscribeToken = 'unsub-token-123';
  preference.createdAt = new Date('2024-01-01');
  preference.updatedAt = new Date('2024-01-01');
  
  // Add the method that tests expect
  preference.canReceiveNotification = jest.fn().mockReturnValue({ allowed: true });
  
  return Object.assign(preference, overrides);
}