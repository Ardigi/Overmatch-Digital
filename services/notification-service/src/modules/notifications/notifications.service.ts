import { InjectQueue } from '@nestjs/bull';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Cacheable, type CacheService } from '@soc-compliance/cache-common';
import {
  EventType,
  type NotificationDeliveredEvent,
  type NotificationFailedEvent,
  type NotificationSentEvent,
} from '@soc-compliance/events';
import type { Queue } from 'bull';
import { Between, In, Like, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { KafkaService } from '../kafka/kafka.service';
import type {
  CreateBulkNotificationDto,
  CreateNotificationDto,
  QueryNotificationDto,
  UpdateNotificationDto,
} from './dto';
import { 
  Notification, 
  NotificationStatus,
  NotificationChannel,
  NotificationPriority
} from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import type { UserDataService } from './services/user-data.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationTemplate)
    private readonly templateRepository: Repository<NotificationTemplate>,
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepository: Repository<NotificationPreference>,
    @InjectQueue('notifications')
    private readonly notificationQueue: Queue,
    private readonly configService: ConfigService,
    private readonly kafkaService: KafkaService,
    private readonly userDataService: UserDataService,
    private readonly eventEmitter: EventEmitter2,
    private readonly cacheService: CacheService,
  ) {}

  async create(
    organizationId: string,
    createDto: CreateNotificationDto,
    createdBy: string,
  ): Promise<Notification> {
    // Enrich recipient data if needed
    const enrichedDto = await this.enrichRecipientData(createDto);
    
    // Validate recipient based on channel
    this.validateRecipient(enrichedDto.channel, enrichedDto.recipient);

    // Check user preferences
    const preference = await this.preferenceRepository.findOne({
      where: {
        organizationId,
        userId: enrichedDto.recipient.id,
      },
    });

    if (preference) {
      const canReceive = preference.canReceiveNotification(
        enrichedDto.channel,
        enrichedDto.type,
        enrichedDto.category,
        createdBy,
        enrichedDto.context?.source,
      );

      if (!canReceive.allowed) {
        this.logger.warn(
          `Notification blocked for user ${enrichedDto.recipient.id}: ${canReceive.reason}`,
        );
        throw new BadRequestException(canReceive.reason);
      }
    }

    // Get template if specified
    let content = enrichedDto.content;
    if (enrichedDto.templateId) {
      const template = await this.templateRepository.findOne({
        where: {
          id: enrichedDto.templateId,
          organizationId,
          isActive: true,
        },
      });

      if (!template) {
        throw new NotFoundException('Template not found');
      }

      // Validate variables
      const validation = template.validateVariables(enrichedDto.variables || {});
      if (!validation.valid) {
        throw new BadRequestException({
          message: 'Invalid template variables',
          errors: validation.errors,
        });
      }

      // Interpolate template
      content = template.interpolate(enrichedDto.variables || {});
      template.recordUsage();
      await this.templateRepository.save(template);
    }

    if (!content) {
      throw new BadRequestException('Content is required when not using a template');
    }

    // Create notification
    const notification = this.notificationRepository.create({
      organizationId,
      channel: enrichedDto.channel,
      type: enrichedDto.type,
      priority: enrichedDto.priority,
      category: enrichedDto.category,
      templateId: enrichedDto.templateId,
      recipient: enrichedDto.recipient,
      recipientId: enrichedDto.recipient.id,
      content,
      variables: enrichedDto.variables,
      scheduledFor: enrichedDto.scheduledFor,
      groupId: enrichedDto.groupId,
      batchId: enrichedDto.batchId,
      isTransactional: enrichedDto.isTransactional,
      expiresAt: enrichedDto.expiresAt,
      tags: enrichedDto.tags,
      context: enrichedDto.context,
      createdBy,
    });

    const savedNotification = await this.notificationRepository.save(notification);

    // Queue for delivery
    await this.queueNotification(savedNotification);

    // Emit event
    await this.kafkaService.emit('notification.created', {
      id: savedNotification.id,
      organizationId,
      channel: savedNotification.channel,
      type: savedNotification.type,
      recipientId: savedNotification.recipientId,
    });

    return savedNotification;
  }

  async createBulk(
    organizationId: string,
    createDto: CreateBulkNotificationDto,
    createdBy: string,
  ): Promise<Notification[]> {
    const batchId = createDto.batchId || `batch_${uuidv4()}`;
    const notifications: Notification[] = [];

    for (const notificationDto of createDto.notifications) {
      try {
        const notification = await this.create(
          organizationId,
          {
            ...notificationDto,
            batchId,
          },
          createdBy,
        );
        notifications.push(notification);
      } catch (error) {
        this.logger.error(
          `Failed to create notification for recipient ${notificationDto.recipient.id}:`,
          error,
        );
      }
    }

    return notifications;
  }

  async findAll(
    organizationId: string,
    query: QueryNotificationDto,
  ): Promise<{ items: Notification[]; total: number }> {
    const queryBuilder = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.organizationId = :organizationId', { organizationId });

    if (query.channel) {
      queryBuilder.andWhere('notification.channel = :channel', {
        channel: query.channel,
      });
    }

    if (query.type) {
      queryBuilder.andWhere('notification.type = :type', { type: query.type });
    }

    if (query.priority) {
      queryBuilder.andWhere('notification.priority = :priority', {
        priority: query.priority,
      });
    }

    if (query.status) {
      queryBuilder.andWhere('notification.status = :status', {
        status: query.status,
      });
    }

    if (query.category) {
      queryBuilder.andWhere('notification.category = :category', {
        category: query.category,
      });
    }

    if (query.recipientId) {
      queryBuilder.andWhere('notification.recipientId = :recipientId', {
        recipientId: query.recipientId,
      });
    }

    if (query.groupId) {
      queryBuilder.andWhere('notification.groupId = :groupId', {
        groupId: query.groupId,
      });
    }

    if (query.batchId) {
      queryBuilder.andWhere('notification.batchId = :batchId', {
        batchId: query.batchId,
      });
    }

    if (query.startDate && query.endDate) {
      queryBuilder.andWhere('notification.createdAt BETWEEN :startDate AND :endDate', {
        startDate: query.startDate,
        endDate: query.endDate,
      });
    }

    if (query.search) {
      queryBuilder.andWhere(
        '(notification.content::text ILIKE :search OR notification.notificationId ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [items, total] = await queryBuilder
      .orderBy(`notification.${query.sortBy}`, query.sortOrder)
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    return { items, total };
  }

  async findOne(
    organizationId: string,
    id: string,
  ): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id, organizationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  async update(
    organizationId: string,
    id: string,
    updateDto: UpdateNotificationDto,
    updatedBy: string,
  ): Promise<Notification> {
    const notification = await this.findOne(organizationId, id);

    Object.assign(notification, {
      ...updateDto,
      updatedBy,
    });

    return await this.notificationRepository.save(notification);
  }

  async cancel(
    organizationId: string,
    id: string,
    updatedBy: string,
  ): Promise<Notification> {
    const notification = await this.findOne(organizationId, id);

    if (notification.status !== NotificationStatus.PENDING) {
      throw new BadRequestException('Can only cancel pending notifications');
    }

    notification.status = NotificationStatus.FAILED;
    notification.lastError = 'Cancelled by user';
    notification.updatedBy = updatedBy;

    const updated = await this.notificationRepository.save(notification);

    // Remove from queue if queued
    const jobs = await this.notificationQueue.getJobs(['waiting', 'delayed']);
    for (const job of jobs) {
      if (job.data.notificationId === id) {
        await job.remove();
        break;
      }
    }

    return updated;
  }

  async resend(
    organizationId: string,
    id: string,
    updatedBy: string,
  ): Promise<Notification> {
    const notification = await this.findOne(organizationId, id);

    if (![NotificationStatus.FAILED, NotificationStatus.BOUNCED].includes(notification.status)) {
      throw new BadRequestException('Can only resend failed or bounced notifications');
    }

    notification.status = NotificationStatus.PENDING;
    notification.lastError = null;
    notification.updatedBy = updatedBy;

    const updated = await this.notificationRepository.save(notification);
    await this.queueNotification(updated);

    return updated;
  }

  async recordOpen(
    organizationId: string,
    id: string,
    ip?: string,
    userAgent?: string,
  ): Promise<void> {
    const notification = await this.findOne(organizationId, id);
    
    notification.recordOpen(ip, userAgent);
    await this.notificationRepository.save(notification);

    await this.kafkaService.emit('notification.opened', {
      id: notification.id,
      organizationId,
      recipientId: notification.recipientId,
      openCount: notification.openCount,
    });
  }

  async recordClick(
    organizationId: string,
    id: string,
    url: string,
    ip?: string,
    userAgent?: string,
  ): Promise<void> {
    const notification = await this.findOne(organizationId, id);
    
    notification.recordClick(url, ip, userAgent);
    await this.notificationRepository.save(notification);

    await this.kafkaService.emit('notification.clicked', {
      id: notification.id,
      organizationId,
      recipientId: notification.recipientId,
      clickCount: notification.clickCount,
      url,
    });
  }

  @Cacheable({
    key: 'stats',
    ttl: 300, // Cache for 5 minutes
    service: 'notification',
    enableLogging: true,
  })
  async getStats(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    const stats = await this.notificationRepository
      .createQueryBuilder('notification')
      .select('notification.channel', 'channel')
      .addSelect('notification.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('notification.organizationId = :organizationId', { organizationId })
      .andWhere('notification.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('notification.channel')
      .addGroupBy('notification.status')
      .getRawMany();

    const summary = {
      total: 0,
      byChannel: {},
      byStatus: {},
      deliveryRate: 0,
      openRate: 0,
      clickRate: 0,
    };

    stats.forEach((stat) => {
      const count = parseInt(stat.count);
      summary.total += count;

      if (!summary.byChannel[stat.channel]) {
        summary.byChannel[stat.channel] = 0;
      }
      summary.byChannel[stat.channel] += count;

      if (!summary.byStatus[stat.status]) {
        summary.byStatus[stat.status] = 0;
      }
      summary.byStatus[stat.status] += count;
    });

    if (summary.total > 0) {
      summary.deliveryRate =
        ((summary.byStatus[NotificationStatus.DELIVERED] || 0) / summary.total) * 100;
    }

    // Calculate engagement rates
    const engagementStats = await this.notificationRepository
      .createQueryBuilder('notification')
      .select('SUM(CASE WHEN notification.openCount > 0 THEN 1 ELSE 0 END)', 'opened')
      .addSelect('SUM(CASE WHEN notification.clickCount > 0 THEN 1 ELSE 0 END)', 'clicked')
      .where('notification.organizationId = :organizationId', { organizationId })
      .andWhere('notification.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('notification.status = :status', {
        status: NotificationStatus.DELIVERED,
      })
      .getRawOne();

    const delivered = summary.byStatus[NotificationStatus.DELIVERED] || 0;
    if (delivered > 0) {
      summary.openRate = (parseInt(engagementStats.opened) / delivered) * 100;
      summary.clickRate = (parseInt(engagementStats.clicked) / delivered) * 100;
    }

    return summary;
  }

  /**
   * Enrich notification recipient data with user information from auth-service
   */
  async enrichRecipientData(notification: CreateNotificationDto): Promise<CreateNotificationDto> {
    try {
      // If recipient already has complete data, skip enrichment
      if (notification.recipient.email || notification.recipient.phone) {
        return notification;
      }

      // Fetch user data from auth-service
      const userData = await this.userDataService.getUserById(notification.recipient.id);
      if (!userData) {
        this.logger.warn(`Could not fetch user data for recipient: ${notification.recipient.id}`);
        return notification;
      }

      // Enrich recipient data
      const enrichedNotification = {
        ...notification,
        recipient: {
          ...notification.recipient,
          email: userData.email,
          phone: userData.phone,
          firstName: userData.firstName,
          lastName: userData.lastName,
        },
      };

      this.logger.debug(`Enriched recipient data for user: ${userData.email}`);
      return enrichedNotification;
    } catch (error) {
      this.logger.error('Failed to enrich recipient data', error);
      return notification;
    }
  }

  /**
   * Validate user access to organization
   */
  async validateUserOrganizationAccess(
    userId: string,
    organizationId: string,
  ): Promise<boolean> {
    try {
      return await this.userDataService.validateUserAccess(userId, organizationId);
    } catch (error) {
      this.logger.error('Failed to validate user organization access', error);
      return false;
    }
  }

  /**
   * Get organization notification settings
   */
  async getOrganizationNotificationSettings(organizationId: string): Promise<any> {
    try {
      const orgData = await this.userDataService.getOrganizationById(organizationId);
      return orgData?.settings?.notifications || {
        enabled: true,
        channels: ['email', 'in-app'],
      };
    } catch (error) {
      this.logger.error('Failed to get organization notification settings', error);
      return {
        enabled: true,
        channels: ['email', 'in-app'],
      };
    }
  }

  private validateRecipient(channel: string, recipient: any): void {
    switch (channel) {
      case 'email':
        if (!recipient.email) {
          throw new BadRequestException('Email is required for email notifications');
        }
        break;
      case 'sms':
        if (!recipient.phone) {
          throw new BadRequestException('Phone number is required for SMS notifications');
        }
        break;
      case 'slack':
        if (!recipient.slackUserId) {
          throw new BadRequestException('Slack user ID is required for Slack notifications');
        }
        break;
      case 'teams':
        if (!recipient.teamsUserId) {
          throw new BadRequestException('Teams user ID is required for Teams notifications');
        }
        break;
      case 'webhook':
        if (!recipient.webhookUrl) {
          throw new BadRequestException('Webhook URL is required for webhook notifications');
        }
        break;
    }
  }

  private async queueNotification(notification: Notification): Promise<void> {
    const delay = notification.isScheduled
      ? notification.scheduledFor.getTime() - Date.now()
      : 0;

    await this.notificationQueue.add(
      'send-notification',
      {
        notificationId: notification.id,
        organizationId: notification.organizationId,
      },
      {
        delay,
        priority: this.getPriorityValue(notification.priority),
        attempts: notification.priority === 'urgent' ? 5 : 3,
      },
    );

    notification.markAsQueued();
    await this.notificationRepository.save(notification);
  }

  private getPriorityValue(priority: string): number {
    const priorityMap = {
      urgent: 1,
      high: 2,
      medium: 3,
      low: 4,
    };
    return priorityMap[priority] || 3;
  }

  async markNotificationAsSent(
    notificationId: string,
    organizationId: string,
    result: {
      providerMessageId?: string;
      providerResponse?: any;
    } = {}
  ): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, organizationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.markAsSent(result.providerMessageId, result.providerResponse);
    const updatedNotification = await this.notificationRepository.save(notification);

    // Emit standardized notification sent event
    const notificationSentEvent: NotificationSentEvent = {
      id: uuidv4(),
      type: EventType.NOTIFICATION_SENT,
      timestamp: new Date(),
      version: '1.0',
      source: 'notification-service',
      userId: notification.createdBy,
      organizationId,
      payload: {
        notificationId: updatedNotification.id,
        channel: updatedNotification.channel,
        recipientId: updatedNotification.recipientId,
        organizationId,
        sentBy: 'system',
        providerMessageId: result.providerMessageId,
      },
    };

    this.eventEmitter.emit('notification.sent', notificationSentEvent);
    this.logger.log(`Emitted notification.sent event for notification ${updatedNotification.id}`);

    return updatedNotification;
  }

  async markNotificationAsDelivered(
    notificationId: string,
    organizationId: string
  ): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, organizationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.markAsDelivered();
    const updatedNotification = await this.notificationRepository.save(notification);

    // Emit standardized notification delivered event
    const notificationDeliveredEvent: NotificationDeliveredEvent = {
      id: uuidv4(),
      type: EventType.NOTIFICATION_DELIVERED,
      timestamp: new Date(),
      version: '1.0',
      source: 'notification-service',
      userId: notification.createdBy,
      organizationId,
      payload: {
        notificationId: updatedNotification.id,
        channel: updatedNotification.channel,
        recipientId: updatedNotification.recipientId,
        organizationId,
        sentBy: 'system',
        deliveredAt: updatedNotification.deliveredAt,
      },
    };

    this.eventEmitter.emit('notification.delivered', notificationDeliveredEvent);
    this.logger.log(`Emitted notification.delivered event for notification ${updatedNotification.id}`);

    return updatedNotification;
  }

  async markNotificationAsFailed(
    notificationId: string,
    organizationId: string,
    error: string
  ): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, organizationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.markAsFailed(error);
    const updatedNotification = await this.notificationRepository.save(notification);

    // Emit standardized notification failed event
    const notificationFailedEvent: NotificationFailedEvent = {
      id: uuidv4(),
      type: EventType.NOTIFICATION_FAILED,
      timestamp: new Date(),
      version: '1.0',
      source: 'notification-service',
      userId: notification.createdBy,
      organizationId,
      payload: {
        notificationId: updatedNotification.id,
        channel: updatedNotification.channel,
        recipientId: updatedNotification.recipientId,
        organizationId,
        error,
        retryCount: updatedNotification.retryCount || 0,
      },
    };

    this.eventEmitter.emit('notification.failed', notificationFailedEvent);
    this.logger.log(`Emitted notification.failed event for notification ${updatedNotification.id}`);

    return updatedNotification;
  }

  async createFromTemplate(
    organizationId: string,
    data: {
      templateCode?: string;
      templateId?: string;
      channel: string;
      recipient: any;
      variables?: Record<string, any>;
      priority?: string;
      metadata?: Record<string, any>;
      tags?: string[];
    },
    createdBy: string,
  ): Promise<Notification> {
    let template: NotificationTemplate | null = null;

    // Find template by code or ID
    if (data.templateCode) {
      template = await this.templateRepository.findOne({
        where: {
          organizationId,
          code: data.templateCode,
          isActive: true,
        },
      });
    } else if (data.templateId) {
      template = await this.templateRepository.findOne({
        where: {
          id: data.templateId,
          organizationId,
          isActive: true,
        },
      });
    }

    if (!template) {
      throw new NotFoundException(
        `Template not found: ${data.templateCode || data.templateId}`,
      );
    }

    // Validate variables against template
    const validation = template.validateVariables(data.variables || {});
    if (!validation.valid) {
      throw new BadRequestException(
        `Invalid template variables: ${validation.errors.join(', ')}`,
      );
    }

    // Interpolate template content
    const content = template.interpolate(data.variables || {});

    // Create notification
    return await this.create(
      organizationId,
      {
        channel: (data.channel || template.channel) as NotificationChannel,
        type: template.type,
        category: template.category,
        recipient: data.recipient,
        content,
        variables: data.variables,
        priority: (data.priority || 
          (typeof template.priority === 'number' ? 'medium' : template.priority) || 
          'medium') as NotificationPriority,
        metadata: {
          ...data.metadata,
          templateId: template.id,
          templateCode: template.code,
          templateVersion: template.version,
        },
        tags: [...(data.tags || []), `template:${template.code}`],
        isTransactional: template.isTransactional,
      },
      createdBy,
    );
  }

  async createBulkFromTemplate(
    organizationId: string,
    data: {
      templateCode?: string;
      templateId?: string;
      channel: string;
      recipients: any[];
      variables?: Record<string, any>;
      recipientVariables?: Record<string, Record<string, any>>;
      priority?: string;
      metadata?: Record<string, any>;
      tags?: string[];
    },
    createdBy: string,
  ): Promise<Notification[]> {
    const notifications = await Promise.all(
      data.recipients.map(async (recipient) => {
        const recipientVars = data.recipientVariables?.[recipient.id] || {};
        const mergedVariables = {
          ...data.variables,
          ...recipientVars,
        };

        return await this.createFromTemplate(
          organizationId,
          {
            templateCode: data.templateCode,
            templateId: data.templateId,
            channel: data.channel,
            recipient,
            variables: mergedVariables,
            priority: data.priority,
            metadata: data.metadata,
            tags: data.tags,
          },
          createdBy,
        );
      }),
    );

    return notifications;
  }
}