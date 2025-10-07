import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DeliveryStatus,
  type NotificationProvider,
  type NotificationProviderType,
  type ProviderConfig,
  type SendResult,
} from '../interfaces/notification-provider.interface';

export interface InAppConfig extends ProviderConfig {
  provider: 'in-app';
  enableWebSocket: boolean;
  enableSSE: boolean;
  retentionDays: number;
}

export interface InAppContent {
  title: string;
  body: string;
  icon?: string;
  image?: string;
  actions?: InAppAction[];
  data?: Record<string, any>;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
  sound?: string;
  badge?: number;
}

export interface InAppAction {
  id: string;
  label: string;
  url?: string;
  action?: string;
  style?: 'default' | 'primary' | 'danger';
}

export interface InAppRecipient {
  userId: string;
  deviceTokens?: string[];
  preferences?: {
    sound?: boolean;
    vibrate?: boolean;
    badge?: boolean;
  };
}

// This would be imported from entities in a real implementation
interface InAppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  icon?: string;
  image?: string;
  actions?: InAppAction[];
  data?: Record<string, any>;
  priority: string;
  category?: string;
  read: boolean;
  readAt?: Date;
  dismissed: boolean;
  dismissedAt?: Date;
  createdAt: Date;
  expiresAt?: Date;
}

@Injectable()
export class InAppProviderService implements NotificationProvider {
  private readonly logger = new Logger(InAppProviderService.name);
  private config: InAppConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2
    // In a real implementation, this would be injected
    // @InjectRepository(InAppNotification)
    // private readonly inAppRepository: Repository<InAppNotification>,
  ) {
    this.initializeProvider();
  }

  private initializeProvider(): void {
    this.config = {
      provider: 'in-app',
      enableWebSocket: this.configService.get<boolean>('IN_APP_ENABLE_WEBSOCKET', true),
      enableSSE: this.configService.get<boolean>('IN_APP_ENABLE_SSE', true),
      retentionDays: this.configService.get<number>('IN_APP_RETENTION_DAYS', 30),
    };

    this.logger.log('In-app notification provider configured');
  }

  getType(): NotificationProviderType {
    return 'in-app';
  }

  async send(recipient: InAppRecipient, content: InAppContent, options?: any): Promise<SendResult> {
    try {
      // Create in-app notification record
      const notification: Partial<InAppNotification> = {
        userId: recipient.userId,
        title: content.title,
        body: content.body,
        icon: content.icon,
        image: content.image,
        actions: content.actions,
        data: content.data,
        priority: content.priority || 'medium',
        category: content.category,
        read: false,
        dismissed: false,
        createdAt: new Date(),
        expiresAt: options?.expiresAt,
      };

      // In a real implementation, save to database
      // const saved = await this.inAppRepository.save(notification);
      const saved = { ...notification, id: `in-app-${Date.now()}` };

      // Emit real-time event for WebSocket/SSE delivery
      if (this.config.enableWebSocket || this.config.enableSSE) {
        this.emitRealtimeNotification(recipient.userId, saved);
      }

      // Update badge count if specified
      if (content.badge !== undefined) {
        await this.updateBadgeCount(recipient.userId, content.badge);
      }

      // Play sound if enabled
      if (recipient.preferences?.sound && content.sound) {
        this.emitSoundEvent(recipient.userId, content.sound);
      }

      this.logger.log(`In-app notification sent to user ${recipient.userId}`);

      return {
        success: true,
        providerMessageId: saved.id,
        status: DeliveryStatus.DELIVERED,
        providerResponse: {
          notificationId: saved.id,
          deliveredAt: new Date(),
        },
      };
    } catch (error) {
      this.logger.error('Failed to send in-app notification:', error);

      return {
        success: false,
        error: error.message,
        status: DeliveryStatus.FAILED,
      };
    }
  }

  async sendBulk(
    recipients: InAppRecipient[],
    content: InAppContent,
    options?: any
  ): Promise<SendResult[]> {
    const results = await Promise.allSettled(
      recipients.map((recipient) => this.send(recipient, content, options))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          success: false,
          error: result.reason.message,
          status: DeliveryStatus.FAILED,
          recipient: recipients[index],
        };
      }
    });
  }

  async getStatus(providerMessageId: string): Promise<DeliveryStatus> {
    // In-app notifications are delivered immediately
    return DeliveryStatus.DELIVERED;
  }

  async handleWebhook(data: any): Promise<void> {
    // In-app notifications don't typically have webhooks
    // This could be used for client-side events like read receipts
    try {
      const { event, notificationId, userId } = data;

      switch (event) {
        case 'read':
          await this.markAsRead(notificationId, userId);
          break;
        case 'dismissed':
          await this.markAsDismissed(notificationId, userId);
          break;
        case 'action_clicked':
          await this.handleActionClick(notificationId, userId, data.actionId);
          break;
      }
    } catch (error) {
      this.logger.error('Failed to handle in-app event:', error);
    }
  }

  validateRecipient(recipient: InAppRecipient): boolean {
    return !!recipient.userId;
  }

  validateContent(content: InAppContent): boolean {
    return !!(content.title && content.body);
  }

  getConfig(): InAppConfig {
    return this.config;
  }

  isConfigured(): boolean {
    return true; // In-app is always available
  }

  // In-app specific features
  private emitRealtimeNotification(userId: string, notification: any): void {
    // Emit event for WebSocket handler
    this.eventEmitter.emit('in-app.notification.new', {
      userId,
      notification,
    });

    // Also emit for SSE if enabled
    if (this.config.enableSSE) {
      this.eventEmitter.emit('sse.notification.new', {
        userId,
        notification,
      });
    }
  }

  private async updateBadgeCount(userId: string, badge: number): Promise<void> {
    // Update user's unread count
    this.eventEmitter.emit('in-app.badge.update', {
      userId,
      badge,
    });
  }

  private emitSoundEvent(userId: string, sound: string): void {
    this.eventEmitter.emit('in-app.sound.play', {
      userId,
      sound,
    });
  }

  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      // In real implementation:
      // await this.inAppRepository.update(
      //   { id: notificationId, userId },
      //   { read: true, readAt: new Date() }
      // );

      this.eventEmitter.emit('in-app.notification.read', {
        userId,
        notificationId,
      });

      return true;
    } catch (error) {
      this.logger.error(`Failed to mark notification ${notificationId} as read:`, error);
      return false;
    }
  }

  async markAsDismissed(notificationId: string, userId: string): Promise<boolean> {
    try {
      // In real implementation:
      // await this.inAppRepository.update(
      //   { id: notificationId, userId },
      //   { dismissed: true, dismissedAt: new Date() }
      // );

      this.eventEmitter.emit('in-app.notification.dismissed', {
        userId,
        notificationId,
      });

      return true;
    } catch (error) {
      this.logger.error(`Failed to mark notification ${notificationId} as dismissed:`, error);
      return false;
    }
  }

  async handleActionClick(notificationId: string, userId: string, actionId: string): Promise<void> {
    this.eventEmitter.emit('in-app.action.clicked', {
      userId,
      notificationId,
      actionId,
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      // In real implementation:
      // return await this.inAppRepository.count({
      //   where: { userId, read: false, dismissed: false }
      // });
      return 0;
    } catch (error) {
      this.logger.error(`Failed to get unread count for user ${userId}:`, error);
      return 0;
    }
  }

  async getNotifications(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
    }
  ): Promise<InAppNotification[]> {
    try {
      // In real implementation:
      // const query = this.inAppRepository.createQueryBuilder('notification')
      //   .where('notification.userId = :userId', { userId })
      //   .andWhere('notification.expiresAt > :now OR notification.expiresAt IS NULL', { now: new Date() });
      //
      // if (options?.unreadOnly) {
      //   query.andWhere('notification.read = false');
      // }
      //
      // return await query
      //   .orderBy('notification.createdAt', 'DESC')
      //   .limit(options?.limit || 50)
      //   .offset(options?.offset || 0)
      //   .getMany();

      return [];
    } catch (error) {
      this.logger.error(`Failed to get notifications for user ${userId}:`, error);
      return [];
    }
  }

  async cleanupExpiredNotifications(): Promise<number> {
    try {
      // In real implementation:
      // const result = await this.inAppRepository
      //   .createQueryBuilder()
      //   .delete()
      //   .where('expiresAt < :now', { now: new Date() })
      //   .orWhere('createdAt < :cutoff', {
      //     cutoff: new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000)
      //   })
      //   .execute();
      //
      // return result.affected || 0;

      return 0;
    } catch (error) {
      this.logger.error('Failed to cleanup expired notifications:', error);
      return 0;
    }
  }
}
